export const normalized = (value) => String(value || '').trim().toLowerCase()
export const cents = (value) => Math.round(Number(value || 0) * 100)
export const initialPayment = (appointment) => {
  const total = cents(appointment.totalAmount ?? appointment.amount)
  return appointment.installmentsAllowed === true
    ? Math.ceil(total * Number(appointment.depositPercent || 50) / 100) : total
}
export const paymentDue = (appointment) => {
  const paid = cents(appointment.amountPaid)
  const total = cents(appointment.totalAmount ?? appointment.amount)
  return Math.max(0, (paid < initialPayment(appointment) ? initialPayment(appointment) : total) - paid)
}
export const initialPaymentReceived = (appointment) => cents(appointment.amountPaid) >= initialPayment(appointment)
export const balanceSettled = (appointment) => cents(appointment.amountPaid) >= cents(appointment.totalAmount ?? appointment.amount)
export const afterPaymentStatus = (appointment) => {
  if (appointment.workerCompleted && appointment.customerCompleted) return balanceSettled(appointment) ? 'Completed' : 'Balance Due'
  if (!initialPaymentReceived(appointment)) return 'Awaiting Payment'
  if (normalized(appointment.contract?.status) !== 'signed') return 'Contract Pending'
  if (appointment.startedAt) return appointment.workerCompleted ? 'Awaiting Customer Confirmation' : 'Ongoing'
  return appointment.workerKeyVerified ? 'Ready to Start' : 'Paid'
}
export const assertWorkflow = (condition, message, status = 409) => {
  if (!condition) throw Object.assign(new Error(message), { status })
}

// Inventory counts represent available stock. Materials are reserved for all
// active bookings; equipment is reserved only for overlapping appointments.
export const resourceConflict = ({ requirements, inventory, appointments, overlaps }) => {
  for (const requirement of requirements) {
    const stock = inventory.find((item) => item.id === requirement.id)
    if (!stock) return 'A required material or piece of equipment is unavailable.'
    const used = appointments.reduce((sum, appointment) => sum + (appointment.resources || []).filter((entry) =>
      entry.id === requirement.id && (entry.kind === 'material' ? !appointment.materialsConsumed : overlaps(appointment))
    ).reduce((count, entry) => count + entry.quantity, 0), 0)
    if (!Number.isFinite(Number(stock.currentStock)) || Number(stock.currentStock || 0) - used < requirement.quantity) return `${stock.name || 'Required resource'} is unavailable for this booking.`
  }
  return ''
}
