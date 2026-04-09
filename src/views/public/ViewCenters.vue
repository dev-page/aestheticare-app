<template>
  <nav class="public-glass-nav centers-page-nav fixed top-0 inset-x-0 z-50">
    <div class="max-w-7xl mx-auto grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 md:px-8">
      <router-link
        to="/"
        class="centers-home-icon"
        aria-label="Go to homepage"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10.5l9-7 9 7M5.25 9.75V20.25H18.75V9.75" />
        </svg>
      </router-link>

      <router-link to="/" class="public-brand-cluster centers-brand-cluster justify-self-center min-w-0">
        <span class="public-nav-mark" aria-hidden="true"></span>
        <span class="public-nav-brand text-lg sm:text-xl tracking-wide">AesthetiCare</span>
      </router-link>

      <div class="flex items-center justify-end">
        <router-link to="/login" class="centers-login-button">Login</router-link>
      </div>
    </div>
  </nav>

  <main class="centers-discovery min-h-screen pt-20 pb-14">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <section class="centers-hero relative">
        <div class="relative z-10 py-2 md:py-4">
          <div class="space-y-6">
            <div class="mx-auto max-w-4xl space-y-4 text-center">
              <h1 class="centers-hero-title">
                Discover aesthetic centers with a calmer, clearer booking journey.
              </h1>
            </div>

            <h2 class="centers-resource-title">Search for Centers</h2>
          </div>

          <div class="mt-6 rounded-[1.75rem] border border-white/70 bg-white/76 p-4 shadow-[0_18px_60px_rgba(96,64,43,0.08)] backdrop-blur-xl md:p-5">
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_0.75fr_0.75fr_auto]">
              <label class="filter-shell">
                <span class="filter-label">Search</span>
                <div class="filter-search-wrap">
                  <input
                    v-model="search"
                    type="text"
                    placeholder="Center, treatment, or keyword"
                    class="filter-input filter-input-search"
                  />
                  <svg class="filter-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1110.5 3a7.5 7.5 0 016.15 13.65z" />
                  </svg>
                </div>
              </label>

              <label class="filter-shell">
                <span class="filter-label">City</span>
                <select v-model="city" class="filter-input">
                  <option value="">All cities</option>
                  <option v-for="option in cities" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>

              <label class="filter-shell">
                <span class="filter-label">Service</span>
                <select v-model="service" class="filter-input">
                  <option value="">All services</option>
                  <option v-for="option in services" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>

              <button
                type="button"
                class="h-full min-h-[72px] rounded-2xl border border-gold-300/70 bg-gold-700 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-gold-800"
                @click="clearFilters"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="flex flex-col gap-4 rounded-[1.5rem] border border-gold-200/70 bg-white/70 px-5 py-4 shadow-[0_18px_44px_rgba(87,56,35,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-charcoal-500">Results</p>
            <h2 class="mt-1 text-2xl font-semibold text-charcoal-800">
              {{ filteredCenters.length }} {{ filteredCenters.length === 1 ? 'center' : 'centers' }} available
            </h2>
          </div>
          <p class="max-w-2xl text-sm leading-6 text-charcoal-500">
            Browse centers with published profiles and active listings. Select a card to view full details, products, services, and chat options.
          </p>
        </div>
      </section>

      <section class="mt-8">
        <div v-if="loading" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="index in 6" :key="index" class="loading-card animate-pulse"></div>
        </div>

        <div v-else-if="errorMessage" class="state-panel">
          <p class="state-title text-rose-700">We couldn’t load the centers right now.</p>
          <p class="state-copy">{{ errorMessage }}</p>
        </div>

        <div v-else-if="filteredCenters.length" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="center in filteredCenters"
            :key="center.id"
            class="center-card group"
          >
            <div class="center-card-media">
              <img v-if="center.bannerPicture" :src="center.bannerPicture" alt="Center banner" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div v-else class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,213,175,0.95),_rgba(200,147,108,0.82)_45%,_rgba(117,75,51,0.94)_100%)]"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-[rgba(39,23,14,0.8)] via-[rgba(39,23,14,0.18)] to-transparent"></div>

              <div class="absolute left-5 top-5 flex items-center gap-2">
                <span class="center-pill bg-white/84 text-charcoal-700">
                  {{ center.city || 'Cavite' }}
                </span>
                <span class="center-pill bg-gold-100/85 text-gold-800">
                  {{ center.rating > 0 ? `${center.rating.toFixed(1)} rating` : 'Recently added' }}
                </span>
              </div>

              <div class="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Aesthetic center</p>
                  <h3 class="mt-2 text-2xl font-semibold leading-tight text-white">{{ center.name }}</h3>
                </div>
                <div class="center-avatar">
                  <img v-if="center.profilePicture" :src="center.profilePicture" alt="Center profile" class="h-full w-full object-cover" />
                  <span v-else>{{ getInitials(center.name) }}</span>
                </div>
              </div>
            </div>

            <div class="p-5">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-charcoal-700">{{ center.location || 'Location not set' }}</p>
                  <p class="mt-1 text-sm text-charcoal-500">
                    {{ center.services.length }} {{ center.services.length === 1 ? 'service area' : 'service areas' }} available
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs uppercase tracking-[0.18em] text-charcoal-400">Fit</p>
                  <p class="mt-1 text-sm font-semibold text-gold-700">{{ center.services[0] || 'General services' }}</p>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap gap-2">
                <span
                  v-for="tag in center.services.slice(0, 4)"
                  :key="tag"
                  class="rounded-full border border-gold-200/80 bg-gold-50 px-3 py-1.5 text-xs font-medium text-gold-800"
                >
                  {{ tag }}
                </span>
                <span
                  v-if="center.services.length > 4"
                  class="rounded-full border border-charcoal-200/70 bg-charcoal-50 px-3 py-1.5 text-xs font-medium text-charcoal-600"
                >
                  +{{ center.services.length - 4 }} more
                </span>
              </div>

              <div class="mt-6 flex items-center justify-between gap-4 border-t border-gold-100 pt-4">
                <div>
                  <p class="text-xs uppercase tracking-[0.18em] text-charcoal-400">Experience</p>
                  <p class="mt-1 text-sm text-charcoal-600">
                    {{ center.rating > 0 ? 'Customer-rated and ready to explore' : 'Profile published and ready for discovery' }}
                  </p>
                </div>

                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl bg-charcoal-800 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-charcoal-700"
                  @click="openCenter(center.id)"
                >
                  View center
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="state-panel">
          <p class="state-title">No centers match your current filters.</p>
          <p class="state-copy">Try clearing one or two filters to broaden the results and explore more clinics across Cavite.</p>
          <button
            type="button"
            class="mt-5 inline-flex rounded-2xl bg-gold-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold-800"
            @click="clearFilters"
          >
            Show all centers
          </button>
        </div>
      </section>
    </div>
  </main>

  <transition name="fade">
    <div v-if="showRedirectPopup" class="fixed inset-0 z-[80] bg-[rgba(28,15,7,0.45)] backdrop-blur-sm flex items-center justify-center px-4">
      <div class="w-full max-w-md rounded-[1.75rem] border border-gold-200/70 bg-white/92 shadow-[0_28px_80px_rgba(48,26,12,0.24)] p-6">
        <h3 class="text-lg font-semibold text-charcoal-800">Redirecting to sign in</h3>
        <p class="mt-1 text-sm text-charcoal-500">Please wait while we prepare your center view and login path.</p>
        <div class="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-gold-100">
          <div class="redirect-bar h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-500 to-cream-300"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/config/firebaseConfig'
