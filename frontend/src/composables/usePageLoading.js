import { onUnmounted, ref } from 'vue'
import { createPageLoadingState } from '@/utils/pageLoadingState'

export function usePageLoading() {
  const pageLoading = ref(false)
  const state = createPageLoadingState(active => { pageLoading.value = active })
  onUnmounted(state.dispose)
  return { pageLoading, trackPageLoad: state.track, pageListener: state.listen }
}
