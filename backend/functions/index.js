const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()
Object.assign(exports, require('./supplyMonitoring')({ admin, functions }))

const DAY_MS = 24 * 60 * 60 * 1000

const normalizePlanKey = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'free-plan' || raw === 'freeplan' || raw === 'free_plan' || raw === 'free-trial' || raw === 'trial') {
    return 'free'
  }
  if (raw.includes('premium')) return 'premium'
  if (raw.includes('basic')) return 'basic'
  if (raw.includes('free')) return 'free'
  return raw
}

const getPlanDurationDays = (planKey, billingCycle = 'month') => {
  const normalizedPlan = normalizePlanKey(planKey)
  if (!normalizedPlan || normalizedPlan === 'free') return 0
  const normalizedCycle = String(billingCycle || '').trim().toLowerCase()
  if (normalizedCycle === 'year' || normalizedCycle === 'annual') return 365
  return 30
}

const clearPendingSubscriptionFields = () => ({
  pendingSubscriptionPlan: admin.firestore.FieldValue.delete(),
  pendingSubscriptionApplyAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionRequestedAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionChangeType: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
  pendingSubscriptionPaidAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionNextExpiresAt: admin.firestore.FieldValue.delete(),
  pendingSubscriptionBillingCycle: admin.firestore.FieldValue.delete(),
})

const toDate = (value) => {
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

const { runSubscriptionMaintenance } = require('./subscriptionMaintenance.cjs')
exports.subscriptionMaintenance = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Manila')
  .onRun(() => runSubscriptionMaintenance({ admin, normalizePlanKey, toDate, getPlanDurationDays, clearPendingSubscriptionFields }))

// Owner-initiated clinic closures are recoverable for 30 days. Once that
// window passes, remove the owner, employee, branch, and branch-scoped records
// together. The closure flag prevents this job from touching legacy owner-only
// deactivations that were not requested as full clinic closures.
const CLOSED_CLINIC_COLLECTIONS = [
  'activities', 'appointments', 'attendance', 'bookings', 'bookingReservations',
  'clients', 'customerOrders', 'financialRecords', 'inventoryItems', 'messages',
  'notifications', 'orders', 'payrolls', 'payrollSummaries', 'productServicePosts',
  'purchaseRequests', 'refundRequests', 'reviews', 'shifts', 'suppliers',
  'supplyAudit', 'supplyRecords', 'transactions', 'walkInSales', 'walkInTransactions',
]

const CUSTOMER_ACCOUNT_COLLECTIONS = [
  'appointments', 'bookings', 'bookingReservations', 'customerOrders', 'messages',
  'notifications', 'refundRequests', 'reviews', 'transactions', 'walkInSales',
  'walkInTransactions',
]

const deleteRecursively = async (firestore, ref) => firestore.recursiveDelete(ref)

const deleteBranchRecords = async (firestore, branchIds) => {
  for (const collectionName of CLOSED_CLINIC_COLLECTIONS) {
    for (const branchId of branchIds) {
      const snapshot = await firestore.collection(collectionName).where('branchId', '==', branchId).get()
      for (const record of snapshot.docs) await deleteRecursively(firestore, record.ref)
    }
  }
}

exports.accountClosureMaintenance = functions.pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Manila')
  .onRun(async () => {
    const firestore = admin.firestore()
    const now = new Date()
    const owners = await firestore.collection('users').get()
    const dueOwners = owners.docs.filter((ownerSnap) => {
      const owner = ownerSnap.data() || {}
      const deleteAt = toDate(owner.accountDeletionScheduledFor)
      return owner.clinicClosurePendingDeletion === true
        && owner.accountClosed === true
        && String(owner.accountClosureAction || '').toLowerCase() === 'deactivate'
        && deleteAt && deleteAt.getTime() <= now.getTime()
    })
    const dueCustomers = owners.docs.filter((customerSnap) => {
      const customer = customerSnap.data() || {}
      const deleteAt = toDate(customer.accountDeletionScheduledFor)
      const role = String(customer.role || customer.userType || '').trim().toLowerCase()
      return role === 'customer'
        && customer.accountDeletionRequested === true
        && deleteAt && deleteAt.getTime() <= now.getTime()
    })

    for (const ownerSnap of dueOwners) {
      const ownerId = ownerSnap.id
      const clinicSnapshot = await firestore.collection('clinics').where('ownerId', '==', ownerId).get()
      const clinics = new Map(clinicSnapshot.docs.map((clinic) => [clinic.id, clinic]))
      const mainClinic = await firestore.collection('clinics').doc(ownerId).get()
      if (mainClinic.exists) clinics.set(mainClinic.id, mainClinic)
      const branchIds = [...clinics.keys()]

      const employeeSnapshots = await Promise.all(branchIds.map((branchId) => firestore.collection('users').where('branchId', '==', branchId).get()))
      const employeeIds = new Set()
      employeeSnapshots.forEach((snapshot) => snapshot.forEach((employeeSnap) => {
        const employee = employeeSnap.data() || {}
        if (employeeSnap.id !== ownerId && ['staff', 'employee'].includes(String(employee.userType || '').toLowerCase())) employeeIds.add(employeeSnap.id)
      }))

      await deleteBranchRecords(firestore, branchIds)
      for (const clinic of clinics.values()) await deleteRecursively(firestore, clinic.ref)
      const closureRequests = await firestore.collection('accountClosureRequests').where('ownerId', '==', ownerId).get()
      for (const request of closureRequests.docs) await deleteRecursively(firestore, request.ref)
      const ownerSettings = await firestore.collection('ownerModuleSettings').doc(ownerId).get()
      if (ownerSettings.exists) await deleteRecursively(firestore, ownerSettings.ref)
      for (const employeeId of employeeIds) {
        await deleteRecursively(firestore, firestore.collection('users').doc(employeeId))
        await admin.auth().deleteUser(employeeId).catch(() => undefined)
      }
      await deleteRecursively(firestore, ownerSnap.ref)
      await admin.auth().deleteUser(ownerId).catch(() => undefined)

      const bucket = admin.storage().bucket()
      await Promise.all([
        bucket.deleteFiles({ prefix: `clinics/${ownerId}/` }).catch(() => undefined),
        bucket.deleteFiles({ prefix: `users/${ownerId}/` }).catch(() => undefined),
      ])
    }

    for (const customerSnap of dueCustomers) {
      const customerId = customerSnap.id
      for (const collectionName of CUSTOMER_ACCOUNT_COLLECTIONS) {
        const records = await firestore.collection(collectionName).where('customerId', '==', customerId).get()
        for (const record of records.docs) await deleteRecursively(firestore, record.ref)
      }
      await deleteRecursively(firestore, customerSnap.ref)
      await admin.auth().deleteUser(customerId).catch(() => undefined)
      await admin.storage().bucket().deleteFiles({ prefix: `users/${customerId}/` }).catch(() => undefined)
    }

    return { deletedOwnerAccounts: dueOwners.length, deletedCustomerAccounts: dueCustomers.length }
  })
