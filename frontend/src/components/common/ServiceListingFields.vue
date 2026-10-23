<template>
  <fieldset class="listing-fields" :disabled="disabled">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ContractAppearanceSelect :id="editing ? 'edit-listing-post-type' : 'listing-post-type'" v-model="form.postType" class="listing-post-type" label="Post Type" :disabled="editing || disabled" :options="isFreePlan ? [{ value: 'Service', label: 'Service' }] : [{ value: 'Service', label: 'Service' }, { value: 'Consultation', label: 'Consultation' }, { value: 'Package', label: 'Service Package' }]" />

          <div v-if="form.postType === 'Product'">
            <label class="block text-slate-400 mb-1">Product</label>
            <select
              v-model="form[nameKey('productName')]"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                {{ inventoryProducts.length === 0 ? 'No inventory items available yet' : 'Select product from inventory' }}
              </option>
              <option v-for="item in inventoryProducts" :key="item.id" :value="item.name">{{ item.name }}</option>
            </select>
          </div>

          <div v-if="form.postType === 'Service'">
            <label class="block text-slate-400 mb-1">Service Name</label>
            <input
              type="text"
              v-model="form[nameKey('serviceName')]"
              placeholder="Enter service name"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div v-else-if="form.postType === 'Consultation'">
            <label class="block text-slate-400 mb-1">Consultation Name</label>
            <input
              type="text"
              v-model="form[nameKey('consultationName')]"
              placeholder="Enter consultation name"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="mb-4 border-b border-slate-700 pb-3">
          <h3 class="font-semibold text-white">{{ form.postType === 'Consultation' ? 'Consultation Information' : form.postType === 'Package' ? 'Package Information' : 'Service Information' }}</h3>
          <p class="mt-1 text-xs text-slate-400">The service, consultation, or package name becomes the title customers see.</p>
          <p v-if="form.postType === 'Service'" class="mt-2 text-xs text-slate-500">Recommendation: create a Service for one appointment. For a planned course with multiple visits, create a Service Package and include the individual services.</p>
          <p v-else-if="form.postType === 'Package'" class="mt-2 text-xs text-slate-500">Use a package for a course of multiple treatment visits. Select the services or consultations included; the package price is calculated from their prices and your discount.</p>
          <p v-else-if="form.postType === 'Consultation'" class="mt-2 text-xs text-slate-500">A consultation is a single appointment. Its fee is entered once below.</p>
        </div>

        <div v-if="['Service', 'Package'].includes(form.postType)" class="listing-category-field">
          <ContractAppearanceSelect :id="editing ? 'edit-service-category' : 'service-category'" :model-value="serviceCategoryKey(form.serviceCategory)" label="Service category" :disabled="disabled" :options="categoryOptions" @update:model-value="selectCategory" />
          <div class="listing-category-help"><p>Group similar treatments so customers can find them easily.</p><button type="button" :disabled="disabled" @click="addingCategory = !addingCategory">{{ addingCategory ? 'Cancel' : '+ Add category' }}</button></div>
          <div v-if="addingCategory" class="listing-new-category">
            <label :for="editing ? 'edit-new-category' : 'new-category'">New category name</label>
            <div><input :id="editing ? 'edit-new-category' : 'new-category'" v-model="newCategory" maxlength="60" placeholder="e.g. Skin Rejuvenation" @keydown.enter.prevent="addCategory" /><button type="button" @click="addCategory">Use category</button></div>
            <p v-if="categoryError" role="alert">{{ categoryError }}</p>
          </div>
        </div>

        <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div v-if="form.postType !== 'Consultation'">
            <label class="block text-slate-400 mb-1">Price (PHP)</label>
            <input :value="form.postType === 'Package' ? packagePrice.toFixed(2) : form.price" :readonly="form.postType === 'Package'" @input="setPositiveNumber('price', $event, 0)" @keydown="blockNegativeKey" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 read-only:opacity-80" />
          </div>
          <div v-if="form.postType === 'Package'">
            <label class="block text-slate-400 mb-1">Number of Package Visits</label>
            <input :value="form.sessionCount" @input="setPositiveNumber('sessionCount', $event, 1, 50, true)" @keydown="blockNegativeKey" type="number" min="1" max="50" step="1" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="text-xs text-slate-400 mt-1">Set how many visits the package covers. The clinic schedules each visit.</p>
          </div>
          <div v-if="form.postType === 'Package' && Number(form.sessionCount) > 1" class="md:col-span-2">
            <label class="block text-slate-400 mb-1">Interval before the next session (days)</label>
            <input v-model.number="form.sessionIntervalDays" type="number" min="0" max="365" step="1" class="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white" />
            <p class="mt-1 text-xs text-slate-400">Counted from completion of the prior treatment session.</p>
          </div>
          <div class="md:col-span-2">
            <label class="block text-slate-400 mb-1">Description</label>
            <textarea v-model="form.description" rows="3" placeholder="Describe this service, consultation, or package" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>
        </div>

        <div v-if="form.postType === 'Package'" class="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
          <label class="block text-slate-400 mb-1">Package Name</label>
          <input v-model="form[nameKey('packageName')]" type="text" placeholder="Consultation + service package" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600" />
          <label class="block text-slate-400 mt-4 mb-1">Included services and consultations</label>
          <select v-model="form.packageServiceIds" multiple class="min-h-28 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white">
            <option v-for="item in posts.filter((post) => ['Service', 'Consultation'].includes(post.postType))" :key="item.id" :value="item.id">{{ item.title || item.serviceName || item.consultationName }} ({{ item.durationMinutes || 0 }} mins)</option>
          </select>
          <p class="mt-2 text-xs text-slate-400">A package can combine at least two different services, pair a consultation with a service, or repeat one service across multiple package visits. Customers pay for the course once; the clinic schedules its visits.</p>
          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="block text-slate-400">Package discount (%)
              <input v-model.number="form.discountPercent" type="number" min="0" max="90" step="0.5" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" />
            </label>
            <div class="rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
              <p>Included total: PHP {{ packageSubtotal.toFixed(2) }}</p>
              <p>Customer pays: PHP {{ packagePrice.toFixed(2) }}</p>
              <p>Customer saves: PHP {{ packageSavings.toFixed(2) }}</p>
            </div>
          </div>
          <p class="mt-2 text-xs text-slate-400">The clinic sets the discount. The package price is calculated from the current prices of its included services and consultation.</p>
        </div>

        <p v-if="editing && form.postType === 'Service' && Number(form.sessionCount || 1) > 1" class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">This existing Service is configured for {{ form.sessionCount }} treatment sessions. New Services cover one appointment; consider creating a Service Package for a multi-visit course. This existing listing will keep its current session setup when edited.</p>

        <div v-if="form.postType === 'Product'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="md:col-span-2">
            <p class="text-sm font-medium text-white">Inventory Details</p>
            <p class="mt-1 text-xs text-slate-400">These optional details help customers identify the selected inventory product.</p>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Quantity / Volume</label>
            <input
              v-model="form.productVolume"
              type="text"
              placeholder="e.g. 30 mL or 1 L"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Unit</label>
            <input
              v-model="form.productUnit"
              type="text"
              placeholder="e.g. bottle, box, piece"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>


        <div v-if="form.postType === 'Product'" class="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
          <p class="mb-3 font-medium text-amber-200">FDA product documentation</p>
          <p class="text-xs leading-5 text-slate-400">FDA details are supplied by the selected supplier and are copied from inventory when this product is published. Update them from the supplier catalog, not here.</p>
        </div>

        <div v-if="form.postType === 'Service' || form.postType === 'Consultation'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="md:col-span-2 border-b border-slate-700 pb-2">
            <h3 class="font-semibold text-white">{{ form.postType === 'Service' ? 'Booking Rules' : 'Consultation Rules' }}</h3>
            <p class="mt-1 text-xs text-slate-400">{{ form.postType === 'Service' ? 'Set only the rules customers need to know before requesting this service.' : 'Set the fee, duration, and appointment mode for this consultation.' }}</p>
          </div>
          <label v-if="form.postType !== 'Service' || !isFreePlan" class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
            <input
              v-if="form.postType === 'Service' && !isFreePlan"
              v-model="form.requiresConsultationFirst"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-blue-500"
            />
            <input
              v-else-if="form.postType === 'Consultation'"
              type="checkbox"
              checked
              disabled
              class="mt-1 h-4 w-4 accent-blue-500"
            />
            <span>
              <span class="block font-medium text-white">
                {{ form.postType === 'Consultation' ? 'Standalone consultation post' : 'Requires consultation first' }}
              </span>
              <span class="block text-xs text-slate-400">
                {{ form.postType === 'Consultation'
                  ? 'This consultation can be booked separately.'
                  : isFreePlan ? 'Consultations are unavailable on Free Plan.' : 'Enable this when the service must be assessed before a booking can proceed.' }}
              </span>
            </span>
          </label>
          <div v-if="form.postType === 'Consultation'" class="md:col-span-2">
            <div v-if="form.consultationMode === 'online'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <label class="block text-slate-400">Arrival grace (minutes)<input v-model.number="form.consultationGraceMinutes" type="number" min="0" max="30" step="1" placeholder="10" class="w-full px-3 py-2 rounded-lg border border-slate-600" /></label>
              <label class="block text-slate-400">Schedule buffer (minutes)<input v-model.number="form.consultationBufferMinutes" type="number" min="5" max="45" step="1" placeholder="15" class="w-full px-3 py-2 rounded-lg border border-slate-600" /></label>
              <p class="md:col-span-2 text-xs text-slate-400">The duration starts after verified attendance. The buffer reserves time between bookings and is at least the grace period plus five minutes. Connection interruptions can restore up to five minutes within this buffer. Unstarted sessions go to clinic review; no automatic customer penalty.</p>
            </div>
            <label class="block text-slate-400 mb-1">Consultation Fee (PHP)</label>
            <input
              v-model.number="form.consultationFee"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-slate-400 mt-1">
              {{ form.postType === 'Consultation' ? 'Required for consultation posts.' : 'Required when consultation is enabled.' }}
            </p>
          </div>
          <label v-if="form.postType === 'Service'" :class="{ 'md:col-span-2': isFreePlan }" class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
            <input v-model="form.followUpAllowed" type="checkbox" class="mt-1 h-4 w-4 accent-blue-500" />
            <span>
              <span class="block font-medium text-white">Allow follow-ups</span>
              <span class="block text-xs text-slate-400">Mark this when customers may book a follow-up after the initial service.</span>
            </span>
          </label>
          <div v-if="form.postType === 'Service'">
            <label class="block text-slate-400 mb-1">Follow-up Window (days)</label>
            <input
              v-model.number="form.followUpWindowDays"
              type="number"
              min="1"
              step="1"
              :disabled="!form.followUpAllowed"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
            <p class="text-xs text-slate-400 mt-1">How many days after the service a follow-up can be scheduled.</p>
          </div>
          <div :class="{ 'md:col-span-2': form.postType === 'Consultation' }">
            <label class="block text-slate-400 mb-1">{{ form.postType === 'Consultation' ? 'Consultation Duration (minutes)' : 'Service Duration (minutes)' }}</label>
            <input
              v-model.number="form.durationMinutes"
              type="number"
              :min="form.postType === 'Consultation' && form.consultationMode === 'online' ? 5 : 1"
              :max="form.postType === 'Consultation' && form.consultationMode === 'online' ? 240 : undefined"
              step="1"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-xs text-slate-400 mt-1">
              {{ form.postType === 'Consultation'
                ? 'How long the consultation usually takes to complete.'
                : 'How long the service usually takes to complete.' }}
            </p>
          </div>
          <div v-if="form.postType === 'Consultation'" class="md:col-span-2">
            <label class="block text-slate-400 mb-1">Consultation Mode</label>
            <select v-model="form.consultationMode" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="on-site">On-site consultation</option>
              <option value="online">Online consultation</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Choose one mode for this consultation. Packages inherit the mode of their included consultation.</p>
          </div>
          <div v-if="form.postType === 'Service' && form.requiresConsultationFirst" class="md:col-span-2">
            <ContractAppearanceSelect :id="editing ? 'edit-linked-consultation' : 'linked-consultation'" v-model="form.linkedConsultationId" label="Linked consultation (required)" :disabled="disabled || !consultationOptions.length" :options="consultationOptions" />
            <p class="mt-2 text-xs text-slate-400">{{ consultationOptions.length ? 'Clients must complete this linked consultation before booking this service.' : 'No published consultations are available. Create and publish an online or on-site consultation first.' }}</p>
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-slate-400 mb-1">{{ editing ? 'Replace image (optional)' : 'Image (1 file only)' }}</label>
          <input
            type="file"
            accept="image/*"
            @change="$emit('image-change', $event)"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-blue-600 file:text-white"
          />
          <p v-if="imageFileName" class="text-xs text-slate-400 mt-1">Selected: {{ imageFileName }}</p>
        </div>

        <div class="mb-4 rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm">
          <p class="font-semibold text-white">{{ form.postType === 'Product' ? 'Listing Summary' : 'Booking Summary' }}</p>
          <p v-if="form.postType === 'Service'" class="mt-2 text-slate-300">Consultation: {{ form.requiresConsultationFirst ? 'Required before booking' : 'Not required' }}</p>
          <p v-if="form.postType === 'Service'" class="mt-1 text-slate-300">Follow-up: {{ form.followUpAllowed ? `Available within ${form.followUpWindowDays || 14} days` : 'Not available' }}</p>
          <p v-if="form.postType === 'Consultation'" class="mt-2 text-slate-300">Mode: {{ form.consultationMode === 'on-site' ? 'On-site consultation' : 'Online consultation' }}</p>
          <p v-if="form.postType === 'Package'" class="mt-2 text-slate-300">Included appointments: {{ form.packageServiceIds.length }}</p>
          <p v-if="form.postType === 'Service'" class="mt-1 text-slate-300">Appointments per booking: 1</p>
          <p v-if="form.postType === 'Package'" class="mt-1 text-slate-300">Package visits: {{ Math.max(1, Number(form.sessionCount || 1)) }}</p>
          <p v-if="form.postType === 'Product'" class="mt-2 text-slate-300">Source: selected inventory product</p>
          <p class="mt-1 text-slate-300">Proposed {{ String(form.postType || 'Service').toLowerCase() }} price: PHP {{ Number(form.price || form.consultationFee || 0).toFixed(2) }}</p>
          <p class="mt-1 text-xs text-amber-200">{{ isFreePlan ? 'Free Plan service listings publish directly; Finance approval is not required.' : 'Financial terms, including installment settings, require Finance approval before publication.' }}</p>
        </div>

    <ServiceStaffingFields v-if="['Service', 'Consultation'].includes(form.postType)" :model="form" />
  </fieldset>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeServiceCategory, serviceCategoryKey, serviceCategoryOptions } from '../../../../shared/serviceCategories.js'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import ServiceStaffingFields from './ServiceStaffingFields.vue'
