// Retry reads against the hosted API when an old backend URL serves HTML.
// Mutations use the endpoint confirmed by a read and are never retried.
export const createJsonApiClient = (bases, fetcher = (...args) => fetch(...args)) => {
  const candidates = [...new Set(bases.filter(Boolean))]
  let confirmedBase = null
  return async (path, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase()
    const targets = method === 'GET' ? [...new Set([confirmedBase, ...candidates].filter(Boolean))] : [confirmedBase || candidates[0]]
    let lastError
    for (const base of targets) {
      let response, payload
      try {
        response = await fetcher(base + path, options)
      } catch (error) {
        lastError = new Error('Unable to reach the compensation API. Please try again.')
        if (method === 'GET') continue
        throw lastError
      }
      try {
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) throw new Error('Non-JSON response')
        payload = await response.json()
        if (!payload || typeof payload !== 'object' || !('data' in payload || 'error' in payload || 'success' in payload)) throw new Error('Invalid API response')
      } catch (error) {
        lastError = new Error('The compensation API is unavailable or outdated. Deploy the updated backend with the frontend and check the API URL configuration.')
        if (method === 'GET') continue
        throw lastError
      }
      if (!response.ok) {
        if (method === 'GET' && response.status === 404) {
          lastError = new Error(payload.error || 'This compensation endpoint is missing from the deployed backend.')
          continue
        }
        throw new Error(payload.error || 'Unable to complete the compensation request.')
      }
      confirmedBase = base
      return payload.data
    }
    throw lastError || new Error('No compensation API endpoint is configured.')
  }
}
