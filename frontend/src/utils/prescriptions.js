export const parsePrescriptionText = value => {
  const lines = String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length > 20) throw new Error('Enter no more than 20 prescribed items.')
  return lines.map((line, index) => {
    const [name = '', dosage = '', frequency = '', duration = '', instructions = ''] = line.split('|').map(part => part.trim())
    if (!name) throw new Error(`Prescription line ${index + 1} needs a medication or product name.`)
    if (name.length > 160 || dosage.length > 160 || frequency.length > 160 || duration.length > 160 || instructions.length > 500) throw new Error(`Prescription line ${index + 1} is too long.`)
    return { name, dosage, frequency, duration, instructions }
  })
}

export const promptForPrescriptions = (initial = []) => {
  const current = (Array.isArray(initial) ? initial : []).map(item => [item.name || item.medication || item.productName, item.dosage || item.strength, item.frequency, item.duration, item.instructions || item.notes].map(value => String(value || '')).join(' | ').replace(/\s+\|\s+$/, '')).join('\n')
  const value = window.prompt('Optional prescription items, one per line: medication | dosage | frequency | duration | instructions', current)
  return value === null ? null : parsePrescriptionText(value)
}
