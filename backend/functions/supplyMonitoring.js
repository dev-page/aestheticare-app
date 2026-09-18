// Server-only background monitoring; deliberately creates recommendations and
// notifications, never purchase requests or payments.
module.exports = ({ admin, functions }) => {
  const db = admin.firestore()
  const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const flagsFor = (item, date) => {
    const flags = [], stock = Number(item.currentStock || 0), maximum = Number(item.maxStock || item.targetStock || 0)
    if (stock <= Number(item.minStock || 0)) flags.push('For Restocking')
    if (maximum && stock > maximum) flags.push('Overstocked')
    if (item.expiryDate) { const remaining = (Date.parse(item.expiryDate) - Date.parse(date)) / 86400000; if (remaining < 0) flags.push('Expired'); else if (remaining <= 30) flags.push('Expiring Soon') }
    if (['damaged', 'defective', 'under repair', 'bad'].includes(String(item.condition || '').toLowerCase())) flags.push('Needs Attention')
    return flags
  }
  const staffFor = async (branchId, permission, cache) => {
    const key = `${branchId}:${permission}`
    if (cache.has(key)) return cache.get(key)
    const staff = await db.collection('users').where('branchId', '==', branchId).get()
    const result = []
    for (const user of staff.docs) {
      const data = user.data(), permissions = new Set([...(data.permissions || []), ...(data.effectivePermissions || [])])
      const role = String(data.role || data.userType || '').trim()
      const roleIds = [...new Set([...(data.customRoleIds || []), data.customRoleId].filter(Boolean))]
      const roles = await Promise.all([...(role ? [db.collection('rolePermissions').doc(role).get()] : []), ...roleIds.map(id => db.collection('clinicRoles').doc(id).get())])
      roles.forEach(r => (r.data()?.permissions || []).forEach(p => permissions.add(p)))
      if (permissions.has(permission) || permissions.has('administrator:full_access')) result.push(user.id)
    }
    cache.set(key, result); return result
  }
  const notify = async (uid, record, date, event, message, link) => {
    const id = `supply-auto-${uid}-${record.id}-${event}-${date}`
    try { await db.collection('notifications').doc(id).create({ recipientUserId: uid, branchId: record.branchId, title: 'Supply management', message, link, read: false, deleted: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }) }
    catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error }
  }
  const snapshotItem = async (snapshot, cache) => {
    const item = { ...snapshot.data(), id: snapshot.id }, date = day()
    if (!item.branchId) return
    const flags = flagsFor(item, date)
    await db.collection('supplySnapshots').doc(`${item.branchId}-${item.id}-${date}`).set({ branchId: item.branchId, itemId: item.id, date, currentStock: Number(item.currentStock || 0), minStock: Number(item.minStock || 0), maxStock: Number(item.maxStock || 0), flags, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    if (flags.length) for (const uid of await staffFor(item.branchId, 'inventory:view', cache)) await notify(uid, item, date, 'stock', `${item.name}: ${flags.join(', ')}. Review the recommendation before requesting replenishment.`, '/supply-management/inventory/items')
  }
  const scan = async (name, handler) => {
    let cursor
    do {
      let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(100)
      if (cursor) query = query.startAfter(cursor)
      const page = await query.get()
      for (const snapshot of page.docs) await handler(snapshot)
      cursor = page.size === 100 ? page.docs.at(-1) : null
    } while (cursor)
  }
  const sweep = async () => {
    const cache = new Map(), date = day()
    await scan('inventoryItems', snapshot => snapshotItem(snapshot, cache))
    await scan('supplyRecords', async snapshot => {
      const r = { ...snapshot.data(), id: snapshot.id }
      const due = r.kind === 'rfq' && ['Open', 'Quotation Received'].includes(r.status) ? r.deadline : r.kind === 'po' && ['Ongoing', 'Partially Received', 'Supplier Confirmed'].includes(r.status) ? r.deliveryDate : r.kind === 'invoice' && !['Paid', 'Cancelled'].includes(r.status) ? r.dueDate : null
      if (!r.branchId || !due || Date.parse(due) - Date.parse(date) > 3 * 86400000) return
      const department = r.kind === 'rfq' ? 'procurement' : r.kind === 'po' ? 'logistics' : 'finance'
      const permission = { procurement: 'procurement:view', logistics: 'orders:view', finance: 'finance:payables:view' }[department]
      for (const uid of await staffFor(r.branchId, permission, cache)) await notify(uid, r, date, 'deadline', `${r.number}: ${r.status}; due ${due}.`, `/supply-management/${department}/dashboard`)
      if (r.mode === 'Online') for (const id of [...new Set([...(r.supplierIds || []), r.supplierId].filter(Boolean))]) {
        const supplier = (await db.collection('suppliers').doc(id).get()).data()
        if (supplier?.status === 'Active' && (supplier.ownerId || supplier.supplierUserId)) await notify(supplier.ownerId || supplier.supplierUserId, r, date, 'deadline', `${r.number}: ${r.status}; due ${due}.`, '/supplier/supply/dashboard')
      }
    })
  }
  return {
    supplyInventoryMonitor: functions.firestore.document('inventoryItems/{itemId}').onWrite(change => change.after.exists ? snapshotItem(change.after, new Map()) : null),
    supplyDeadlineMonitor: functions.runWith({ timeoutSeconds: 540, memory: '512MB' }).pubsub.schedule('every 60 minutes').timeZone('Asia/Manila').onRun(sweep),
  }
}
