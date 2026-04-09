<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8 text-white">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold mb-1">Archives</h1>
        <p class="text-slate-400">Review archived posts and suppliers, then restore or delete when needed.</p>
      </div>

      <div class="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          @click="activeTab = 'posts'"
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold transition',
            activeTab === 'posts' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          ]"
        >
          Posts
        </button>
        <button
          type="button"
          @click="activeTab = 'suppliers'"
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold transition',
            activeTab === 'suppliers' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          ]"
        >
          Suppliers
        </button>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
        <div v-if="activeTab === 'posts'">
          <div v-if="posts.length === 0" class="text-slate-400">No archived posts yet.</div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <article v-for="post in posts" :key="post.id" class="bg-slate-900/70 border border-slate-700 rounded-lg overflow-hidden">
              <img v-if="post.imageUrl" :src="post.imageUrl" alt="Post image" class="w-full h-40 object-cover" />
              <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">{{ post.postType }}</span>
                  <span class="text-xs text-slate-400">{{ formatDate(post.archivedAt || post.updatedAt || post.createdAt) }}</span>
                </div>
                <h3 class="font-semibold mb-1">{{ post.title }}</h3>
                <p class="text-sm text-slate-300 mb-1">{{ post.productName || post.serviceName }}</p>
                <p class="text-sm text-slate-400 mb-2">{{ post.description }}</p>
                <p class="text-sm font-semibold text-green-400">{{ formatCurrency(post.price) }}</p>

                <div class="mt-3">
                  <button
                    @click="unarchivePost(post)"
                    :disabled="loadingId === post.id"
                    class="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Unarchive
                  </button>
                  <button
                    @click="deletePermanently(post)"
                    :disabled="loadingId === post.id"
                    class="ml-2 px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div v-else>
          <div v-if="archivedSuppliers.length === 0" class="text-slate-400">No archived suppliers yet.</div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <article v-for="supplier in archivedSuppliers" :key="supplier.id" class="bg-slate-900/70 border border-slate-700 rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold text-white">{{ supplier.name || 'Unnamed Supplier' }}</h3>
                <span class="text-xs text-slate-400">{{ formatDate(supplier.archivedAt || supplier.updatedAt || supplier.createdAt) }}</span>
              </div>
              <p class="text-sm text-slate-300 mb-1">Contact: {{ supplier.contact || '-' }}</p>
              <p class="text-sm text-slate-300 mb-1">Email: {{ supplier.email || '-' }}</p>
              <p class="text-sm text-slate-300 mb-3">Phone: {{ supplier.phone || '-' }}</p>

              <div class="flex flex-wrap gap-1 mb-3">
                <span
                  v-for="cat in normalizedCategories(supplier)"
                  :key="`${supplier.id}-${cat}`"
                  class="px-2 py-0.5 rounded-full text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30"
                >
                  {{ cat }}
                </span>
                <span v-if="normalizedCategories(supplier).length === 0" class="text-slate-500 text-xs">No category</span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  @click="unarchiveSupplier(supplier)"
                  :disabled="loadingId === supplier.id"
                  class="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  Unarchive
                </button>
                <button
                  @click="deleteSupplierPermanently(supplier)"
                  :disabled="loadingId === supplier.id"
                  class="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Permanently
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'

