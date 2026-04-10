const DOMExceptionImpl = globalThis.DOMException

if (!DOMExceptionImpl) {
  throw new Error('DOMException is not available in this runtime.')
}

export default DOMExceptionImpl
export const DOMException = DOMExceptionImpl
