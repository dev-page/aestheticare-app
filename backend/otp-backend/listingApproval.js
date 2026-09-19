export const financialFields = ['price', 'consultationFee', 'allowInstallments', 'depositPercent', 'discountPercent', 'discountAmount']
export const draftListing = () => ({ financeStatus: 'draft', isPublished: false, financeReview: null, publishedBy: null, publishedAt: null })
export const financialTermsChanged = (before, after) => financialFields.some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
export const approvedOrderLines = (items, listings, amount) => {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 409 }) }
  if (!Array.isArray(items) || !items.length || items.length > 50) fail('Select between 1 and 50 products.')
  const lines = items.map((item, index) => {
    const post = listings[index]
    if (!post || post.postType !== 'Product' || post.isPublished !== true || post.financeStatus !== 'approved' || post.archived) fail('A product is no longer published and approved. Refresh your cart.')
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) fail('Choose a valid product quantity.')
    const price = Math.round(Number(post.price) * 100)
    if (!Number.isFinite(price) || price <= 0 || Math.round(Number(item.price) * 100) !== price) fail('A product price changed. Refresh your cart before paying.')
    return { name: post.title || post.productName || 'Product', amount: price, quantity: item.quantity, currency: 'PHP' }
  })
  if (lines.reduce((sum, line) => sum + line.amount * line.quantity, 0) !== Number(amount)) fail('Your cart total changed. Refresh your cart before paying.')
  return lines
}
export const listingTransition = (post, action, role, uid, note = '') => {
  const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }) }
  if (post.archived) fail('Restore the listing before submitting it for review.')
  if (action === 'submit') {
    if (!['Owner', 'Manager'].includes(role)) fail('Only the clinic owner or manager can submit listings.', 403)
    if (!['draft', 'rejected'].includes(post.financeStatus || 'draft')) fail('This listing has already been submitted.')
    if (!Number.isFinite(Number(post.price)) || Number(post.price) <= 0) fail('Set a valid positive price before submitting.')
    if (post.allowInstallments && (!Number.isFinite(Number(post.depositPercent)) || post.depositPercent < 1 || post.depositPercent >= 100)) fail('Set an initial payment between 1% and 99%.')
    return { ...draftListing(), financeStatus: 'pending', submittedBy: uid }
  }
  if (['approve', 'reject'].includes(action)) {
    if (!['Finance', 'Owner'].includes(role)) fail('Only Finance or the clinic owner can review financial terms.', 403)
    if (post.financeStatus !== 'pending') fail('This listing is no longer awaiting Finance review.')
    if (action === 'reject' && !note.trim()) fail('Explain which financial terms need changing.', 400)
    return { financeStatus: action === 'approve' ? 'approved' : 'rejected', isPublished: false, financeReview: { reviewedBy: uid, note: note.trim(), terms: Object.fromEntries(financialFields.map((key) => [key, post[key] ?? null])) } }
  }
  if (['publish', 'unpublish'].includes(action)) {
    if (!['Owner', 'Manager'].includes(role)) fail('Only the clinic owner or manager can publish listings.', 403)
    if (action === 'publish' && post.financeStatus !== 'approved') fail('Finance must approve the financial terms first.')
    return { isPublished: action === 'publish', publishedBy: action === 'publish' ? uid : null }
  }
  fail('Unknown listing action.', 400)
}

export const registerListingApproval = (app, { admin, requireAuth, loadUserContext }) => {
  app.post('/listings/:id/approval', requireAuth, async (req, res) => {
    try {
      const db = admin.firestore()
      const context = await loadUserContext(req.user.uid)
      const action = String(req.body?.action || '')
      const result = await db.runTransaction(async (tx) => {
        const ref = db.collection('productServicePosts').doc(req.params.id)
        const snapshot = await tx.get(ref)
        if (!snapshot.exists) throw Object.assign(new Error('Listing not found.'), { status: 404 })
        const post = snapshot.data()
        const clinic = (await tx.get(db.collection('clinics').doc(post.branchId))).data() || {}
        const owner = context.roleKey === 'Owner' && (clinic.ownerId === req.user.uid || post.branchId === req.user.uid)
        const assignedBranches = new Set([context.userData?.branchId, ...(Array.isArray(context.userData?.branchIds) ? context.userData.branchIds : [])].filter(Boolean))
        if (!owner && (context.roleKey === 'Owner' || !assignedBranches.has(post.branchId))) throw Object.assign(new Error('This listing belongs to another clinic.'), { status: 403 })
        const update = listingTransition(post, action, context.roleKey, req.user.uid, String(req.body?.note || '').slice(0, 2000))
        if (action === 'publish' && post.postType === 'Package') {
          for (const id of post.packageServiceIds || []) {
            const component = (await tx.get(db.collection('productServicePosts').doc(id))).data()
            if (!component || component.branchId !== post.branchId || component.financeStatus !== 'approved' || component.isPublished !== true) throw Object.assign(new Error('Approve and publish the included services and consultations before publishing this package.'), { status: 409 })
          }
        }
        const timestamp = admin.firestore.FieldValue.serverTimestamp()
        const recipients = action === 'submit'
          ? (await tx.get(db.collection('users').where('branchId', '==', post.branchId).where('role', '==', 'Finance'))).docs.map((doc) => doc.id)
          : [post.submittedBy, post.createdBy, clinic.ownerId].filter(Boolean)
        if (update.financeReview) update.financeReview.reviewedAt = timestamp
        if (action === 'publish') update.publishedAt = timestamp
        tx.update(ref, { ...update, updatedAt: timestamp })
        tx.set(ref.collection('approvalHistory').doc(), { action, actorId: req.user.uid, note: String(req.body?.note || '').slice(0, 2000), terms: Object.fromEntries(financialFields.map((key) => [key, post[key] ?? null])), createdAt: timestamp })
        for (const uid of new Set(recipients)) {
          if (uid === req.user.uid) continue
          tx.set(db.collection('notifications').doc(), { recipientUserId: uid, title: 'Listing review updated', message: `${post.title || 'Product/service'}: ${action === 'submit' ? 'Awaiting Finance review' : action}.`, link: action === 'submit' ? '/finance/listing-approvals' : '/catalog/products-services', read: false, deleted: false, createdAt: timestamp })
        }
        return { financeStatus: update.financeStatus || post.financeStatus, isPublished: update.isPublished }
      })
      res.json({ success: true, data: result })
    } catch (error) { res.status(error.status || 500).json({ success: false, error: error.message }) }
  })
}
