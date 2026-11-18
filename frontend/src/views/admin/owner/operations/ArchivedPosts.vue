<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'cards', cards: 6 }" class="flex-1 p-4 md:p-8 text-white">
      <div class="mb-6">
        <h1 class="mb-1 text-2xl font-bold md:text-3xl">Archived Posts</h1>
        <p class="text-slate-400">Review archived product and service posts, then restore or permanently delete them.</p>
      </div>

      <section class="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-6">
        <div v-if="posts.length === 0" class="text-slate-400">No archived posts yet.</div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="post in posts" :key="post.id" class="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/70">
            <img v-if="post.imageUrl" :src="post.imageUrl" alt="Post image" class="h-40 w-full object-cover" />
            <div class="p-4">
              <div class="mb-2 flex items-center justify-between">
                <span class="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300">{{ post.postType }}</span>
                <span class="text-xs text-slate-400">{{ formatDate(post.archivedAt || post.updatedAt || post.createdAt) }}</span>
              </div>
              <h2 class="mb-1 font-semibold">{{ post.title }}</h2>
              <p class="mb-1 text-sm text-slate-300">{{ post.productName || post.serviceName }}</p>
              <p class="mb-2 text-sm text-slate-400">{{ post.description }}</p>
              <p class="font-semibold text-green-400">{{ formatCurrency(post.price) }}</p>

              <div class="mt-3">
                <button
                  v-if="canRestorePosts"
                  type="button"
                  @click="unarchivePost(post)"
                  :disabled="loadingId === post.id"
                  class="rounded bg-emerald-600 px-3 py-1 text-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  Unarchive
                </button>
                <button
                  v-if="canDeletePosts"
                  type="button"
                  @click="deletePermanently(post)"
                  :disabled="loadingId === post.id"
                  class="ml-2 rounded bg-red-600 px-3 py-1 text-xs hover:bg-red-700 disabled:opacity-50"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'
import { usePageLoading } from '@/composables/usePageLoading'

export default {
  name: 'ArchivedPosts',
  components: { OwnerSidebar },
  setup() {
    const { pageLoading, trackPageLoad, pageListener } = usePageLoading()
    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission } = usePermissions()

    const currentBranchId = ref('')
    const posts = ref([])
    const loadingId = ref('')
    const canRestorePosts = computed(() => hasPermission('services:create') && hasPermission('services:disable'))
    const canDeletePosts = computed(() => hasPermission('services:disable'))

    const formatCurrency = (value) =>
      new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'symbol' }).format(Number(value) || 0)

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      return '-'
    }

    const loadArchivedPosts = trackPageLoad(async () => {
      if (!hasPermission('services:view') || !currentBranchId.value) {
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
    })

    const unarchivePost = async (post) => {
      if (!canRestorePosts.value) {
        toast.error('You do not have permission to restore archived posts.')
        return
      }
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
          financeStatus: 'draft', isPublished: false, financeReview: null, publishedBy: null, publishedAt: null,
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
      if (!canDeletePosts.value) {
        toast.error('You do not have permission to permanently delete archived posts.')
        return
      }
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

    let unsubscribeAuth = null

    onMounted(trackPageLoad(() => {
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          currentBranchId.value = ''
          posts.value = []
          return
        }

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''
        await loadArchivedPosts()
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      pageLoading,
      posts,
      loadingId,
      canRestorePosts,
      canDeletePosts,
      formatCurrency,
      formatDate,
      unarchivePost,
      deletePermanently
    }
  }
}
</script>
