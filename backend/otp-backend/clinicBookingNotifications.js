// Resolve recipients before the booking transaction starts writing. Individual
// notifications keep read/unread state independent for every clinic employee.
export const prepareClinicBookingRecipients = async ({ tx, db, branchId, branch, loadUserContext }) => {
  const primary = await tx.get(db.collection('users').where('branchId', '==', branchId))
  const additional = await tx.get(db.collection('users').where('branchIds', 'array-contains', branchId))
  const candidates = new Map([...primary.docs, ...additional.docs].map(doc => [doc.id, doc.data()]))
  for (const uid of new Set([branch.ownerId, branch.organizationOwnerId].filter(Boolean))) {
    if (!candidates.has(uid)) {
      const snapshot = await tx.get(db.collection('users').doc(uid))
      if (snapshot.exists) candidates.set(uid, snapshot.data())
    }
  }
  const recipients = []
  for (const [uid, user] of candidates) {
    const branches = new Set([user.branchId, ...(Array.isArray(user.branchIds) ? user.branchIds : [])])
    if (uid !== branch.ownerId && !branches.has(branchId)) continue
    if (user.archived || user.disabled || user.active === false || user.isActive === false || ['inactive', 'disabled', 'archived', 'closed', 'deactivated', 'deleted'].includes(String(user.status || '').toLowerCase().trim())) continue
    const role = String(user.role || user.userType || '').toLowerCase().replace(/[\s_-]+/g, '')
    if (['customer', 'client', 'patient', 'supplier', 'superadmin'].includes(role)) continue
    const context = loadUserContext ? await loadUserContext(uid) : null
    const permissions = new Set(context?.permissions || [...(user.permissions || []), ...(user.effectivePermissions || [])])
    const canReview = permissions.has('appointments:review')
    if (!canReview && !permissions.has('appointments:view') && !permissions.has('appointments:update')) continue
    recipients.push({ uid, canReview })
  }
  return recipients
}

export const writeClinicBookingNotifications = ({ tx, db, recipients, branchId, bookingId, appointmentId, customerName, count = 1, directBooking = false, createdAt }) => {
  for (const recipient of recipients) {
    const query = new URLSearchParams({ tab: !directBooking && recipient.canReview ? 'requests' : 'all', branchId })
    tx.set(db.collection('notifications').doc(`booking-created-${bookingId}-${recipient.uid}`), {
      recipientUserId: recipient.uid, branchId, bookingId, appointmentId,
      eventType: 'booking_created', title: directBooking ? 'New online booking' : 'New online booking request',
      message: `${customerName || 'A customer'} submitted ${count === 1 ? 'an online appointment' : `${count} separately scheduled appointments`}. ${directBooking ? 'Awaiting customer payment; payment is not yet confirmed.' : 'Review the booking request before approval. Payment is not yet confirmed.'}`,
      link: `/crm/appointments?${query}`, read: false, deleted: false, createdAt,
    })
  }
}
