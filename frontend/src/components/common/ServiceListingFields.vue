<template>
  <fieldset class="listing-fields" :disabled="disabled">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ContractAppearanceSelect :id="editing ? 'edit-listing-post-type' : 'listing-post-type'" v-model="form.postType" class="listing-post-type" label="Post Type" :disabled="editing || disabled" :options="isFreePlan ? [{ value: 'Service', label: 'Service · Single visit' }] : [{ value: 'Service', label: 'Service · Single visit' }, { value: 'Consultation', label: 'Consultation' }, { value: 'Package', label: 'Service Package · Treatment course' }]" />

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
          <p v-if="form.postType === 'Service'" class="mt-2 text-xs text-slate-500">A Service is one appointment. Use a Service Package for a treatment course with two or more separately scheduled visits.</p>
          <p v-else-if="form.postType === 'Package'" class="mt-2 text-xs text-slate-500">Build the course in visit order. Customers book the first visit; the clinic arranges each later visit after the previous one is completed or resolved.</p>
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
          <div class="md:col-span-2">
            <label class="block text-slate-400 mb-1">Description</label>
            <textarea v-model="form.description" rows="3" placeholder="Describe this service, consultation, or package" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>
        </div>

        <section v-if="['Service', 'Consultation', 'Package'].includes(form.postType)" class="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div><h3 class="font-semibold text-white">Appointment tax</h3><p class="mt-1 text-xs leading-5 text-slate-400">Apply the fixed 12% VAT only if this specific listing is taxable for your clinic.</p></div>
            <span class="rounded-full border px-3 py-1 text-xs font-semibold" :class="form.vatApplicable ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-600 bg-slate-800 text-slate-400'">{{ form.vatApplicable && vatRegistered ? '12% VAT enabled' : 'No VAT on this listing' }}</span>
          </div>
          <label class="mt-4 flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-4" :class="!vatRegistered ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'">
            <input v-model="form.vatApplicable" type="checkbox" class="mt-1 h-4 w-4 accent-emerald-600" :disabled="disabled || !vatRegistered" />
            <span><strong class="block text-sm text-slate-100">This listing is subject to VAT</strong><span class="mt-1 block text-xs leading-5 text-slate-400">The checkout will show the subtotal, VAT amount, and total.</span></span>
          </label>
          <p v-if="!vatRegistered" class="mt-2 text-xs text-amber-200">Enable “Clinic is VAT-registered” in Policy &amp; Contract Management before marking a listing VAT-applicable.</p>
          <label v-if="form.vatApplicable" class="mt-4 block max-w-sm text-sm font-medium text-slate-200">How is the listed price shown?
            <select v-model="form.vatPriceMode" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" :disabled="disabled || !vatRegistered">
              <option value="inclusive">Price already includes 12% VAT</option>
              <option value="exclusive">Add 12% VAT to the listed price</option>
            </select>
          </label>
        </section>

        <div v-if="form.postType === 'Package'" class="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
          <label class="block text-slate-400 mb-1">Package Name</label>
          <input v-model="form[nameKey('packageName')]" type="text" placeholder="Consultation + service package" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600" />
          <div class="mt-4 flex items-start justify-between gap-3"><div><h4 class="font-medium text-white">Course steps</h4><p class="mt-1 text-xs text-slate-400">Add the visits in the order they should happen. Each minimum gap applies before the next course visit; clinic availability determines the confirmed date.</p></div><button type="button" class="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200 disabled:opacity-50" :disabled="disabled || courseSteps.length >= 50" @click="addCourseStep">Add step</button></div>
          <div v-if="courseSteps.length" class="mt-3 space-y-3">
            <article v-for="(step, index) in courseSteps" :key="index" class="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-3 md:grid-cols-[minmax(0,1fr)_120px_150px_auto] md:items-end">
              <label class="block text-slate-300">{{ index + 1 }}. Visit type
                <select v-model="step.serviceId" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" :aria-label="`Course step ${index + 1} service`">
                  <option value="">Choose a published service or consultation</option>
                  <option v-if="step.serviceId && !courseServiceOptions.some(item => item.id === step.serviceId)" :value="step.serviceId">Previously included listing · unavailable</option>
                  <option v-for="item in courseServiceOptions" :key="item.id" :value="item.id">{{ item.title || item.serviceName || item.consultationName }} · {{ item.postType }}</option>
                </select>
              </label>
              <label class="block text-slate-300">Visits
                <input :value="step.visitCount" @input="setStepNumber(step, 'visitCount', $event, 1, 50)" @keydown="blockNegativeKey" type="number" min="1" max="50" step="1" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" :aria-label="`Course step ${index + 1} visit count`" />
              </label>
              <label class="block text-slate-300">Minimum gap (days)
                <input :value="step.minimumGapDays" @input="setStepNumber(step, 'minimumGapDays', $event, 1, 365)" @keydown="blockNegativeKey" type="number" min="1" max="365" step="1" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" :aria-label="`Course step ${index + 1} minimum gap in days`" />
              </label>
              <button v-if="courseSteps.length > 1" type="button" class="rounded-lg border border-rose-800 px-3 py-2 text-sm text-rose-200" :aria-label="`Remove course step ${index + 1}`" @click="removeCourseStep(index)">Remove</button>
            </article>
          </div>
          <p v-else class="mt-3 rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-400">Add the first service or consultation to begin the course.</p>
          <p v-if="courseVisitCount > 50" class="mt-2 text-sm text-rose-300" role="alert">A treatment course can include up to 50 visits.</p>
          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="block text-slate-400">Package discount (%)
              <input v-model.number="form.discountPercent" type="number" min="0" max="90" step="0.5" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" />
            </label>
            <div class="rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
              <p>Included total: ₱{{ packageSubtotal.toFixed(2) }}</p>
              <p>Customer pays: ₱{{ packagePrice.toFixed(2) }}</p>
              <p>Customer saves: ₱{{ packageSavings.toFixed(2) }}</p>
            </div>
          </div>
          <p class="mt-2 text-xs text-slate-400">The clinic sets the discount. Course price uses each selected listing's price multiplied by its visit count.</p>
        </div>

        <p v-if="editing && form.postType === 'Service' && form.legacyMultiSessionService" class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">This older Service was configured with multiple sessions. Saving it will make future bookings single-visit; appointments already booked keep their existing course. Create a Service Package to offer a new multi-visit course.</p>

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
          <p class="text-xs leading-5 text-slate-400">Product FDA registration details are maintained by clinic staff on the linked inventory item and copied to this listing.</p>
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
            <div v-if="form.postType === 'Consultation' && form.consultationModes.includes('online')" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            <p class="text-xs text-slate-400 mt-1">Customers must book the follow-up within this many days after the service is completed.</p>
          </div>
          <div :class="{ 'md:col-span-2': form.postType === 'Consultation' }">
            <label class="block text-slate-400 mb-1">{{ form.postType === 'Consultation' ? 'Consultation Duration (minutes)' : 'Service Duration (minutes)' }}</label>
            <input
              v-model.number="form.durationMinutes"
              type="number"
              :min="form.postType === 'Consultation' && form.consultationModes.includes('online') ? 5 : 1"
              :max="form.postType === 'Consultation' && form.consultationModes.includes('online') ? 240 : undefined"
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
            <fieldset class="rounded-xl border border-slate-600 bg-slate-900/40 p-4">
              <legend class="px-1 text-sm font-medium text-slate-200">Available consultation modes</legend>
              <div class="mt-2 flex flex-wrap gap-4">
                <label class="inline-flex items-center gap-2 text-sm text-slate-300"><input v-model="form.consultationModes" type="checkbox" value="on-site" class="h-4 w-4 accent-amber-500" /> On-site</label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-300"><input v-model="form.consultationModes" type="checkbox" value="online" class="h-4 w-4 accent-amber-500" /> Online</label>
              </div>
              <p class="mt-2 text-xs text-slate-400">Create one consultation listing. Customers choose one of the modes enabled here when booking.</p>
            </fieldset>
          </div>
          <div v-if="form.postType === 'Service' && form.requiresConsultationFirst" class="md:col-span-2">
            <ContractAppearanceSelect :id="editing ? 'edit-linked-consultation' : 'linked-consultation'" v-model="form.linkedConsultationId" label="Linked consultation (required)" :disabled="disabled || !consultationOptions.length" :options="consultationOptions" />
            <p class="mt-2 text-xs text-slate-400">{{ consultationOptions.length ? 'Clients must complete this linked consultation before booking this service.' : 'No published consultations are available. Create and publish an online or on-site consultation first.' }}</p>
          </div>
          <div v-if="form.postType === 'Service' && form.requiresConsultationFirst" class="md:col-span-2 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
            <label class="flex items-start gap-3">
              <input v-model="form.sameDayConsultationAllowed" type="checkbox" class="mt-1 h-4 w-4 accent-emerald-500" />
              <span>
                <span class="block font-medium text-white">Allow a same-day treatment request after an on-site consultation</span>
                <span class="block text-xs leading-5 text-slate-400">The treatment time stays provisional until the assigned practitioner clears it. The customer pays for the consultation first; treatment consent and payment follow only if approved.</span>
              </span>
            </label>
            <label v-if="form.sameDayConsultationAllowed" class="mt-3 block text-slate-400">Time between consultation and treatment (minutes)
              <input v-model.number="form.sameDayConsultationBufferMinutes" type="number" min="0" max="60" step="1" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" />
            </label>
            <p v-if="form.sameDayConsultationAllowed" class="mt-2 text-xs text-slate-400">This option is available only when the linked consultation supports on-site appointments. It is a request, not a treatment guarantee.</p>
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
          <p v-if="form.postType === 'Consultation'" class="mt-2 text-slate-300">Available modes: {{ consultationModeLabel }}</p>
          <p v-if="form.postType === 'Service'" class="mt-1 text-slate-300">Single visit: 1 appointment</p>
          <p v-if="form.postType === 'Package'" class="mt-2 text-slate-300">Treatment course: {{ courseVisitCount }} visits across {{ courseSteps.length }} step{{ courseSteps.length === 1 ? '' : 's' }}</p>
          <ol v-if="form.postType === 'Package' && courseSteps.length" class="mt-2 list-inside list-decimal space-y-1 text-xs text-slate-300"><li v-for="(step, index) in courseSteps" :key="index">{{ courseStepName(step) }} · {{ step.visitCount }} visit{{ Number(step.visitCount) === 1 ? '' : 's' }} · minimum {{ step.minimumGapDays }}-day gap before the next visit</li></ol>
          <p v-if="form.postType === 'Product'" class="mt-2 text-slate-300">Source: selected inventory product</p>
          <p class="mt-1 text-slate-300">{{ form.postType === 'Package' ? 'Calculated package' : `Proposed ${String(form.postType || 'Service').toLowerCase()}` }} price: ₱{{ Number(form.postType === 'Package' ? packagePrice : (form.price || form.consultationFee || 0)).toFixed(2) }}</p>
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
const props = defineProps({ model: { type: Object, required: true }, editing: Boolean, disabled: Boolean, isFreePlan: Boolean, vatRegistered: Boolean, inventoryProducts: { type: Array, default: () => [] }, posts: { type: Array, default: () => [] }, imageFileName: { type: String, default: '' } })
defineEmits(['image-change'])
const form = computed(() => props.model)
const vatRegistered = computed(() => props.vatRegistered === true)
const courseSteps = computed(() => Array.isArray(form.value.treatmentCourseSteps) ? form.value.treatmentCourseSteps : [])
const courseServiceOptions = computed(() => props.posts.filter(post => ['Service', 'Consultation'].includes(post.postType) && post.isPublished === true && post.financeStatus === 'approved' && post.archived !== true))
const packageComponents = computed(() => [...new Set(courseSteps.value.map(step => String(step.serviceId || '')).filter(Boolean))].map(id => props.posts.find(post => post.id === id)).filter(Boolean))
const courseVisitCount = computed(() => courseSteps.value.reduce((sum, step) => sum + Math.max(0, Number(step.visitCount) || 0), 0))
const courseStepName = step => { const post = props.posts.find(item => item.id === step.serviceId); return post?.title || post?.serviceName || post?.consultationName || 'Select a visit' }
const packageSubtotal = computed(() => courseSteps.value.length
  ? courseSteps.value.reduce((sum, step) => { const post = props.posts.find(item => item.id === step.serviceId); return sum + Number(post?.price || post?.consultationFee || 0) * Math.max(0, Number(step.visitCount) || 0) }, 0)
  : 0)
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
const addCourseStep = () => { if (!Array.isArray(form.value.treatmentCourseSteps)) form.value.treatmentCourseSteps = []; if (form.value.treatmentCourseSteps.length < 50) form.value.treatmentCourseSteps.push({ serviceId: '', visitCount: 1, minimumGapDays: 7 }) }
const removeCourseStep = index => { form.value.treatmentCourseSteps.splice(index, 1) }
const setStepNumber = (step, key, event, min, max) => {
  const raw = event.target.value
  if (raw === '') { step[key] = ''; return }
  const value = Number(raw)
  if (!Number.isFinite(value)) { step[key] = ''; event.target.value = ''; return }
  const bounded = Math.max(min, Math.min(max, Math.trunc(value)))
  step[key] = bounded
  if (bounded !== value) event.target.value = String(bounded)
}
const setPositiveNumber = (key, event, min, max = Infinity, wholeNumber = false) => {
  const raw = event.target.value
  if (raw === '') { form.value[key] = ''; return }
  const value = Number(raw)
  if (!Number.isFinite(value)) { form.value[key] = ''; event.target.value = ''; return }
  const bounded = Math.max(min, Math.min(max, wholeNumber ? Math.trunc(value) : value))
  form.value[key] = bounded
  if (bounded !== value) event.target.value = String(bounded)
}
const consultationOptions = computed(() => props.posts.filter(post => post.postType === 'Consultation' && post.isPublished === true && post.financeStatus === 'approved' && !post.archived).map(post => { const modes = Array.isArray(post.consultationModes) ? post.consultationModes : [post.consultationMode || 'on-site']; return { value: post.id, label: `${post.title || post.consultationName || 'Consultation'} (${modes.map(mode => mode === 'online' ? 'Online' : 'On-site').join(' / ')})` } }))
const consultationModeLabel = computed(() => (props.model.consultationModes || []).map(mode => mode === 'online' ? 'Online' : 'On-site').join(' and ') || 'Choose at least one')
watch(courseSteps, steps => {
  if (form.value.postType !== 'Package') return
  const ids = [...new Set(steps.map(step => String(step.serviceId || '').trim()).filter(Boolean))]
  if (JSON.stringify(form.value.packageServiceIds || []) !== JSON.stringify(ids)) form.value.packageServiceIds = ids
}, { deep: true })
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
