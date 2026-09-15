const acceptsNumber = (value, decimal) => (decimal ? /^\d*(?:\.\d{0,2})?$/ : /^\d*$/).test(value)

export const blockInvalidNumberInput = (event, decimal = false) => {
  if (!event.inputType?.startsWith('insert') || event.data == null) return
  const input = event.target
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  const next = input.value.slice(0, start) + event.data + input.value.slice(end)
  if (!acceptsNumber(next, decimal)) event.preventDefault()
}

// Covers paste, drop, autofill, and keyboards that omit beforeinput data.
// Reject the whole edit so pasting "1e3" cannot silently become "13".
export const readNumberInput = (event, previous, decimal = false) => {
  const input = event.target
  if (acceptsNumber(input.value, decimal)) return input.value
  input.value = String(previous ?? '')
  return previous
}
