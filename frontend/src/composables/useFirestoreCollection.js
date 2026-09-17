import { onScopeDispose, ref, watch } from 'vue'
import { onSnapshot } from 'firebase/firestore'

export function useFirestoreCollection(source, mapDocument = (snapshot) => ({ id: snapshot.id, ...snapshot.data() })) {
  const records = ref([])
  const loading = ref(false)
  const error = ref(null)
  let unsubscribe = null

  const stop = () => {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
  }

  watch(source, (reference) => {
    stop()
    records.value = []
    error.value = null
    if (!reference) {
      loading.value = false
      return
    }

    loading.value = true
    unsubscribe = onSnapshot(reference, (snapshot) => {
      records.value = snapshot.docs.map(mapDocument)
      loading.value = false
    }, (nextError) => {
      error.value = nextError
      loading.value = false
    })
  }, { immediate: true })

  onScopeDispose(stop)

  return { records, loading, error, stop }
}
