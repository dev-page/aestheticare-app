import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

const toText = (value) => String(value || '').trim()

export const toDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

export const isSuspendedStatus = (value) => toText(value).toLowerCase().includes('suspend')

export const hasExpiredSuspension = (clinic) => {
  const endsAt = toDate(clinic?.suspensionEndsAt)
  if (!endsAt) return false
  const suspended =
    isSuspendedStatus(clinic?.status) ||
    isSuspendedStatus(clinic?.moderationStatus)
  return suspended && endsAt.getTime() <= Date.now()
}

export const buildSuspensionRestorePayload = () => ({
  status: 'Active',
  moderationStatus: 'Resolved',
  isPublished: true,
  updatedAt: serverTimestamp(),
  suspendedAt: deleteField(),
  suspensionEndsAt: deleteField(),
  suspensionReason: deleteField(),
  suspensionSource: deleteField(),
})

export const restoreExpiredSuspension = async (db, clinicId, clinic) => {
  if (!clinicId || !hasExpiredSuspension(clinic)) return false
  await updateDoc(doc(db, 'clinics', clinicId), buildSuspensionRestorePayload())
  return true
}
