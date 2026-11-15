import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHrWorkflow } from './hrWorkflow.js'

const createHarness = seed => {
  const records = new Map(Object.entries(seed)), routes = new Map()
  let serial = 0
  const ref = path => ({ path, id: path.split('/').pop(), collection: name => collection(`${path}/${name}`), async get() { return snap(path, records.get(path)) } })
  const collection = (path, filters = []) => ({
    path,
    filters,
    doc: (id = `auto-${++serial}`) => ref(`${path}/${id}`),
    where: (key, op, value) => collection(path, [...filters, [key, op, value]]),
    async get() { return querySnapshot(path, filters) },
  })
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) })
  const querySnapshot = (path, filters = []) => ({ docs: [...records].filter(([recordPath, data]) =>
    recordPath.startsWith(`${path}/`) && recordPath.split('/').length === path.split('/').length + 1 && filters.every(([key, op, value]) => op === '==' && data[key] === value)
  ).map(([recordPath, data]) => snap(recordPath, data)) })
  const db = {
    collection,
    async runTransaction(fn) {
      const writes = []
      const tx = {
        async get(target) {
          assert.equal(writes.length, 0, 'Transaction reads must precede writes')
          return target.filters ? querySnapshot(target.path, target.filters) : snap(target.path, records.get(target.path))
        },
        set(target, data, options) { writes.push([target.path, data, options?.merge]) },
        update(target, data) { writes.push([target.path, data, true]) },
      }
      const result = await fn(tx)
      for (const [path, data, merge] of writes) records.set(path, { ...(merge ? records.get(path) : {}), ...structuredClone(data) })
      return result
    },
  }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => new Date('2026-11-15T00:00:00Z') }
  const contexts = {
    hr: { uid: 'hr', userData: { branchId: 'clinic' }, permissions: new Set(['leave:create', 'leave:review']) },
    worker: { uid: 'worker', userData: { branchId: 'clinic', userType: 'Staff' }, permissions: new Set() },
    outsider: { uid: 'outsider', userData: { branchId: 'other' }, permissions: new Set(['leave:review']) },
  }
  const app = { get(path, _auth, handler) { routes.set(`GET ${path}`, handler) }, post(path, _auth, handler) { routes.set(`POST ${path}`, handler) } }
  registerHrWorkflow(app, {
    admin: { firestore },
    requireAuth() {},
    loadUserContext: async uid => contexts[uid],
    assertPlanFeature: async () => {},
    loadAttendanceSchedule: async () => ({}),
  })
  const call = async (method, path, uid, { body = {}, query = {}, params = {} } = {}) => {
    const result = { status: 200 }
    await routes.get(`${method} ${path}`)({ user: { uid }, body, query, params }, {
      status(code) { result.status = code; return this },
      json(payload) { result.payload = payload },
    })
    return result
  }
  return { records, call }
}

test('HR leave policy settings are permission checked and the backend enforces eligibility and annual limits', async () => {
  const h = createHarness({
    'clinics/clinic': { ownerId: 'hr', clinicName: 'Clinic' },
    'users/worker': { branchId: 'clinic', userType: 'Staff', employmentStartDate: '2026-01-04', firstName: 'Pat', lastName: 'Employee' },
  })

  const saved = await h.call('POST', '/hr/leave-policy', 'hr', { body: { branchId: 'clinic', annualPaidDays: 1, eligibilityMonths: 12 } })
  assert.equal(saved.status, 200)
  assert.deepEqual(saved.payload.data, { annualPaidDays: 1, eligibilityMonths: 12 })
  assert.equal((await h.call('GET', '/hr/leave-policy', 'outsider', { query: { branchId: 'clinic' } })).status, 403)
  assert.deepEqual((await h.call('GET', '/hr/leave-policy', 'worker', { query: { branchId: 'clinic' } })).payload.data, { annualPaidDays: 1, eligibilityMonths: 12 })

  const leave = date => h.call('POST', '/hr/leave-requests', 'worker', { body: {
    paymentType: 'Paid Leave', leaveType: 'Vacation Leave', startDate: date, endDate: date, reason: 'Personal appointment',
  } })
  assert.equal((await leave('2026-12-30')).status, 400, 'tenure must be complete on the requested start date')
  assert.equal((await leave('2027-01-04')).status, 200)
  assert.equal((await leave('2027-01-05')).status, 400, 'pending paid leave must reserve the annual allowance')
  assert.equal([...h.records.keys()].filter(path => path.startsWith('leaveRequests/')).length, 1)
})
