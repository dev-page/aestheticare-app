// A strict test adapter catches Firestore reads performed after transaction writes.
export const transactionDb = () => {
  const records = new Map()
  let sequence = 0
  const snapshot = ref => ({ id: ref.id, ref, exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) })
  const collection = name => {
    const query = filters => ({ where: (field, op, value) => query([...filters, [field, op, value]]), get: async () => ({ docs: [...records.keys()].filter(path => path.startsWith(name + '/') && !path.slice(name.length + 1).includes('/') && filters.every(([field, op, value]) => op === 'array-contains' ? records.get(path)[field]?.includes(value) : records.get(path)[field] === value)).map(path => snapshot(ref(path))) }) })
    return { ...query([]), doc: (id = `auto-${++sequence}`) => ref(`${name}/${id}`) }
  }
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(ref(path)), collection: name => collection(`${path}/${name}`), set: async value => records.set(path, structuredClone(value)) })
  const merge = (a, b) => Object.fromEntries([...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].map(key => [key, b[key] === undefined ? a[key] : b[key] && a?.[key] && Object.getPrototypeOf(b[key]) === Object.prototype ? merge(a[key], b[key]) : b[key]]))
  const db = { collection, runTransaction: async callback => {
    const writes = []
    const result = await callback({ get: async target => { if (writes.length) throw new Error('Firestore transaction read after write'); return target.get() }, set: (target, value, options) => writes.push({ target, value, merge: options?.merge }), update: (target, value) => writes.push({ target, value, merge: true }) })
    for (const write of writes) records.set(write.target.path, write.merge ? merge(records.get(write.target.path), structuredClone(write.value)) : structuredClone(write.value))
    return result
  } }
  const firestore = () => db
  firestore.FieldValue = { serverTimestamp: () => new Date(), delete: () => null }
  return { db, records, admin: { firestore }, seed: (name, id, data) => records.set(`${name}/${id}`, structuredClone(data)) }
}
