<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />
    
    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Purchase Requests</h1>
          <p class="text-slate-400">Manage and approve purchase requests from branches</p>
          <p v-if="canCreateRequests && !canReviewRequests" class="text-xs text-amber-300 mt-2">
            You can submit requests here. Approval actions are reserved for reviewers.
          </p>
          <p v-else-if="canReviewRequests && !canCreateRequests" class="text-xs text-amber-300 mt-2">
            You can review branch purchase requests.
          </p>
        </div>
        <button 
          v-if="canCreateRequests"
          @click="showAddModal = true"
          class="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          New Request
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Pending</h3>
          <p class="text-3xl font-bold text-orange-500">{{ pendingCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Delivered</h3>
          <p class="text-3xl font-bold text-green-500">{{ deliveredCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Delayed</h3>
          <p class="text-3xl font-bold text-yellow-500">{{ delayedCount }}</p>
        </div>
        <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 class="text-slate-400 text-sm mb-2">Total</h3>
          <p class="text-3xl font-bold text-white">{{ totalCount }}</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-slate-400 text-sm mb-2">Search</label>
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="Search requests..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Status</label>
            <select 
              v-model="selectedStatus"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
              <option value="Delayed">Delayed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Branch</label>
            <select 
              v-model="selectedBranch"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Branches</option>
              <option v-for="branch in branchOptions" :key="branch" :value="branch">{{ branch }}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-sm mb-2">Priority</label>
            <select 
              v-model="selectedPriority"
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Request ID</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Item</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Branch</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Quantity</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Priority</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Date</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Payment</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Receipts</th>
                <th class="px-4 py-3 text-left text-[11px] font-medium text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="request in filteredRequests" :key="request.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-white font-medium">{{ request.id }}</span>
                </td>
                <td class="px-4 py-3">
                  <div>
                    <p class="text-white font-medium">{{ request.item }}</p>
                    <p class="text-slate-400 text-sm">{{ request.supplier }}</p>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-slate-300">{{ request.branch }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-white">{{ request.quantity }} {{ request.unit }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span 
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      request.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                      request.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    ]"
                  >
                    {{ request.priority }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="text-slate-300">{{ request.date }}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span 
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium',
                      request.status === 'Pending' ? 'bg-orange-500/20 text-orange-400' :
                      request.status === 'Delivered' ? 'bg-green-500/20 text-green-400' :
                      request.status === 'Delayed' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    ]"
                  >
                    {{ request.status }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    @click="canReviewRequests ? togglePaymentStatus(request) : null"
                    :class="[
                      'px-3 py-1 rounded-full text-xs font-medium select-none',
                      canReviewRequests
                        ? request.status === 'Delivered'
                          ? 'cursor-pointer'
                          : 'cursor-default'
                        : 'cursor-default opacity-50 cursor-not-allowed',
                      request.paymentStatus === 'Paid' ? 'bg-green-500/20 text-green-400' :
                      request.paymentStatus === 'Partial' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-rose-500/20 text-rose-400'
                    ]"
                    :title="canReviewRequests
                      ? request.status === 'Delivered'
                        ? 'Mark as paid (requires receipt)'
                        : request.status === 'Cancelled'
                          ? 'Cancelled requests cannot be paid'
                          : 'Payment can be changed only after delivery'
                      : 'You do not have review access for purchase requests.'"
                  >
                    {{ request.paymentStatus || 'Unpaid' }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <button
                    v-if="canReviewRequests"
                    type="button"
                    class="px-3 py-1 rounded text-xs font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
                    :disabled="request.status !== 'Delivered' || request.status === 'Cancelled'"
                    @click="openReceiptModal(request)"
                  >
                    {{ request.receiptUrl ? 'View / Replace' : 'Upload Receipt' }}
                  </button>
                  <span v-else class="text-slate-400 text-xs">Read only</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div v-if="canReviewRequests" class="flex items-center gap-2">
                    <button 
                      @click="markDelivered(request)"
                      :disabled="request.status === 'Delivered' || request.status === 'Cancelled'"
                      class="text-green-400 hover:text-green-300 transition-colors"
                      :class="{ 'opacity-40 cursor-not-allowed hover:text-green-400': request.status === 'Delivered' || request.status === 'Cancelled' }"
                      title="Mark as Delivered"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </button>
                    <button 
                      @click="markDelayed(request.id)"
                      :disabled="request.status === 'Delivered' || request.status === 'Cancelled'"
                      class="text-yellow-400 hover:text-yellow-300 transition-colors"
                      :class="{ 'opacity-40 cursor-not-allowed hover:text-yellow-400': request.status === 'Delivered' || request.status === 'Cancelled' }"
                      title="Mark as Delayed"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                    </button>
                    <button
                      @click="openCancelModal(request)"
                      :disabled="request.status === 'Delivered' || request.status === 'Cancelled'"
                      class="text-red-400 hover:text-red-300 transition-colors"
                      :class="{ 'opacity-40 cursor-not-allowed hover:text-red-400': request.status === 'Delivered' || request.status === 'Cancelled' }"
                      title="Cancel Request"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636 5.636 18.364M6.343 6.343l11.314 11.314"></path>
                      </svg>
                    </button>
                  </div>
                  <span v-else class="text-slate-400 text-xs">No review access</span>
                </td>
              </tr>

              <tr v-if="requests.length === 0">
                <td colspan="10" class="px-4 py-8 text-center text-slate-400">No purchase requests yet.</td>
              </tr>

              <tr v-else-if="filteredRequests.length === 0">
                <td colspan="10" class="px-4 py-8 text-center text-slate-400">No purchase requests matched your filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="showAddModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-8 max-w-2xl w-full mx-auto my-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-white mb-6">New Purchase Request</h2>
          <form @submit.prevent="addRequest" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-slate-400 text-sm mb-2">Supplier</label>
                <select 
                  v-model="newRequest.supplierId"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="" disabled>Select Supplier</option>
                  <option v-for="supplier in activeSuppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Item</label>
                <select 
                  v-model="newRequest.itemId"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="" disabled>{{ newRequest.supplierId ? 'Select Item' : 'Select Supplier First' }}</option>
                  <option v-for="item in supplierItemOptions" :key="item.id" :value="item.id">
                    {{ item.name }} ({{ item.category || 'Uncategorized' }}) - PHP {{ Number(item.unitCost || 0).toLocaleString() }}/unit
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Branch</label>
                <input
                  :value="currentBranchName || '-'"
                  disabled
                  class="w-full bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Category</label>
                <input
                  :value="selectedSupplierItem?.category || '-'"
                  disabled
                  class="w-full bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Quantity</label>
                <input 
                  v-model.number="newRequest.quantity"
                  type="number" 
                  min="1"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Unit Cost</label>
                <input
                  :value="`PHP ${selectedUnitCost.toLocaleString()}`"
                  disabled
                  class="w-full bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Estimated Total Cost</label>
                <input
                  :value="`PHP ${selectedTotalCost.toLocaleString()}`"
                  disabled
                  class="w-full bg-slate-700 text-slate-300 px-4 py-2 rounded-lg border border-slate-600 focus:outline-none"
                />
              </div>
              <div class="col-span-2">
                <div class="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
                  <div class="flex items-center justify-between mb-2">
                    <p class="text-sm text-slate-200 font-semibold">DSS Recommendation</p>
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-50"
                      :disabled="!dssSuggestion"
                      @click="applyDssSuggestion"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                  <div v-if="!dssSuggestion" class="text-xs text-slate-400">
                    Select an item to see recommended quantity and priority.
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                    <div>
                      <p class="text-slate-400">Current Stock</p>
                      <p class="text-white font-semibold">{{ dssSuggestion.currentStock }} {{ dssSuggestion.unit }}</p>
                    </div>
                    <div>
                      <p class="text-slate-400">Suggested Qty</p>
                      <p class="text-white font-semibold">{{ dssSuggestion.recommendedQty }} {{ dssSuggestion.unit }}</p>
                    </div>
                    <div>
                      <p class="text-slate-400">Recommended Priority</p>
                      <p class="text-white font-semibold">{{ dssSuggestion.priority }}</p>
                    </div>
                    <div class="md:col-span-3 text-slate-400">
                      {{ dssSuggestion.reason }}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-slate-400 text-sm mb-2">Priority</label>
                <select 
                  v-model="newRequest.priority"
                  required
                  class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-slate-400 text-sm mb-2">Reason/Notes</label>
              <textarea 
                v-model="newRequest.notes"
                rows="3"
                required
                class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              ></textarea>
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button 
                type="button"
                @click="showAddModal = false"
                class="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                :disabled="saving || activeSuppliers.length === 0 || supplierItemOptions.length === 0"
                class="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
              >
                {{ saving ? 'Submitting...' : 'Submit Request' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-if="showPaymentModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-6 max-w-xl w-full mx-auto my-8 border border-slate-700">
          <h2 class="text-xl font-bold text-white mb-4">Mark Payment as Paid</h2>
          <p class="text-slate-400 text-sm mb-5">
            Upload receipt before confirming payment for this delivered request.
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-slate-400 text-sm mb-2">Amount Paid</label>
              <input
                :value="`PHP ${Number(paymentAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`"
                disabled
                class="w-full bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-slate-600"
              />
            </div>

            <div>
              <label class="block text-slate-400 text-sm mb-2">Receipt Upload</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                @change="handlePaymentReceiptUpload"
                class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600"
              />
              <p v-if="paymentReceiptName" class="text-xs text-slate-400 mt-1">Selected: {{ paymentReceiptName }}</p>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              @click="closePaymentModal"
              class="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="paymentSaving"
              @click="submitPaymentWithReceipt"
              class="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              {{ paymentSaving ? 'Saving...' : 'Confirm Paid' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showReceiptModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-auto my-8 border border-slate-700">
          <h2 class="text-xl font-bold text-white mb-3">Receipt Upload</h2>
          <p class="text-slate-400 text-sm mb-5">
            {{ receiptTarget?.item || '-' }} - {{ receiptTarget?.supplier || '-' }}
          </p>

          <div v-if="receiptTarget?.receiptUrl" class="mb-4">
            <img
              v-if="isReceiptImage(receiptTarget)"
              :src="receiptTarget.receiptUrl"
              alt="Current receipt"
              class="w-full max-h-72 object-contain rounded-lg border border-slate-700 bg-slate-900"
            />
            <a
              v-else
              :href="receiptTarget.receiptUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sky-300 hover:text-sky-200 underline text-sm"
            >
              Open current receipt
            </a>
          </div>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Upload Receipt Image/PDF</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              @change="handleStandaloneReceiptUpload"
              class="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600"
            />
            <p v-if="standaloneReceiptName" class="text-xs text-slate-400 mt-1">Selected: {{ standaloneReceiptName }}</p>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              @click="closeReceiptModal"
              class="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Close
            </button>
            <button
              type="button"
              :disabled="receiptSaving"
              @click="submitStandaloneReceiptUpload"
              class="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
            >
              {{ receiptSaving ? 'Uploading...' : 'Save Receipt' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showCancelModal" class="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4">
        <div class="bg-slate-800 rounded-xl p-6 max-w-xl w-full mx-auto my-8 border border-slate-700">
          <h2 class="text-xl font-bold text-white mb-3">Cancel Purchase Request</h2>
          <p class="text-slate-400 text-sm mb-5">
            Provide a reason for cancelling this request. Cancellation is only allowed before delivery.
          </p>

          <div>
            <label class="block text-slate-400 text-sm mb-2">Reason for cancellation</label>
            <textarea
              v-model="cancelReason"
              rows="4"
              placeholder="Enter reason..."
              class="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
            ></textarea>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              @click="closeCancelModal"
              class="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Close
            </button>
            <button
              type="button"
              :disabled="cancelSaving"
              @click="submitCancellation"
              class="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {{ cancelSaving ? 'Cancelling...' : 'Confirm Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { usePermissions } from '@/composables/usePermissions'

export default {
  name: 'ManagerPurchaseRequests',
  components: {
    OwnerSidebar
  },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const storage = getStorage(getApp())
    const { hasPermission } = usePermissions()

    const showAddModal = ref(false)
    const showPaymentModal = ref(false)
    const saving = ref(false)
    const paymentSaving = ref(false)
    const searchQuery = ref('')
    const selectedStatus = ref('')
    const selectedBranch = ref('')
    const selectedPriority = ref('')
    const currentUserId = ref('')
    const currentUserName = ref('')
    const currentUserRole = ref('Manager')
    const currentUserType = ref('Staff')
    const currentOwnerId = ref('')
    const currentBranchId = ref('')
    const currentBranchName = ref('')
    const requests = ref([])
    const suppliers = ref([])
    const inventoryItems = ref([])
    const paymentTarget = ref(null)
    const paymentAmount = ref(0)
    const paymentReceiptFile = ref(null)
    const paymentReceiptName = ref('')
    const showReceiptModal = ref(false)
    const receiptTarget = ref(null)
    const standaloneReceiptFile = ref(null)
    const standaloneReceiptName = ref('')
    const receiptSaving = ref(false)
    const showCancelModal = ref(false)
    const cancelTarget = ref(null)
    const cancelReason = ref('')
    const cancelSaving = ref(false)
    const canCreateRequests = computed(() => hasPermission('inventory:create'))
    const canReviewRequests = computed(() => hasPermission('inventory:review'))

    const newRequest = ref({
      supplierId: '',
      itemId: '',
      quantity: 1,
      priority: 'Low',
      notes: ''
    })

    const formatDate = (timestamp) => {
      if (!timestamp || !timestamp.toDate) return '-'
      return timestamp.toDate().toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    const getStockStatus = (currentStock, minStock) => {
      if (Number(currentStock) <= 0) return 'Out of Stock'
      if (Number(currentStock) < Number(minStock)) return 'Low Stock'
      return 'In Stock'
    }

    const getAdaptiveMinStock = (quantity) => {
      const normalizedQuantity = Math.max(0, Number(quantity) || 0)
      if (normalizedQuantity <= 0) return 0
      return 1
    }

    const logManagerActivity = async (action, meta = {}) => {
      if (!currentUserId.value) return
      try {
        await addDoc(collection(db, 'activities'), {
          actorId: currentUserId.value,
          actorName: currentUserName.value || 'Manager',
          actorRole: currentUserRole.value || 'Manager',
          actorUserType: currentUserType.value || 'Staff',
          ownerId: currentOwnerId.value || null,
          branchId: currentBranchId.value || '',
          branch: currentBranchName.value || '',
          module: 'Purchase Requests',
          details: meta.details || '',
          action,
          ...meta,
          createdAt: serverTimestamp()
        })
      } catch (error) {
        console.error('Activity log failed:', error)
      }
    }

    const branchOptions = computed(() => {
      return [...new Set(requests.value.map((request) => request.branch).filter(Boolean))]
    })

    const normalizeSupplierItems = (supplier) => {
      if (!Array.isArray(supplier?.offeredItems)) return []
      return supplier.offeredItems
        .filter((item) => (item?.name || '').trim())
        .map((item, index) => ({
          id: `${supplier.id}_${index}`,
          name: item.name.trim(),
          category: item.category || '',
          unit: item.unit || 'units',
          unitCost: Number(item.unitCost || item.costPerUnit || item.costPrice || item.unitPrice || item.price || 0)
        }))
    }

    const activeSuppliers = computed(() => {
      return suppliers.value.filter((s) => (s.status || 'Active') === 'Active')
    })

    const selectedSupplier = computed(() => {
      return activeSuppliers.value.find((s) => s.id === newRequest.value.supplierId) || null
    })

    const supplierItemOptions = computed(() => {
      const explicitItems = normalizeSupplierItems(selectedSupplier.value)
      if (explicitItems.length > 0) return explicitItems

      const supplierName = selectedSupplier.value?.name || ''
      if (!supplierName) return []

      return inventoryItems.value
        .filter((item) => (item.supplier || '') === supplierName)
        .map((item) => ({
          id: item.id,
          name: item.name || '',
          category: item.category || '',
          unit: item.unit || 'units',
          unitCost: Number(item.costPrice ?? item.unitPrice ?? 0)
        }))
    })

    const selectedSupplierItem = computed(() => {
      return supplierItemOptions.value.find((item) => item.id === newRequest.value.itemId) || null
    })
    const selectedUnitCost = computed(() => Number(selectedSupplierItem.value?.unitCost || 0))
    const selectedTotalCost = computed(() => selectedUnitCost.value * (Number(newRequest.value.quantity) || 0))

    const resolveStockPriority = (currentStock, maxStock) => {
      if (currentStock <= 0) return 'High'
      if (maxStock > 0 && currentStock < maxStock * 0.5) return 'Medium'
      return 'Low'
    }

    const computeRecommendedQty = (currentStock, maxStock) => {
      if (maxStock > 0) {
        return Math.max(maxStock - currentStock, 1)
      }
      return Math.max(10 - currentStock, 1)
    }

    const findInventoryMatch = () => {
      if (!selectedSupplierItem.value || !selectedSupplier.value) return null
      const itemName = String(selectedSupplierItem.value.name || '').trim().toLowerCase()
      const supplierName = String(selectedSupplier.value.name || '').trim().toLowerCase()
      return inventoryItems.value.find((item) =>
        String(item.name || '').trim().toLowerCase() === itemName &&
        String(item.supplier || '').trim().toLowerCase() === supplierName
      )
    }

    const dssSuggestion = computed(() => {
      const match = findInventoryMatch()
      if (!match) return null
      const currentStock = Number(match.currentStock || 0)
      const maxStock = Number(match.maxStock || currentStock || 0)
      if (currentStock > 0 && (maxStock <= 0 || currentStock >= maxStock * 0.5)) return null
      const unit = match.unit || selectedSupplierItem.value?.unit || 'units'
      const priority = resolveStockPriority(currentStock, maxStock)
      const recommendedQty = computeRecommendedQty(currentStock, maxStock)
      const reason =
        currentStock <= 0
          ? 'Item is out of stock. Immediate replenishment is recommended.'
          : currentStock < minStock
            ? 'Stock is below minimum level. Reorder soon to avoid stockouts.'
            : 'Stock is within safe levels.'

      return {
        currentStock,
        maxStock,
        unit,
        priority,
        recommendedQty,
        reason
      }
    })

    const applyDssSuggestion = () => {
      if (!dssSuggestion.value) return
      newRequest.value.quantity = dssSuggestion.value.recommendedQty
      newRequest.value.priority = dssSuggestion.value.priority
      if (!newRequest.value.notes) {
        newRequest.value.notes = `DSS: ${dssSuggestion.value.reason}`
      }
    }

    const resolveRequestCategory = (request) => {
      if (request?.category) return request.category

      const supplier = suppliers.value.find((s) => (s.name || '') === (request?.supplier || ''))
      if (!supplier) return ''

      const offeredItems = Array.isArray(supplier.offeredItems) ? supplier.offeredItems : []
      const matchedItem = offeredItems.find(
        (item) => (item?.name || '').trim().toLowerCase() === (request?.item || '').toLowerCase()
      )
      if (matchedItem?.category) return matchedItem.category

      if (Array.isArray(supplier.categories) && supplier.categories.length > 0) return supplier.categories[0]
      if (supplier.category) return supplier.category
      return ''
    }

    const loadSuppliers = async () => {
      if (!currentBranchId.value) {
        suppliers.value = []
        return
      }

      const supplierQuery = query(collection(db, 'suppliers'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(supplierQuery)
      suppliers.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadInventoryItems = async () => {
      if (!currentBranchId.value) {
        inventoryItems.value = []
        return
      }
      const itemQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(itemQuery)
      inventoryItems.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    const loadRequests = async () => {
      if (!currentBranchId.value) {
        requests.value = []
        return
      }

      const requestQuery = query(collection(db, 'purchaseRequests'), where('branchId', '==', currentBranchId.value))
      const snapshot = await getDocs(requestQuery)
      requests.value = snapshot.docs.map((snap) => {
        const data = snap.data()
        return {
          id: snap.id,
          item: data.item || '-',
          category: data.category || '',
          supplier: data.supplier || '-',
          branch: data.branch || currentBranchName.value || '-',
          quantity: data.quantity || 0,
          unit: data.unit || 'units',
          unitCost: Number(data.unitCost || 0),
          totalCost: Number(data.totalCost || 0),
          priority: data.priority || 'Low',
          date: formatDate(data.createdAt),
          status: data.status || 'Pending',
          paymentStatus: data.paymentStatus || 'Unpaid',
          amountPaid: Number(data.amountPaid || 0),
          balance: Number(data.balance || 0),
          receiptUrl: data.receiptUrl || '',
          receiptFileName: data.receiptFileName || '',
          receiptMimeType: data.receiptMimeType || '',
          receiptUploadedAt: data.receiptUploadedAt || null
        }
      })
    }

    const pendingCount = computed(() =>
      requests.value.filter((r) => r.status === 'Pending' || r.status === 'Delayed').length
    )
    const deliveredCount = computed(() => requests.value.filter((r) => r.status === 'Delivered').length)
    const delayedCount = computed(() => requests.value.filter((r) => r.status === 'Delayed').length)
    const totalCount = computed(() => requests.value.length)

    const filteredRequests = computed(() => {
      return requests.value.filter(request => {
        const searchText = searchQuery.value.toLowerCase()
        const matchesSearch = request.id.toLowerCase().includes(searchText) || request.item.toLowerCase().includes(searchText)
        const matchesStatus = !selectedStatus.value || request.status === selectedStatus.value
        const matchesBranch = !selectedBranch.value || request.branch === selectedBranch.value
        const matchesPriority = !selectedPriority.value || request.priority === selectedPriority.value
        
        return matchesSearch && matchesStatus && matchesBranch && matchesPriority
      })
    })

    const addRequest = async () => {
      if (!canCreateRequests.value) {
        toast.error('You do not have permission to create purchase requests.')
        return
      }
      if (!currentBranchId.value) {
        toast.error('Your account has no branch assignment.')
        return
      }

      if (!newRequest.value.supplierId) {
        toast.error('Please select a supplier.')
        return
      }
      if (!selectedSupplierItem.value || !selectedSupplier.value) {
        toast.error('Please select an item offered by the selected supplier.')
        return
      }

      saving.value = true
      try {
        const unitCost = Number(selectedSupplierItem.value.unitCost || 0)
        const quantity = Number(newRequest.value.quantity) || 0
        const totalCost = unitCost * quantity

        const createdRequestRef = await addDoc(collection(db, 'purchaseRequests'), {
          branchId: currentBranchId.value,
          branch: currentBranchName.value || '-',
          supplierId: selectedSupplier.value.id,
          supplier: selectedSupplier.value.name || '-',
          itemId: selectedSupplierItem.value.id,
          item: selectedSupplierItem.value.name || '',
          category:
            selectedSupplierItem.value.category ||
            (Array.isArray(selectedSupplier.value.categories) ? selectedSupplier.value.categories[0] || '' : '') ||
            selectedSupplier.value.category ||
            '',
          quantity,
          unit: selectedSupplierItem.value.unit || 'units',
          unitCost,
          totalCost,
          priority: newRequest.value.priority,
          notes: newRequest.value.notes,
          status: 'Pending',
          paymentStatus: 'Unpaid',
          amountPaid: 0,
          balance: totalCost,
          createdAt: serverTimestamp()
        })

        await logManagerActivity(`Created purchase request for ${selectedSupplierItem.value.name || 'item'}.`, {
          type: 'purchase_request_created',
          requestId: createdRequestRef.id,
          item: selectedSupplierItem.value.name || '',
          supplier: selectedSupplier.value.name || '',
          quantity,
          details: `Supplier: ${selectedSupplier.value.name || '-'}, Qty: ${quantity}`
        })

        toast.success('Purchase request submitted.')
        showAddModal.value = false
        newRequest.value = {
          supplierId: '',
          itemId: '',
          quantity: 1,
          priority: 'Low',
          notes: ''
        }
        await loadRequests()
      } catch (error) {
        console.error(error)
        toast.error('Failed to submit purchase request.')
      } finally {
        saving.value = false
      }
    }

    const upsertDeliveredItem = async (request) => {
      const quantityToAdd = Number(request.quantity) || 0
      const deliveredUnitCost = Number(request.unitCost || 0)
      if (quantityToAdd <= 0) return
      const resolvedCategory = resolveRequestCategory(request)

      const existingQuery = query(collection(db, 'inventoryItems'), where('branchId', '==', currentBranchId.value))
      const existingSnapshot = await getDocs(existingQuery)
      const existingItem = existingSnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .find((item) =>
          (item.name || '').toLowerCase() === (request.item || '').toLowerCase() &&
          (item.supplier || '').toLowerCase() === (request.supplier || '').toLowerCase()
        )

      if (existingItem) {
        const nextStock = Number(existingItem.currentStock || 0) + quantityToAdd
      const nextMinStock = getAdaptiveMinStock(nextStock)
      const baseMaxStock = Number(existingItem.maxStock || existingItem.currentStock || 0)
      const nextMaxStock = baseMaxStock + quantityToAdd
      const updatePayload = {
        currentStock: nextStock,
        minStock: nextMinStock,
        maxStock: nextMaxStock,
        stockStatus: getStockStatus(nextStock, nextMinStock),
        updatedAt: serverTimestamp()
      }
        if (deliveredUnitCost > 0 && Number(existingItem.unitPrice || 0) <= 0) {
          updatePayload.unitPrice = deliveredUnitCost
        }
        if (deliveredUnitCost > 0 && Number(existingItem.costPrice || 0) <= 0) {
          updatePayload.costPrice = deliveredUnitCost
        }
        if (!existingItem.category && resolvedCategory) {
          updatePayload.category = resolvedCategory
        }
        await updateDoc(doc(db, 'inventoryItems', existingItem.id), updatePayload)
        return
      }

      const fallbackSku = `AUTO-${Date.now()}`
      const initialMinStock = getAdaptiveMinStock(quantityToAdd)
      await addDoc(collection(db, 'inventoryItems'), {
        name: request.item || 'Unnamed Item',
        sku: fallbackSku,
        category: resolvedCategory,
        supplier: request.supplier || '',
        currentStock: quantityToAdd,
        minStock: initialMinStock,
        maxStock: quantityToAdd,
        unit: request.unit || 'units',
        costPrice: deliveredUnitCost > 0 ? deliveredUnitCost : 0,
        unitPrice: deliveredUnitCost > 0 ? deliveredUnitCost : 0,
        description: 'Auto-added from delivered purchase request',
        stockStatus: getStockStatus(quantityToAdd, initialMinStock),
        branchId: currentBranchId.value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }

    const markDelivered = async (request) => {
      try {
        if (!request?.id) return
        if (request.status === 'Delivered') {
          toast.info('This request is already marked as delivered.')
          return
        }
        if (request.status === 'Cancelled') {
          toast.info('Cancelled requests cannot be marked as delivered.')
          return
        }

        await upsertDeliveredItem(request)
        await updateDoc(doc(db, 'purchaseRequests', request.id), {
          status: 'Delivered',
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        await logManagerActivity(`Marked request as delivered: ${request.item || 'item'}.`, {
          type: 'purchase_request_delivered',
          requestId: request.id,
          item: request.item || '',
          supplier: request.supplier || '',
          quantity: Number(request.quantity || 0),
          details: `Supplier: ${request.supplier || '-'}, Qty: ${Number(request.quantity || 0)}`
        })
        await loadInventoryItems()
        await loadRequests()
        toast.success('Request marked delivered and catalog updated.')
      } catch (error) {
        console.error(error)
        toast.error('Failed to mark request as delivered.')
      }
    }

    const markDelayed = async (id) => {
      try {
        const request = requests.value.find((r) => r.id === id)
        if (request?.status === 'Delivered') {
          toast.info('Delivered requests can no longer be marked as delayed.')
          return
        }
        if (request?.status === 'Cancelled') {
          toast.info('Cancelled requests can no longer be marked as delayed.')
          return
        }
        await updateDoc(doc(db, 'purchaseRequests', id), {
          status: 'Delayed',
          updatedAt: serverTimestamp()
        })
        await logManagerActivity(`Marked request as delayed: ${request?.item || id}.`, {
          type: 'purchase_request_delayed',
          requestId: id,
          item: request?.item || '',
          supplier: request?.supplier || '',
          quantity: Number(request?.quantity || 0),
          details: `Supplier: ${request?.supplier || '-'}, Qty: ${Number(request?.quantity || 0)}`
        })
        await loadRequests()
      } catch (error) {
        console.error(error)
        toast.error('Failed to mark request as delayed.')
      }
    }

    const togglePaymentStatus = async (request) => {
      if (!request?.id) return
      if (!canReviewRequests.value) {
        toast.error('You do not have permission to review purchase requests.')
        return
      }
      if (request.status === 'Cancelled') {
        toast.info('Cancelled requests cannot be marked as paid.')
        return
      }
      if (request.status !== 'Delivered') return

      if ((request.paymentStatus || 'Unpaid') === 'Paid') {
        toast.info('This request is already marked as paid.')
        return
      }

      openPaymentModal(request)
    }

    const openPaymentModal = (request) => {
      if (!canReviewRequests.value) return
      paymentTarget.value = request
      paymentAmount.value = Number(request.totalCost || (Number(request.unitCost || 0) * Number(request.quantity || 0)) || 0)
      paymentReceiptFile.value = null
      paymentReceiptName.value = ''
      showPaymentModal.value = true
    }

    const closePaymentModal = () => {
      showPaymentModal.value = false
      paymentTarget.value = null
      paymentAmount.value = 0
      paymentReceiptFile.value = null
      paymentReceiptName.value = ''
    }

    const handlePaymentReceiptUpload = (event) => {
      const file = event?.target?.files?.[0]
      if (!file) return
      paymentReceiptFile.value = file
      paymentReceiptName.value = file.name
    }

    const isReceiptImage = (request) => String(request?.receiptMimeType || '').toLowerCase().startsWith('image/')

    const openReceiptModal = (request) => {
      if (!canReviewRequests.value) {
        toast.error('You do not have permission to review purchase requests.')
        return
      }
      receiptTarget.value = request || null
      standaloneReceiptFile.value = null
      standaloneReceiptName.value = ''
      showReceiptModal.value = true
    }

    const closeReceiptModal = () => {
      showReceiptModal.value = false
      receiptTarget.value = null
      standaloneReceiptFile.value = null
      standaloneReceiptName.value = ''
    }

    const handleStandaloneReceiptUpload = (event) => {
      const file = event?.target?.files?.[0]
      if (!file) return
      standaloneReceiptFile.value = file
      standaloneReceiptName.value = file.name
    }

    const submitStandaloneReceiptUpload = async () => {
      const request = receiptTarget.value
      if (!request?.id) return
      if (!canReviewRequests.value) {
        toast.error('You do not have permission to review purchase requests.')
        return
      }
      if (!standaloneReceiptFile.value) {
        toast.error('Please select a receipt file first.')
        return
      }

      receiptSaving.value = true
      try {
        const extension = (standaloneReceiptFile.value.name || '').split('.').pop() || 'bin'
        const receiptPath = `purchase-receipts/${currentBranchId.value}/${request.id}-${Date.now()}.${extension}`
        const receiptRef = storageRef(storage, receiptPath)
        await uploadBytes(receiptRef, standaloneReceiptFile.value)
        const receiptUrl = await getDownloadURL(receiptRef)

        await updateDoc(doc(db, 'purchaseRequests', request.id), {
          receiptUrl,
          receiptFileName: standaloneReceiptFile.value.name || '',
          receiptMimeType: standaloneReceiptFile.value.type || '',
          receiptUploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        request.receiptUrl = receiptUrl
        request.receiptFileName = standaloneReceiptFile.value.name || ''
        request.receiptMimeType = standaloneReceiptFile.value.type || ''
        toast.success('Receipt uploaded successfully.')
        closeReceiptModal()
      } catch (error) {
        console.error(error)
        toast.error('Failed to upload receipt.')
      } finally {
        receiptSaving.value = false
      }
    }

    const submitPaymentWithReceipt = async () => {
      try {
        const request = paymentTarget.value
        if (!request?.id) return
        if (!canReviewRequests.value) {
          toast.error('You do not have permission to review purchase requests.')
          return
        }
        if (!paymentReceiptFile.value) {
          toast.error('Please upload a receipt before confirming payment.')
          return
        }

        paymentSaving.value = true
        const totalCost = Number(paymentAmount.value || 0)
        const extension = (paymentReceiptFile.value.name || '').split('.').pop() || 'bin'
        const receiptPath = `purchase-receipts/${currentBranchId.value}/${request.id}-${Date.now()}.${extension}`
        const receiptRef = storageRef(storage, receiptPath)
        await uploadBytes(receiptRef, paymentReceiptFile.value)
        const receiptUrl = await getDownloadURL(receiptRef)

        const updatePayload = {
          paymentStatus: 'Paid',
          amountPaid: totalCost,
          balance: 0,
          paidAt: serverTimestamp(),
          paidBy: currentUserId.value || null,
          receiptUrl,
          receiptFileName: paymentReceiptFile.value.name || '',
          receiptMimeType: paymentReceiptFile.value.type || '',
          receiptUploadedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }

        await updateDoc(doc(db, 'purchaseRequests', request.id), updatePayload)
        request.paymentStatus = 'Paid'
        request.amountPaid = updatePayload.amountPaid
        request.balance = updatePayload.balance
        request.receiptUrl = receiptUrl
        request.receiptFileName = paymentReceiptFile.value.name || ''

        await logManagerActivity(`Payment marked as Paid: ${request.item || 'purchase request'}.`, {
          type: 'purchase_request_paid',
          requestId: request.id,
          item: request.item || '',
          supplier: request.supplier || '',
          amount: totalCost,
          details: `Supplier: ${request.supplier || '-'}, Amount: P${totalCost.toLocaleString('en-PH')}`
        })
        toast.success('Payment marked as Paid with receipt.')
        closePaymentModal()
      } catch (error) {
        console.error(error)
        toast.error('Failed to update payment status.')
      } finally {
        paymentSaving.value = false
      }
    }

    const openCancelModal = (request) => {
      if (!request?.id) return
      if (!canReviewRequests.value) {
        toast.error('You do not have permission to review purchase requests.')
        return
      }
      if (request.status === 'Delivered') {
        toast.info('Delivered requests cannot be cancelled.')
        return
      }
      if (request.status === 'Cancelled') {
        toast.info('This request is already cancelled.')
        return
      }
      cancelTarget.value = request
      cancelReason.value = ''
      showCancelModal.value = true
    }

    const closeCancelModal = () => {
      showCancelModal.value = false
      cancelTarget.value = null
      cancelReason.value = ''
    }

    const submitCancellation = async () => {
      const request = cancelTarget.value
      if (!request?.id) return
      if (!canReviewRequests.value) {
        toast.error('You do not have permission to review purchase requests.')
        return
      }
      if (request.status === 'Delivered') {
        toast.info('Delivered requests cannot be cancelled.')
        closeCancelModal()
        return
      }
      if (!String(cancelReason.value || '').trim()) {
        toast.error('Please provide a cancellation reason.')
        return
      }

      cancelSaving.value = true
      try {
        await updateDoc(doc(db, 'purchaseRequests', request.id), {
          status: 'Cancelled',
          cancellationReason: cancelReason.value.trim(),
          cancelledAt: serverTimestamp(),
          cancelledBy: currentUserId.value || null,
          updatedAt: serverTimestamp()
        })
        await logManagerActivity(`Cancelled purchase request: ${request.item || request.id}.`, {
          type: 'purchase_request_cancelled',
          requestId: request.id,
          item: request.item || '',
          supplier: request.supplier || '',
          quantity: Number(request.quantity || 0),
          details: `Supplier: ${request.supplier || '-'}, Qty: ${Number(request.quantity || 0)}`
        })
        toast.success('Purchase request cancelled.')
        closeCancelModal()
        await loadRequests()
      } catch (error) {
        console.error(error)
        toast.error('Failed to cancel request.')
      } finally {
        cancelSaving.value = false
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentUserName.value = ''
          currentUserRole.value = 'Manager'
          currentUserType.value = 'Staff'
          currentOwnerId.value = ''
          currentBranchId.value = ''
          currentBranchName.value = ''
          requests.value = []
          suppliers.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists()) {
          const profile = userSnap.data()
          currentBranchId.value = profile.branchId || ''
          const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
          currentUserName.value = profile.name || fullName || profile.email || user.email || 'Manager'
          currentUserRole.value = profile.role || 'Manager'
          currentUserType.value = profile.userType || 'Staff'
        } else {
          currentBranchId.value = ''
          currentUserName.value = user.email || 'Manager'
          currentUserRole.value = 'Manager'
          currentUserType.value = 'Staff'
        }

        if (currentBranchId.value) {
          const clinicSnap = await getDoc(doc(db, 'clinics', currentBranchId.value))
          if (clinicSnap.exists()) {
            const clinicData = clinicSnap.data()
            currentBranchName.value = clinicData.name || clinicData.clinicName || ''
            currentOwnerId.value = clinicData.ownerId || ''
          } else {
            currentBranchName.value = ''
            currentOwnerId.value = ''
          }
        } else {
          currentBranchName.value = ''
          currentOwnerId.value = ''
        }

        await loadSuppliers()
        await loadInventoryItems()
        await loadRequests()
        await logManagerActivity('Viewed purchase requests', {
          type: 'purchase_requests_viewed',
          details: 'Opened manager purchase requests page.'
        })
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    watch(
      () => newRequest.value.supplierId,
      () => {
        newRequest.value.itemId = ''
      }
    )

    return {
      showAddModal,
      canCreateRequests,
      canReviewRequests,
      showPaymentModal,
      showReceiptModal,
      showCancelModal,
      saving,
      paymentSaving,
      receiptSaving,
      cancelSaving,
      searchQuery,
      selectedStatus,
      selectedBranch,
      selectedPriority,
      currentBranchName,
      branchOptions,
      requests,
      activeSuppliers,
      supplierItemOptions,
      selectedSupplierItem,
      selectedUnitCost,
      selectedTotalCost,
      dssSuggestion,
      applyDssSuggestion,
      paymentAmount,
      paymentReceiptName,
      receiptTarget,
      standaloneReceiptName,
      cancelReason,
      newRequest,
      pendingCount,
      deliveredCount,
      delayedCount,
      totalCount,
      filteredRequests,
      addRequest,
      togglePaymentStatus,
      openReceiptModal,
      closeReceiptModal,
      handleStandaloneReceiptUpload,
      submitStandaloneReceiptUpload,
      isReceiptImage,
      handlePaymentReceiptUpload,
      closePaymentModal,
      submitPaymentWithReceipt,
      markDelivered,
      markDelayed,
      openCancelModal,
      closeCancelModal,
      submitCancellation
    }
  }
}
</script>
