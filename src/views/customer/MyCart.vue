<template>
  <div class="cart-shell">
    <CustomerSidebar />

    <main class="cart-main">
      <div class="cart-content">
        <section class="cart-header">
          <h1 class="cart-title">My Cart</h1>
          <p class="cart-subtitle">Review and manage the products you selected before checkout.</p>
        </section>

        <div v-if="cartItems.length === 0" class="cart-empty-panel">Your cart is empty.</div>

        <div v-else class="cart-list">
          <article
            v-for="item in cartItems"
            :key="item.id"
            class="cart-item-card"
          >
            <input type="checkbox" v-model="item.selected" class="cart-checkbox" />

            <div class="cart-item-image">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="Product image" class="h-full w-full object-cover" />
            </div>

            <div class="cart-item-body">
              <h2 class="cart-item-title">{{ item.name }}</h2>
              <p class="cart-item-meta">Variation: {{ item.variation || 'Default' }}</p>
              <p class="cart-item-meta">Center: {{ item.branchName || 'AesthetiCare' }}</p>
              <p class="cart-item-price">PHP {{ Number(item.price || 0).toFixed(2) }}</p>

              <div class="cart-qty-row">
                <button @click="decreaseQty(item)" class="cart-qty-button">-</button>
                <span class="cart-qty-value">{{ item.quantity }}</span>
                <button @click="increaseQty(item)" class="cart-qty-button">+</button>
              </div>
            </div>

            <button @click="removeItem(item.id)" class="cart-remove-button">Remove</button>
          </article>
        </div>

        <section class="cart-summary-panel">
          <div class="cart-summary-head">
            <p class="cart-summary-value">Selected Items: {{ selectedItems.length }}</p>
            <p class="cart-summary-value">Subtotal: PHP {{ cartSubtotal.toFixed(2) }}</p>
          </div>

          <div class="cart-summary-footer">
            <p class="cart-summary-note">Review your selected products before checkout.</p>
            <button
              @click="checkout"
              class="cart-checkout-button"
              :disabled="selectedItems.length === 0"
            >
              Check Out
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { removeCartItem, readCart, saveCheckoutItems, writeCart } from '@/utils/customerCart'

const router = useRouter()
const cartItems = ref(readCart())

watch(
  cartItems,
  (items) => {
    writeCart(items)
  },
  { deep: true }
)

const increaseQty = (item) => {
  item.quantity = Number(item.quantity || 1) + 1
}

const decreaseQty = (item) => {
  item.quantity = Math.max(1, Number(item.quantity || 1) - 1)
}

const removeItem = (itemId) => {
  cartItems.value = removeCartItem(itemId)
}

const selectedItems = computed(() => cartItems.value.filter((item) => item.selected))
const cartSubtotal = computed(() => selectedItems.value.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0))

const checkout = () => {
  if (!selectedItems.value.length) return
  saveCheckoutItems(selectedItems.value)
  router.push({ name: 'customer-checkout' })
}
</script>

<style scoped>
.cart-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.cart-main {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.cart-content {
  padding: 1.5rem 1.4rem 2rem;
}

.cart-header,
.cart-empty-panel,
.cart-item-card,
.cart-summary-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.cart-header,
.cart-summary-panel {
  padding: 1.25rem;
}

.cart-title {
  margin: 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.cart-subtitle,
.cart-summary-note,
.cart-item-meta,
.cart-empty-panel {
  color: rgba(76, 54, 40, 0.76);
}

.cart-subtitle {
  margin: 0.75rem 0 0;
  line-height: 1.7;
}

.cart-empty-panel {
  margin-top: 1.35rem;
  padding: 1.4rem 1.25rem;
}

.cart-list {
  display: grid;
  gap: 1rem;
  margin-top: 1.35rem;
}

.cart-item-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1.1rem;
}

.cart-checkbox {
  margin-top: 0.4rem;
  width: 1.15rem;
  height: 1.15rem;
  accent-color: #8d5a3b;
}

.cart-item-image {
  width: 6rem;
  height: 6rem;
  overflow: hidden;
  border-radius: 1rem;
  background: linear-gradient(135deg, #ead6b8 0%, #dcb489 48%, #c6946c 100%);
}

.cart-item-body {
  flex: 1;
  min-width: 0;
}

.cart-item-title {
  margin: 0;
  color: #2f1d14;
  font-size: 1.1rem;
  font-weight: 700;
}

.cart-item-meta {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
}

.cart-item-price {
  margin: 0.55rem 0 0;
  color: #a56b44;
  font-weight: 700;
}

.cart-qty-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 0.9rem;
}

.cart-qty-button,
.cart-remove-button,
.cart-checkout-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  font-weight: 700;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.cart-qty-button {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fff8ef;
  color: #6f4a35;
}

.cart-qty-value {
  min-width: 1.5rem;
  color: #3d281d;
  font-weight: 700;
  text-align: center;
}

.cart-remove-button {
  padding: 0.72rem 1rem;
  border: 1px solid rgba(175, 98, 98, 0.28);
  background: linear-gradient(120deg, #ca7c7c 0%, #b85e5e 48%, #974444 100%);
  color: #fff8f2;
}

.cart-summary-panel {
  margin-top: 1.35rem;
}

.cart-summary-head,
.cart-summary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cart-summary-head {
  margin-bottom: 1rem;
}

.cart-summary-value {
  margin: 0;
  color: #3d281d;
  font-size: 1.15rem;
  font-weight: 700;
}

.cart-checkout-button {
  padding: 0.82rem 1.35rem;
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

.cart-checkout-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cart-qty-button:hover,
.cart-remove-button:hover,
.cart-checkout-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

@media (min-width: 1280px) {
  .cart-content {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 767px) {
  .cart-content {
    padding: 1rem 1rem 1.5rem;
  }

  .cart-item-card,
  .cart-summary-head,
  .cart-summary-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .cart-remove-button,
  .cart-checkout-button {
    width: 100%;
  }
}
</style>
