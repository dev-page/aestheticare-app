import { normalizeContractAppearance } from '../../../shared/clientContract.js'

const colorToRgb = color => {
  const value = String(color || '#000000').replace('#', '')
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16) || 0)
}

const plainText = value => String(value ?? '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\r\n?/g, '\n')
  .replace(/\t/g, '    ')

/** Build a printable PDF from the same structured agreement used by the page preview. */
export async function createClientContractPdf(document = {}) {
  const [{ jsPDF }] = await Promise.all([import('jspdf')])
  const appearance = normalizeContractAppearance(document?.appearance)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  const contentBottom = pageHeight - 20
  const headingColor = colorToRgb(appearance.headingColor)
  const accentColor = colorToRgb(appearance.accentColor)
  const bodyColor = [53, 42, 36]
  const fontFace = appearance.font === 'serif' || appearance.font === 'classic' ? 'times' : 'helvetica'
  const bodyFontSize = Math.max(9, Math.round(appearance.fontSize * 0.75))
  const bodyLineHeight = bodyFontSize * 0.3528 * 1.65
  const sectionGap = Math.max(5, appearance.spacing * 0.3)
  let y = 18

  pdf.setProperties({ title: String(document?.title || 'Client treatment agreement'), subject: 'Clinic client agreement' })

  const addPage = () => {
    pdf.addPage()
    y = 18
  }

  const ensureSpace = height => {
    if (y + height > contentBottom) addPage()
  }

  const writeLines = (value, { fontSize = bodyFontSize, style = 'normal', color = bodyColor, indent = 0, after = 0 } = {}) => {
    const text = plainText(value).trim()
    if (!text) return
    const lineHeight = fontSize * 0.3528 * 1.65
    pdf.setFont(fontFace, style)
    pdf.setFontSize(fontSize)
    pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(text, contentWidth - indent)

    lines.forEach((line, index) => {
      ensureSpace(lineHeight)
      const alignment = appearance.alignment === 'center'
        ? 'center'
        : appearance.alignment === 'justify' && index < lines.length - 1
          ? 'justify'
          : 'left'
      const x = alignment === 'center' ? pageWidth / 2 : margin + indent
      pdf.text(line, x, y, { align: alignment, maxWidth: contentWidth - indent })
      y += lineHeight
    })
    y += after
  }

  const title = String(document?.title || 'Client treatment agreement').trim()
  pdf.setFillColor(...accentColor)
  pdf.roundedRect(margin, y, 13, 2, 1, 1, 'F')
  y += 10
  writeLines(title, { fontSize: Math.max(17, bodyFontSize + 6), style: 'bold', color: headingColor, after: 3 })
  pdf.setDrawColor(...accentColor)
  pdf.setLineWidth(0.7)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 7

  if (document?.intro) writeLines(document.intro, { color: bodyColor, after: sectionGap })

  for (const section of Array.isArray(document?.sections) ? document.sections : []) {
    const titleText = String(section?.title || '').trim()
    if (titleText) {
      ensureSpace(bodyLineHeight * 2)
      y += sectionGap
      writeLines(titleText, { fontSize: bodyFontSize + 1, style: 'bold', color: headingColor, after: 1.5 })
    }

    const lines = plainText(section?.text).split('\n')
    let paragraph = []
    const flushParagraph = () => {
      if (!paragraph.length) return
      writeLines(paragraph.join(' '), { color: bodyColor, after: 2 })
      paragraph = []
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        flushParagraph()
        continue
      }
      const bullet = section?.formatted === true && /^[-*]\s+/.test(line)
      if (bullet) {
        flushParagraph()
        writeLines(`- ${line.replace(/^[-*]\s+/, '')}`, { color: bodyColor, indent: 3, after: 1 })
      } else if (section?.formatted === true) {
        flushParagraph()
        writeLines(line, { color: bodyColor, after: 2 })
      } else {
        paragraph.push(line)
      }
    }
    flushParagraph()
  }

  if (document?.acknowledgement) {
    y += sectionGap
    ensureSpace(bodyLineHeight * 2 + 8)
    pdf.setDrawColor(...accentColor)
    pdf.setLineWidth(0.35)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6
    writeLines(document.acknowledgement, { style: 'italic', color: headingColor })
  }

  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(...accentColor)
    pdf.setLineWidth(0.25)
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
    pdf.setFont(fontFace, 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(115, 95, 78)
    pdf.text('AesthetiCare | Client treatment agreement', margin, pageHeight - 9)
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: 'right' })
  }

  return pdf.output('blob')
}
