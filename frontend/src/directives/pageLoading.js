import { h, render } from 'vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import './pageLoading.css'

const states = new WeakMap()
function update(element, binding) {
  const config = typeof binding.value === 'object' ? binding.value : { active: binding.value }
  let state = states.get(element)
  if (!config?.active) {
    if (!state) return
    state.observer.disconnect()
    state.resizeObserver?.disconnect()
    state.content.forEach((previous, child) => {
      child.inert = previous.inert
      if (previous.hidden === null) child.removeAttribute('aria-hidden')
      else child.setAttribute('aria-hidden', previous.hidden)
    })
    render(null, state.overlay)
    state.overlay.remove()
    element.classList.remove('page-is-loading')
    if (state.busy === null) element.removeAttribute('aria-busy')
    else element.setAttribute('aria-busy', state.busy)
    element.style.minHeight = state.minHeight
    states.delete(element)
    return
  }
  if (!state) {
    const overlay = document.createElement('div')
    overlay.className = 'page-skeleton-overlay'
    state = { overlay, content: new Map(), busy: element.getAttribute('aria-busy'), minHeight: element.style.minHeight }
    const hideContent = () => {
      for (const child of element.children) {
        if (child === overlay || state.content.has(child)) continue
        state.content.set(child, { inert: child.inert, hidden: child.getAttribute('aria-hidden') })
        child.inert = true
        child.setAttribute('aria-hidden', 'true')
      }
    }
    state.observer = new MutationObserver(hideContent)
    states.set(element, state)
    element.classList.add('page-is-loading')
    element.setAttribute('aria-busy', 'true')
    element.appendChild(overlay)
    hideContent()
    state.observer.observe(element, { childList: true })
    if (typeof ResizeObserver !== 'undefined') {
      state.resizeObserver = new ResizeObserver(() => {
        element.style.minHeight = `${overlay.scrollHeight}px`
      })
      state.resizeObserver.observe(overlay)
    }
  }
  const { active, ...props } = config
  render(h(PageSkeleton, props), state.overlay)
  element.style.minHeight = `${state.overlay.scrollHeight}px`
}

export default {
  mounted: update,
  updated: update,
  beforeUnmount(element) { update(element, { value: false }) },
}
