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
        </div>

        <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="block text-slate-400 mb-1">Price (PHP)</label>
            <input :value="form.price" @input="setPositiveNumber('price', $event, 0)" @keydown="blockNegativeKey" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div v-if="['Service', 'Package'].includes(form.postType)">
            <label class="block text-slate-400 mb-1">Number of Treatment Sessions</label>
            <input :value="form.sessionCount" @input="setPositiveNumber('sessionCount', $event, 1, 50, true)" @keydown="blockNegativeKey" type="number" min="1" max="50" step="1" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="text-xs text-slate-400 mt-1">Use 1 for a single visit. The clinic schedules subsequent treatment sessions.</p>
          </div>
          <div v-if="['Service', 'Package'].includes(form.postType) && Number(form.sessionCount) > 1" class="md:col-span-2">
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
          <p class="mt-2 text-xs text-slate-400">A package must include at least two services, or one consultation plus at least one service. Customers book and pay for the package as one appointment.</p>
        </div>

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
              min="1"
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
            <p class="mt-2 text-xs text-slate-400">{{ consultationOptions.length ? 'Clients must complete this consultation or receive clinic-approved clearance before booking this service.' : 'No published consultations are available. Create and publish a consultation first.' }}</p>
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
          <p v-if="['Service', 'Package'].includes(form.postType)" class="mt-1 text-slate-300">Treatment sessions: {{ Math.max(1, Number(form.sessionCount || 1)) }}</p>
          <p v-if="form.postType === 'Product'" class="mt-2 text-slate-300">Source: selected inventory product</p>
          <p class="mt-1 text-slate-300">Proposed {{ String(form.postType || 'Service').toLowerCase() }} price: PHP {{ Number(form.price || form.consultationFee || 0).toFixed(2) }}</p>
          <p class="mt-1 text-xs text-amber-200">{{ isFreePlan ? 'Free Plan service listings publish directly; Finance approval is not required.' : 'Financial terms, including installment settings, require Finance approval before publication.' }}</p>
        </div>

    <ServiceStaffingFields v-if="['Service', 'Consultation'].includes(form.postType)" :model="form" />
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import ServiceStaffingFields from './ServiceStaffingFields.vue'
const props = defineProps({ model: { type: Object, required: true }, editing: Boolean, disabled: Boolean, isFreePlan: Boolean, inventoryProducts: { type: Array, default: () => [] }, posts: { type: Array, default: () => [] }, imageFileName: { type: String, default: '' } })
defineEmits(['image-change'])
const form = computed(() => props.model)
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
const consultationOptions = computed(() => props.posts.filter(post => post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived).map(post => ({ value: post.id, label: post.title || post.consultationName || 'Consultation' })))
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
</style>
