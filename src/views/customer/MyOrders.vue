<template>
  <div class="orders-shell">
    <CustomerSidebar />

    <main class="orders-main">
      <div class="orders-content">
        <div class="orders-header">
          <h1 class="orders-title">My Orders</h1>
          <p class="orders-subtitle">Track your orders placed through the platform.</p>
        </div>

        <div class="orders-panel">
          <div class="orders-toolbar">
            <input
              v-model="search"
              type="text"
              placeholder="Search order id or payment method..."
              class="orders-search-input"
            />
            <div class="orders-total">Total Orders: {{ filteredOrders.length }}</div>
          </div>

          <div class="orders-table-wrap">
            <table class="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="7" class="orders-empty-cell">
                    <PageSectionSkeleton variant="table" :rows="5" :columns="7" />
                  </td>
                </tr>
                <tr v-else-if="filteredOrders.length === 0">
                  <td colspan="7" class="orders-empty-cell">No orders found.</td>
                </tr>
                <tr v-for="order in filteredOrders" :key="order.id">
                  <td class="orders-primary-cell">{{ order.id }}</td>
                  <td>{{ order.items.length }}</td>
                  <td class="orders-total-cell">PHP {{ Number(order.total || 0).toFixed(2) }}</td>
                  <td>{{ order.paymentMethod || 'Cash' }}</td>
                  <td>
                    <span
                      class="orders-status-badge"
                      :class="order.status === 'Completed'
                        ? 'orders-status-completed'
                        : order.status === 'Cancelled'
                          ? 'orders-status-cancelled'
                          : 'orders-status-pending'"
                    >
                      {{ order.status || 'Pending' }}
                    </span>
                  </td>
                  <td>{{ formatDate(order.createdAt) }}</td>
                  <td>
                    <div class="orders-action-group">
                      <button
                        type="button"
                        class="orders-button orders-button-primary"
                        @click="openOrder(order)"
                      >
                        View
                      </button>
                      <button
                        v-if="canCancelOrder(order)"
                        type="button"
                        class="orders-button orders-button-danger"
                        @click="openCancelModal(order)"
                      >
                        Cancel
                      </button>
                      <button
                        v-if="canMarkReceived(order)"
                        type="button"
                        class="orders-button orders-button-success"
                        @click="openReceiveModal(order)"
                      >
                        Order Received
                      </button>
                      <button
                        v-if="canRequestRefund(order)"
                        type="button"
                        class="orders-button orders-button-accent"
                        @click="openRefundModal(order)"
                      >
                        Request Refund
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <Modal :isOpen="showModal" @close="closeModal" :showConfirm="false" panelClass="bg-slate-900 border border-slate-700">
      <div v-if="selectedOrder" class="text-slate-200">
        <h2 class="text-xl font-semibold text-white mb-2">Order Details</h2>
        <p class="text-sm text-slate-400 mb-4">Order ID: {{ selectedOrder.id }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p class="text-xs uppercase text-slate-400">Delivery</p>
            <p class="text-white font-semibold mt-1">{{ selectedOrder.delivery?.fullName || selectedOrder.customerName || 'Customer' }}</p>
            <p class="text-xs text-slate-400">Phone: {{ selectedOrder.delivery?.phone || 'N/A' }}</p>
            <p class="text-xs text-slate-400">Address: {{ selectedOrder.delivery?.address || 'N/A' }}</p>
          </div>
          <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p class="text-xs uppercase text-slate-400">Payment</p>
            <p class="text-white font-semibold mt-1">{{ selectedOrder.paymentMethod || 'Cash' }}</p>
            <p class="text-xs text-slate-400 mt-2">Total: PHP {{ Number(selectedOrder.total || 0).toFixed(2) }}</p>
            <p class="text-xs text-slate-400">Status: {{ selectedOrder.status || 'Pending' }}</p>
            <p v-if="selectedOrder.cancelledAt" class="text-xs text-slate-400">Cancelled: {{ formatDate(selectedOrder.cancelledAt) }}</p>
            <p v-if="selectedOrder.receivedAt" class="text-xs text-slate-400">Received: {{ formatDate(selectedOrder.receivedAt) }}</p>
            <p class="text-xs text-slate-400">Created: {{ formatDate(selectedOrder.createdAt) }}</p>
          </div>
        </div>

        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p class="text-xs uppercase text-slate-400 mb-3">Items</p>
          <div v-for="item in selectedOrder.items" :key="item.id" class="flex items-start justify-between py-2 border-b border-slate-700 last:border-b-0">
            <div>
              <p class="text-white font-medium">{{ item.name }}</p>
              <p class="text-xs text-slate-400">Qty: {{ item.quantity }} • Branch: {{ item.branchName || 'N/A' }}</p>
            </div>
            <div class="text-amber-300">PHP {{ Number(item.price || 0).toFixed(2) }}</div>
          </div>
        </div>

        <div v-if="selectedOrder.deliveryReview || selectedOrder.deliveryProofUrl" class="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-4">
          <p class="text-xs uppercase text-slate-400 mb-3">Proof of Receipt</p>
          <div v-if="selectedOrder.deliveryRating" class="mb-3 flex items-center gap-1">
            <span
              v-for="star in 5"
              :key="`display-star-${star}`"
              class="text-lg"
              :class="star <= Number(selectedOrder.deliveryRating || 0) ? 'text-amber-300' : 'text-slate-600'"
            >
              ★
            </span>
          </div>
          <p v-if="selectedOrder.deliveryReview" class="text-sm text-slate-200 whitespace-pre-wrap">{{ selectedOrder.deliveryReview }}</p>
          <a
            v-if="selectedOrder.deliveryProofUrl"
            :href="selectedOrder.deliveryProofUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex mt-3 px-3 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white text-xs"
          >
            View Proof Photo
          </a>
        </div>

        <div v-if="selectedOrder.refundRequestId || selectedOrder.refundVoucherId" class="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-4">
          <p class="text-xs uppercase text-slate-400 mb-3">Refund Status</p>
          <p class="text-sm text-slate-200">
            {{ selectedOrder.refundRequestStatus || (selectedOrder.refundVoucherId ? 'Approved' : 'Not requested') }}
          </p>
          <p v-if="selectedOrder.refundReason" class="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{{ selectedOrder.refundReason }}</p>
          <a
            v-if="selectedOrder.refundProofUrl"
            :href="selectedOrder.refundProofUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex mt-3 px-3 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs"
          >
            View Refund Proof
          </a>
        </div>

        <div v-if="selectedOrder.cancelReasonType || selectedOrder.cancelReasonDetails" class="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-4">
          <p class="text-xs uppercase text-slate-400 mb-3">Cancellation</p>
          <p class="text-sm text-slate-200">{{ selectedOrder.cancelReasonType || 'No reason recorded' }}</p>
          <p v-if="selectedOrder.cancelReasonDetails" class="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{{ selectedOrder.cancelReasonDetails }}</p>
          <p v-if="selectedOrder.paymentStatus === 'Refunded'" class="mt-3 text-xs text-emerald-300">
            Refund initiated. Depending on your payment method, the amount may reflect within 24 hours or a few business days.
          </p>
        </div>
      </div>
    </Modal>

    <Modal :isOpen="showReceiveModal" @close="closeReceiveModal" :showConfirm="false" panelClass="bg-slate-900 border border-slate-700">
      <div class="text-slate-200">
        <h2 class="text-xl font-semibold text-white mb-2">Confirm Order Received</h2>
        <p class="text-sm text-slate-400 mb-4">
          Upload a proof photo and leave a short review to confirm that you already received this order.
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">Proof of Delivery Photo</label>
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-gold-700 file:px-3 file:py-2 file:text-white hover:file:bg-gold-800"
              @change="handleProofFileChange"
            />
            <p v-if="receiveForm.fileName" class="mt-2 text-xs text-slate-400">Selected: {{ receiveForm.fileName }}</p>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">Delivery Rating</label>
            <div class="flex items-center gap-2">
              <button
                v-for="star in 5"
                :key="`input-star-${star}`"
                type="button"
                class="text-3xl leading-none transition"
                :class="star <= receiveForm.rating ? 'text-amber-300' : 'text-slate-500 hover:text-amber-200'"
                @click="receiveForm.rating = star"
              >
                ★
              </button>
            </div>
            <p class="mt-2 text-xs text-slate-400">Choose a rating from 1 to 5 stars.</p>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">Delivery Review</label>
            <textarea
              v-model="receiveForm.review"
              rows="4"
              class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold-500"
              placeholder="Describe the condition of the order and confirm that you received it."
            />
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="isSubmittingReceive"
              class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white"
              @click="confirmOrderReceived"
            >
              {{ isSubmittingReceive ? 'Submitting...' : 'Submit and Complete Order' }}
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              @click="closeReceiveModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>

    <Modal :isOpen="showRefundModal" @close="closeRefundModal" :showConfirm="false" panelClass="bg-slate-900 border border-slate-700">
      <div class="text-slate-200">
        <h2 class="text-xl font-semibold text-white mb-2">Request Refund</h2>
        <p class="text-sm text-slate-400 mb-4">
          Submit your refund concern with supporting proof. The clinic owner/admin will review it and issue a voucher if approved.
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">Reason</label>
            <select
              v-model="refundRequestForm.issueType"
              class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a refund reason</option>
              <option value="Damaged Item">Damaged Item</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Missing Item">Missing Item</option>
              <option value="Quality Concern">Quality Concern</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">Details</label>
            <textarea
              v-model="refundRequestForm.reason"
              rows="4"
              class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe what went wrong with the order."
            />
          </div>

          <div>
            <label class="block text-sm text-slate-400 mb-2">Proof Photo</label>
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-purple-700 file:px-3 file:py-2 file:text-white hover:file:bg-purple-800"
              @change="handleRefundProofFileChange"
            />
            <p v-if="refundRequestForm.fileName" class="mt-2 text-xs text-slate-400">Selected: {{ refundRequestForm.fileName }}</p>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="isSubmittingRefundRequest"
              class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white"
              @click="submitRefundRequest"
            >
              {{ isSubmittingRefundRequest ? 'Submitting...' : 'Submit Refund Request' }}
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              @click="closeRefundModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>

    <Modal :isOpen="showCancelModal" @close="closeCancelModal" :showConfirm="false" panelClass="bg-slate-900 border border-slate-700">
      <div class="text-slate-200">
        <h2 class="text-xl font-semibold text-white mb-2">Cancel Order</h2>
        <p class="text-sm text-slate-400 mb-4">
          Choose a cancellation reason. If this order was already paid online, your refund will be processed after cancellation.
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-slate-400 mb-2">Reason</label>
            <select
              v-model="cancelForm.reasonType"
              class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select a reason</option>
              <option value="Changed my mind">Changed my mind</option>
              <option value="Ordered by mistake">Ordered by mistake</option>
              <option value="Wrong delivery details">Wrong delivery details</option>
              <option value="Found a better option">Found a better option</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div v-if="cancelForm.reasonType === 'Other'">
            <label class="block text-sm text-slate-400 mb-2">Please specify</label>
            <textarea
              v-model="cancelForm.reasonDetails"
              rows="4"
              class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Tell us why you are cancelling this order."
            />
          </div>

          <div class="rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-xs text-slate-300">
            Refund notice: if your payment was already processed online, the refund is initiated after cancellation and may reflect within 24 hours or a few business days depending on your payment method.
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="isSubmittingCancel"
              class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white"
              @click="confirmCancelOrder"
            >
              {{ isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation' }}
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              @click="closeCancelModal"
            >
              Keep Order
            </button>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { addDoc, getFirestore, collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { storage } from '@/config/firebaseConfig'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

export default {
  name: 'CustomerOrders',
  components: { CustomerSidebar, Modal, PageSectionSkeleton },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const loading = ref(true)
    const search = ref('')
    const orders = ref([])
    const showModal = ref(false)
    const selectedOrder = ref(null)
    const showReceiveModal = ref(false)
    const selectedReceiveOrder = ref(null)
    const isSubmittingReceive = ref(false)
    const showRefundModal = ref(false)
    const selectedRefundOrder = ref(null)
    const isSubmittingRefundRequest = ref(false)
    const showCancelModal = ref(false)
    const selectedCancelOrder = ref(null)
    const isSubmittingCancel = ref(false)
    const receiveForm = ref({
      file: null,
      fileName: '',
      rating: 0,
      review: '',
    })
    const refundRequestForm = ref({
      issueType: '',
      reason: '',
      file: null,
      fileName: '',
    })
    const cancelForm = ref({
      reasonType: '',
      reasonDetails: '',
    })
    let unsubscribeOrders = null

    const formatDate = (value) => {
      if (!value) return 'N/A'
      if (value.toDate) return value.toDate().toLocaleString()
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString()
      return String(value)
    }

    const fetchFromBackend = async (path, options = {}) => {
      const baseUrl = String(OTP_API_BASE || '').trim()
      if (!baseUrl) {
        throw new Error('VITE_OTP_API_BASE_URL is not set.')
      }
      const response = await fetch(`${baseUrl}${path}`, options)
      if (response.status === 404) {
        throw new Error(`Endpoint not found on ${baseUrl}`)
      }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`Non-JSON response from ${baseUrl}`)
      }
      return response
    }

    const buildAuthHeaders = async (headers = {}) => {
      const user = auth.currentUser
      if (!user) {
        throw new Error('You must be logged in to continue.')
      }
      const token = await user.getIdToken()
      return {
        ...headers,
        Authorization: `Bearer ${token}`,
      }
    }

    const createCustomerNotification = async ({ title, message, link = '/customer/orders' }) => {
      const user = auth.currentUser
      if (!user) return
      await addDoc(collection(db, 'notifications'), {
        recipientUserId: user.uid,
        title: String(title || 'Notification').trim(),
        message: String(message || '').trim(),
        link,
        read: false,
        deleted: false,
        createdAt: serverTimestamp(),
      })
    }

    const getCreatedAtMillis = (order) => {
      if (order?.createdAt?.toDate) return order.createdAt.toDate().getTime()
      const parsed = new Date(order?.createdAt || 0)
      return parsed.getTime()
    }

    const canCancelOrder = (order) => {
      const status = String(order?.status || 'Pending')
      if (status === 'Cancelled' || status === 'Completed') return false
      const createdAtMillis = getCreatedAtMillis(order)
      if (!createdAtMillis) return false
      const diffHours = (Date.now() - createdAtMillis) / (1000 * 60 * 60)
      return diffHours <= 24
    }

    const canMarkReceived = (order) => {
      const status = String(order?.status || '').trim().toLowerCase()
      return status !== 'completed' && status !== 'cancelled' && status !== 'refunded'
    }

    const canRequestRefund = (order) => {
      const status = String(order?.status || '').trim().toLowerCase()
      const refundRequestStatus = String(order?.refundRequestStatus || '').trim().toLowerCase()
      if (status !== 'completed') return false
      if (order?.refundVoucherId) return false
      if (order?.refundRequestId && refundRequestStatus !== 'rejected') return false
      return refundRequestStatus !== 'approved' && refundRequestStatus !== 'pending'
    }

    const handleProofFileChange = (event) => {
      const file = event?.target?.files?.[0] || null
      receiveForm.value.file = file
      receiveForm.value.fileName = file?.name || ''
    }

    const handleRefundProofFileChange = (event) => {
      const file = event?.target?.files?.[0] || null
      refundRequestForm.value.file = file
      refundRequestForm.value.fileName = file?.name || ''
    }

    const resetReceiveForm = () => {
      receiveForm.value = {
        file: null,
        fileName: '',
        rating: 0,
        review: '',
      }
    }

    const resetRefundRequestForm = () => {
      refundRequestForm.value = {
        issueType: '',
        reason: '',
        file: null,
        fileName: '',
      }
    }

    const resetCancelForm = () => {
      cancelForm.value = {
        reasonType: '',
        reasonDetails: '',
      }
    }

    const openReceiveModal = (order) => {
      selectedReceiveOrder.value = order
      resetReceiveForm()
      showReceiveModal.value = true
    }

    const closeReceiveModal = () => {
      showReceiveModal.value = false
      selectedReceiveOrder.value = null
      resetReceiveForm()
    }

    const openRefundModal = (order) => {
      selectedRefundOrder.value = order
      resetRefundRequestForm()
      showRefundModal.value = true
    }

    const closeRefundModal = () => {
      showRefundModal.value = false
      selectedRefundOrder.value = null
      resetRefundRequestForm()
    }

    const openCancelModal = (order) => {
      selectedCancelOrder.value = order
      resetCancelForm()
      showCancelModal.value = true
    }

    const closeCancelModal = () => {
      showCancelModal.value = false
      selectedCancelOrder.value = null
      resetCancelForm()
    }

    const confirmOrderReceived = async () => {
      if (!selectedReceiveOrder.value?.id) {
        toast.error('No order selected.')
        return
      }
      if (!receiveForm.value.file) {
        toast.error('Please upload a proof photo.')
        return
      }
      if (!String(receiveForm.value.review || '').trim()) {
        toast.error('Please leave a short delivery review.')
        return
      }
      if (Number(receiveForm.value.rating || 0) < 1) {
        toast.error('Please choose a delivery rating.')
        return
      }

      isSubmittingReceive.value = true
      try {
        const extension = String(receiveForm.value.file.name || '').split('.').pop() || 'jpg'
        const filePath = `order-receipts/${selectedReceiveOrder.value.id}/${Date.now()}.${extension}`
        const fileRef = storageRef(storage, filePath)
        await uploadBytes(fileRef, receiveForm.value.file)
        const proofUrl = await getDownloadURL(fileRef)

        await updateDoc(doc(db, 'customerOrders', selectedReceiveOrder.value.id), {
          status: 'Completed',
          receivedAt: serverTimestamp(),
          deliveryProofUrl: proofUrl,
          deliveryProofPath: filePath,
          deliveryRating: Number(receiveForm.value.rating || 0),
          deliveryReview: String(receiveForm.value.review || '').trim(),
          updatedAt: serverTimestamp(),
        })

        selectedReceiveOrder.value.status = 'Completed'
        selectedReceiveOrder.value.receivedAt = new Date()
        selectedReceiveOrder.value.deliveryProofUrl = proofUrl
        selectedReceiveOrder.value.deliveryProofPath = filePath
        selectedReceiveOrder.value.deliveryRating = Number(receiveForm.value.rating || 0)
        selectedReceiveOrder.value.deliveryReview = String(receiveForm.value.review || '').trim()

        if (selectedOrder.value?.id === selectedReceiveOrder.value.id) {
          selectedOrder.value = { ...selectedReceiveOrder.value }
        }

        await createCustomerNotification({
          title: 'Order Completed',
          message: `You confirmed receipt for order ${selectedReceiveOrder.value.id}. Thank you for your review.`,
        })

        toast.success('Order marked as received.')
        closeReceiveModal()
      } catch (error) {
        console.error(error)
        toast.error('Failed to confirm order received.')
      } finally {
        isSubmittingReceive.value = false
      }
    }

    const submitRefundRequest = async () => {
      if (!selectedRefundOrder.value?.id) {
        toast.error('No order selected.')
        return
      }
      if (!String(refundRequestForm.value.issueType || '').trim()) {
        toast.error('Please choose a refund reason.')
        return
      }
      if (!String(refundRequestForm.value.reason || '').trim()) {
        toast.error('Please describe your refund concern.')
        return
      }
      if (!refundRequestForm.value.file) {
        toast.error('Please upload a proof photo.')
        return
      }

      isSubmittingRefundRequest.value = true
      try {
        const extension = String(refundRequestForm.value.file.name || '').split('.').pop() || 'jpg'
        const filePath = `refund-requests/${selectedRefundOrder.value.id}/${Date.now()}.${extension}`
        const fileRef = storageRef(storage, filePath)
        await uploadBytes(fileRef, refundRequestForm.value.file)
        const proofUrl = await getDownloadURL(fileRef)

        const requestPayload = {
          orderId: selectedRefundOrder.value.id,
          customerId: selectedRefundOrder.value.customerId || auth.currentUser?.uid || '',
          customerName: selectedRefundOrder.value.customerName || selectedRefundOrder.value.delivery?.fullName || 'Customer',
          branchId: selectedRefundOrder.value.branchId || '',
          branchName: selectedRefundOrder.value.branchName || '',
          amount: Number(selectedRefundOrder.value.total || 0),
          issueType: String(refundRequestForm.value.issueType || '').trim(),
          reason: String(refundRequestForm.value.reason || '').trim(),
          proofUrl,
          proofPath: filePath,
          status: 'Pending',
          orderStatusAtRequest: selectedRefundOrder.value.status || 'Completed',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }

        const requestRef = await addDoc(collection(db, 'refundRequests'), requestPayload)

        await updateDoc(doc(db, 'customerOrders', selectedRefundOrder.value.id), {
          status: 'Refund Requested',
          refundRequestId: requestRef.id,
          refundRequestStatus: 'Pending',
          refundIssueType: requestPayload.issueType,
          refundReason: requestPayload.reason,
          refundProofUrl: proofUrl,
          refundProofPath: filePath,
          refundRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        const targetOrder = orders.value.find((entry) => entry.id === selectedRefundOrder.value.id)
        if (targetOrder) {
          targetOrder.status = 'Refund Requested'
          targetOrder.refundRequestId = requestRef.id
          targetOrder.refundRequestStatus = 'Pending'
          targetOrder.refundIssueType = requestPayload.issueType
          targetOrder.refundReason = requestPayload.reason
          targetOrder.refundProofUrl = proofUrl
          targetOrder.refundProofPath = filePath
        }

        if (selectedOrder.value?.id === selectedRefundOrder.value.id && targetOrder) {
          selectedOrder.value = { ...targetOrder }
        }

        await createCustomerNotification({
          title: 'Refund Request Submitted',
          message: `Your refund request for order ${selectedRefundOrder.value.id} has been submitted and is now pending review.`,
        })

        toast.success('Refund request submitted.')
        closeRefundModal()
      } catch (error) {
        console.error(error)
        toast.error('Failed to submit refund request.')
      } finally {
        isSubmittingRefundRequest.value = false
      }
    }

    const confirmCancelOrder = async () => {
      const order = selectedCancelOrder.value
      if (!order?.id) return
      if (!canCancelOrder(order)) {
        toast.error('Orders can only be cancelled within 24 hours.')
        return
      }

      const reasonType = String(cancelForm.value.reasonType || '').trim()
      const reasonDetails = String(cancelForm.value.reasonDetails || '').trim()

      if (!reasonType) {
        toast.error('Please choose a cancellation reason.')
        return
      }
      if (reasonType === 'Other' && !reasonDetails) {
        toast.error('Please specify your cancellation reason.')
        return
      }

      isSubmittingCancel.value = true
      try {
        const isPayMongoPaid =
          String(order.source || '').trim().toLowerCase() === 'paymongo_checkout' &&
          String(order.paymentStatus || '').trim().toLowerCase() === 'paid' &&
          Boolean(String(order.paymongoPaymentId || '').trim())

        if (isPayMongoPaid) {
          const response = await fetchFromBackend(`/customer/orders/${order.id}/cancel`, {
            method: 'POST',
            headers: await buildAuthHeaders({ 'content-type': 'application/json' }),
            body: JSON.stringify({
              reasonType,
              reasonDetails,
            }),
          })
          const raw = await response.text()
          let payload = null
          try {
            payload = JSON.parse(raw)
          } catch (_error) {
            throw new Error(`Backend returned non-JSON response (${response.status}). Check backend URL/port and ensure /customer/orders/${order.id}/cancel exists.`)
          }
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error || 'Failed to cancel and refund order.')
          }

          order.status = 'Cancelled'
          order.paymentStatus = payload?.data?.paymentStatus || 'Refunded'
          order.refundType = payload?.data?.refundType || 'PayMongo'
          order.refundAmount = Number(payload?.data?.refundAmount || order.total || 0)
          order.paymongoRefundId = payload?.data?.paymongoRefundId || null
          order.paymongoRefundStatus = payload?.data?.paymongoRefundStatus || null
          order.cancelReasonType = reasonType
          order.cancelReasonDetails = reasonType === 'Other' ? reasonDetails : ''
          order.cancelledAt = new Date()
          order.refundedAt = new Date()
        } else {
          await updateDoc(doc(db, 'customerOrders', order.id), {
            status: 'Cancelled',
            cancelReasonType: reasonType,
            cancelReasonDetails: reasonType === 'Other' ? reasonDetails : '',
            cancelledAt: serverTimestamp(),
          })
          order.status = 'Cancelled'
          order.cancelReasonType = reasonType
          order.cancelReasonDetails = reasonType === 'Other' ? reasonDetails : ''
          order.cancelledAt = new Date()
        }

        if (selectedOrder.value?.id === order.id) {
          selectedOrder.value = { ...order }
        }

        await createCustomerNotification({
          title: 'Order Cancelled',
          message: isPayMongoPaid
            ? `Your order ${order.id} was cancelled. Your refund has been initiated and may reflect within 24 hours or a few business days depending on your payment method.`
            : `Your order ${order.id} was cancelled successfully.`,
        })

        closeCancelModal()
        toast.success(
          isPayMongoPaid
            ? 'Order cancelled. Your refund has been initiated and may reflect within 24 hours or a few business days depending on your payment method.'
            : 'Order cancelled successfully.'
        )
      } catch (error) {
        console.error(error)
        toast.error(error?.message || 'Failed to cancel order.')
      } finally {
        isSubmittingCancel.value = false
      }
    }

    const loadOrders = (userId) => {
      if (!userId) return
      loading.value = true
      if (unsubscribeOrders) {
        unsubscribeOrders()
        unsubscribeOrders = null
      }

      const ordersQuery = query(collection(db, 'customerOrders'), where('customerId', '==', userId))
      unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snapshot) => {
          orders.value = snapshot.docs
            .map((snap) => ({ id: snap.id, ...snap.data() }))
            .sort((a, b) => {
              const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime()
              const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime()
              return bTime - aTime
            })
          loading.value = false
        },
        (error) => {
          console.error('Failed to load orders:', error)
          toast.error('Failed to load orders.')
          loading.value = false
        }
      )
    }

    const filteredOrders = computed(() => {
      const keyword = String(search.value || '').trim().toLowerCase()
      if (!keyword) return orders.value
      return orders.value.filter((order) => {
        const text = [order.id, order.paymentMethod]
          .map((entry) => String(entry || '').toLowerCase())
          .join(' ')
        return text.includes(keyword)
      })
    })

    const openOrder = (order) => {
      selectedOrder.value = order
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      selectedOrder.value = null
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          orders.value = []
          loading.value = false
          return
        }
        await loadOrders(user.uid)
      })
    })

    onUnmounted(() => {
      if (unsubscribeOrders) unsubscribeOrders()
    })

    return {
      loading,
      search,
      filteredOrders,
      formatDate,
      openOrder,
      closeModal,
      showModal,
      selectedOrder,
      showReceiveModal,
      isSubmittingReceive,
      receiveForm,
      showRefundModal,
      isSubmittingRefundRequest,
      refundRequestForm,
      showCancelModal,
      isSubmittingCancel,
      cancelForm,
      canCancelOrder,
      canMarkReceived,
      canRequestRefund,
      openCancelModal,
      closeCancelModal,
      confirmCancelOrder,
      openReceiveModal,
      closeReceiveModal,
      handleProofFileChange,
      confirmOrderReceived,
      openRefundModal,
      closeRefundModal,
      handleRefundProofFileChange,
      submitRefundRequest,
    }
  }
}
</script>

