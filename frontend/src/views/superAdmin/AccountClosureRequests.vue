<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <SuperAdminSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Account Closure Requests</h1>
          <p class="text-slate-400">Review closure and ownership transfer requests submitted by clinic owners.</p>
        </div>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          @click="loadRequests"
        >
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div v-for="card in statsCards" :key="card.label" class="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <p class="text-slate-400 text-sm mb-2">{{ card.label }}</p>
          <p class="text-white text-3xl font-bold">{{ card.value }}</p>
        </div>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>

      <section class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-slate-700">
              <tr>
                <th class="text-left text-slate-300 px-4 py-3">Owner</th>
                <th class="text-left text-slate-300 px-4 py-3">Action</th>
                <th class="text-left text-slate-300 px-4 py-3">Clinics</th>
                <th class="text-left text-slate-300 px-4 py-3">Submitted</th>
                <th class="text-left text-slate-300 px-4 py-3">Status</th>
                <th class="text-right text-slate-300 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-3 text-slate-200" colspan="6">Loading closure requests...</td>
              </tr>
              <tr v-else-if="!requests.length">
                <td class="px-4 py-3 text-slate-200" colspan="6">No account closure requests yet.</td>
              </tr>
              <tr
                v-else
                v-for="request in requests"
                :key="request.id"
                class="border-b border-slate-700/60 last:border-b-0"
              >
                <td class="px-4 py-3 text-slate-200">
                  <div class="font-medium">{{ request.ownerName || 'Unknown owner' }}</div>
                  <div class="text-xs text-slate-400">{{ request.ownerEmail || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-200">
                  <div class="font-medium">{{ request.actionLabel || request.action || 'Close owner account only' }}</div>
                  <div class="text-xs text-slate-400">{{ request.transferEmail || request.reason || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-200">
                  <div class="font-medium">{{ request.clinicCount || 0 }}</div>
                  <div class="text-xs text-slate-400">{{ request.branchNamesPreview || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-300">{{ request.requestedLabel }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-1 text-xs font-semibold" :class="statusClass(request.reviewStatus)">
                    {{ request.reviewStatus || 'Pending' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
                    @click="openRequest(request)"
                  >
                    Review
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <Modal
    :isOpen="showModal"
    panelClass="bg-slate-800 text-white w-full max-w-3xl"
    @close="closeModal"
  >
    <template #header>
      <h2 class="text-xl font-semibold">Account Closure Request</h2>
    </template>

    <template #body>
      <div v-if="selectedRequest" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Owner</p>
            <p class="text-white mt-1">{{ selectedRequest.ownerName || '-' }}</p>
            <p class="text-slate-400 text-xs mt-1">{{ selectedRequest.ownerEmail || '-' }}</p>
          </div>
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Requested</p>
            <p class="text-white mt-1">{{ selectedRequest.requestedLabel }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Action</p>
            <p class="text-white mt-1">{{ selectedRequest.actionLabel || selectedRequest.action }}</p>
          </div>
          <div>
            <p class="text-slate-400 text-xs uppercase tracking-wide">Clinic Count</p>
            <p class="text-white mt-1">{{ selectedRequest.clinicCount || 0 }}</p>
          </div>
        </div>

        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Clinics</p>
          <p class="text-white mt-1 whitespace-pre-wrap">{{ selectedRequest.branchNamesText || '-' }}</p>
        </div>

        <div v-if="selectedRequest.transferEmail">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Transfer Email</p>
          <p class="text-white mt-1">{{ selectedRequest.transferEmail }}</p>
        </div>

        <div class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Closure Impact</p>
          <p class="mt-2 text-sm text-slate-200 whitespace-pre-line">{{ closureImpactText(selectedRequest) }}</p>
        </div>

        <div>
          <p class="text-slate-400 text-xs uppercase tracking-wide">Reason</p>
          <p class="text-white mt-1 whitespace-pre-line">{{ selectedRequest.reason || '-' }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-xs uppercase tracking-wide mb-2">Decision</label>
            <select
              v-model="reviewDraft.status"
              class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-xs uppercase tracking-wide mb-2">Public Note</label>
            <input
              v-model.trim="reviewDraft.note"
              type="text"
              class="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              placeholder="Optional note for the owner"
            />
          </div>
        </div>

        <div class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p class="text-slate-400 text-xs uppercase tracking-wide">Handling Note</p>
          <p class="mt-2 text-sm text-slate-200">
            Approval will record the review decision, notify the owner, and apply the closure action selected in the request.
          </p>
        </div>

        <p v-if="saveMessage" class="text-xs text-emerald-300">{{ saveMessage }}</p>
        <p v-if="saveError" class="text-xs text-rose-300">{{ saveError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700"
            @click="closeModal"
          >
            Close
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-60"
            :disabled="saving"
            @click="saveDecision"
          >
            {{ saving ? 'Saving...' : 'Save Decision' }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import Modal from '@/components/common/Modal.vue'

const formatDate = (value) => {
  if (!value) return '-'
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return 'bg-emerald-500/20 text-emerald-300'
  if (normalized === 'rejected') return 'bg-rose-500/20 text-rose-300'
  return 'bg-amber-500/20 text-amber-300'
}

const chunkArray = (values = [], size = 10) => {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

const isOwnerLikeUser = (data = {}) => {
  const compactRole = String(data.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const compactType = String(data.userType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  return (
    compactRole === 'owner' ||
    compactRole === 'clinicadmin' ||
    compactRole === 'clinicadministrator' ||
    compactType === 'owner' ||
    compactType === 'clinicadmin' ||
    compactType === 'clinicadministrator'
  )
}

export default {
  name: 'SuperAdminAccountClosureRequests',
  components: { SuperAdminSidebar, Modal },
  setup() {
    const requests = ref([])
    const loading = ref(true)
    const error = ref('')
    const saving = ref(false)
    const showModal = ref(false)
    const selectedRequest = ref(null)
    const saveMessage = ref('')
    const saveError = ref('')
    const reviewDraft = ref({
      status: 'Approved',
      note: '',
    })
    let unsubscribe = null

    const statsCards = computed(() => {
      const pending = requests.value.filter((item) => String(item.reviewStatus || 'pending').toLowerCase() === 'pending').length
      const approved = requests.value.filter((item) => String(item.reviewStatus || '').toLowerCase() === 'approved').length
      const rejected = requests.value.filter((item) => String(item.reviewStatus || '').toLowerCase() === 'rejected').length
      return [
        { label: 'Total Requests', value: requests.value.length },
        { label: 'Pending', value: pending },
        { label: 'Approved', value: approved },
        { label: 'Rejected', value: rejected },
      ]
    })

    const enrich = (docSnap) => {
      const data = docSnap.data() || {}
      const branchNames = Array.isArray(data.branchNames) ? data.branchNames.filter(Boolean) : []
      return {
        id: docSnap.id,
        ...data,
        branchNamesPreview: branchNames.slice(0, 2).join(', '),
        branchNamesText: branchNames.length ? branchNames.join('\n') : '',
        requestedLabel: formatDate(data.requestedAt || data.createdAt),
      }
    }

    const closureImpactText = (request = {}) => {
      const action = String(request.action || '').toLowerCase()
      if (action === 'transfer') {
        return [
          'The selected main branch will be reassigned to the email provided in the request.',
          'The previous owner account will be closed after the transfer is recorded.',
          'Branch employees stay active so the clinic can continue operating under the new owner.'
        ].join('\n')
      }

      if (action === 'delete') {
        return [
          'The owner account will be closed.',
          'All connected branches will be marked inactive.',
          'Branch employees tied to those clinics will be archived or disabled too.'
        ].join('\n')
      }

      return [
        'Only the owner account will be closed.',
        'Clinic branches and staff accounts will remain active.',
        'Use this when the clinic continues under another administrator.'
      ].join('\n')
    }

    const saveUserClosureState = (batch, userId, action, branchIds = []) => {
      if (!userId) return
      batch.update(doc(db, 'users', userId), {
        archived: true,
        status: 'Inactive',
        accountClosed: true,
        accountClosureAction: action,
        accountClosedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      if (action === 'delete' && branchIds.length) {
        branchIds.forEach((branchId) => {
          batch.update(doc(db, 'clinics', branchId), {
            status: 'Inactive',
            archived: true,
            archivedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        })
      }
    }

    const archiveBranchStaff = async (batch, branchIds = []) => {
      if (!branchIds.length) return
      const chunks = chunkArray(branchIds, 10)
      for (const chunk of chunks) {
        const staffSnapshot = await getDocs(
          query(collection(db, 'users'), where('branchId', 'in', chunk))
        )
        staffSnapshot.docs.forEach((staffDoc) => {
          const staffData = staffDoc.data() || {}
          if (String(staffData.userType || '').trim().toLowerCase() !== 'staff') return
          batch.update(doc(db, 'users', staffDoc.id), {
            archived: true,
            status: 'Inactive',
            archivedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        })
      }
    }

    const loadRequests = () => {
      loading.value = true
      error.value = ''
      unsubscribe = onSnapshot(
        query(collection(db, 'accountClosureRequests'), orderBy('requestedAt', 'desc')),
        (snapshot) => {
          requests.value = snapshot.docs.map(enrich)
          loading.value = false
        },
        (err) => {
          console.error('Failed to load account closure requests:', err)
          error.value = 'Unable to load account closure requests.'
          loading.value = false
        }
      )
    }

    const openRequest = (request) => {
      selectedRequest.value = request
      reviewDraft.value = {
        status: String(request.reviewStatus || request.status || 'Pending').toLowerCase() === 'rejected' ? 'Rejected' : 'Approved',
        note: request.reviewNote || '',
      }
      saveMessage.value = ''
      saveError.value = ''
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      selectedRequest.value = null
      saveMessage.value = ''
      saveError.value = ''
    }

    const saveDecision = async () => {
      if (!selectedRequest.value?.id) return
      saving.value = true
      saveMessage.value = ''
      saveError.value = ''
      try {
        const reviewerId = auth.currentUser?.uid || 'superadmin'
        const reviewerName = auth.currentUser?.displayName || 'System Admin'
        const nextStatus = reviewDraft.value.status
        const requestRef = doc(db, 'accountClosureRequests', selectedRequest.value.id)
        const nextAction = String(selectedRequest.value.action || 'deactivate').toLowerCase()
        const branchIds = Array.isArray(selectedRequest.value.branchIds) ? selectedRequest.value.branchIds.filter(Boolean) : []

        if (nextStatus === 'Rejected') {
          await updateDoc(requestRef, {
            status: 'rejected',
            reviewStatus: 'Rejected',
            reviewNote: String(reviewDraft.value.note || '').trim(),
            reviewedBy: reviewerId,
            reviewedByName: reviewerName,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })

          if (selectedRequest.value.ownerId) {
            await addDoc(collection(db, 'notifications'), {
              recipientUserId: selectedRequest.value.ownerId,
              senderId: reviewerId,
              type: 'account_closure_review',
              title: 'Account Closure Request Reviewed',
              message: 'Your account closure request was rejected. Please check the review note for details.',
              link: '/owner/account/closure',
              read: false,
              createdAt: serverTimestamp(),
            })
          }

          saveMessage.value = 'Decision saved.'
          toast.success('Account closure request rejected.')
          requests.value = requests.value.map((request) =>
            request.id === selectedRequest.value.id
              ? {
                  ...request,
                  status: 'rejected',
                  reviewStatus: 'Rejected',
                  reviewNote: String(reviewDraft.value.note || '').trim(),
                  reviewedBy: reviewerId,
                  reviewedByName: reviewerName,
                  reviewedAt: new Date(),
                }
              : request
          )
          closeModal()
          return
        }

        const batch = writeBatch(db)
        batch.update(requestRef, {
          status: 'approved',
          reviewStatus: 'Approved',
          reviewNote: String(reviewDraft.value.note || '').trim(),
          reviewedBy: reviewerId,
          reviewedByName: reviewerName,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          processedAction: nextAction,
        })

        if (nextAction === 'transfer') {
          const transferEmail = String(selectedRequest.value.transferEmail || '').trim().toLowerCase()
          if (!transferEmail) {
            throw new Error('Transfer email is required for ownership transfer.')
          }

          const transferSnapshot = await getDocs(
            query(collection(db, 'users'), where('email', '==', transferEmail))
          )
          const transferCandidate = transferSnapshot.docs
            .map((snap) => ({ id: snap.id, ...(snap.data() || {}) }))
            .find((user) => isOwnerLikeUser(user))

          if (!transferCandidate) {
            throw new Error('No eligible clinic admin or owner was found for the transfer email.')
          }
          if (transferCandidate.id === selectedRequest.value.ownerId) {
            throw new Error('The transfer target must be a different account.')
          }

          branchIds.forEach((branchId) => {
            batch.update(doc(db, 'clinics', branchId), {
              ownerId: transferCandidate.id,
              previousOwnerId: selectedRequest.value.ownerId,
              ownershipTransferredAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          })

          saveUserClosureState(batch, selectedRequest.value.ownerId, nextAction)

          batch.update(doc(db, 'users', transferCandidate.id), {
            role: transferCandidate.role || 'Owner',
            userType: transferCandidate.userType || 'owner',
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          await addDoc(collection(db, 'notifications'), {
            recipientUserId: selectedRequest.value.ownerId,
            senderId: reviewerId,
            type: 'account_closure_review',
            title: 'Account Closure Request Approved',
            message: `Your clinic ownership was transferred to ${selectedRequest.value.transferEmail}.`,
            link: '/owner/account/closure',
            read: false,
            createdAt: serverTimestamp(),
          })

          await addDoc(collection(db, 'notifications'), {
            recipientUserId: transferCandidate.id,
            senderId: reviewerId,
            type: 'ownership_transfer',
            title: 'Clinic Ownership Assigned',
            message: 'You have been assigned as the owner for transferred clinic branches.',
            link: '/owner/dashboard',
            read: false,
            createdAt: serverTimestamp(),
          })
        } else if (nextAction === 'delete') {
          saveUserClosureState(batch, selectedRequest.value.ownerId, nextAction, branchIds)
          await archiveBranchStaff(batch, branchIds)
          await batch.commit()

          if (selectedRequest.value.ownerId) {
            await addDoc(collection(db, 'notifications'), {
              recipientUserId: selectedRequest.value.ownerId,
              senderId: reviewerId,
              type: 'account_closure_review',
              title: 'Account Closure Request Approved',
              message: 'Your clinic closure request was approved. Connected branches are now inactive.',
              link: '/owner/account/closure',
              read: false,
              createdAt: serverTimestamp(),
            })
          }
        } else {
          saveUserClosureState(batch, selectedRequest.value.ownerId, nextAction)
          await batch.commit()

          if (selectedRequest.value.ownerId) {
            await addDoc(collection(db, 'notifications'), {
              recipientUserId: selectedRequest.value.ownerId,
              senderId: reviewerId,
              type: 'account_closure_review',
              title: 'Account Closure Request Approved',
              message: 'Your owner account has been closed. Clinic branches remain active.',
              link: '/owner/account/closure',
              read: false,
              createdAt: serverTimestamp(),
            })
          }
        }

        saveMessage.value = 'Decision saved.'
        toast.success('Account closure request processed.')
        requests.value = requests.value.map((request) =>
          request.id === selectedRequest.value.id
            ? {
                ...request,
                status: 'approved',
                reviewStatus: 'Approved',
                reviewNote: String(reviewDraft.value.note || '').trim(),
                reviewedBy: reviewerId,
                reviewedByName: reviewerName,
                reviewedAt: new Date(),
                processedAction: nextAction,
              }
            : request
        )
        closeModal()
      } catch (err) {
        console.error('Failed to save account closure decision:', err)
        saveError.value = 'Failed to save decision.'
        toast.error('Failed to save account closure decision.')
      } finally {
        saving.value = false
      }
    }

    onMounted(loadRequests)
    onUnmounted(() => {
      if (unsubscribe) unsubscribe()
    })

    return {
      closeModal,
      error,
      loadRequests,
      loading,
      openRequest,
      requests,
      reviewDraft,
      saveDecision,
      saveError,
      saveMessage,
      saving,
      selectedRequest,
      showModal,
      statsCards,
      statusClass,
      closureImpactText,
    }
  },
}
</script>
