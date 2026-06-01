<template>
  <EmployeeSidebar v-if="isEmployeeView" />
  <BaseCollapsibleSidebar
    v-else
    title="Clinic Admin"
    subtitle="Clinic Admin Sidebar"
    panel-key="owner"
    default-name="Owner"
    default-email="owner@aestheticare.com"
    :items="items"
  />
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import BaseCollapsibleSidebar from '@/components/sidebar/BaseCollapsibleSidebar.vue'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'
import { buildClinicSidebarItems } from '@/components/sidebar/clinicSidebarItems'
import { useOwnerModules } from '@/composables/useOwnerModules'

export default {
  name: 'OwnerSidebar',
  components: { BaseCollapsibleSidebar, EmployeeSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { enabledModules, startOwnerModulesListener } = useOwnerModules()
    const currentUserType = ref('')
    let unsubscribeAuth = null
    const baseItems = buildClinicSidebarItems()

    const items = computed(() =>
      baseItems.filter((item) => {
        if (!item.moduleKey) return true
        return enabledModules.value?.[item.moduleKey] !== false
      })
    )

    const isEmployeeView = computed(() => currentUserType.value === 'staff')

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserType.value = ''
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() || {} : {}
        currentUserType.value = String(userData.userType || '').trim().toLowerCase()

        if (currentUserType.value !== 'staff') {
          await startOwnerModulesListener()
        }
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    })

    return { items, isEmployeeView }
  }
}
</script>
