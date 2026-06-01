<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white mb-2">Transaction History</h1>
        <p class="text-slate-400">All branch transactions recorded by reception and cashier flow.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 class="text-slate-400 text-sm mb-1">Total Revenue</h2>
        <p class="text-3xl font-bold text-green-400">{{ formatAmount(totalAmount) }}</p>
      </div>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-700">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Client</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Amount</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Method</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
              <tr v-for="txn in transactions" :key="txn.id" class="hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 text-white">{{ txn.clientName || 'Walk-in Client' }}</td>
                <td class="px-6 py-4 text-green-400 font-medium">{{ formatAmount(txn.amount) }}</td>
                <td class="px-6 py-4 text-slate-300">{{ txn.method || '-' }}</td>
                <td class="px-6 py-4">
                  <span :class="statusClass(txn.status)">
                    {{ txn.status || 'Paid' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-slate-300">{{ formatDate(txn.createdAt) }}</td>
              </tr>
              <tr v-if="transactions.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400">No transactions yet.</td>
              </tr>
            </tbody>
          </table>
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
  name: 'ReceptionistTransactionHistory',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const transactions = ref([])

    const totalAmount = computed(() =>
      transactions.value.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    )

    const formatAmount = (amount) => {
      const numeric = Number(amount || 0)
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(numeric)
    }

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return '-'
      return timestamp.toDate().toLocaleString()
    }

    const statusClass = (status) => {
      if (status === 'Pending') return 'px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400'
      if (status === 'Failed') return 'px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400'
      return 'px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400'
    }

    const loadTransactions = async () => {
      if (!currentBranchId.value) return
      const snapshot = await getDocs(query(collection(db, 'transactions'), where('branchId', '==', currentBranchId.value)))
      transactions.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    onMounted(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) return

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? userSnap.data().branchId || '' : ''
        await loadTransactions()
      })
    })

    return {
      transactions,
      totalAmount,
      formatAmount,
      formatDate,
      statusClass
    }
  }
}
</script>

