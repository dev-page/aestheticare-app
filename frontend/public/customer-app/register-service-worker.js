// Register independently of Vue, Firebase and page-load timing so a failure
// in the app bundle cannot prevent the customer PWA worker from installing.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', {
    scope: '/',
    updateViaCache: 'none',
  }).catch((error) => {
    console.warn('Customer app service worker registration failed:', error)
  })
}