import { fetchCustomerCenters } from '@/utils/customerCenters'

const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const centers = ref([])
const showRedirectPopup = ref(false)
const search = ref('')
const city = ref('')
const service = ref('')
let redirectTimeout = null

const cities = computed(() => [...new Set(centers.value.map((item) => item.city).filter(Boolean))])
const services = computed(() => [...new Set(centers.value.flatMap((item) => item.services).filter(Boolean))])

const filteredCenters = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return centers.value.filter((center) => {
    const matchesSearch =
      !keyword ||
      center.name.toLowerCase().includes(keyword) ||
      center.location.toLowerCase().includes(keyword) ||
      center.services.some((entry) => entry.toLowerCase().includes(keyword))
    const matchesCity = !city.value || center.city === city.value
    const matchesService = !service.value || center.services.includes(service.value)
    return matchesSearch && matchesCity && matchesService
  })
})

const clearFilters = () => {
  search.value = ''
  city.value = ''
  service.value = ''
}

const getInitials = (name) => {
  return String(name || 'Center')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

const openCenter = (centerId) => {
  if (!auth.currentUser) {
    showRedirectPopup.value = true
    if (redirectTimeout) clearTimeout(redirectTimeout)
    redirectTimeout = setTimeout(() => {
      router.push({ path: '/login', query: { redirect: `/customer/center/${centerId}` } })
      showRedirectPopup.value = false
    }, 1700)
    return
  }
  router.push({ name: 'customer-center', params: { id: centerId } })
}

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    centers.value = await fetchCustomerCenters()
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Failed to load centers.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (redirectTimeout) clearTimeout(redirectTimeout)
})
</script>

