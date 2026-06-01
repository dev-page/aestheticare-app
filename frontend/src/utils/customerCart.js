const CART_STORAGE_KEY = 'customer_cart_v1'
const CHECKOUT_STORAGE_KEY = 'customer_checkout_v1'

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const readCart = () => {
  const raw = localStorage.getItem(CART_STORAGE_KEY)
  const parsed = safeParse(raw, [])
  return Array.isArray(parsed) ? parsed : []
}

export const writeCart = (items) => {
  write(CART_STORAGE_KEY, Array.isArray(items) ? items : [])
}

export const addCartItem = (item) => {
  const cart = readCart()
  const existing = cart.find((cartItem) => cartItem.id === item.id)

  if (existing) {
    existing.quantity += item.quantity || 1
  } else {
    cart.push({
      id: item.id,
      branchId: item.branchId || '',
      branchName: item.branchName || '',
      name: item.name || '',
      variation: item.variation || 'Default',
      price: Number(item.price || 0),
      quantity: Math.max(1, Number(item.quantity || 1)),
      selected: true,
      imageUrl: item.imageUrl || '',
    })
  }

  writeCart(cart)
  return cart
}

export const removeCartItem = (itemId) => {
  const next = readCart().filter((item) => item.id !== itemId)
  writeCart(next)
  return next
}

export const saveCheckoutItems = (items) => {
  write(CHECKOUT_STORAGE_KEY, Array.isArray(items) ? items : [])
}

export const readCheckoutItems = () => {
  const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY)
  const parsed = safeParse(raw, [])
  return Array.isArray(parsed) ? parsed : []
}

export const clearCheckoutItems = () => {
  localStorage.removeItem(CHECKOUT_STORAGE_KEY)
}