export default {
  name: 'ArchivedPosts',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())

    const currentBranchId = ref('')
    const posts = ref([])
    const archivedSuppliers = ref([])
    const loadingId = ref('')
    const activeTab = ref('posts')

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(Number(value) || 0)

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      return '-'
    }

    const normalizedCategories = (supplier) => {
      if (Array.isArray(supplier.categories)) return supplier.categories.filter(Boolean)
      if (supplier.category) return [supplier.category]
      return []
    }

    const loadArchivedPosts = async () => {
      if (!currentBranchId.value) {
        posts.value = []
        return
      }
      const archivedQuery = query(
        collection(db, 'archivedProductServicePosts'),
        where('branchId', '==', currentBranchId.value)
      )
      const snapshot = await getDocs(archivedQuery)
      posts.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.archivedAt?.seconds || b.updatedAt?.seconds || 0) - (a.archivedAt?.seconds || a.updatedAt?.seconds || 0))
    }

    const loadArchivedSuppliers = async () => {
      if (!currentBranchId.value) {
        archivedSuppliers.value = []
        return
      }
      const archivedQuery = query(
        collection(db, 'archivedSuppliers'),
        where('branchId', '==', currentBranchId.value)
      )
      const snapshot = await getDocs(archivedQuery)
      archivedSuppliers.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.archivedAt?.seconds || b.updatedAt?.seconds || 0) - (a.archivedAt?.seconds || a.updatedAt?.seconds || 0))
    }

    const unarchivePost = async (post) => {
      const result = await Swal.fire({
        title: 'Unarchive Post?',
        text: `Restore "${post.title || 'this post'}" to active posts?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Unarchive',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      loadingId.value = post.id
      try {
        const { id, originalPostId, archivedAt, archivedBy, ...payload } = post
        await setDoc(doc(db, 'productServicePosts', post.id), {
          ...payload,
          updatedAt: serverTimestamp()
        })
        await deleteDoc(doc(db, 'archivedProductServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Unarchived product/service post',
          details: `Unarchived post: ${post.title || post.id}.`
        })
        toast.success('Post unarchived.')
        await loadArchivedPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to unarchive post.')
      } finally {
        loadingId.value = ''
      }
    }

    const deletePermanently = async (post) => {
      const result = await Swal.fire({
        title: 'Delete Permanently?',
        text: `Permanently delete "${post.title || 'this post'}"? This cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      loadingId.value = post.id
      try {
        await deleteDoc(doc(db, 'archivedProductServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Deleted archived post permanently',
          details: `Deleted archived post: ${post.title || post.id}.`
        })
        toast.success('Archived post deleted permanently.')
        await loadArchivedPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to delete archived post.')
      } finally {
        loadingId.value = ''
      }
    }

    const unarchiveSupplier = async (supplier) => {
      const result = await Swal.fire({
        title: 'Unarchive Supplier?',
        text: `Restore "${supplier.name || 'this supplier'}" to active suppliers?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Unarchive',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      loadingId.value = supplier.id
      try {
        const { id, originalSupplierId, archivedAt, archivedBy, ...payload } = supplier
        await setDoc(doc(db, 'suppliers', supplier.id), {
          ...payload,
          updatedAt: serverTimestamp()
        })
        await deleteDoc(doc(db, 'archivedSuppliers', supplier.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Unarchived supplier',
          details: `Unarchived supplier: ${supplier.name || supplier.id}.`
        })
        toast.success('Supplier unarchived.')
        await loadArchivedSuppliers()
      } catch (error) {
        console.error(error)
        toast.error('Failed to unarchive supplier.')
      } finally {
        loadingId.value = ''
      }
    }

    const deleteSupplierPermanently = async (supplier) => {
      const result = await Swal.fire({
        title: 'Delete Permanently?',
        text: `Permanently delete "${supplier.name || 'this supplier'}"? This cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      loadingId.value = supplier.id
      try {
        await deleteDoc(doc(db, 'archivedSuppliers', supplier.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Deleted archived supplier permanently',
          details: `Deleted archived supplier: ${supplier.name || supplier.id}.`
        })
        toast.success('Archived supplier deleted permanently.')
        await loadArchivedSuppliers()
      } catch (error) {
        console.error(error)
        toast.error('Failed to delete archived supplier.')
      } finally {
        loadingId.value = ''
      }
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          posts.value = []
          archivedSuppliers.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''
        await loadArchivedPosts()
        await loadArchivedSuppliers()
        await logActivity(db, {
          module: 'Manager',
          action: 'Viewed archives',
          details: 'Opened manager archives page.'
        })
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      posts,
      archivedSuppliers,
      loadingId,
      activeTab,
      formatCurrency,
      formatDate,
      normalizedCategories,
      unarchivePost,
      deletePermanently,
      unarchiveSupplier,
      deleteSupplierPermanently
    }
  }
}
</script>

