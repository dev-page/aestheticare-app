<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <component :is="sidebarComponent" v-if="sidebarComponent" />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Activities</h1>
        <p class="text-slate-400">Recent activity logs related to your account and clinic access.</p>
      </div>

      <div class="space-y-4">
        <div
          v-for="activity in filteredActivities"
          :key="activity.id"
          class="bg-slate-800 rounded-xl border border-slate-700 p-5"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-white font-semibold">{{ activity.action || 'Activity' }}</p>
            <p class="text-slate-400 text-xs">{{ formatDate(activity.createdAt) }}</p>
          </div>
          <p class="text-slate-300 text-sm mt-2">{{ activity.details || 'No details provided.' }}</p>
          <p class="text-slate-500 text-xs mt-3">
            {{ activity.actorName || 'Unknown user' }} - {{ activity.module || 'Clinic' }}
          </p>
        </div>

        <div v-if="filteredActivities.length === 0" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400">
          No activity logs available.
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { isSignificantActivity } from '@/utils/activityLogger'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'Activities',
  components: { CustomerSidebar, EmployeeSidebar, OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const role = ref('')
    const userType = ref('')
    const activities = ref([])

    const sidebarComponent = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (typeValue === 'customer' || roleValue === 'customer') return CustomerSidebar
      if (typeValue === 'staff') return EmployeeSidebar
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return OwnerSidebar
      return CustomerSidebar
    })

    const filteredActivities = computed(() =>
      activities.value
        .filter((item) => isSignificantActivity(item))
        .filter((item) => {
          const currentUserIdValue = String(currentUserId.value || '')
          const roleValue = String(role.value || '').trim().toLowerCase()
          const userTypeValue = String(userType.value || '').trim().toLowerCase()
          const actorRole = String(item.actorRole || '').trim().toLowerCase()
          const activityModule = String(item.module || '').trim().toLowerCase()

          if (item.actorId && String(item.actorId) === currentUserIdValue) return true
          if (item.practitionerId && String(item.practitionerId) === currentUserIdValue) return true

          if (userTypeValue === 'staff') {
            if (actorRole && actorRole === roleValue) return true
            if (activityModule && activityModule === roleValue) return true
            if (activityModule && roleValue && activityModule.includes(roleValue)) return true
            if (activityModule && roleValue && roleValue.includes(activityModule)) return true
          }

          if (roleValue === 'owner' || roleValue === 'clinic admin' || roleValue === 'clinicadmin') {
            return true
          }

          return false
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    )

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const loadActivities = async () => {
      activities.value = []
      try {
        // Always include activities done by the current user
        const userActivitiesSnap = await getDocs(query(collection(db, 'activities'), where('actorId', '==', currentUserId.value)))
        const userActivities = userActivitiesSnap.docs.map((s) => ({ id: s.id, ...s.data() }))

        // Include activities for the current branch (if set)
        let branchActivities = []
        if (currentBranchId.value) {
          const bSnap = await getDocs(query(collection(db, 'activities'), where('branchId', '==', currentBranchId.value)))
          branchActivities = bSnap.docs.map((s) => ({ id: s.id, ...s.data() }))
        }

        // If user is an owner/clinic-admin, include activities across all clinics they own
        let ownerClinicActivities = []
        const roleValue = String(role.value || '').toLowerCase()
        if (roleValue === 'owner' || roleValue === 'clinic admin' || roleValue === 'clinicadmin') {
          // find clinics owned by this user
          const clinicsSnap = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', currentUserId.value)))
          const clinicIds = clinicsSnap.docs.map((d) => d.id)

          // For each clinic id, fetch activities for that branch/clinic
          const fetches = clinicIds.map((cid) => getDocs(query(collection(db, 'activities'), where('branchId', '==', cid))))
          const results = await Promise.all(fetches)
          ownerClinicActivities = results.flatMap((snap) => snap.docs.map((s) => ({ id: s.id, ...s.data() })))

          // Also include activities where actorClinicId matches any of the clinics (if such field exists)
          if (clinicIds.length) {
            try {
              const actorQueries = []
              // Firestore 'in' supports up to 10 elements; chunk if needed
              const chunkSize = 10
              for (let i = 0; i < clinicIds.length; i += chunkSize) {
                const chunk = clinicIds.slice(i, i + chunkSize)
                actorQueries.push(getDocs(query(collection(db, 'activities'), where('actorClinicId', 'in', chunk))))
              }
              const actorResults = await Promise.all(actorQueries)
              ownerClinicActivities = ownerClinicActivities.concat(actorResults.flatMap((snap) => snap.docs.map((s) => ({ id: s.id, ...s.data() }))))
            } catch (e) {
              // Not all deployments have actorClinicId field or 'in' may be unsupported; ignore and rely on branchId fetches
              console.debug('actorClinicId queries skipped or failed', e)
            }
          }
        }

        // merge and dedupe by id
        const combined = [...userActivities, ...branchActivities, ...ownerClinicActivities]
        const map = new Map()
        combined.forEach((act) => {
          if (!map.has(act.id)) map.set(act.id, act)
        })
        activities.value = Array.from(map.values()).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      } catch (err) {
        console.error('Failed to load activities:', err)
      }
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const data = userSnap.exists() ? userSnap.data() || {} : {}
        currentBranchId.value = data.branchId || ''
        role.value = data.role || ''
        userType.value = data.userType || ''
        await loadActivities()
      })
    })

    return {
      filteredActivities,
      formatDate,
      sidebarComponent
    }
  }
}
</script>
