<script>
import { serviceOnlyClinicPolicies } from '@/utils/clinicPolicies'
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, computed } from 'vue'
import { getFirestore, collection, updateDoc, doc, getDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import ClientContractDocument from '@/components/common/ClientContractDocument.vue'
import { buildClientContractDocument, clientContractPolicies } from '../../../../../shared/clientContract.js'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { useSubscription } from '@/composables/useSubscription'
import { revenueByBranch } from '@/utils/revenue'

export default {
  name: 'Branch Info',
  components: { OwnerSidebar, Modal, ClientContractDocument },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasFeature } = useSubscription()
    const branches = ref([])
    const staffOptions = ref([])
    const showEditModal = ref(false)
    const showPolicyModal = ref(false)
    const activeMenuBranchId = ref('')
    const policyBranch = ref(null)
    const clinicPolicies = ref({})
    const linkedPolicyKeys = ref([])
    const showContractPreview = ref(false)
    const contractPreviewSource = ref('customer_booking_request')
    const contractConfigured = computed(() => clinicPolicies.value.clientContract?.configured === true)
    const selectedContractPolicies = computed(() => clientContractPolicies(clinicPolicies.value, { branch: { enforcedPolicyKeys: linkedPolicyKeys.value }, source: contractPreviewSource.value }))
    const branchContractPreview = computed(() => buildClientContractDocument(clinicPolicies.value, { branch: { enforcedPolicyKeys: linkedPolicyKeys.value }, source: contractPreviewSource.value }))
    const ownerProfile = ref({
      branchAdminId: '',
      branchAdminName: ''
    })
    const currentOwnerId = ref('')

    const currentBranch = ref({
      id: null,
      clinicBranch: '',
      status: 'Active',
      clinicLocation: '',
      isMainBranch: false,
      branchAdminId: '',
      branchAdminName: '',
    })
    const archivedBranches = computed(() => branches.value.filter((branch) => branch.status === 'Inactive'))
    const activeBranches = computed(() => branches.value.filter((branch) => branch.status !== 'Inactive'))
    const canManageMultipleBranches = computed(() => hasFeature('multi_branch'))
    const policyDefinitions = [
      { key: 'paymentPolicy', title: 'Payment Policy', enabledKey: 'servicePaymentPolicyEnabled' },
      { key: 'cancellationPolicy', title: 'Cancellation Policy', enabledKey: 'serviceCancellationPolicyEnabled' },
      { key: 'reschedulePolicy', title: 'Rescheduling Policy', enabledKey: 'serviceReschedulingPolicyEnabled' },
      { key: 'noShowPolicy', title: 'No-Show Policy', enabledKey: 'serviceNoShowPolicyEnabled' },
      { key: 'walkInPolicy', title: 'Walk-In Policy', enabledKey: 'walkInPolicyEnabled' },
    ]
    const enabledPolicies = computed(() => policyDefinitions
      .filter((policy) => clinicPolicies.value[policy.enabledKey] === true || clinicPolicies.value[`${policy.key}Enabled`] === true)
      .map((policy) => ({ ...policy, details: String(clinicPolicies.value[policy.key] || '').trim() || 'No details have been configured.' })))

    const loadOwnerProfile = trackPageLoad(async (uid) => {
      if (!uid) return { branchAdminId: '', branchAdminName: '' }
      const userSnap = await getDoc(doc(db, 'users', uid))
      const data = userSnap.exists() ? userSnap.data() || {} : {}
      const branchAdminName =
        String(data.fullName || '').trim() ||
        `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
        'Owner'

      return {
        branchAdminId: uid,
        branchAdminName,
      }
    })

    const formatFullName = (data = {}) =>
      String(data.fullName || '').trim() ||
      `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
      data.email ||
      'Owner'

    const loadBranches = trackPageLoad(async () => {
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        staffOptions.value = []
        currentOwnerId.value = ''
        return
      }

      try {
      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid
      const branchDocs = await loadClinicDocsByIds(db, scope.branchIds?.length ? scope.branchIds : [scope.branchId || ''])
      ownerProfile.value = await loadOwnerProfile(currentOwnerId.value)
      const transactionRows = []
      for (const branchDoc of branchDocs) {
        const transactionSnapshot = await getDocs(query(collection(db, 'transactions'), where('branchId', '==', branchDoc.id)))
        transactionRows.push(...transactionSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })))
      }
      const branchRevenue = revenueByBranch(transactionRows)
      branches.value = sortRecordsNewestFirst(branchDocs.map((branchDoc) => {
        const data = branchDoc || {}
        const rawStatus = String(data.status || '').trim()
        const isMainBranch = Boolean(data.isMainBranch)
        const branchAdminId = String(data.branchAdminId || '').trim()
        const branchAdminName = String(data.branchAdminName || '').trim()
        return {
          id: branchDoc.id,
          ...data,
          revenue: branchRevenue[branchDoc.id] || 0,
          status: rawStatus || 'Active',
          isMainBranch,
          branchAdminId: branchAdminId || (isMainBranch ? ownerProfile.value.branchAdminId : ''),
          branchAdminName: branchAdminName || (isMainBranch ? ownerProfile.value.branchAdminName : ''),
          createdAt: data.archivedAt || data.createdAt || data.updatedAt || null,
        }
      }))

      const policySnap = await getDoc(doc(db, 'clinicPolicies', currentOwnerId.value))
      if (policySnap.exists()) {
        clinicPolicies.value = serviceOnlyClinicPolicies(policySnap.data())
      } else {
        // Read an older branch-keyed policy document until the owner next
        // saves Policy Management, which migrates it to the clinic owner ID.
        const legacyPolicySnap = branches.value[0]?.id
          ? await getDoc(doc(db, 'clinicPolicies', branches.value[0].id))
          : null
        clinicPolicies.value = legacyPolicySnap?.exists() ? serviceOnlyClinicPolicies(legacyPolicySnap.data()) : {}
      }

      const branchIds = branches.value.map((branch) => branch.id).filter(Boolean)
      if (!branchIds.length) {
        staffOptions.value = []
        return
      }

      const staffResults = [{
        id: ownerProfile.value.branchAdminId,
        branchId: '',
        fullName: ownerProfile.value.branchAdminName || 'Owner',
        role: 'Clinic Admin',
        isOwner: true
      }]
      for (let index = 0; index < branchIds.length; index += 10) {
        const chunk = branchIds.slice(index, index + 10)
        const staffQuery = query(
          collection(db, 'users'),
          where('branchId', 'in', chunk),
          where('userType', '==', 'Staff')
        )
        const staffSnapshot = await getDocs(staffQuery)
        staffResults.push(
          ...staffSnapshot.docs.map((staffDoc) => {
            const data = staffDoc.data() || {}
            const fullName = formatFullName(data)
            return {
              id: staffDoc.id,
              branchId: String(data.branchId || ''),
              fullName: fullName || 'Unnamed Staff',
              role: String(data.customRoleName || data.role || 'Staff'),
              isOwner: false
            }
          })
        )
      }
      staffOptions.value = staffResults
        .filter((staff, index, array) => array.findIndex((entry) => entry.id === staff.id) === index)
        .filter((staff) => staff.id)
        .sort((left, right) => left.fullName.localeCompare(right.fullName))
      } catch (error) {
        console.error('Failed to load branch management data:', error)
        branches.value = []
        staffOptions.value = []
        toast.error('We could not load branch management. Please refresh and try again.')
      }
    })

    onMounted(loadBranches)

    const openEditModal = (branch) => {
      activeMenuBranchId.value = ''
      currentBranch.value = {
        ...branch,
      }
      if (!String(currentBranch.value.branchAdminId || '').trim() && currentBranch.value.isMainBranch) {
        currentBranch.value.branchAdminId = ownerProfile.value.branchAdminId
        currentBranch.value.branchAdminName = ownerProfile.value.branchAdminName
      }
      showEditModal.value = true
    }

    const openPolicyModal = async (branch) => {
      activeMenuBranchId.value = ''
      try {
        const snapshot = await getDoc(doc(db, 'clinicPolicies', currentOwnerId.value))
        const legacy = !snapshot.exists() ? await getDoc(doc(db, 'clinicPolicies', branch.id)) : null
        clinicPolicies.value = serviceOnlyClinicPolicies(snapshot.exists() ? snapshot.data() : legacy?.data() || {})
      } catch (error) {
        toast.error('Could not load the latest clinic policies and contract. Please try again.')
        return
      }
      policyBranch.value = branch
      showContractPreview.value = false
      contractPreviewSource.value = 'customer_booking_request'
      // Existing branches enforce all enabled clinic policies until the owner
      // explicitly saves a narrower selection. This keeps current rules intact.
      linkedPolicyKeys.value = Array.isArray(branch.enforcedPolicyKeys)
        ? [...branch.enforcedPolicyKeys]
        : enabledPolicies.value.map((policy) => policy.key)
      showPolicyModal.value = true
    }

    const saveLinkedPolicies = async () => {
      if (!policyBranch.value?.id) return
      try {
        const validKeys = new Set(enabledPolicies.value.map((policy) => policy.key))
        const enforcedPolicyKeys = linkedPolicyKeys.value.filter((key) => validKeys.has(key))
        await updateDoc(doc(db, 'clinics', policyBranch.value.id), {
          enforcedPolicyKeys,
          policiesLinkedAt: serverTimestamp(),
          policiesLinkedBy: auth.currentUser?.uid || null,
          updatedAt: serverTimestamp(),
        })
        const index = branches.value.findIndex((branch) => branch.id === policyBranch.value.id)
        if (index !== -1) branches.value[index] = { ...branches.value[index], enforcedPolicyKeys }
        showPolicyModal.value = false
        toast.success('Branch policy links saved.')
      } catch (error) {
        console.error('Unable to save branch policy links:', error)
        toast.error('Could not save the branch policy links.')
      }
    }

    const archiveBranch = async (branch) => {
      if (!canManageMultipleBranches.value) {
        toast.info('Archiving branches is available with the multi-branch plan.')
        return
      }
      if (!branch?.id) {
        toast.error('Invalid branch ID')
        return
      }

      const result = await Swal.fire({
        title: 'Archive Branch',
        text: `Archive ${branch.clinicBranch}? This will set the status to Inactive.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, archive it!',
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info('Archive cancelled')
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, {
          status: 'Inactive',
          archivedAt: serverTimestamp()
        })
        branch.status = 'Inactive'
        toast.success('Branch archived successfully.')
      } catch (error) {
        console.error('Error archiving branch:', error)
        toast.error('Failed to archive branch. Please try again.')
      }
    }

    const unarchiveBranch = async (branch) => {
      if (!canManageMultipleBranches.value) return
      if (!branch?.id) {
        toast.error('Invalid branch ID')
        return
      }

      const result = await Swal.fire({
        title: 'Unarchive Branch',
        text: `Unarchive ${branch.clinicBranch}? This will set the status to Active.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, unarchive it!',
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info('Unarchive cancelled')
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, {
          status: 'Active',
          updatedAt: serverTimestamp()
        })
        branch.status = 'Active'
        toast.success('Branch unarchived successfully.')
      } catch (error) {
        console.error('Error unarchiving branch:', error)
        toast.error('Failed to unarchive branch. Please try again.')
      }
    }

    const updateBranch = async () => {
      if (!currentBranch.value.clinicBranch || !currentBranch.value.clinicBranch.trim()) {
        toast.error('Branch name is required')
        return
      }

      if (!currentBranch.value.clinicLocation || !currentBranch.value.clinicLocation.trim()) {
        toast.error('Branch location is required')
        return
      }
      try {
        const user = auth.currentUser
        if (!user) {
          toast.error('You must be logged in to update a branch')
          return
        }

        const ownerId = user.uid
        const ownerProfileData = ownerProfile.value.branchAdminId ? ownerProfile.value : await loadOwnerProfile(ownerId)
        const shouldUseOwnerAsBranchAdmin =
          Boolean(currentBranch.value.isMainBranch) && !String(currentBranch.value.branchAdminId || '').trim()
        const branchAdminId = shouldUseOwnerAsBranchAdmin
          ? ownerProfileData.branchAdminId
          : String(currentBranch.value.branchAdminId || '').trim()
        const branchAdminName = shouldUseOwnerAsBranchAdmin
          ? ownerProfileData.branchAdminName
          : String(currentBranch.value.branchAdminName || '').trim()

        if (currentBranch.value.id) {
          const result = await Swal.fire({
            title: 'Confirm Update',
            text: 'Are you sure you want to update this branch?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, update!',
            cancelButtonText: 'Cancel'
          })

          if (!result.isConfirmed) {
            toast.info('Update cancelled')
            return
          }

          const branchRef = doc(db, 'clinics', currentBranch.value.id)
          await updateDoc(branchRef, {
            clinicBranch: currentBranch.value.clinicBranch.trim(),
            clinicLocation: currentBranch.value.clinicLocation.trim(),
            status: currentBranch.value.status,
            isMainBranch: Boolean(currentBranch.value.isMainBranch),
            branchAdminId: branchAdminId || null,
            branchAdminName: branchAdminName || null,
            updatedAt: serverTimestamp()
          })

          const index = branches.value.findIndex((branch) => branch.id === currentBranch.value.id)
          if (index !== -1) {
            branches.value[index] = {
              ...currentBranch.value,
              clinicBranch: currentBranch.value.clinicBranch.trim(),
              clinicLocation: currentBranch.value.clinicLocation.trim(),
              branchAdminId,
              branchAdminName
            }
          }

          toast.success('Branch updated successfully.')
          showEditModal.value = false
        }
      } catch (error) {
        console.error('Error updating branch:', error)
        toast.error('Failed to update branch. Please try again.')
      }
    }

    const toggleStatus = async (branch) => {
      if (!canManageMultipleBranches.value) {
        toast.info('The only branch on a Basic plan must remain active.')
        return
      }
      const action = branch.status === 'Active' ? 'deactivate' : 'reactivate'
      const newStatus = branch.status === 'Active' ? 'Inactive' : 'Active'

      const result = await Swal.fire({
        title: `Confirm ${action}`,
        text: `Are you sure you want to ${action} ${branch.clinicBranch}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: `Yes, ${action}!`,
        cancelButtonText: 'Cancel'
      })

      if (!result.isConfirmed) {
        toast.info(`${action.charAt(0).toUpperCase() + action.slice(1)} cancelled`)
        return
      }

      try {
        const branchRef = doc(db, 'clinics', branch.id)
        await updateDoc(branchRef, { status: newStatus })
        branch.status = newStatus
        toast.success(`${branch.clinicBranch} has been ${action}d.`)
      } catch (error) {
        console.error('Error updating status:', error)
        toast.error(`Failed to ${action} branch.`)
      }
    }

    return {
      pageLoading,
      branches,
      staffOptions,
      activeBranches,
      archivedBranches,
      canManageMultipleBranches,
      showEditModal,
      showPolicyModal,
      activeMenuBranchId,
      policyBranch,
      enabledPolicies,
      linkedPolicyKeys,
      showContractPreview,
      contractPreviewSource,
      contractConfigured,
      selectedContractPolicies,
      branchContractPreview,
      currentBranch,
      openEditModal,
      openPolicyModal,
      saveLinkedPolicies,
      archiveBranch,
      unarchiveBranch,
      updateBranch,
      toggleStatus
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component v-page-loading="{ active: pageLoading, variant: 'table', columns: 7, rows: 4, header: false }" :is="embedded ? 'div' : 'main'" class="flex-1 min-w-0" :class="embedded ? '' : 'p-4 md:p-8'">
      <div v-if="!embedded" class="mb-6 flex flex-col items-start justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
        <div>
          <h1 class="mb-1 text-2xl font-bold text-white md:text-3xl">Branch Management</h1>
          <p class="text-sm text-slate-400 md:text-base">Monitor branch locations, employees, and revenue performance</p>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <table class="w-full min-w-[600px] border-collapse text-left sm:min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-700 text-xs uppercase text-slate-400 sm:text-sm">
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Name</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Location</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Admin</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Revenue</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Status</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr
              v-for="branch in activeBranches"
              :key="branch.id"
              class="transition-colors hover:bg-slate-700"
            >
              <td class="px-2 py-2 font-medium sm:px-4 sm:py-3">{{ branch.clinicBranch }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">{{ branch.clinicLocation || 'N/A' }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <div class="text-sm text-white">{{ branch.branchAdminName || 'Not assigned' }}</div>
                <div v-if="branch.isMainBranch" class="text-xs text-amber-300 mt-1">Main branch</div>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">PHP {{ branch.revenue ? branch.revenue.toLocaleString() : 0 }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <span
                  @click="canManageMultipleBranches && toggleStatus(branch)"
                  :class="[
                    'rounded-full px-2 py-1 text-xs font-medium sm:px-3 sm:text-sm',
                    canManageMultipleBranches ? 'cursor-pointer' : 'cursor-default',
                    branch.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  ]"
                >
                  {{ branch.status }}
                </span>
              </td>
              <td class="relative px-2 py-2 sm:px-4 sm:py-3">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 text-lg text-slate-200 transition hover:border-amber-400 hover:bg-slate-700 hover:text-amber-200"
                  :aria-expanded="activeMenuBranchId === branch.id"
                  aria-label="Branch actions"
                  @click="activeMenuBranchId = activeMenuBranchId === branch.id ? '' : branch.id"
                >
                  ⋯
                </button>
                <div v-if="activeMenuBranchId === branch.id" class="absolute bottom-11 right-3 z-30 w-40 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-2xl">
                  <button type="button" class="block w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700" @click="openEditModal(branch)">Edit</button>
                  <button type="button" class="block w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700" @click="openPolicyModal(branch)">Link Policy</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="canManageMultipleBranches" class="mt-8 overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <div class="mb-4">
          <h2 class="text-lg font-semibold text-white sm:text-xl">Archived Branches</h2>
          <p class="text-sm text-slate-400">Inactive branches archived by the owner.</p>
        </div>
        <table class="w-full min-w-[600px] border-collapse text-left sm:min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-700 text-xs uppercase text-slate-400 sm:text-sm">
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Name</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Location</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Branch Admin</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Revenue</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Status</th>
              <th class="px-2 py-2 sm:px-4 sm:py-3">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-if="archivedBranches.length === 0">
              <td colspan="5" class="py-6 text-center text-slate-400">No archived branches yet.</td>
            </tr>
            <tr
              v-for="branch in archivedBranches"
              :key="branch.id"
              class="transition-colors hover:bg-slate-700"
            >
              <td class="px-2 py-2 font-medium sm:px-4 sm:py-3">{{ branch.clinicBranch }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">{{ branch.clinicLocation || 'N/A' }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <div class="text-sm text-white">{{ branch.branchAdminName || 'Not assigned' }}</div>
                <div v-if="branch.isMainBranch" class="text-xs text-amber-300 mt-1">Main branch</div>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">PHP {{ branch.revenue ? branch.revenue.toLocaleString() : 0 }}</td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <span class="rounded-full bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-400 sm:px-3 sm:text-sm">
                  Inactive
                </span>
              </td>
              <td class="px-2 py-2 sm:px-4 sm:py-3">
                <button
                  @click="unarchiveBranch(branch)"
                  class="rounded bg-emerald-600 px-3 py-1 text-white transition hover:bg-emerald-700"
                >
                  Unarchive
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Modal :isOpen="showEditModal" panelClass="branch-dialog branch-edit-dialog" @close="showEditModal = false">
        <template #header>
          <div>
            <h2 class="branch-dialog-title">Edit Branch</h2>
            <p class="branch-dialog-description">Update this location’s details and assigned administrator.</p>
          </div>
        </template>
        <template #body>
          <form id="branch-edit-form" class="branch-edit-form" @submit.prevent="updateBranch">
            <div class="branch-field">
              <label for="branch-edit-name">Branch Name</label>
              <input id="branch-edit-name" v-model="currentBranch.clinicBranch" type="text" placeholder="Enter branch name" />
            </div>
            <div class="branch-field">
              <label for="branch-edit-location">Location</label>
              <input id="branch-edit-location" v-model="currentBranch.clinicLocation" type="text" placeholder="Enter location" />
            </div>
            <div class="branch-field">
              <label for="branch-edit-status">Status</label>
              <select id="branch-edit-status" v-model="currentBranch.status"><option>Active</option><option>Inactive</option></select>
            </div>
            <div class="branch-field">
              <label for="branch-edit-admin">Branch Admin</label>
              <select id="branch-edit-admin" v-model="currentBranch.branchAdminId" @change="currentBranch.branchAdminName = staffOptions.find((staff) => staff.id === currentBranch.branchAdminId)?.fullName || ''">
                <option value="">Select branch admin</option>
                <option v-for="staff in staffOptions" :key="staff.id" :value="staff.id">{{ staff.fullName }} - {{ staff.role }}{{ staff.isOwner ? ' (Clinic Admin)' : '' }}</option>
              </select>
              <p class="branch-field-help">Choose who manages this branch.</p>
            </div>
            <div class="branch-dialog-note">
              <strong>{{ currentBranch.isMainBranch ? 'Main branch' : 'Additional branch' }}</strong>
              <p>{{ currentBranch.isMainBranch ? 'This is the clinic location registered first. Its main-branch status cannot be changed here.' : 'The main branch is the first clinic location registered.' }}</p>
            </div>
          </form>
        </template>
        <template #footer>
          <div class="branch-dialog-actions">
            <button type="button" class="branch-dialog-button branch-dialog-button-secondary" @click="showEditModal = false">Cancel</button>
            <button type="submit" form="branch-edit-form" class="branch-dialog-button branch-dialog-button-primary">Update Branch</button>
          </div>
        </template>
      </Modal>

      <Modal :isOpen="showPolicyModal" panelClass="branch-dialog branch-policy-dialog" @close="showPolicyModal = false">
        <template #header>
          <div>
            <h2 class="branch-dialog-title">Link Policies</h2>
            <p class="branch-dialog-description">Choose the clinic-wide policies this branch enforces. Edit policies and agreements in Policy &amp; Contract Management.</p>
          </div>
        </template>
        <template #body>
          <div class="branch-policy-summary">
            <p>Branch: <strong>{{ policyBranch?.clinicBranch || 'Selected branch' }}</strong></p>
            <span>{{ linkedPolicyKeys.filter(key => enabledPolicies.some(policy => policy.key === key)).length }} of {{ enabledPolicies.length }} policies linked</span>
          </div>
          <section class="branch-contract-link-note" aria-label="Linked client contract">
            <div>
              <h3>Client Contract</h3>
              <p v-if="contractConfigured">This branch uses your clinic's saved Client Contract for both online and walk-in bookings, including the saved design and additional terms. The applicable policies selected below are included in each agreement. The Walk-In Policy is an additional policy for walk-in bookings.</p>
              <p v-else>No Client Contract has been saved yet. Configure it in Policy &amp; Contract Management to use a clinic agreement at this branch. Until then, new bookings use their service-specific agreement.</p>
              <p v-if="contractConfigured" class="branch-contract-preview-help">Preview reflects your current selections. Save Policy Links to apply changes. Existing booking agreements retain their saved content and design.</p>
            </div>
            <button type="button" class="branch-dialog-button branch-dialog-button-secondary" :disabled="!contractConfigured" :aria-expanded="showContractPreview" aria-controls="branch-contract-preview" @click="showContractPreview = !showContractPreview">{{ showContractPreview ? 'Hide Branch Contract' : 'Preview Branch Contract' }}</button>
          </section>
          <section v-if="showContractPreview && contractConfigured" id="branch-contract-preview" class="branch-contract-preview">
            <h3>Contract preview · {{ policyBranch?.clinicBranch }}</h3>
            <div class="branch-contract-preview-types" aria-label="Preview appointment type">
              <button type="button" :aria-pressed="contractPreviewSource === 'customer_booking_request'" @click="contractPreviewSource = 'customer_booking_request'">Online booking</button>
              <button type="button" :aria-pressed="contractPreviewSource === 'walk_in'" @click="contractPreviewSource = 'walk_in'">Walk-in</button>
            </div>
            <p class="branch-contract-preview-help">{{ selectedContractPolicies.length ? 'Included policies: ' + selectedContractPolicies.map(policy => policy.title).join(', ') : 'No applicable policies selected.' }} Booked service details and any service-specific terms are added to the actual agreement.</p>
            <ClientContractDocument :document="branchContractPreview" />
          </section>
          <div class="branch-policy-table-wrap">
            <table class="branch-policy-table">
              <thead><tr><th scope="col">Link</th><th scope="col">Policy title</th><th scope="col">Policy details</th><th scope="col">Status</th></tr></thead>
              <tbody>
                <tr v-for="policy in enabledPolicies" :key="policy.key">
                  <td><input v-model="linkedPolicyKeys" :value="policy.key" type="checkbox" :aria-label="'Enforce ' + policy.title" /></td>
                  <td class="branch-policy-name">{{ policy.title }}</td>
                  <td class="branch-policy-details">{{ policy.details }}</td>
                  <td><span class="branch-policy-badge" :class="{ 'is-enforced': linkedPolicyKeys.includes(policy.key) }">{{ linkedPolicyKeys.includes(policy.key) ? 'Enforced' : 'Not enforced' }}</span></td>
                </tr>
                <tr v-if="!enabledPolicies.length"><td colspan="4" class="branch-policy-empty">No clinic-wide policies are enabled. Configure them in Policy &amp; Contract Management first.</td></tr>
              </tbody>
            </table>
          </div>
        </template>
        <template #footer>
          <div class="branch-dialog-actions">
            <button type="button" class="branch-dialog-button branch-dialog-button-secondary" @click="showPolicyModal = false">Cancel</button>
            <button type="button" class="branch-dialog-button branch-dialog-button-primary" @click="saveLinkedPolicies">Save Policy Links</button>
          </div>
        </template>
      </Modal>
    </component>
  </div>
</template>

<style>
/* These panels are teleported to body, outside the page theme container. */
.app-modal-panel.branch-dialog {
  background: var(--ac-surface, #fffdf9) !important;
  color: var(--ac-text, #342419) !important;
  border: 1px solid var(--ac-border, #ead2b2) !important;
  border-radius: 20px !important;
}
.app-modal-panel.branch-edit-dialog { max-width: 600px; }
.app-modal-panel.branch-policy-dialog { max-width: 1040px; }
.branch-dialog > div { padding: 24px; }
.branch-dialog > div:first-child { align-items: flex-start; background: var(--ac-surface-soft, #fff7ec); }
.branch-dialog > div:last-child { background: var(--ac-surface-soft, #fff7ec); }
.branch-dialog .branch-dialog-title { margin: 0; color: var(--ac-text) !important; font-size: 22px; font-weight: 700; line-height: 1.3; }
.branch-dialog .branch-dialog-description { margin: 8px 0 0; color: var(--ac-text-muted); font-size: 14px; line-height: 1.6; }
.branch-dialog > div:first-child > button { flex-shrink: 0; border-radius: 8px; padding: 4px; color: var(--ac-text-muted); }
.branch-dialog > div:first-child > button:hover { background: var(--ac-surface-muted); color: var(--ac-text); }
.branch-edit-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.branch-field { min-width: 0; }
.branch-field label { display: block; margin-bottom: 8px; color: var(--ac-text-secondary); font-size: 14px; font-weight: 600; }
.branch-dialog .branch-field :is(input, select) { width: 100%; min-height: 44px; border: 1px solid var(--ac-border-strong) !important; border-radius: 10px !important; padding: 10px 12px; background: var(--ac-surface) !important; color: var(--ac-text) !important; font-size: 14px; }
.branch-dialog select option { background: var(--ac-surface) !important; color: var(--ac-text) !important; }
.branch-field-help { margin-top: 8px; color: var(--ac-text-muted); font-size: 12px; line-height: 1.5; }
.branch-dialog-note { grid-column: 1 / -1; border: 1px solid var(--ac-border); border-radius: 12px; padding: 14px 16px; background: var(--ac-surface-soft); color: var(--ac-text-secondary); font-size: 13px; line-height: 1.6; }
.branch-dialog-note p { margin: 4px 0 0; }
.branch-dialog-actions { display: flex; justify-content: flex-end; gap: 12px; }
.branch-dialog .branch-dialog-button { min-height: 42px; border: 1px solid var(--ac-border-strong); border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .15s ease; }
.branch-dialog .branch-dialog-button-primary { border-color: var(--ac-primary); background: var(--ac-primary); color: var(--ac-on-primary); }
.branch-dialog .branch-dialog-button-primary:hover { background: var(--ac-primary-hover); }
.branch-dialog .branch-dialog-button-secondary { background: var(--ac-surface); color: var(--ac-text-secondary); }
.branch-dialog .branch-dialog-button-secondary:hover { background: var(--ac-surface-muted); }
.branch-dialog :is(button, input, select):focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 3px; }
.branch-policy-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; border: 1px solid var(--ac-border); border-radius: 12px; padding: 14px 16px; background: var(--ac-surface-soft); color: var(--ac-text-secondary); font-size: 14px; }
.branch-policy-summary p { margin: 0; }
.branch-policy-summary span { color: var(--ac-text-muted); font-size: 12px; }
.branch-contract-link-note { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; padding: 18px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface-soft); }
.branch-contract-link-note > div { flex: 1 1 360px; }
.branch-contract-link-note h3, .branch-contract-preview > h3 { color: var(--ac-text); font-size: 16px; font-weight: 700; }
.branch-contract-link-note p { margin-top: 8px; color: var(--ac-text-secondary); font-size: 13px; line-height: 1.6; }
.branch-contract-preview-help { margin: 10px 0 16px; color: var(--ac-text-muted); font-size: 12px; line-height: 1.6; }
.branch-contract-link-note button:disabled { opacity: .5; cursor: not-allowed; }
.branch-contract-preview { margin-bottom: 20px; padding: 18px; border: 1px solid var(--ac-border); border-radius: 12px; background: var(--ac-surface-soft); }
.branch-contract-preview-types { display: flex; gap: 8px; margin-top: 12px; }
.branch-contract-preview-types button { border: 1px solid var(--ac-border-strong); border-radius: 8px; padding: 8px 12px; color: var(--ac-text-secondary); background: var(--ac-surface); font-size: 12px; }
.branch-contract-preview-types button[aria-pressed="true"] { border-color: var(--ac-primary); color: var(--ac-on-primary); background: var(--ac-primary); }
.branch-policy-table-wrap { overflow-x: auto; border: 1px solid var(--ac-border); border-radius: 12px; }
.branch-policy-table { width: 100%; min-width: 640px; border-collapse: collapse; text-align: left; font-size: 14px; }
.branch-policy-table th { padding: 14px 16px; background: var(--ac-surface-muted); color: var(--ac-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.branch-policy-table td { border-top: 1px solid var(--ac-border); padding: 18px 16px; vertical-align: top; }
.branch-policy-table th:first-child { width: 60px; }
.branch-policy-table th:nth-child(2) { width: 24%; }
.branch-policy-name { color: var(--ac-text); font-weight: 600; line-height: 1.6; }
.branch-policy-details { color: var(--ac-text-secondary); line-height: 1.7; }
.branch-policy-table input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--ac-primary); cursor: pointer; }
.branch-policy-badge { display: inline-block; border-radius: 999px; padding: 5px 10px; background: var(--ac-surface-muted); color: var(--ac-text-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.branch-policy-badge.is-enforced { background: var(--ac-success-bg); color: var(--ac-success); }
.branch-policy-table .branch-policy-empty { padding: 32px 20px; color: var(--ac-text-muted); text-align: center; }
@media (max-width: 640px) {
  .app-modal-panel.branch-dialog { max-height: calc(100dvh - 6rem); }
  .branch-dialog > div { padding: 18px; }
  .branch-edit-form { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .branch-dialog-actions > button { flex: 1; padding-inline: 10px; }
}
</style>
