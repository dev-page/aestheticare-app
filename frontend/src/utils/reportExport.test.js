import test from 'node:test'
import assert from 'node:assert/strict'
import { createReportFile, reportCsv } from './reportExport.js'

const report = {
  title: 'Receiving & Inspection', description: 'Main Branch | Generated 2026-10-11 | 1 record',
  headers: ['Reference', 'Supplier', 'Status'],
  rows: [['PO-001', 'Supplier, Inc.', 'Delivered']]
}

test('CSV preserves headers on empty reports, quotes values, and prevents spreadsheet formulas', () => {
  assert.equal(reportCsv({ ...report, rows: [] }), '\uFEFF"Reference","Supplier","Status"')
  assert.match(reportCsv(report), /"Supplier, Inc\."/)
  const csv = reportCsv({ headers: ['Name'], rows: [['=SUM(1,2)'], ['"quoted"'], ['Two\nlines']] })
  assert.ok(csv.includes('"\'=SUM(1,2)"'))
  assert.ok(csv.includes('"""quoted"""'))
  assert.ok(csv.includes('"Two\nlines"'))
})

test('PDF generates a real, paginated document for filtered rows', async () => {
  const file = await createReportFile('pdf', { ...report, rows: Array.from({ length: 100 }, (_, index) => ['PO-' + index, 'Supplier', 'Delivered']) })
  const contents = Buffer.from(await file.arrayBuffer()).toString('latin1')
  assert.ok(contents.startsWith('%PDF-'))
  assert.ok(contents.includes('Receiving & Inspection'))
  assert.match(contents, /\/Count [2-9]/)
})

test('Word generates a real DOCX package and supports empty reports', async () => {
  for (const rows of [report.rows, []]) {
    const file = await createReportFile('docx', { ...report, rows })
    const contents = Buffer.from(await file.arrayBuffer())
    assert.equal(contents.subarray(0, 2).toString(), 'PK')
    assert.ok(contents.includes(Buffer.from('word/document.xml')))
  }
})