<style scoped>
.orders-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.orders-main {
  flex: 1;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.orders-content {
  padding: 1.5rem 1.4rem 2rem;
}

.orders-header,
.orders-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.orders-header {
  padding: 1.25rem;
}

.orders-panel {
  margin-top: 1.35rem;
  padding: 1.25rem;
}

.orders-title {
  margin: 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.orders-subtitle,
.orders-total {
  color: rgba(76, 54, 40, 0.76);
}

.orders-subtitle {
  margin: 0.75rem 0 0;
  line-height: 1.7;
}

.orders-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.orders-search-input {
  width: 100%;
  max-width: 30rem;
  min-height: 3.25rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.92);
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.orders-search-input::placeholder {
  color: #b08b6e;
}

.orders-search-input:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.orders-table-wrap {
  overflow-x: auto;
  border-radius: 1.35rem;
  border: 1px solid rgba(230, 193, 150, 0.72);
  background: rgba(255, 251, 244, 0.94);
}

.orders-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

.orders-table thead tr {
  background: linear-gradient(180deg, #d8b891 0%, #c8a57d 100%);
}

.orders-table th {
  padding: 1rem 1.05rem;
  text-align: left;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #4d301f;
}

.orders-table td {
  padding: 1rem 1.05rem;
  border-top: 1px solid rgba(230, 193, 150, 0.5);
  color: #6a4b39;
  font-size: 0.94rem;
  vertical-align: middle;
}

.orders-table tbody tr:nth-child(even) {
  background: rgba(252, 245, 233, 0.76);
}

.orders-table tbody tr:hover {
  background: rgba(245, 230, 209, 0.72);
}

.orders-primary-cell {
  color: #2f1d14;
  font-weight: 600;
}

.orders-total-cell {
  color: #a56b44;
  font-weight: 700;
}

.orders-empty-cell {
  padding: 1.6rem 1rem;
  text-align: center;
  color: rgba(76, 54, 40, 0.76);
}

.orders-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
}

.orders-status-completed {
  background: rgba(95, 158, 107, 0.16);
  color: #46744b;
  border: 1px solid rgba(95, 158, 107, 0.22);
}

.orders-status-cancelled {
  background: rgba(194, 96, 96, 0.14);
  color: #9a4444;
  border: 1px solid rgba(194, 96, 96, 0.22);
}

.orders-status-pending {
  background: rgba(213, 160, 94, 0.18);
  color: #8a5e1d;
  border: 1px solid rgba(213, 160, 94, 0.28);
}

.orders-action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.orders-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.65rem;
  padding: 0.75rem 1rem;
  border-radius: 0.95rem;
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 0.18s ease, filter 0.18s ease, background-color 0.18s ease;
}

.orders-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.orders-button-primary {
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
}

.orders-button-success {
  border: 1px solid rgba(79, 138, 89, 0.22);
  background: linear-gradient(120deg, #6aa06f 0%, #4f8556 48%, #3f6d46 100%);
  color: #f6fff5;
}

.orders-button-danger {
  border: 1px solid rgba(175, 98, 98, 0.28);
  background: linear-gradient(120deg, #ca7c7c 0%, #b85e5e 48%, #974444 100%);
  color: #fff8f2;
}

.orders-button-accent {
  border: 1px solid rgba(135, 104, 172, 0.28);
  background: linear-gradient(120deg, #9d7cc4 0%, #7f60ad 48%, #65458f 100%);
  color: #fff8ff;
}

@media (min-width: 1280px) {
  .orders-content {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 767px) {
  .orders-content {
    padding: 1rem 1rem 1.5rem;
  }

  .orders-toolbar {
    align-items: stretch;
  }

  .orders-search-input {
    max-width: none;
  }
}
</style>
