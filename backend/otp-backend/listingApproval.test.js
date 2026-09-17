import test from 'node:test'
import assert from 'node:assert/strict'
import { listingTransition, financialTermsChanged, draftListing, approvedOrderLines, registerListingApproval } from './listingApproval.js'

const listing = () => ({ ...draftListing(), title: 'Treatment', price: 1000, allowInstallments: true, depositPercent: 30 })
test('Draft requires Finance or clinic-owner approval before publication', () => {
  let post = listing()
  assert.throws(() => listingTransition(post, 'publish', 'Owner', 'owner'), /Finance must approve/)
  post = { ...post, ...listingTransition(post, 'submit', 'Manager', 'manager') }
  assert.equal(post.financeStatus, 'pending')
  assert.throws(() => listingTransition(post, 'approve', 'Manager', 'manager'), /Only Finance or the clinic owner/)
  post = { ...post, ...listingTransition(post, 'approve', 'Owner', 'owner') }
  assert.equal(post.isPublished, false)
  assert.equal(post.financeReview.terms.price, 1000)
  assert.throws(() => listingTransition(post, 'publish', 'Finance', 'finance'), /owner or manager/)
  post = { ...post, ...listingTransition(post, 'publish', 'Owner', 'owner') }
  assert.equal(post.isPublished, true)
  assert.throws(() => listingTransition(post, 'reject', 'Finance', 'finance', 'Change price'), /no longer awaiting/)
})
test('Rejected financial terms require a reason and can be resubmitted', () => {
  let post = { ...listing(), financeStatus: 'pending' }
  assert.throws(() => listingTransition(post, 'reject', 'Owner', 'owner'), /Explain/)
  post = { ...post, ...listingTransition(post, 'reject', 'Owner', 'owner', 'Reduce the deposit.') }
  assert.equal(post.financeStatus, 'rejected')
  assert.equal(listingTransition(post, 'submit', 'Manager', 'm').financeStatus, 'pending')
  assert.throws(() => listingTransition({ ...listing(), price: -1 }, 'submit', 'Manager', 'm'), /valid positive price/)
  assert.throws(() => listingTransition({ ...listing(), depositPercent: 100 }, 'submit', 'Manager', 'm'), /between 1% and 99%/)
})
test('Only financial changes require a fresh review', () => {
  const before = listing()
  for (const change of [{ price: 1200 }, { consultationFee: 200 }, { allowInstallments: false }, { depositPercent: 40 }, { discountPercent: 10 }, { discountAmount: 100 }]) assert.equal(financialTermsChanged(before, { ...before, ...change }), true)
  assert.equal(financialTermsChanged(before, { ...before, title: 'New title', description: 'Corrected text', imageUrl: 'new.jpg' }), false)
  assert.equal(draftListing().isPublished, false)
})
test('Product checkout refuses drafts, unpublished listings, stale prices and invalid quantities', () => {
  const item = { id: 'p', price: 1000, quantity: 2 }
  const post = { ...listing(), postType: 'Product', isPublished: true, financeStatus: 'approved' }
  assert.equal(approvedOrderLines([item], [post], 200000)[0].amount, 100000)
  for (const change of [{ financeStatus: 'pending' }, { isPublished: false }, { archived: true }]) assert.throws(() => approvedOrderLines([item], [{ ...post, ...change }], 200000), /no longer published/)
  assert.throws(() => approvedOrderLines([{ ...item, price: 1 }], [post], 200000), /price changed/)
  assert.throws(() => approvedOrderLines([{ ...item, quantity: 1.5 }], [post], 150000), /quantity/)
  assert.throws(() => approvedOrderLines([item], [post], 1), /total changed/)
})

test('Approval endpoint rejects other branches and records Finance audit and notifications', async () => {
  const records = new Map([
    ['productServicePosts/p', { ...listing(), financeStatus: 'pending', branchId: 'clinic', createdBy: 'manager', submittedBy: 'manager' }],
    ['clinics/clinic', { ownerId: 'owner' }],
  ])
  let context = { roleKey: 'Finance', userData: { branchId: 'other-clinic' } }
  let handler, sequence = 0
  const collection = (path) => ({ doc: (id = String(++sequence)) => ({ path: `${path}/${id}`, collection: (name) => collection(`${path}/${id}/${name}`) }) })
  const db = { collection, runTransaction: async (fn) => {
    const writes = []
    const result = await fn({ get: async (ref) => ({ exists: records.has(ref.path), data: () => records.get(ref.path) }), update: (ref, value) => writes.push([ref.path, value]), set: (ref, value) => writes.push([ref.path, value]) })
    writes.forEach(([path, value]) => records.set(path, { ...records.get(path), ...value }))
    return result
  } }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => 'timestamp' }
  registerListingApproval({ post: (path, auth, callback) => { handler = callback } }, { admin: { firestore }, requireAuth() {}, loadUserContext: async () => context })
  const call = async () => {
    const result = { code: 200 }
    await handler({ params: { id: 'p' }, body: { action: 'approve' }, user: { uid: 'finance' } }, { status(code) { result.code = code; return this }, json(body) { result.body = body } })
    return result
  }
  assert.equal((await call()).code, 403)
  assert.equal(records.get('productServicePosts/p').financeStatus, 'pending')
  context = { roleKey: 'Finance', userData: { branchId: 'clinic' } }
  assert.equal((await call()).code, 200)
  assert.equal(records.get('productServicePosts/p').financeStatus, 'approved')
  assert.equal(records.get('productServicePosts/p').isPublished, false)
  assert.equal([...records.keys()].filter((key) => key.includes('/approvalHistory/')).length, 1)
  assert.equal([...records.keys()].filter((key) => key.startsWith('notifications/')).length, 2)
  assert.equal((await call()).code, 409)
})
