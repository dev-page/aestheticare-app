<template>
  <div class="customer-home-shell flex min-h-screen bg-gradient-to-br from-[#fbf2e4] via-[#f7ead8] to-[#f1dcc0]">
    <CustomerSidebar class="flex-shrink-0" />

    <main class="customer-home-main flex-1">
      <div class="customer-home-content">
        <section class="customer-filter-section">
          <div class="customer-filter-panel">
            <div class="customer-filter-grid">
              <label class="filter-shell">
                <span class="filter-label">Search</span>
                <div class="filter-search-wrap">
                  <input
                    v-model="search"
                    type="text"
                    placeholder="Center, treatment, or keyword"
                    class="filter-input filter-input-search"
                  />
                  <Icon icon="mdi:magnify" class="filter-search-icon" aria-hidden="true" />
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

              <div class="filter-shell">
                <span class="filter-label">Nearby</span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex h-[3.5rem] flex-1 items-center justify-center gap-2 rounded-[1.1rem] border border-gold-300/80 bg-gold-700 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-gold-800 disabled:cursor-not-allowed disabled:opacity-70"
                    :disabled="locationLoading"
                    aria-label="Toggle nearby centers"
                    @click="toggleNearbyCenters"
                  >
                    <Icon icon="mdi:map-marker-radius-outline" class="h-5 w-5 shrink-0" aria-hidden="true" />
                    {{ userLocation ? 'Location on' : 'Use my location' }}
                  </button>

                  <select
                    v-model="radiusKm"
                    class="filter-input max-w-[6.75rem]"
                    :disabled="!userLocation"
                    aria-label="Distance radius"
                  >
                    <option v-for="option in radiusOptions" :key="option" :value="option">
                      {{ option }} km
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                class="filter-icon-button inline-flex h-[3.5rem] min-h-[3.5rem] items-center justify-center rounded-[1.1rem] border border-gold-300/70 bg-gold-700 text-white transition hover:-translate-y-0.5 hover:bg-gold-800"
                aria-label="Reset filters"
                @click="clearFilters"
              >
                <Icon icon="mdi:filter-off-outline" class="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <transition name="fade">
          <div
            v-if="locationMessage"
            class="inline-flex max-w-full rounded-2xl border border-gold-200/80 bg-gold-50 px-4 py-3 text-sm leading-6 text-gold-900 shadow-[0_10px_24px_rgba(126,87,57,0.08)]"
          >
            {{ locationMessage }}
          </div>
        </transition>

        <section class="customer-results-section">
          <div class="customer-results-head">
            <h2 class="customer-results-title">Explore Clinics</h2>
            <p class="customer-results-note">
              {{ loading ? 'Loading clinics...' : `${filteredCenters.length} clinic${filteredCenters.length === 1 ? '' : 's'} found` }}
            </p>
          </div>

          <div v-if="loading" class="state-panel">
            <PageSectionSkeleton variant="split" />
          </div>

          <div v-else-if="errorMessage" class="state-panel">
            <p class="state-title">We couldn't load the centers right now.</p>
            <p class="state-copy">{{ errorMessage }}</p>
          </div>

          <div v-else-if="filteredCenters.length" class="customer-results-grid">
            <article
              v-for="center in filteredCenters"
              :key="center.id"
              class="center-card group"
            >
              <div class="center-card-media">
                <img
                  v-if="center.bannerPicture"
                  :src="center.bannerPicture"
                  alt="Center banner"
                  class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
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
              </div>

            <div class="center-card-body">
              <div>
                <h3 class="center-title">{{ center.name }}</h3>
                <p class="center-location">{{ center.location || 'Location not set' }}</p>
                <p v-if="center.distanceKm !== null" class="mt-2 inline-flex rounded-full border border-gold-200/80 bg-gold-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-800">
                  {{ formatDistance(center.distanceKm) }} away
                </p>
              </div>

              <div class="center-tags">
                <span
                  v-for="tag in center.services.slice(0, 4)"
                  :key="`${center.id}-${tag}`"
                  class="center-tag"
                >
                  {{ tag }}
                </span>
                <span
                  v-if="center.services.length > 4"
                  class="center-tag center-tag-muted"
                >
                  +{{ center.services.length - 4 }} more
                </span>
              </div>

              <div class="center-footer">
                <span class="center-location">{{ center.city || 'Clinic location' }}</span>
                <button @click="openCenter(center.id)" class="customer-center-button">
                  View Center
                </button>
              </div>
              </div>
            </article>
          </div>

          <div v-else class="state-panel">
            <p class="state-title">No centers match your current filters.</p>
            <p class="state-copy">Try clearing one or two filters to see more clinics.</p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import PageSectionSkeleton from '@/components/common/PageSectionSkeleton.vue'
