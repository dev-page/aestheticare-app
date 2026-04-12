let lockCount = 0
let savedBodyOverflow = ''
let savedHtmlOverflow = ''

export const lockPageScroll = () => {
  if (typeof document === 'undefined') return

  if (lockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    savedHtmlOverflow = document.documentElement.style.overflow
  }

  lockCount += 1
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
}

export const unlockPageScroll = () => {
  if (typeof document === 'undefined') return

  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedBodyOverflow || ''
    document.documentElement.style.overflow = savedHtmlOverflow || ''
  }
}
