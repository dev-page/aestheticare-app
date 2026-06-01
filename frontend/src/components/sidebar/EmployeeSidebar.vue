<template>
  <BaseCollapsibleSidebar
    :title="sidebarTitle"
    :subtitle="sidebarSubtitle"
    panel-key="employee"
    default-name="Employee"
    default-email="employee@aestheticare.com"
    :items="items"
  />
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getFirestore, onSnapshot, query, where } from 'firebase/firestore'
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'
import { buildClinicSidebarItems } from '@/components/sidebar/clinicSidebarItems'
import { useOwnerModules } from '@/composables/useOwnerModules'

export default {
  name: 'EmployeeSidebar',
  components: { BaseCollapsibleSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { enabledModules, startOwnerModulesListener } = useOwnerModules()

    const roleLabel = ref('')
    const branchLabel = ref('')
    const moduleOwnerId = ref('')
    let unsubscribeAuth = null
    let unsubscribeProfile = null
    let unsubscribeBranch = null

    const sidebarTitle = computed(() => {
      const label = String(roleLabel.value || '').trim()
      return label || 'Employee Panel'
    })

    const sidebarSubtitle = computed(() => {
      const label = String(branchLabel.value || '').trim()
      return label ? `Assigned branch: ${label}` : 'Dynamic access based on your assigned permissions'
    })

    const clearBranchSubscription = () => {
      if (unsubscribeBranch) {
        unsubscribeBranch()
        unsubscribeBranch = null
      }
    }

    const applyBranchSnapshot = async (branchSnap, fallbackBranchId = '') => {
      const branchData = branchSnap?.data?.() || {}
      const branchId = String(fallbackBranchId || branchSnap?.id || '').trim()
      const label = [branchData.clinicBranch, branchData.clinicLocation].filter(Boolean).join(' - ')
      branchLabel.value = label || branchId || 'No branch assigned'
      moduleOwnerId.value = String(branchData.ownerId || '').trim()
      await startOwnerModulesListener(moduleOwnerId.value)
    }

    const subscribeToBranchSource = (user, userData = {}) => {
      clearBranchSubscription()

      const branchId = String(userData.branchId || userData.clinicBranch || '').trim()
      if (branchId) {
        unsubscribeBranch = onSnapshot(doc(db, 'clinics', branchId), (branchSnap) => {
          if (!branchSnap.exists()) {
            branchLabel.value = branchId
            moduleOwnerId.value = ''
            void startOwnerModulesListener('')
            return
          }
          void applyBranchSnapshot(branchSnap, branchId)
        })
        return
      }

      unsubscribeBranch = onSnapshot(
        query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid)),
        (snapshot) => {
          if (snapshot.empty) {
            branchLabel.value = ''
            moduleOwnerId.value = ''
            void startOwnerModulesListener('')
            return
          }

          const branchSnap = snapshot.docs[0]
          void applyBranchSnapshot(branchSnap)
        }
      )
    }
    const items = computed(() => {
      const baseItems = buildClinicSidebarItems({ dashboardTo: '/employee/dashboard' })
      const attendanceChild = {
        label: 'Scan Attendance QR',
        icon: 'qr',
        to: '/attendance/scan',
        feature: 'attendance',
        permission: 'attendance:create'
      }

      return baseItems
        .map((item) => {
          if (item.key !== 'team-management' || !Array.isArray(item.children)) {
            return item
          }

          return {
            ...item,
            children: [
              ...item.children.slice(0, 4),
              attendanceChild,
              ...item.children.slice(4)
            ]
          }
        })
        .filter((item) => {
          if (!item.moduleKey) return true
          return enabledModules.value?.[item.moduleKey] !== false
        })
    })

    onMounted(async () => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          roleLabel.value = ''
          branchLabel.value = ''
          moduleOwnerId.value = ''
          void startOwnerModulesListener('')
          if (unsubscribeProfile) {
            unsubscribeProfile()
            unsubscribeProfile = null
          }
          clearBranchSubscription()
          return
        }

        if (unsubscribeProfile) {
          unsubscribeProfile()
          unsubscribeProfile = null
        }

        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (userSnap) => {
          const userData = userSnap.exists() ? userSnap.data() || {} : {}
          roleLabel.value = String(userData.customRoleName || userData.role || 'Employee').trim()
          subscribeToBranchSource(user, userData)
        })
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
      clearBranchSubscription()
    })

    return {
      items,
      sidebarTitle,
      sidebarSubtitle,
    }
  }
}
</script>
