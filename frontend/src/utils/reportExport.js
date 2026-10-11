export function reportCsv({ headers, rows }) {
  const cell = value => {
    const text = String(value ?? '')
    return '"' + (/^\s*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"'
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
}

export async function createReportFile(format, report) {
  const { title, description = '', headers, rows } = report
  if (format === 'csv') return new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' })
  if (format === 'pdf') {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const document = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' })
    document.setFont('helvetica', 'bold').setFontSize(18).setTextColor(61, 40, 29)
    document.text(title, 14, 20)
    document.setFont('helvetica', 'normal').setFontSize(10)
    const context = document.splitTextToSize(description, document.internal.pageSize.getWidth() - 28)
    document.text(context, 14, 28)
    autoTable(document, {
      startY: 32 + context.length * 5,
      head: [headers], body: rows.length ? rows : [['No matching records.']],
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [247, 234, 213], textColor: [118, 82, 55] },
      alternateRowStyles: { fillColor: [255, 250, 244] },
      margin: { bottom: 18 },
      didDrawPage: () => {
        document.setFontSize(9).setTextColor(138, 114, 95)
        document.text(`Page ${document.internal.getCurrentPageInfo().pageNumber}`, 14, document.internal.pageSize.getHeight() - 9)
      }
    })
    return document.output('blob')
  }
  if (format === 'docx') {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, PageOrientation } = await import('docx')
    const paragraph = (text, bold = false) => new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold, font: 'Arial', size: 20, color: '3D281D' })] })
    const tableRow = (cells, heading = false) => new TableRow({
      tableHeader: heading,
      children: cells.map(text => new TableCell({
        children: [paragraph(text, heading)],
        ...(heading ? { shading: { fill: 'F7EAD5' } } : {}),
        margins: { top: 100, bottom: 100, left: 100, right: 100 }
      }))
    })
    const document = new Document({ sections: [{
      properties: { page: { size: { orientation: headers.length > 5 ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, font: 'Arial', size: 32, color: '3D281D' })], spacing: { after: 180 } }),
        paragraph(description), new Paragraph({ text: '', spacing: { after: 120 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [tableRow(headers, true), ...rows.map(row => tableRow(row))] }),
        ...(!rows.length ? [paragraph('No matching records.')] : [])
      ]
    }] })
    return Packer.toBlob(document)
  }
  throw new Error('Unsupported export format.')
}

export function downloadReport(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
