<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Client List</h1>
          <p class="text-slate-400">View and search all clients registered in your branch.</p>
        </div>
        <router-link
          to="/receptionist/clients/add"
          class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
        >
          Add Client
        </router-link>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <label class="block text-slate-400 text-sm mb-2">Search Client</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Name, email, or phone..."
          class="w-full md:w-96 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Email</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Phone</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="client in filteredClients" :key="client.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4">
                  <p class="text-white font-medium">{{ client.fullName || '-' }}</p>
                </td>
                <td class="px-6 py-4 text-slate-300">{{ client.email || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ client.phone || '-' }}</td>
                <td class="px-6 py-4 text-slate-300">{{ formatDate(client.createdAt) }}</td>
              </tr>
              <tr v-if="clients.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">No clients yet.</td>
              </tr>
              <tr v-else-if="filteredClients.length === 0">
                <td colspan="4" class="px-6 py-8 text-center text-slate-400">No matching clients.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { toast } from 'vue3-toastify'

export default {
  name: 'ReceptionistClientList',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const searchQuery = ref('')
    const clients = ref([])

    const filteredClients = computed(() => {
      const queryText = searchQuery.value.trim().toLowerCase()
      if (!queryText) return clients.value

      return clients.value.filter((client) => {
        const name = (client.fullName || '').toLowerCase()
        const email = (client.email || '').toLowerCase()
        const phone = (client.phone || '').toLowerCase()
        return name.includes(queryText) || email.includes(queryText) || phone.includes(queryText)
      })
    })

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const loadClients = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'clients'), where('branchId', '==', currentBranchId.value)))
      clients.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadClients()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      searchQuery,
      clients,
      filteredClients,
      formatDate
    }
  }
}
</script>
