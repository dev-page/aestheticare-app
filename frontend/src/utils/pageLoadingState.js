// Track the first data load, including subscriptions whose first result arrives later.
// Later live updates leave the page visible and preserve in-progress edits.
export function createPageLoadingState(onChange) {
  let pending = 0
  let initial = true
  let disposed = false
  const begin = () => {
    if (!initial || disposed) return () => {}
    pending += 1
    onChange(true)
    let finished = false
    return () => {
      if (finished || disposed) return
      finished = true
      pending -= 1
      queueMicrotask(() => {
        if (pending === 0 && initial && !disposed) {
          initial = false
          onChange(false)
        }
      })
    }
  }
  const track = (callback) => function (...args) {
    const finish = begin()
    try {
      const result = callback.apply(this, args)
      if (result && typeof result.then === 'function') return Promise.resolve(result).finally(finish)
      finish()
      return result
    } catch (error) {
      finish()
      throw error
    }
  }
  const listen = (register, ...args) => {
    const finish = begin()
    const callbackIndex = args.findIndex(argument => typeof argument === 'function')
    if (callbackIndex < 0) {
      finish()
      throw new Error('Page loading listeners require a result callback.')
    }
    const wrap = callback => (...values) => {
      try {
        const result = callback?.(...values)
        if (result && typeof result.then === 'function') return Promise.resolve(result).finally(finish)
        finish()
        return result
      } catch (error) {
        finish()
        throw error
      }
    }
    args[callbackIndex] = wrap(args[callbackIndex])
    args[callbackIndex + 1] = wrap(args[callbackIndex + 1] || (error => console.error('Unable to load page data:', error)))
    try {
      const unsubscribe = register(...args)
      return () => { finish(); unsubscribe?.() }
    } catch (error) {
      finish()
      throw error
    }
  }
  return {
    track,
    listen,
    dispose() { disposed = true; initial = false; pending = 0; onChange(false) },
  }
}