const props = defineProps({ model: { type: Object, required: true }, editing: Boolean, disabled: Boolean, isFreePlan: Boolean, inventoryProducts: { type: Array, default: () => [] }, posts: { type: Array, default: () => [] }, imageFileName: { type: String, default: '' } })
defineEmits(['image-change'])
const form = computed(() => props.model)
const packageComponents = computed(() => (form.value.packageServiceIds || []).map(id => props.posts.find(post => post.id === id)).filter(Boolean))
const packageSubtotal = computed(() => packageComponents.value.reduce((sum, post) => sum + Number(post.price || post.consultationFee || 0) * Math.max(1, Number(post.sessionCount || 1)), 0) * Math.max(1, Number(form.value.sessionCount || 1)))
const packageSavings = computed(() => packageSubtotal.value * Math.min(90, Math.max(0, Number(form.value.discountPercent || 0))) / 100)
const packagePrice = computed(() => Math.max(0, packageSubtotal.value - packageSavings.value))
const addingCategory = ref(false), newCategory = ref(''), categoryError = ref('')
const categoryOptions = computed(() => serviceCategoryOptions([...props.posts, { postType: 'Service', serviceCategory: form.value.serviceCategory }], true))
const selectCategory = key => { form.value.serviceCategory = categoryOptions.value.find(option => option.value === key)?.label || 'Other' }
const addCategory = () => {
  const name = normalizeServiceCategory(newCategory.value)
  if (!newCategory.value.trim()) { categoryError.value = 'Enter a category name.'; return }
  if (serviceCategoryKey(name) === 'all services') { categoryError.value = 'Choose a specific category name. All Services is the combined filter.'; return }
  form.value.serviceCategory = categoryOptions.value.find(option => option.value === serviceCategoryKey(name))?.label || name
  addingCategory.value = false; newCategory.value = ''; categoryError.value = ''
}
watch(() => props.model, () => { addingCategory.value = false; newCategory.value = ''; categoryError.value = '' })
const nameKey = key => props.editing ? 'name' : key
const blockNegativeKey = event => { if (event.key === '-') event.preventDefault() }
const setPositiveNumber = (key, event, min, max = Infinity, wholeNumber = false) => {
  const raw = event.target.value
  if (raw === '') { form.value[key] = ''; return }
  const value = Number(raw)
  if (!Number.isFinite(value)) { form.value[key] = ''; event.target.value = ''; return }
  const bounded = Math.max(min, Math.min(max, wholeNumber ? Math.trunc(value) : value))
  form.value[key] = bounded
  if (bounded !== value) event.target.value = String(bounded)
}
const consultationOptions = computed(() => props.posts.filter(post => post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived).map(post => ({ value: post.id, label: `${post.title || post.consultationName || 'Consultation'} (${post.consultationMode === 'online' ? 'Online' : 'On-site'})` })))
</script>