<style scoped>
.centers-discovery {
  background:
    radial-gradient(circle at top left, rgba(255, 241, 223, 0.95), transparent 32%),
    radial-gradient(circle at 85% 10%, rgba(214, 169, 123, 0.3), transparent 24%),
    linear-gradient(180deg, #fffdf8 0%, #f8efe3 42%, #f3e3cf 100%);
}

.centers-page-nav {
  background: rgba(255, 252, 247, 0.82);
  border-bottom: 1px solid rgba(198, 148, 108, 0.12);
  box-shadow: 0 6px 18px rgba(54, 34, 22, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.centers-brand-cluster {
  gap: 0.8rem;
  max-width: 100%;
  white-space: nowrap;
}

.centers-home-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  width: 2.5rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 105, 70, 0.2);
  color: #6f4a35;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.centers-home-icon:hover {
  border-color: rgba(159, 105, 70, 0.38);
  background: rgba(255, 248, 240, 0.96);
  color: #5d3926;
}

.centers-login-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5.5rem;
  border-radius: 999px;
  border: 1px solid rgba(159, 105, 70, 0.24);
  background: rgba(255, 252, 248, 0.74);
  color: #6f4a35;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.72rem 1.1rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.centers-login-button:hover {
  border-color: rgba(159, 105, 70, 0.42);
  background: rgba(255, 248, 240, 0.96);
  color: #5d3926;
  transform: translateY(-1px);
}

.centers-hero {
  position: relative;
}

.centers-hero-title {
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2.1rem, 5vw, 4.2rem);
  line-height: 1.04;
  letter-spacing: -0.02em;
  color: #6b4431;
}

.centers-resource-title {
  display: block;
  width: 100%;
  margin: 0;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #2f2119;
}

.filter-shell {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.filter-label {
  padding-left: 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #8c6d55;
}

.filter-search-wrap {
  position: relative;
}

.filter-input {
  height: 3.5rem;
  width: 100%;
  border-radius: 1.1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.9);
  padding: 0 1rem;
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.filter-input-search {
  padding-left: 3.25rem;
}

.filter-search-icon {
  pointer-events: none;
  position: absolute;
  left: 1.1rem;
  top: 50%;
  height: 1.1rem;
  width: 1.1rem;
  transform: translateY(-50%);
  color: #b17950;
}

.filter-input:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.center-card {
  overflow: hidden;
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 251, 244, 0.92);
  box-shadow: 0 24px 60px rgba(84, 54, 34, 0.12);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.center-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 30px 72px rgba(84, 54, 34, 0.18);
}

.center-card-media {
  position: relative;
  height: 17rem;
  overflow: hidden;
  background: linear-gradient(135deg, #f8e5bd 0%, #bc8a65 100%);
}

.center-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
}

.center-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 3.6rem;
  width: 3.6rem;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.18);
  color: #fff8f0;
  font-weight: 700;
  letter-spacing: 0.08em;
  backdrop-filter: blur(10px);
}

.state-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  padding: 3rem 1.5rem;
  text-align: center;
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.state-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #342419;
}

.state-copy {
  margin: 0.85rem auto 0;
  max-width: 36rem;
  color: #72573f;
  line-height: 1.7;
}

.loading-card {
  min-height: 29rem;
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.7);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.86), rgba(248, 229, 189, 0.7));
}

.redirect-bar {
  width: 100%;
  transform-origin: left;
  animation: loadingBar 1.7s linear forwards;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes loadingBar {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
}

@media (max-width: 767px) {
  .centers-login-button {
    min-width: auto;
    padding-inline: 0.9rem;
  }

  .centers-brand-cluster {
    gap: 0.55rem;
  }
}

@media (max-width: 639px) {
  .centers-brand-cluster .public-nav-mark {
    height: 2rem;
    width: 2rem;
  }

  .centers-brand-cluster .public-nav-brand {
    font-size: 1.05rem;
    letter-spacing: 0.03em;
  }

  .centers-home-icon {
    height: 2.35rem;
    width: 2.35rem;
  }
}
</style>
