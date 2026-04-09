<template>
  <div class="customer-home-shell flex min-h-screen overflow-hidden bg-gradient-to-br from-[#fbf2e4] via-[#f7ead8] to-[#f1dcc0]">
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
                  <svg class="filter-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            </div>
          </div>
        </section>

        <section class="customer-results-section">
          <div class="customer-results-head">
            <h2 class="customer-results-title">Explore Clinics</h2>
            <p class="customer-results-note">
              {{ loading ? 'Loading clinics...' : `${filteredCenters.length} clinic${filteredCenters.length === 1 ? '' : 's'} found` }}
            </p>
          </div>

          <div v-if="loading" class="state-panel">
            <p class="state-title">Loading centers...</p>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { fetchCustomerCenters } from '@/utils/customerCenters'

const router = useRouter()
const loading = ref(true)
const errorMessage = ref('')
const centers = ref([])

const search = ref('')
const city = ref('')
const service = ref('')

const cities = computed(() => [...new Set(centers.value.map((item) => item.city).filter(Boolean))])
const services = computed(() => [...new Set(centers.value.flatMap((item) => item.services).filter(Boolean))])

const filteredCenters = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return centers.value.filter((center) => {
    const matchesKeyword =
      !keyword ||
      center.name.toLowerCase().includes(keyword) ||
      center.services.some((entry) => entry.toLowerCase().includes(keyword))
    const matchesCity = !city.value || center.city === city.value
    const matchesService = !service.value || center.services.includes(service.value)
    return matchesKeyword && matchesCity && matchesService
  })
})

const openCenter = (centerId) => {
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
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
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
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.75fr) minmax(0, 0.75fr);
  }

  .customer-results-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
