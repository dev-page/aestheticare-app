if (typeof Object.prototype.getUniverseDomain !== 'function') {
  Object.defineProperty(Object.prototype, 'getUniverseDomain', {
    value: async function getUniverseDomain() {
      return 'googleapis.com'
    },
    configurable: true,
    writable: true,
    enumerable: false,
  })
}

const { admin, runClientContactBackfill } = await import('../server.js')

const run = async () => {
  const db = admin.firestore()
  const result = await runClientContactBackfill(db)
  console.log(
    JSON.stringify(
      {
        success: true,
        ...result,
      },
      null,
      2
    )
  )

  await admin.app().delete()
}

run().catch((error) => {
  console.error('Client contact backfill failed:', error?.message || error)
  process.exit(1)
})
