<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Activities</h1>
        <p class="text-slate-400">Recent activity logs related to your practitioner account.</p>
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
            {{ activity.actorName || 'Unknown user' }} - {{ activity.module || 'Practitioner' }}
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
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'

export default {
  name: 'PractitionerActivities',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const currentUserId = ref('')
    const activities = ref([])

    const filteredActivities = computed(() =>
      activities.value
        .filter((item) => {
          if (item.actorId && String(item.actorId) === currentUserId.value) return true
          if (item.practitionerId && String(item.practitionerId) === currentUserId.value) return true
          return false
        })
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    )

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const loadActivities = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'activities'), where('branchId', '==', currentBranchId.value)))
      activities.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        await loadActivities()
      })
    })

    return {
      filteredActivities,
      formatDate
    }
  }
}
</script>