<style scoped>
.listing-fields { min-width: 0; margin: 0; padding: 0; border: 0; }
.listing-fields :is(label, input, select, textarea) { font-size: 13px; }
.listing-fields :is(input:not([type=checkbox]), select, textarea) { min-height: 44px; color-scheme: light; }
.listing-fields textarea { line-height: 1.7; resize: vertical; }
.listing-fields input[type=checkbox] { accent-color: #97603c; }
.listing-fields select option { background: #fffdf9; color: #3d281d; padding: 8px 10px; }
.listing-fields input[type=file] { padding: 8px; border-style: dashed; }
.listing-fields input[type=file]::file-selector-button { padding: 7px 12px; border: 0; border-radius: 6px; background: #f4e7d5; color: #805432; cursor: pointer; }
.listing-post-type { margin: 0; }
.listing-post-type :deep(label) { margin-bottom: 4px; color: #6b5342; font-weight: 400; }
.listing-category-field { margin-bottom: 22px; }
.listing-category-field :deep(.appearance-select) { margin-top: 0; }
.listing-category-help { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.listing-category-help p { margin: 0; color: #87664e; font-size: 12px; }
.listing-category-help button { padding: 4px 0; background: transparent; border: 0; color: #865737; font-size: 12px; font-weight: 600; }
.listing-new-category { margin-top: 12px; padding: 14px; border: 1px solid #e6ceb2; border-radius: 12px; background: #fff8ed; }
.listing-new-category label { display: block; margin-bottom: 6px; color: #694c37; }
.listing-new-category > div { display: flex; gap: 8px; flex-wrap: wrap; }
.listing-new-category input { flex: 1; min-width: 140px; padding: 10px 12px; border: 1px solid #dec19e; border-radius: 9px; background: #fffdf9; color: #3d281d; }
.listing-new-category button { padding: 10px 14px; border: 1px solid #8d5a3b; border-radius: 9px; background: #8d5a3b; color: #fffaf3; font-size: 12px; }
.listing-new-category p { margin: 8px 0 0; color: #ac3b30; font-size: 12px; }
</style>
