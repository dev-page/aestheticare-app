<template>
  <div class="flex module-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-4 md:p-8 text-white">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold mb-1">Product & Service Listing</h1>
        <p class="text-slate-400">Save drafts, submit financial terms to Finance, then publish approved listings. Existing listings also need approval.</p>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
        <h2 class="text-lg font-semibold mb-4">Create Draft</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-slate-400 mb-1">Post Type</label>
            <select
              v-model="form.postType"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Product">Product</option>
              <option value="Service">Service</option>
              <option value="Consultation">Consultation</option>
              <option value="Package">Service Package</option>
            </select>
          </div>

          <div v-if="form.postType === 'Product'">
            <label class="block text-slate-400 mb-1">Product</label>
            <select
              v-model="form.productName"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                {{ inventoryProducts.length === 0 ? 'No inventory items available yet' : 'Select product from inventory' }}
              </option>
              <option v-for="item in inventoryProducts" :key="item.id" :value="item.name">{{ item.name }}</option>
            </select>
          </div>

          <div v-else-if="form.postType === 'Service'">
            <label class="block text-slate-400 mb-1">Service Name</label>
            <input
              type="text"
              v-model="form.serviceName"
              placeholder="Enter service name"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div v-else-if="form.postType === 'Consultation'">
            <label class="block text-slate-400 mb-1">Consultation Name</label>
            <input
              type="text"
              v-model="form.consultationName"
              placeholder="Enter consultation name"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="mb-4 border-b border-slate-700 pb-3">
          <h3 class="font-semibold text-white">{{ form.postType === 'Product' ? 'Product Information' : form.postType === 'Consultation' ? 'Consultation Information' : form.postType === 'Package' ? 'Package Information' : 'Service Information' }}</h3>
          <p class="mt-1 text-xs text-slate-400">Complete the details required for this {{ form.postType.toLowerCase() }} before adding its customer-facing listing information.</p>
        </div>

        <div v-if="form.postType === 'Package'" class="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
          <label class="block text-slate-400 mb-1">Package Name</label>
          <input v-model="form.packageName" type="text" placeholder="Consultation + service package" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600" />
          <label class="block text-slate-400 mt-4 mb-1">Included services and consultations</label>
          <select v-model="form.packageServiceIds" multiple class="min-h-28 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white">
            <option v-for="item in posts.filter((post) => ['Service', 'Consultation'].includes(post.postType))" :key="item.id" :value="item.id">{{ item.title || item.serviceName || item.consultationName }} ({{ item.durationMinutes || 0 }} mins)</option>
          </select>
          <p class="mt-2 text-xs text-slate-400">A package must include one consultation and at least one service. Customers book and pay for the package as one appointment.</p>
          <label class="mt-4 block text-slate-400">Number of treatment sessions<input v-model.number="form.sessionCount" type="number" min="1" max="50" step="1" class="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white" /><span class="mt-1 block text-xs text-slate-400">Use 1 for a one-time package. For multiple sessions, the clinic schedules each visit separately after approval.</span></label>
        </div>

        <div v-if="form.postType === 'Product'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="md:col-span-2">
            <p class="text-sm font-medium text-white">Inventory Details</p>
            <p class="mt-1 text-xs text-slate-400">These optional details help customers identify the selected inventory product.</p>
          </div>
          <div v-if="form.postType === 'Service'" class="md:col-span-2">
            <label class="block text-slate-400 mb-1">Number of Treatment Sessions</label>
            <input v-model.number="form.sessionCount" type="number" min="1" max="50" step="1" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p class="text-xs text-slate-400 mt-1">Use 1 for a one-time service. A multi-session plan tracks the total sessions; the clinic schedules each next visit to match availability.</p>
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
          <label class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
            <input
              v-if="form.postType === 'Service'"
              v-model="form.requiresConsultationFirst"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-blue-500"
            />
            <input
              v-else
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
                  : 'Enable this when the service must be assessed before a booking can proceed.' }}
              </span>
            </span>
          </label>
          <div v-if="form.postType === 'Consultation' || form.requiresConsultationFirst" class="md:col-span-2">
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
          <label v-if="form.postType === 'Service'" class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
            <input v-model="form.followUpAllowed" type="checkbox" class="mt-1 h-4 w-4 accent-blue-500" />
            <span>
              <span class="block font-medium text-white">Allow follow-ups</span>
              <span class="block text-xs text-slate-400">Mark this when customers may book a follow-up after the initial service.</span>
            </span>
          </label>
          <div v-if="form.postType === 'Service'" class="md:col-span-2">
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
          <div class="md:col-span-2">
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
            <label class="block text-slate-400 mb-1">Required Consultation Mode</label>
            <select v-model="form.consultationMode" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600">
              <option value="on-site">On-site consultation</option>
              <option value="online">Online consultation</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">The automatically created package will use this consultation mode.</p>
          </div>
          <div v-if="form.postType === 'Service'" class="md:col-span-2">
            <div class="mb-3 border-t border-slate-700 pt-4">
              <h3 class="font-semibold text-white">Resources & Payment</h3>
              <p class="mt-1 text-xs text-slate-400">Materials are reserved for each booking. Payment terms require Finance approval before publishing.</p>
            </div>
            <label class="mb-4 flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
              <input v-model="form.allowInstallments" type="checkbox" class="mt-1 h-4 w-4 accent-blue-500" />
              <span>
                <span class="block font-medium text-white">Allow installment payment</span>
                <span class="block text-xs text-slate-400">Customer pays an initial amount after approval; the balance is due after completion.</span>
              </span>
            </label>
            <label v-if="form.allowInstallments" class="mb-4 block text-slate-400">Initial payment (%)<input v-model.number="form.depositPercent" type="number" min="1" max="99" step="1" required class="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white" /><span class="mt-1 block text-xs text-slate-400">Use one initial percentage and one final balance—no multi-installment schedules.</span></label>
            <label class="block text-slate-400 mb-1">Required Supplies</label>
            <select v-model="form.requiredSupplyIds" multiple class="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option v-for="item in inventoryProducts" :key="item.id" :value="item.id">{{ item.name }} ({{ item.unit || 'unit' }})</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">One unit of each selected material is reserved per booking and deducted when the service starts.</p>
            <label class="block text-slate-400 mt-3 mb-1">Required equipment (reusable)</label>
            <select v-model="form.requiredEquipmentIds" multiple class="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white">
              <option v-for="item in inventoryProducts" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
            <p class="text-xs text-slate-400">One unit of each is reserved for the appointment time, then becomes available again.</p>
            <p class="mt-1 text-xs text-slate-400">Select every material or supply needed to perform this service.</p>
          </div>
        </div>

        <div v-if="form.postType === 'Package'" class="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
          <h3 class="font-semibold text-white">Payment</h3>
          <p class="mt-1 text-xs text-slate-400">Package payment terms also require Finance approval before publication.</p>
          <label class="mt-4 flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-800 p-4">
            <input v-model="form.allowInstallments" type="checkbox" class="mt-1 h-4 w-4 accent-blue-500" />
            <span><span class="block font-medium text-white">Allow installment payment</span><span class="block text-xs text-slate-400">Use one initial payment and one final balance for the complete package.</span></span>
          </label>
          <label v-if="form.allowInstallments" class="mt-4 block text-slate-400">Initial payment (%)<input v-model.number="form.depositPercent" type="number" min="1" max="99" step="1" required class="mt-1 w-full rounded-lg bg-slate-700 px-3 py-2 text-white" /></label>
        </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div class="md:col-span-2 border-t border-slate-700 pt-4">
            <h3 class="font-semibold text-white">Customer-Facing Listing</h3>
            <p class="mt-1 text-xs text-slate-400">This is the information customers see when choosing the {{ form.postType.toLowerCase() }}.</p>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Title</label>
            <input
              type="text"
              v-model="form.title"
              placeholder="Post title"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Price (PHP)</label>
            <input
              type="number"
              v-model.number="form.price"
              min="0"
              step="0.01"
              placeholder="0.00"
              :readonly="form.postType === 'Product'"
              class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p v-if="form.postType === 'Product'" class="text-xs text-slate-400 mt-1">
              Product price comes from inventory unit price.
            </p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-slate-400 mb-1">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Write post description"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="mb-4">
          <label class="block text-slate-400 mb-1">{{ form.postType === 'Product' ? 'Product Terms and Conditions' : 'Service Contract Terms and Conditions' }}</label>
          <textarea
            v-model="form.termsAndConditions"
            rows="3"
            :placeholder="form.postType === 'Product' ? 'Add product-specific terms, usage instructions, or return conditions' : 'Add the terms the customer must accept before booking this service'"
            class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>

        <div class="mb-4">
          <label class="block text-slate-400 mb-1">Image (1 file only)</label>
          <input
            type="file"
            accept="image/*"
            @change="handleImageUpload"
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
          <p class="mt-1 text-slate-300">Proposed {{ form.postType.toLowerCase() }} price: PHP {{ Number(form.price || form.consultationFee || 0).toFixed(2) }}</p>
          <p class="mt-1 text-xs text-amber-200">Financial terms, including installment settings, require Finance approval before publication.</p>
        </div>

        <div class="flex gap-2">
          <button
            @click="createPost"
            :disabled="loading"
            class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Posting...' : 'Save Draft' }}
          </button>
          <button
            @click="resetForm"
            :disabled="loading"
            class="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
        <h2 class="text-lg font-semibold mb-4">My Posts</h2>

        <div v-if="posts.length === 0" class="text-slate-400">No posts yet.</div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <article v-for="post in posts" :key="post.id" class="bg-slate-900/70 border border-slate-700 rounded-lg overflow-hidden">
            <img v-if="post.imageUrl" :src="post.imageUrl" alt="Post image" class="w-full h-40 object-cover" />
            <div class="p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">{{ post.postType }}</span>
                <span class="text-xs text-slate-400">{{ formatDate(post.createdAt) }}</span>
              </div>
              <h3 class="font-semibold mb-1">{{ post.title }}</h3>
              <p class="mb-2 text-sm font-semibold">{{ post.isPublished && post.financeStatus === 'approved' ? 'Published' : post.financeStatus === 'approved' ? 'Finance approved - awaiting publication' : post.financeStatus === 'pending' ? 'Awaiting Finance review' : post.financeStatus === 'rejected' ? 'Changes requested' : 'Draft' }}</p>
              <p v-if="post.financeReview?.note" class="mb-2 text-sm">Finance: {{ post.financeReview.note }}</p>
              <div class="mb-3 flex flex-wrap gap-2">
                <button v-if="canManageListingWorkflow && (!post.financeStatus || ['draft', 'rejected'].includes(post.financeStatus))" :disabled="!!actionLoadingId" @click="listingAction(post, 'submit')" class="rounded bg-blue-700 px-3 py-2 text-sm">Submit to Finance</button>
                <button v-if="canManageListingWorkflow && post.financeStatus === 'approved' && !post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'publish')" class="rounded bg-emerald-700 px-3 py-2 text-sm">Publish</button>
                <button v-if="canManageListingWorkflow && post.isPublished" :disabled="!!actionLoadingId" @click="listingAction(post, 'unpublish')" class="rounded bg-slate-700 px-3 py-2 text-sm">Unpublish</button>
              </div>
              <p class="text-sm text-slate-300 mb-1">{{ post.productName || post.serviceName || post.consultationName || post.packageName }}</p>
              <p v-if="post.postType === 'Package'" class="mb-2 text-xs text-amber-200">
                Includes {{ (post.packageServiceIds || []).length }} consultation/service component(s).
              </p>
              <p class="text-sm text-slate-400 mb-2">{{ post.description }}</p>
              <div v-if="post.postType === 'Service' || post.postType === 'Consultation'" class="mb-2 flex flex-wrap gap-2">
                <span
                  v-if="post.postType === 'Service' && post.requiresConsultationFirst"
                  class="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200"
                >
                  Consultation required
                </span>
                <span
                  v-if="post.postType === 'Consultation' || (post.postType === 'Service' && post.requiresConsultationFirst)"
                  class="rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-200"
                >
                  Fee PHP {{ Number(post.consultationFee || post.price || 0).toFixed(2) }}
                </span>
                <span
                  v-if="post.postType === 'Service' && post.followUpAllowed"
                  class="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200"
                >
                  Follow-up allowed
                </span>
                <span
                  v-if="post.durationMinutes"
                  class="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200"
                >
                  {{ post.durationMinutes }} mins
                </span>
              </div>
              <p v-if="post.postType === 'Service' && post.requiresConsultationFirst" class="mb-2 text-xs font-semibold text-amber-200">
                Customer must make sure they have already consulted before booking this service.
              </p>
              <p v-if="post.postType === 'Consultation'" class="mb-2 text-xs font-semibold text-orange-200">
                Standalone consultation post. Customers book this separately before any follow-up service.
              </p>
              <p class="text-sm font-semibold text-green-400">{{ formatCurrency(post.price) }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  @click="openEditPost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  @click="archivePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  Archive
                </button>
                <button
                  @click="deletePost(post)"
                  :disabled="actionLoadingId === post.id"
                  class="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div v-if="showEditModal" class="fixed inset-0 z-50 bg-black/60 p-4 flex items-start md:items-center justify-center overflow-y-auto">
        <div class="w-full max-w-2xl rounded-xl bg-slate-800 border border-slate-700 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
          <div class="px-6 pt-6 pb-4 border-b border-slate-700">
            <h3 class="text-lg font-semibold">Edit Post</h3>
            <p class="text-sm text-amber-300">Changing prices or installment terms unpublishes this listing and requires a new Finance review. Photo and description edits keep the current approval.</p>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-slate-400 mb-1">Post Type</label>
                <input
                  :value="editForm.postType"
                  disabled
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-300"
                />
              </div>
              <div>
            <label class="block text-slate-400 mb-1">
                  {{ editForm.postType === 'Product' ? 'Product' : (editForm.postType === 'Consultation' ? 'Consultation Name' : (editForm.postType === 'Package' ? 'Package Name' : 'Service Name')) }}
                </label>
                <input
                  v-model="editForm.name"
                  :disabled="editForm.postType === 'Product'"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
            </div>

          <div v-if="editForm.postType === 'Service' || editForm.postType === 'Consultation'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <label class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
              <input
                v-if="editForm.postType === 'Service'"
                v-model="editForm.requiresConsultationFirst"
                type="checkbox"
                class="mt-1 h-4 w-4 accent-blue-500"
              />
              <input
                v-else
                type="checkbox"
                checked
                disabled
                class="mt-1 h-4 w-4 accent-blue-500"
              />
              <span>
                <span class="block font-medium text-white">
                  {{ editForm.postType === 'Consultation' ? 'Standalone consultation post' : 'Requires consultation first' }}
                </span>
                <span class="block text-xs text-slate-400">
                  {{ editForm.postType === 'Consultation'
                    ? 'This consultation can be booked separately.'
                    : 'Keep this on when the service should not be booked directly.' }}
                </span>
              </span>
            </label>
            <div v-if="editForm.postType === 'Consultation' || editForm.requiresConsultationFirst" class="md:col-span-2">
              <label class="block text-slate-400 mb-1">Consultation Fee (PHP)</label>
              <input
                v-model.number="editForm.consultationFee"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div v-if="editForm.postType === 'Consultation'" class="md:col-span-2">
              <label class="block text-slate-400 mb-1">Consultation Mode</label>
              <select v-model="editForm.consultationMode" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="on-site">On-site consultation</option>
                <option value="online">Online consultation</option>
              </select>
              <p class="mt-1 text-xs text-slate-400">Packages inherit the mode of their included consultation.</p>
            </div>

            <label v-if="editForm.postType === 'Service'" class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-900/40 p-4">
              <input v-model="editForm.followUpAllowed" type="checkbox" class="mt-1 h-4 w-4 accent-blue-500" />
              <span>
                <span class="block font-medium text-white">Allow follow-ups</span>
                <span class="block text-xs text-slate-400">Let customers book a follow-up tied to this service.</span>
                </span>
              </label>
              <div v-if="editForm.postType === 'Service'" class="md:col-span-2">
                <label class="block text-slate-400 mb-1">Follow-up Window (days)</label>
                <input
                  v-model.number="editForm.followUpWindowDays"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="!editForm.followUpAllowed"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>
              <div class="md:col-span-2">
                <label class="block text-slate-400 mb-1">{{ editForm.postType === 'Consultation' ? 'Consultation Duration (minutes)' : 'Service Duration (minutes)' }}</label>
                <input
                  v-model.number="editForm.durationMinutes"
                  type="number"
                  min="1"
                  step="1"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div v-if="editForm.postType === 'Service'" class="md:col-span-2">
                <label class="block text-slate-400 mb-1">Required Supplies</label>
                <div class="mb-4 space-y-2">
              <label class="flex items-center gap-2"><input type="checkbox" v-model="editForm.allowInstallments" /> Allow installment payment</label>
              <label v-if="editForm.allowInstallments" class="block">Initial payment (%)<input v-model.number="editForm.depositPercent" type="number" min="1" max="99" step="1" required class="w-full rounded-lg bg-slate-700 px-3 py-2" /></label>
              <p class="text-xs text-slate-400">The remaining balance is due after the worker and customer confirm completion.</p>
            </div><select v-model="editForm.requiredSupplyIds" multiple class="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option v-for="item in inventoryProducts" :key="item.id" :value="item.id">{{ item.name }} ({{ item.unit || 'unit' }})</option>
                </select>
            <p class="mt-1 text-xs text-slate-400">One unit of each selected material is reserved per booking and deducted when the service starts.</p>
            <label class="block text-slate-400 mt-3 mb-1">Required equipment (reusable)</label>
            <select v-model="editForm.requiredEquipmentIds" multiple class="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white">
              <option v-for="item in inventoryProducts" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
            <p class="text-xs text-slate-400">One unit of each is reserved for the appointment time, then becomes available again.</p>
              </div>
            </div>

            <div v-if="editForm.postType === 'Product'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-slate-400 mb-1">Quantity / Volume</label>
                <input v-model="editForm.productVolume" type="text" placeholder="e.g. 30 mL or 1 L" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Unit</label>
                <input v-model="editForm.productUnit" type="text" placeholder="e.g. bottle, box, piece" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div v-if="editForm.postType === 'Product'" class="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
              <p class="mb-3 font-medium text-amber-200">FDA product documentation</p>
              <p class="text-xs leading-5 text-slate-400">FDA details come from the supplier inventory record and cannot be replaced by the clinic.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-slate-400 mb-1">Title</label>
                <input
                  v-model="editForm.title"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Price (PHP)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  v-model.number="editForm.price"
                  :readonly="editForm.postType === 'Product'"
                  class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div class="mb-4">
            <label class="block text-slate-400 mb-1">Description</label>
              <textarea
                v-model="editForm.description"
                rows="3"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>

            <label class="block text-slate-400 mb-1 mt-4">{{ editForm.postType === 'Product' ? 'Product Terms and Conditions' : 'Service Contract Terms and Conditions' }}</label>
            <textarea v-model="editForm.termsAndConditions" rows="3" :placeholder="editForm.postType === 'Product' ? 'Add product-specific terms, usage instructions, or return conditions' : 'Add the terms the customer must accept before booking this service'" class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>

            <div class="mb-4">
              <label class="block text-slate-400 mb-1">Replace Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                @change="handleEditImageUpload"
                class="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-blue-600 file:text-white"
              />
              <p v-if="editImageFileName" class="text-xs text-slate-400 mt-1">Selected: {{ editImageFileName }}</p>
            </div>
          </div>

          <div class="border-t border-slate-700 px-6 py-4">
            <div class="flex justify-end gap-2">
              <button
                @click="closeEditModal"
                :disabled="loading"
                class="px-4 py-2 rounded bg-slate-600 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                @click="saveEditedPost"
                :disabled="loading"
                class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { draftListing, financialTermsChanged, updateListingApproval } from '@/utils/listingApproval'
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp } from 'firebase/app'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { logActivity } from '@/utils/activityLogger'
import { usePermissions } from '@/composables/usePermissions'