import { subscribeCustomerCenters } from '@/utils/customerCenters'

const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const centers = ref([])

const search = ref('')
const city = ref('')
const service = ref('')
const userLocation = ref(null)
const radiusKm = ref(15)
const locationLoading = ref(false)
const locationMessage = ref('')
const radiusOptions = [5, 10, 15, 25, 50]
let unsubscribeCenters = null

const cities = computed(() => [...new Set(centers.value.map((item) => item.city).filter(Boolean))])
const services = computed(() => [...new Set(centers.value.flatMap((item) => item.services).filter(Boolean))])

const toRadians = (value) => (value * Math.PI) / 180

const getDistanceKm = (from, to) => {
  if (!from || !to) return null
  const earthRadiusKm = 6371
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const formatDistance = (distanceKm) => {
  if (distanceKm === null || Number.isNaN(distanceKm)) return ''
  if (distanceKm < 1) {
    return `${Math.max(Math.round(distanceKm * 1000), 100)} m`
  }
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`
}

const filteredCenters = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const locationFilterActive = Boolean(userLocation.value)
  return centers.value
    .map((center) => {
      const distanceKm =
        locationFilterActive && Number.isFinite(center.lat) && Number.isFinite(center.lng)
          ? getDistanceKm(userLocation.value, { lat: center.lat, lng: center.lng })
          : null
      const matchesKeyword =
        !keyword ||
        center.name.toLowerCase().includes(keyword) ||
        center.location.toLowerCase().includes(keyword) ||
        center.services.some((entry) => entry.toLowerCase().includes(keyword))
      const matchesCity = !city.value || center.city === city.value
      const matchesService = !service.value || center.services.includes(service.value)
      const withinRadius =
        !locationFilterActive ||
        (distanceKm !== null && distanceKm <= radiusKm.value)
      return {
        ...center,
        distanceKm,
        matchesKeyword,
        matchesCity,
        matchesService,
        withinRadius,
      }
    })
    .filter((center) => center.matchesKeyword && center.matchesCity && center.matchesService && center.withinRadius)
    .sort((a, b) => {
      if (!locationFilterActive) return a.name.localeCompare(b.name)
      if (a.distanceKm === null && b.distanceKm === null) return a.name.localeCompare(b.name)
      if (a.distanceKm === null) return 1
      if (b.distanceKm === null) return -1
      return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name)
    })
})

const clearFilters = () => {
  search.value = ''
  city.value = ''
  service.value = ''
  userLocation.value = null
  radiusKm.value = 15
  locationMessage.value = ''
}

const clearNearbyFilter = () => {
  userLocation.value = null
  locationMessage.value = 'Location-based sorting is off. You can still browse centers using the text filters.'
}

const toggleNearbyCenters = () => {
  if (locationLoading.value) return

  if (userLocation.value) {
    clearNearbyFilter()
    return
  }

  if (!navigator.geolocation) {
    locationMessage.value = 'Your browser does not support location access, so nearby sorting is unavailable.'
    return
  }

  locationLoading.value = true
  locationMessage.value = 'Finding your location to sort the nearest centers...'

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      locationMessage.value = `Showing centers within ${radiusKm.value} km, ordered from nearest to farthest.`
      locationLoading.value = false
    },
    (error) => {
      userLocation.value = null
      const denied = error?.code === 1
      locationMessage.value = denied
        ? 'Location access was denied. You can still use the other filters.'
        : 'We could not get your location right now. Please try again.'
      locationLoading.value = false
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    }
  )
}

const openCenter = (centerId) => {
  router.push({ name: 'customer-center', params: { id: centerId } })
}

onMounted(() => {
  loading.value = true
  errorMessage.value = ''
  unsubscribeCenters = subscribeCustomerCenters(
    (nextCenters) => {
      centers.value = nextCenters
      loading.value = false
    },
    (error) => {
      console.error(error)
      errorMessage.value = 'Failed to load centers.'
      loading.value = false
    }
  )
})

onUnmounted(() => {
  if (unsubscribeCenters) unsubscribeCenters()
})

watch(radiusKm, () => {
  if (userLocation.value) {
    locationMessage.value = `Showing centers within ${radiusKm.value} km, ordered from nearest to farthest.`
  }
})
</script>

<style scoped>
.customer-home-shell {
  position: relative;
}

.customer-home-main {
  position: relative;
  min-width: 0;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.customer-home-content {
  padding: 1.5rem 1.4rem 2rem;
  display: grid;
  gap: 1.35rem;
}

.customer-filter-panel,
.customer-results-section,
.state-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 251, 244, 0.92);
  box-shadow: 0 24px 60px rgba(84, 54, 34, 0.12);
}

.customer-filter-panel {
  padding: 1rem;
}

.customer-filter-grid {
  display: grid;
  gap: 0.9rem;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
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

.filter-icon-button {
  min-width: 3.5rem;
  padding-left: 0.9rem;
  padding-right: 0.9rem;
}

.customer-filter-panel {
  padding: 1rem;
}

.customer-results-section {
  padding: 1.25rem;
}

.customer-results-head,
.center-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.customer-results-title,
.center-title {
  font-family: "Playfair Display", "Times New Roman", serif;
}

.customer-results-title {
  margin: 0;
  color: #3d281d;
  font-size: clamp(1.9rem, 2.8vw, 2.55rem);
  line-height: 1;
}

.customer-results-note {
  margin: 0;
  color: rgba(76, 54, 40, 0.76);
  font-size: 0.88rem;
}

.customer-results-grid {
  display: grid;
  gap: 1.25rem;
  margin-top: 1.25rem;
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

.center-card-body {
  display: grid;
  gap: 1rem;
  padding: 1.3rem;
}

.center-title {
  margin: 0;
  color: #2f1d14;
  font-size: 1.95rem;
  line-height: 1.05;
}

.center-location {
  margin: 0.45rem 0 0;
  color: rgba(76, 54, 40, 0.76);
  font-size: 0.96rem;
}

.center-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.center-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.55rem 0.95rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: #fbf1dc;
  color: #8a5b3d;
  font-size: 0.82rem;
}

.center-tag-muted {
  border-color: rgba(204, 188, 171, 0.7);
  background: #f4eee8;
  color: #6e6259;
}

.customer-center-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  box-shadow: 0 14px 26px rgba(111, 63, 42, 0.14);
  padding: 0.8rem 1.15rem;
  font-size: 0.86rem;
  font-weight: 700;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.customer-center-button:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.state-panel {
  padding: 3rem 1.5rem;
  text-align: center;
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

@media (min-width: 900px) {
  .customer-filter-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.75fr) minmax(0, 0.75fr) auto;
  }

  .customer-results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1180px) {
  .customer-filter-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.74fr) minmax(0, 0.74fr) minmax(0, 1fr) auto;
    align-items: end;
  }

  .customer-filter-grid .filter-shell:last-of-type {
    min-width: 0;
  }
}

@media (min-width: 1280px) {
  .customer-hero {
    padding: 1.5rem 2rem 1.8rem;
  }

  .customer-home-content {
    padding: 1.7rem 2rem 2.2rem;
  }

  .customer-results-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .customer-home-content {
    padding: 1rem 1rem 1.5rem;
  }

  .customer-results-head,
  .center-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .customer-center-button {
    width: 100%;
  }
}
</style>
