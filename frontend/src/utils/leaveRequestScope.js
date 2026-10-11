export function leaveRequestScopes(branchIds, requesterId, reviewer) {
  if (!requesterId) return []
  return [...new Set(branchIds.map(id => String(id || '').trim()).filter(Boolean))]
    .map(branchId => ({ branchId, requesterId: reviewer ? null : requesterId }))
}

export function subscribeLeaveScopes(scopes, subscribe, onState) {
  const pending = new Set(scopes.map(scope => scope.branchId))
  const records = new Map()
  const errors = new Map()
  const stops = []
  let disposed = false
  const emit = () => {
    if (disposed) return
    const unique = new Map([...records.values()].flat().map(record => [record.id, record]))
    onState({
      loading: pending.size > 0,
      errors: [...errors.values()],
      requests: [...unique.values()].sort((a, b) =>
        (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0)),
    })
  }
  scopes.forEach(scope => {
    const success = data => {
      if (disposed) return
      records.set(scope.branchId, data)
      pending.delete(scope.branchId)
      emit()
    }
    const failure = error => {
      if (disposed) return
      errors.set(scope.branchId, error)
      pending.delete(scope.branchId)
      emit()
    }
    try { stops.push(subscribe(scope, success, failure)) } catch (error) { failure(error) }
  })
  if (!scopes.length) emit()
  return () => { disposed = true; stops.forEach(stop => stop?.()) }
}
