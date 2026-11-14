import crypto from 'node:crypto'
import { jsPDF } from 'jspdf'
import { CLINIC_PLATFORM_AGREEMENT } from '../../shared/clinicPlatformAgreement.js'

const cleanText = (value, maxLength = 500) => String(value ?? '').trim().slice(0, maxLength)

const dateLabel = (value) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'long',
  timeZone: 'Asia/Manila',
}).format(value)

export const clinicAgreementTextHash = () => crypto
  .createHash('sha256')
  .update(JSON.stringify(CLINIC_PLATFORM_AGREEMENT))
  .digest('hex')

export const createClinicAgreementPdf = ({
  clinicName,
  companyName,
  signerName,
  signerEmail,
  signerPosition,
  signatureImage,
  signedAt,
  acceptanceId,
}) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 52
  const contentWidth = pageWidth - (margin * 2)
  const bottom = pageHeight - margin
  let y = margin

  const ensureSpace = (height) => {
    if (y + height <= bottom) return
    pdf.addPage()
    y = margin
  }

  const writeParagraph = (value, { size = 10, bold = false, indent = 0, after = 9 } = {}) => {
    const text = cleanText(value)
    if (!text) return
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const width = contentWidth - indent
    const lines = pdf.splitTextToSize(text, width)
    const lineHeight = size * 1.45
    ensureSpace((lines.length * lineHeight) + after)
    pdf.text(lines, margin + indent, y)
    y += (lines.length * lineHeight) + after
  }

  const writeLabelValue = (label, value) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(`${label}:`, margin, y)
    pdf.setFont('helvetica', 'normal')
    const valueLines = pdf.splitTextToSize(cleanText(value, 300) || 'Not provided', contentWidth - 110)
    pdf.text(valueLines, margin + 110, y)
    y += Math.max(14, valueLines.length * 13) + 3
  }

  pdf.setProperties({
    title: `${CLINIC_PLATFORM_AGREEMENT.title} - Signed`,
    subject: `Agreement ${CLINIC_PLATFORM_AGREEMENT.version}`,
    author: 'AesthetiCare',
    creator: 'AesthetiCare registration',
  })
  pdf.setTextColor(74, 46, 31)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(22)
  pdf.text('AesthetiCare', margin, y)
  y += 27
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text(CLINIC_PLATFORM_AGREEMENT.title, margin, y)
  y += 17
  pdf.setDrawColor(190, 137, 84)
  pdf.setLineWidth(1)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 19
  pdf.setTextColor(95, 75, 62)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Agreement version: ${CLINIC_PLATFORM_AGREEMENT.version}  |  Last updated: ${CLINIC_PLATFORM_AGREEMENT.lastUpdated}`, margin, y)
  y += 22

  pdf.setTextColor(55, 42, 33)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Signing details', margin, y)
  y += 17
  writeLabelValue('Clinic', clinicName)
  writeLabelValue('Business name', companyName || clinicName)
  writeLabelValue('Signed by', signerName)
  writeLabelValue('Position', signerPosition || 'Owner / authorized representative')
  writeLabelValue('Email', signerEmail)
  writeLabelValue('Signed on (Philippine Time)', dateLabel(signedAt))
  writeLabelValue('Acceptance reference', acceptanceId)
  y += 8

  pdf.setTextColor(55, 42, 33)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(CLINIC_PLATFORM_AGREEMENT.title, margin, y)
  y += 18
  pdf.setTextColor(55, 42, 33)
  writeParagraph(CLINIC_PLATFORM_AGREEMENT.introduction, { size: 10, after: 12 })

  for (const section of CLINIC_PLATFORM_AGREEMENT.sections) {
    ensureSpace(26)
    pdf.setTextColor(92, 59, 37)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(section.heading, margin, y)
    y += 17
    pdf.setTextColor(55, 42, 33)
    for (const paragraph of section.paragraphs || []) writeParagraph(paragraph)
    for (const bullet of section.bullets || []) {
      writeParagraph(`- ${bullet.label} ${bullet.text}`, { indent: 10, after: 5 })
    }
    for (const paragraph of section.closingParagraphs || []) writeParagraph(paragraph)
    y += 3
  }

  ensureSpace(150)
  pdf.setDrawColor(217, 192, 163)
  pdf.setFillColor(255, 250, 244)
  pdf.roundedRect(margin, y, contentWidth, 132, 8, 8, 'FD')
  pdf.setTextColor(92, 59, 37)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Electronic signature', margin + 14, y + 20)
  pdf.setTextColor(55, 42, 33)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('The representative accepted this agreement and signed electronically during clinic registration.', margin + 14, y + 37)
  pdf.setDrawColor(217, 192, 163)
  pdf.line(margin + 14, y + 106, margin + contentWidth - 14, y + 106)
  pdf.setFont('helvetica', 'bold')
  pdf.text(cleanText(signerName, 200), margin + 14, y + 121)
  if (signatureImage) {
    pdf.addImage(signatureImage, 'PNG', margin + 14, y + 45, 190, 55, undefined, 'FAST')
  }

  const bytes = pdf.output('arraybuffer')
  return Buffer.from(bytes)
}