export default {
  name: 'ProductServiceListing',
  components: { OwnerSidebar },
  setup() {
    const db = getFirestore(getApp())
    const storage = getStorage(getApp())
    const auth = getAuth(getApp())
    const { userRole, isClinicAdminOwner } = usePermissions()
    const canManageListingWorkflow = computed(() =>
      isClinicAdminOwner.value || String(userRole.value || '').trim().toLowerCase() === 'manager'
    )

    const loading = ref(false)
    const currentUserId = ref('')
    const currentBranchId = ref('')

    const inventoryProducts = ref([])

    const posts = ref([])
    const imageFile = ref(null)
    const imageFileName = ref('')
    const fdaApprovalFile = ref(null)
    const fdaApprovalFileName = ref('')
    const actionLoadingId = ref('')

    const showEditModal = ref(false)
    const editTargetId = ref('')
    const editForm = ref({
      postType: 'Product',
      name: '',
      title: '',
      description: '',
      price: 0,
      requiresConsultationFirst: false,
      consultationFee: 0,
      consultationMode: 'on-site',
      followUpAllowed: false,
      followUpWindowDays: 14,
      sessionCount: 1,
      durationMinutes: 60,
      productVolume: '',
      productUnit: '',
      fdaRegistrationNumber: '',
      termsAndConditions: '',
      requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
      packageServiceIds: []
    })
    const editImageFile = ref(null)
    const editImageFileName = ref('')
    const editFdaApprovalFile = ref(null)
    const editFdaApprovalFileName = ref('')

    const form = ref({
      postType: 'Product',
      productName: '',
      serviceName: '',
      consultationName: '',
      packageName: '',
      packageServiceIds: [],
      title: '',
      description: '',
      price: 0,
      requiresConsultationFirst: false,
      consultationFee: 0,
      consultationMode: 'on-site',
      followUpAllowed: false,
      followUpWindowDays: 14,
      sessionCount: 1,
      durationMinutes: 60,
      productVolume: '',
      productUnit: '',
      fdaRegistrationNumber: '',
      termsAndConditions: ''
      , requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50
    })

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP', currencyDisplay: 'code'
      }).format(Number(value) || 0)
    }

    const formatDate = (value) => {
      if (!value) return '-'
      if (value?.toDate) return value.toDate().toLocaleDateString('en-PH')
      if (value?.seconds) return new Date(value.seconds * 1000).toLocaleDateString('en-PH')
      return '-'
    }

    const normalizeConsultationMode = (value) =>
      String(value || '').trim().toLowerCase() === 'on-site' ? 'on-site' : 'online'

    const handleImageUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      imageFile.value = file
      imageFileName.value = file.name
    }

    const handleFdaDocumentUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      fdaApprovalFile.value = file
      fdaApprovalFileName.value = file.name
    }

    const savedBodyOverflow = ref('')
    const savedHtmlOverflow = ref('')
    let bodyScrollLockCount = 0

    const lockBodyScroll = (shouldLock) => {
      if (typeof document === 'undefined') return
      if (shouldLock) {
        if (bodyScrollLockCount === 0) {
          savedBodyOverflow.value = document.body.style.overflow
          savedHtmlOverflow.value = document.documentElement.style.overflow
        }
        bodyScrollLockCount += 1
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
        return
      }

      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow.value || ''
        document.documentElement.style.overflow = savedHtmlOverflow.value || ''
      }
    }

    const resetForm = () => {
      form.value = {
        postType: 'Product',
        productName: '',
      serviceName: '',
      consultationName: '',
      packageName: '',
      packageServiceIds: [],
        title: '',
        description: '',
        price: 0,
        requiresConsultationFirst: false,
        consultationFee: 0,
        consultationMode: 'on-site',
        followUpAllowed: false,
        followUpWindowDays: 14,
        sessionCount: 1,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: []
      }
      imageFile.value = null
      imageFileName.value = ''
      fdaApprovalFile.value = null
      fdaApprovalFileName.value = ''
    }

    const resetEditState = () => {
      editTargetId.value = ''
      editForm.value = {
        postType: 'Product',
        name: '',
        title: '',
        description: '',
        price: 0,
        requiresConsultationFirst: false,
        consultationFee: 0,
        consultationMode: 'on-site',
        followUpAllowed: false,
        followUpWindowDays: 14,
        durationMinutes: 60,
        productVolume: '',
        productUnit: '',
        fdaRegistrationNumber: '',
        termsAndConditions: '',
        requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
        packageServiceIds: []
      }
      editImageFile.value = null
      editImageFileName.value = ''
      editFdaApprovalFile.value = null
      editFdaApprovalFileName.value = ''
    }

    const listingAction = async (post, action) => {
      if (!canManageListingWorkflow.value) {
        toast.error('Only the clinic owner or a manager can submit or publish listings.')
        return
      }
      actionLoadingId.value = post.id
      try { await updateListingApproval(post.id, action); await loadPosts(); toast.success('Listing updated.') }
      catch (error) { toast.error(error.message) }
      finally { actionLoadingId.value = '' }
    }
    const loadPosts = async () => {
      if (!currentBranchId.value) {
        posts.value = []
        return
      }

      const postQuery = query(
        collection(db, 'productServicePosts'),
        where('branchId', '==', currentBranchId.value)
      )

      const snapshot = await getDocs(postQuery)
      posts.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((post) => post.archived !== true)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    const loadInventoryProducts = async () => {
      if (!currentBranchId.value) {
        inventoryProducts.value = []
        return
      }

      const itemQuery = query(
        collection(db, 'inventoryItems'),
        where('branchId', '==', currentBranchId.value)
      )
      const snapshot = await getDocs(itemQuery)
      inventoryProducts.value = snapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .filter((item) => Boolean(item.name))
    }

    const findSelectedProduct = () => {
      return inventoryProducts.value.find((item) => item.name === form.value.productName) || null
    }

    watch(
      () => [form.value.postType, form.value.productName],
      () => {
        if (form.value.postType !== 'Product') return
        const selected = findSelectedProduct()
      form.value.price = Number(selected?.unitPrice || 0)
      form.value.productVolume = String(selected?.volume || selected?.quantityLabel || '').trim()
      form.value.productUnit = String(selected?.unit || '').trim()
      }
    )

    watch(
      () => form.value.postType,
      (postType) => {
        if (postType === 'Service') {
          form.value.consultationName = ''
          return
        }
        if (postType === 'Consultation') {
          form.value.productName = ''
          form.value.serviceName = ''
          form.value.requiresConsultationFirst = false
          form.value.followUpAllowed = false
          form.value.followUpWindowDays = 14
          form.value.consultationFee = Math.max(0.01, Number(form.value.consultationFee || form.value.price || 0))
          form.value.durationMinutes = Math.max(1, Number(form.value.durationMinutes || 30))
          return
        }
        form.value.requiresConsultationFirst = false
        form.value.consultationFee = 0
        form.value.followUpAllowed = false
        form.value.followUpWindowDays = 14
        form.value.durationMinutes = 60
        form.value.consultationName = ''
      }
    )

    watch(
      () => [form.value.postType, form.value.requiresConsultationFirst],
      () => {
        if (form.value.postType !== 'Service' || form.value.requiresConsultationFirst) return
        form.value.consultationFee = 0
      }
    )

    watch(
      () => [form.value.postType, form.value.consultationFee],
      () => {
        if (form.value.postType !== 'Consultation') return
        form.value.price = Number(form.value.consultationFee || 0)
      }
    )

    watch(
      () => [editForm.value.postType, editForm.value.requiresConsultationFirst],
      () => {
        if (editForm.value.postType !== 'Service' || editForm.value.requiresConsultationFirst) return
        editForm.value.consultationFee = 0
      }
    )

    watch(
      () => [editForm.value.postType, editForm.value.consultationFee],
      () => {
        if (editForm.value.postType !== 'Consultation') return
        editForm.value.price = Number(editForm.value.consultationFee || 0)
      }
    )

    const createPost = async () => {
      const postType = form.value.postType
      const selectedName = postType === 'Product'
        ? form.value.productName
        : postType === 'Service'
          ? form.value.serviceName
          : postType === 'Consultation'
            ? form.value.consultationName
            : form.value.packageName
      const selectedProduct = postType === 'Product' ? findSelectedProduct() : null
      const packageComponents = postType === 'Package'
        ? (form.value.packageServiceIds || []).map((id) => posts.value.find((post) => post.id === id)).filter(Boolean)
        : []
      const packageFollowUpComponents = packageComponents.filter((post) => post.followUpAllowed === true)

      if (!selectedName?.trim() || !form.value.title?.trim() || !form.value.description?.trim()) {
        toast.error('Please complete all required fields.')
        return
      }
      if (postType === 'Product' && !selectedProduct) {
        toast.error('Please select a valid product from inventory.')
        return
      }
      if (Number(form.value.price) < 0) {
        toast.error('Price cannot be negative.')
        return
      }
      if (!imageFile.value) {
        toast.error('Please upload one image.')
        return
      }
      if (!currentBranchId.value || !currentUserId.value) {
        toast.error('User branch is not available.')
        return
      }
        if (postType !== 'Product' && Number(form.value.durationMinutes) <= 0) {
        toast.error('Please enter a valid duration.')
        return
      }
      if (postType === 'Package') {
        const selectedComponents = (form.value.packageServiceIds || [])
          .map((id) => posts.value.find((post) => post.id === id))
          .filter(Boolean)
        const consultationComponents = selectedComponents.filter((post) => post.postType === 'Consultation')
        const hasConsultation = consultationComponents.length === 1
        const hasService = selectedComponents.some((post) => post.postType === 'Service')
        if (!hasConsultation || !hasService) {
          toast.error('A package must include exactly one consultation and at least one service.')
          return
        }
        if (Number(form.value.price) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      if (postType === 'Service' && form.value.requiresConsultationFirst && Number(form.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }
      if (postType === 'Consultation' && Number(form.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }

      loading.value = true
      try {
        const fileExt = imageFile.value.name.split('.').pop() || 'jpg'
        const path = `product-service-posts/${currentBranchId.value}/${Date.now()}.${fileExt}`
        const imageRef = storageRef(storage, path)
        await uploadBytes(imageRef, imageFile.value)
        const imageUrl = await getDownloadURL(imageRef)

        const postPayload = {
          ...draftListing(),
          inventoryItemId: selectedProduct?.id || null,
          postType,
          productName: postType === 'Product' ? selectedName.trim() : '',
          serviceName: postType === 'Service' ? selectedName.trim() : '',
          consultationName: postType === 'Consultation' ? selectedName.trim() : '',
          packageName: postType === 'Package' ? String(form.value.packageName || selectedName || '').trim() : '',
          packageServiceIds: postType === 'Package' ? [...(form.value.packageServiceIds || [])] : [],
          consultationMode: postType === 'Consultation'
            ? normalizeConsultationMode(form.value.consultationMode)
            : postType === 'Package'
              ? normalizeConsultationMode(packageComponents.find((post) => post.postType === 'Consultation')?.consultationMode)
              : null,
          title: form.value.title.trim(),
          description: form.value.description.trim(),
          price: postType === 'Product'
            ? Number(selectedProduct?.unitPrice || 0)
            : Number(form.value.price || form.value.consultationFee || 0),
          requiresConsultationFirst: postType === 'Service' ? Boolean(form.value.requiresConsultationFirst) : false,
          consultationFee: postType === 'Service' && form.value.requiresConsultationFirst
            ? Number(form.value.consultationFee || 0)
            : (postType === 'Consultation' ? Number(form.value.consultationFee || 0) : null),
          followUpAllowed: postType === 'Service'
            ? Boolean(form.value.followUpAllowed)
            : postType === 'Package'
              ? packageFollowUpComponents.length > 0
              : false,
          followUpWindowDays: postType === 'Service' && form.value.followUpAllowed
            ? Math.max(1, Number(form.value.followUpWindowDays || 14))
            : postType === 'Package' && packageFollowUpComponents.length
              ? Math.min(...packageFollowUpComponents.map((post) => Number(post.followUpWindowDays || 14)))
              : null,
          sessionCount: ['Service', 'Package'].includes(postType) ? Math.min(50, Math.max(1, Number(form.value.sessionCount || 1))) : 1,
          durationMinutes: postType === 'Product' ? null : postType === 'Package'
            ? Math.max(1, (form.value.packageServiceIds || []).reduce((total, id) => total + Number(posts.value.find((post) => post.id === id)?.durationMinutes || 0), 0))
            : Math.max(1, Number(form.value.durationMinutes || 60)),
          productVolume: postType === 'Product' ? String(form.value.productVolume || '').trim() : '',
          productUnit: postType === 'Product' ? String(form.value.productUnit || '').trim() : '',
          fdaRegistrationNumber: postType === 'Product' ? String(selectedProduct?.fdaRegistrationNumber || '').trim() : '',
          fdaApprovalDocument: postType === 'Product' ? (selectedProduct?.fdaApprovalDocument || null) : null,
          termsAndConditions: String(form.value.termsAndConditions || '').trim(),
          allowInstallments: form.value.allowInstallments === true,
          depositPercent: form.value.allowInstallments ? Math.min(99, Math.max(1, Number(form.value.depositPercent || 50))) : 100,
          requiredEquipmentIds: [...(form.value.requiredEquipmentIds || [])],
          requiredSupplyIds: postType === 'Service' ? [...(form.value.requiredSupplyIds || [])] : postType === 'Package'
            ? [...new Set((form.value.packageServiceIds || []).flatMap((id) => posts.value.find((post) => post.id === id)?.requiredSupplyIds || []))]
            : [],
          imageUrl,
          branchId: currentBranchId.value,
          createdBy: currentUserId.value,
          createdAt: serverTimestamp(),
        }

        if (postType === 'Service' && form.value.requiresConsultationFirst) {
          const consultationRef = await addDoc(collection(db, 'productServicePosts'), {
            ...postPayload,
            postType: 'Consultation',
            productName: '',
            serviceName: '',
            consultationName: `${selectedName.trim()} Consultation`,
            packageName: '',
            packageServiceIds: [],
            title: `${form.value.title.trim()} Consultation`,
            description: `Consultation required before ${selectedName.trim()}.`,
            price: Number(form.value.consultationFee || 0),
            consultationMode: normalizeConsultationMode(form.value.consultationMode),
            requiresConsultationFirst: false,
            consultationFee: Number(form.value.consultationFee || 0),
            followUpAllowed: false,
            followUpWindowDays: null,
            sessionCount: 1,
            durationMinutes: 30,
            requiredSupplyIds: [], requiredEquipmentIds: [], allowInstallments: false, depositPercent: 50,
            isPackageComponent: true,
            packageComponentType: 'Consultation',
          })
          const serviceRef = await addDoc(collection(db, 'productServicePosts'), {
            ...postPayload,
            postType: 'Service',
            productName: '',
            serviceName: selectedName.trim(),
            consultationName: '',
            packageName: '',
            packageServiceIds: [],
            requiresConsultationFirst: false,
            consultationFee: null,
            isPackageComponent: true,
            packageComponentType: 'Service',
          })
          const packageRef = await addDoc(collection(db, 'productServicePosts'), {
            ...postPayload,
            postType: 'Package',
            productName: '',
            serviceName: '',
            consultationName: '',
            packageName: form.value.title.trim(),
            packageServiceIds: [consultationRef.id, serviceRef.id],
            title: form.value.title.trim(),
            price: Number(form.value.price || 0) + Number(form.value.consultationFee || 0),
            consultationMode: normalizeConsultationMode(form.value.consultationMode),
            requiresConsultationFirst: false,
            consultationFee: null,
            durationMinutes: Math.max(1, Number(form.value.durationMinutes || 60) + 30),
            requiredSupplyIds: [...(form.value.requiredSupplyIds || [])],
            isPackageComponent: false,
            autoGeneratedFromService: true,
          })
          await Promise.all([
            updateDoc(consultationRef, { parentPackageId: packageRef.id, updatedAt: serverTimestamp() }),
            updateDoc(serviceRef, { parentPackageId: packageRef.id, updatedAt: serverTimestamp() }),
          ])
        } else {
          await addDoc(collection(db, 'productServicePosts'), postPayload)
        }
        await logActivity(db, {
          module: 'Manager',
          action: 'Created product/service post',
          details: `Created ${postType.toLowerCase()} post: ${form.value.title.trim()}.`
        })

        toast.success('Draft saved. Submit it for Finance review when ready.')
        resetForm()
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to create post.')
      } finally {
        loading.value = false
      }
    }

    const openEditPost = (post) => {
      editTargetId.value = post.id
      editForm.value = {
        postType: post.postType || 'Product',
        name: post.productName || post.serviceName || post.consultationName || post.packageName || '',
        title: post.title || '',
        description: post.description || '',
        price: Number(post.price || 0),
        requiresConsultationFirst: Boolean(post.requiresConsultationFirst),
        consultationFee: Number(post.consultationFee || 0),
        consultationMode: normalizeConsultationMode(post.consultationMode),
        followUpAllowed: Boolean(post.followUpAllowed),
        followUpWindowDays: Number(post.followUpWindowDays || 14),
        durationMinutes: Number(post.durationMinutes || 60)
        , productVolume: String(post.productVolume || '').trim()
        , productUnit: String(post.productUnit || '').trim()
        , fdaRegistrationNumber: String(post.fdaRegistrationNumber || '').trim()
        , termsAndConditions: String(post.termsAndConditions || '').trim()
        , requiredEquipmentIds: post.requiredEquipmentIds || [], allowInstallments: post.allowInstallments === true, depositPercent: Number(post.depositPercent || 50), requiredSupplyIds: Array.isArray(post.requiredSupplyIds) ? [...post.requiredSupplyIds] : []
        , packageServiceIds: Array.isArray(post.packageServiceIds) ? [...post.packageServiceIds] : []
      }
      editImageFile.value = null
      editImageFileName.value = ''
      editFdaApprovalFile.value = null
      editFdaApprovalFileName.value = ''
      showEditModal.value = true
    }

    const closeEditModal = () => {
      showEditModal.value = false
      resetEditState()
    }

    const handleEditImageUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      editImageFile.value = file
      editImageFileName.value = file.name
    }

    const handleEditFdaDocumentUpload = (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      editFdaApprovalFile.value = file
      editFdaApprovalFileName.value = file.name
    }

    const saveEditedPost = async () => {
      if (!editTargetId.value) return
      if (!currentBranchId.value) {
        toast.error('User branch is not available.')
        return
      }
      if (!editForm.value.title?.trim() || !editForm.value.description?.trim() || !editForm.value.name?.trim()) {
        toast.error('Please complete all required fields.')
        return
      }
      if (Number(editForm.value.price) < 0) {
        toast.error('Price cannot be negative.')
        return
      }
      if (editForm.value.postType === 'Package') {
        const selectedComponents = (editForm.value.packageServiceIds || [])
          .map((id) => posts.value.find((post) => post.id === id))
          .filter(Boolean)
        const consultationComponents = selectedComponents.filter((post) => post.postType === 'Consultation')
        const hasConsultation = consultationComponents.length === 1
        const hasService = selectedComponents.some((post) => post.postType === 'Service')
        if (!hasConsultation || !hasService) {
          toast.error('A package must include exactly one consultation and at least one service.')
          return
        }
        if (Number(editForm.value.price) <= 0) {
          toast.error('Enter a package price greater than zero.')
          return
        }
      }
      const editPackageComponents = editForm.value.postType === 'Package'
        ? (editForm.value.packageServiceIds || []).map((id) => posts.value.find((post) => post.id === id)).filter(Boolean)
        : []
      const editPackageFollowUpComponents = editPackageComponents.filter((post) => post.followUpAllowed === true)
      if (editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst && Number(editForm.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }
      if (editForm.value.postType === 'Consultation' && Number(editForm.value.consultationFee) <= 0) {
        toast.error('Please enter a valid consultation fee.')
        return
      }
      if (editForm.value.postType !== 'Product' && Number(editForm.value.durationMinutes) <= 0) {
        toast.error('Please enter a valid duration.')
        return
      }

      loading.value = true
      try {
        let nextImageUrl = ''
        const currentPost = posts.value.find((post) => post.id === editTargetId.value)
        if (currentPost) nextImageUrl = currentPost.imageUrl || ''

        if (editImageFile.value) {
          const fileExt = editImageFile.value.name.split('.').pop() || 'jpg'
          const path = `product-service-posts/${currentBranchId.value}/${Date.now()}.${fileExt}`
          const imageRef = storageRef(storage, path)
          await uploadBytes(imageRef, editImageFile.value)
          nextImageUrl = await getDownloadURL(imageRef)
        }

        const selectedProduct = inventoryProducts.value.find((item) => item.name === editForm.value.name) || null
        const payload = {
          title: editForm.value.title.trim(),
          description: editForm.value.description.trim(),
          productName: editForm.value.postType === 'Product' ? editForm.value.name.trim() : '',
          serviceName: editForm.value.postType === 'Service' ? editForm.value.name.trim() : '',
          consultationName: editForm.value.postType === 'Consultation' ? editForm.value.name.trim() : '',
          packageName: editForm.value.postType === 'Package' ? editForm.value.name.trim() : '',
          packageServiceIds: editForm.value.postType === 'Package' ? [...(editForm.value.packageServiceIds || [])] : [],
          consultationMode: editForm.value.postType === 'Consultation'
            ? normalizeConsultationMode(editForm.value.consultationMode)
            : editForm.value.postType === 'Package'
              ? normalizeConsultationMode(editPackageComponents.find((post) => post.postType === 'Consultation')?.consultationMode)
              : null,
          price: editForm.value.postType === 'Product'
            ? Number(selectedProduct?.unitPrice || editForm.value.price || 0)
            : Number(editForm.value.price || editForm.value.consultationFee || 0),
          requiresConsultationFirst: editForm.value.postType === 'Service' ? Boolean(editForm.value.requiresConsultationFirst) : false,
          consultationFee: editForm.value.postType === 'Service' && editForm.value.requiresConsultationFirst
            ? Number(editForm.value.consultationFee || 0)
            : (editForm.value.postType === 'Consultation' ? Number(editForm.value.consultationFee || 0) : null),
          followUpAllowed: editForm.value.postType === 'Service'
            ? Boolean(editForm.value.followUpAllowed)
            : editForm.value.postType === 'Package'
              ? editPackageFollowUpComponents.length > 0
              : false,
          followUpWindowDays: editForm.value.postType === 'Service' && editForm.value.followUpAllowed
            ? Math.max(1, Number(editForm.value.followUpWindowDays || 14))
            : editForm.value.postType === 'Package' && editPackageFollowUpComponents.length
              ? Math.min(...editPackageFollowUpComponents.map((post) => Number(post.followUpWindowDays || 14)))
              : null,
          durationMinutes: editForm.value.postType === 'Product'
            ? null
            : editForm.value.postType === 'Package'
              ? Math.max(1, editForm.value.packageServiceIds.reduce((total, id) => total + Number(posts.value.find((post) => post.id === id)?.durationMinutes || 0), 0))
              : Math.max(1, Number(editForm.value.durationMinutes || (editForm.value.postType === 'Consultation' ? 30 : 60))),
          productVolume: editForm.value.postType === 'Product' ? String(editForm.value.productVolume || '').trim() : '',
          productUnit: editForm.value.postType === 'Product' ? String(editForm.value.productUnit || '').trim() : '',
          fdaRegistrationNumber: editForm.value.postType === 'Product'
            ? String(selectedProduct?.fdaRegistrationNumber || currentPost?.fdaRegistrationNumber || '').trim()
            : '',
          fdaApprovalDocument: editForm.value.postType === 'Product'
            ? (selectedProduct?.fdaApprovalDocument || currentPost?.fdaApprovalDocument || null)
            : null,
          termsAndConditions: String(editForm.value.termsAndConditions || '').trim(),
          allowInstallments: editForm.value.allowInstallments === true,
          depositPercent: editForm.value.allowInstallments ? Math.min(99, Math.max(1, Number(editForm.value.depositPercent || 50))) : 100,
          requiredEquipmentIds: [...(editForm.value.requiredEquipmentIds || [])],
          requiredSupplyIds: editForm.value.postType === 'Service' ? [...(editForm.value.requiredSupplyIds || [])] : editForm.value.postType === 'Package'
            ? [...new Set(editForm.value.packageServiceIds.flatMap((id) => posts.value.find((post) => post.id === id)?.requiredSupplyIds || []))]
            : [],
          updatedAt: serverTimestamp()
        }
        if (editForm.value.postType === 'Product') payload.inventoryItemId = selectedProduct?.id || currentPost?.inventoryItemId || null
        if (nextImageUrl) payload.imageUrl = nextImageUrl

        const existing = posts.value.find((post) => post.id === editTargetId.value) || {}
        if (financialTermsChanged(existing, { ...existing, ...payload })) Object.assign(payload, draftListing())
        await updateDoc(doc(db, 'productServicePosts', editTargetId.value), payload)
        await logActivity(db, {
          module: 'Manager',
          action: 'Updated product/service post',
          details: `Updated ${editForm.value.postType.toLowerCase()} post: ${editForm.value.title.trim()}.`
        })
        toast.success('Post updated successfully.')
        closeEditModal()
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to update post.')
      } finally {
        loading.value = false
      }
    }

    const archivePost = async (post) => {
      const result = await Swal.fire({
        title: 'Archive Post?',
        text: `Archive "${post.title || 'this post'}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Archive',
        cancelButtonText: 'Cancel'
      })
      if (!result.isConfirmed) return

      actionLoadingId.value = post.id
      try {
        const { id, ...postPayload } = post
        await setDoc(doc(db, 'archivedProductServicePosts', post.id), {
          ...postPayload,
          originalPostId: post.id,
          archivedAt: serverTimestamp(),
          archivedBy: currentUserId.value,
          updatedAt: serverTimestamp()
        })
        await deleteDoc(doc(db, 'productServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Archived product/service post',
          details: `Archived post: ${post.title || post.id}.`
        })
        toast.success('Post archived.')
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to archive post.')
      } finally {
        actionLoadingId.value = ''
      }
    }

    const deletePost = async (post) => {
      const confirmed = window.confirm(`Delete "${post.title || 'this post'}"? This cannot be undone.`)
      if (!confirmed) return

      actionLoadingId.value = post.id
      try {
        await deleteDoc(doc(db, 'productServicePosts', post.id))
        await logActivity(db, {
          module: 'Manager',
          action: 'Deleted product/service post',
          details: `Deleted post: ${post.title || post.id}.`
        })
        toast.success('Post deleted.')
        await loadPosts()
      } catch (error) {
        console.error(error)
        toast.error('Failed to delete post.')
      } finally {
        actionLoadingId.value = ''
      }
    }

    let unsubscribeAuth = null

    watch(
      () => showEditModal.value,
      (isOpen) => {
        lockBodyScroll(isOpen)
      }
    )

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          currentUserId.value = ''
          currentBranchId.value = ''
          posts.value = []
          return
        }

        currentUserId.value = user.uid
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        currentBranchId.value = userSnap.exists() ? (userSnap.data().branchId || '') : ''

        if (!currentBranchId.value) {
          toast.error('Your account has no branch assignment.', { toastId: 'missing-branch-assignment' })
          return
        }

        await loadInventoryProducts()
        await loadPosts()
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      lockBodyScroll(false)
    })

    return {
      listingAction,
      canManageListingWorkflow,
      loading,
      form,
      posts,
      actionLoadingId,
      showEditModal,
      editForm,
      editImageFileName,
      editFdaApprovalFileName,
      imageFileName,
      fdaApprovalFileName,
      inventoryProducts,
      handleImageUpload,
      handleFdaDocumentUpload,
      handleEditImageUpload,
      handleEditFdaDocumentUpload,
      createPost,
      openEditPost,
      closeEditModal,
      saveEditedPost,
      archivePost,
      deletePost,
      resetForm,
      formatCurrency,
      formatDate
    }
  }
}
</script>
