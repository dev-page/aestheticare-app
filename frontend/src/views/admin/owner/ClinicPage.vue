<template>
  <div class="flex owner-theme bg-slate-900 min-h-screen">
    <OwnerSidebar />

    <main class="flex-1 p-8">
      <div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-1">Clinic Page</h1>
          <p class="text-slate-400">Manage public-facing page content per clinic branch.</p>
          <p v-if="branchScopeLabel" class="mt-2 inline-flex rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-200">
            Viewing: {{ branchScopeLabel }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="branch in branches"
            :key="branch.id"
            @click="selectBranch(branch.id)"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedBranchId === branch.id
                ? 'bg-gold-700 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            ]"
          >
            {{ branch.clinicBranch || branch.clinicName || 'Unnamed Branch' }}
          </button>
        </div>
      </div>

      <OwnerPageSkeleton v-if="loading" />

      <div v-else-if="!selectedBranch" class="bg-slate-800 rounded-xl border border-slate-700 p-8 text-slate-300">
        No branches found for this owner account.
      </div>

      <div v-else class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="relative h-64 bg-gradient-to-r from-slate-700 to-slate-600">
          <img
            v-if="selectedBranch.bannerPicture"
            :src="selectedBranch.bannerPicture"
            alt="Clinic banner"
            class="w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0 bg-gradient-to-r from-indigo-500/40 via-sky-400/30 to-emerald-400/30"></div>
        </div>

        <div class="px-8 pb-8">
          <div class="relative -mt-20 z-20 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div class="flex flex-col md:flex-row md:items-end gap-4">
              <div class="h-36 w-36 rounded-full border-4 border-slate-800 bg-slate-700 overflow-hidden flex items-center justify-center shadow-xl">
                <img
                  v-if="selectedBranch.profilePicture"
                  :src="selectedBranch.profilePicture"
                  alt="Clinic profile"
                  class="w-full h-full object-cover"
                />
                <span v-else class="text-4xl font-bold text-white">{{ clinicInitial }}</span>
              </div>
              <div class="pt-10 md:pt-0">
                <h2 class="text-3xl font-bold text-white">{{ displayClinicName }}</h2>
                <p class="text-slate-300 mt-1">{{ selectedBranch.clinicLocation || 'Location not set' }}</p>
              </div>
            </div>
            <div class="md:pb-2">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="!isEditing"
                  @click="startEdit"
                  :disabled="isExpired"
                  class="px-4 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Edit Info
                </button>
                <button
                  @click="togglePublish"
                  :disabled="saving || isExpired"
                  :class="[
                    'px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed',
                    selectedBranch.isPublished ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  ]"
                >
                  {{ selectedBranch.isPublished ? 'Unpublish Page' : 'Publish Page' }}
                </button>
                <span v-if="isExpired" class="text-xs text-amber-300">Publishing is disabled when the plan is expired.</span>
              </div>
            </div>
          </div>

          <div class="mt-8 border-t border-slate-700 pt-4">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-gold-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="mt-6">
            <section v-if="activeTab === 'about'" class="space-y-4">
              <div v-if="isEditing" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 space-y-4">
                <div class="flex items-center gap-3">
                  <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-300"><Icon icon="mdi:pencil-outline" class="h-5 w-5" /></span>
                  <div><h3 class="text-white font-semibold">Edit Branch Page</h3><p class="mt-0.5 text-xs text-slate-400">Update your public contact details, description, services, and page images.</p></div>
                </div>
                <div class="flex items-start gap-3 rounded-xl border border-slate-600 bg-slate-800/70 p-4 text-sm text-slate-300">
                  <Icon icon="mdi:lock-outline" class="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
                  <p><strong class="text-slate-100">Verified branch details are protected.</strong> The clinic name, registered address, and map pin cannot be changed from this page.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Business Email</label>
                    <input
                      v-model="editForm.businessEmail"
                      class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Contact Number</label>
                    <div class="flex overflow-hidden rounded-lg border border-slate-500 bg-slate-800 focus-within:ring-2 focus-within:ring-gold-500">
                      <span class="inline-flex items-center border-r border-slate-500 px-3 text-sm font-semibold text-slate-300">+63</span>
                      <input
                        :value="editForm.contactNumber"
                        type="tel"
                        inputmode="numeric"
                        autocomplete="tel-national"
                        maxlength="10"
                        placeholder="9XXXXXXXXX"
                        class="min-w-0 flex-1 bg-transparent px-3 py-2 text-white outline-none"
                        @input="handleContactNumberInput"
                        @blur="validateContactNumber"
                      />
                    </div>
                    <p v-if="contactNumberError" class="mt-1 text-xs text-rose-300">{{ contactNumberError }}</p>
                  </div>
                </div>

                <div class="rounded-xl border border-slate-600 bg-slate-800/70 p-4">
                  <div class="flex items-start gap-3"><span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/40 bg-gold-500/10 text-gold-300"><Icon icon="mdi:clock-outline" class="h-5 w-5" /></span><div><h4 class="font-medium text-white">Operating Hours</h4><p class="mt-1 text-xs text-slate-400">These hours are used for Basic-plan booking availability and shown to customers.</p></div></div>
                  <div class="mt-4 space-y-3"><div v-for="day in operatingHourDays" :key="day.key" class="grid grid-cols-[minmax(92px,1fr)_auto] items-center gap-3 rounded-lg border border-slate-600 bg-slate-900/60 p-3 sm:grid-cols-[120px_1fr_auto]"><span class="text-sm font-medium text-slate-200">{{ day.label }}</span><div class="flex items-center gap-2" :class="editForm.operatingHours[day.key].closed ? 'pointer-events-none opacity-40' : ''"><input v-model="editForm.operatingHours[day.key].open" type="time" class="min-w-0 rounded-lg border border-slate-500 bg-slate-800 px-2 py-2 text-sm text-white outline-none focus:border-gold-500" :disabled="editForm.operatingHours[day.key].closed" /><span class="text-xs text-slate-500">to</span><input v-model="editForm.operatingHours[day.key].close" type="time" class="min-w-0 rounded-lg border border-slate-500 bg-slate-800 px-2 py-2 text-sm text-white outline-none focus:border-gold-500" :disabled="editForm.operatingHours[day.key].closed" /></div><label class="flex items-center justify-end gap-2 text-xs text-slate-300"><input v-model="editForm.operatingHours[day.key].closed" type="checkbox" /> Closed</label></div></div>
                </div>

                <div>
                  <label class="block text-slate-300 text-sm mb-1">About Us (Description)</label>
                  <textarea
                    v-model="editForm.description"
                    rows="4"
                    class="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-slate-300 text-sm mb-1">Offered Services</label>
                  <div class="w-full rounded-lg px-3 py-2 bg-slate-800 border border-slate-500 focus-within:ring-2 focus-within:ring-gold-500">
                    <div v-if="editForm.services.length" class="flex flex-wrap gap-2 mb-2">
                      <span
                        v-for="(service, index) in editForm.services"
                        :key="`${service}-${index}`"
                        class="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-200 text-xs"
                      >
                        {{ service }}
                        <button
                          type="button"
                          @click="removeServiceTag(index)"
                          class="text-gold-300 hover:text-white leading-none"
                          aria-label="Remove service"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                    <input
                      v-model="serviceInput"
                      type="text"
                      placeholder="Type a service then press Enter"
                      class="w-full bg-transparent text-white placeholder-slate-400 focus:outline-none"
                      @keydown="handleServiceKeydown"
                      @blur="commitServiceInput"
                    />
                  </div>
                  <p class="text-slate-400 text-xs mt-1">Press Enter or comma to add. Click × to remove.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Profile Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      @change="handleProfileUpload"
                      class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-gold-700 file:px-3 file:py-2 file:text-white hover:file:bg-gold-800"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-300 text-sm mb-1">Banner Picture</label>
                    <input
                      type="file"
                      accept="image/*"
                      @change="handleBannerUpload"
                      class="block w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-gold-700 file:px-3 file:py-2 file:text-white hover:file:bg-gold-800"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p class="text-slate-300 text-xs mb-2">Profile Preview</p>
                    <div class="h-20 w-20 rounded-full overflow-hidden bg-slate-700 border border-slate-500">
                      <img v-if="editForm.profilePicture" :src="editForm.profilePicture" class="w-full h-full object-cover" alt="Profile preview" />
                    </div>
                  </div>
                  <div class="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p class="text-slate-300 text-xs mb-2">Banner Preview</p>
                    <div class="h-20 rounded overflow-hidden bg-slate-700 border border-slate-500">
                      <img v-if="editForm.bannerPicture" :src="editForm.bannerPicture" class="w-full h-full object-cover" alt="Banner preview" />
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    @click="saveEdit"
                    :disabled="saving"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm"
                  >
                    {{ saving ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button
                    @click="cancelEdit"
                    class="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h3 class="text-white font-semibold mb-2">About Us</h3>
                <p class="text-slate-300 leading-relaxed">
                  {{ selectedBranch.description || 'No clinic description available yet.' }}
                </p>
              </div>

              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h3 class="text-white font-semibold mb-2">Offered Services</h3>
                <div v-if="Array.isArray(selectedBranch.services) && selectedBranch.services.length" class="flex flex-wrap gap-2">
                  <span
                    v-for="(service, index) in selectedBranch.services"
                    :key="`saved-service-${index}-${service}`"
                    class="inline-flex items-center px-2.5 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-200 text-xs"
                  >
                    {{ service }}
                  </span>
                </div>
                <p v-else class="text-slate-400 text-sm">No services added yet.</p>
              </div>

              <div class="space-y-4">
                <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                  <h4 class="text-slate-200 font-medium mb-2">Contact</h4>
                  <p class="text-slate-300 text-sm">Email: {{ selectedBranch.businessEmail || 'Not set' }}</p>
                  <p class="text-slate-300 text-sm mt-1">Phone: {{ selectedBranch.contactNumber || 'Not set' }}</p>
                </div>
                <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600"><div class="flex items-center gap-2"><Icon icon="mdi:clock-outline" class="h-5 w-5 text-gold-300" /><h4 class="text-slate-200 font-medium">Operating Hours</h4></div><div class="mt-3 grid gap-2 sm:grid-cols-2"><div v-for="day in operatingHourDays" :key="`public-${day.key}`" class="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm"><span class="text-slate-300">{{ day.label }}</span><span class="font-medium text-white">{{ formatOperatingHours(selectedBranch.operatingHours?.[day.key]) }}</span></div></div></div>
                <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 space-y-4">
                  <h4 class="text-slate-200 font-medium">Address</h4>
                  <p class="text-slate-300 text-sm leading-relaxed">
                    {{ selectedBranch.clinicLocationAddress || selectedBranch.clinicLocation || 'Not set' }}
                  </p>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400">City / Municipality</p>
                      <p class="mt-1 text-sm text-white">{{ selectedBranch.clinicLocation || '-' }}</p>
                    </div>
                    <div class="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400">Barangay</p>
                      <p class="mt-1 text-sm text-white">{{ selectedBranch.clinicBarangay || '-' }}</p>
                    </div>
                    <div class="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400">Actual Location</p>
                      <p class="mt-1 text-sm text-white">{{ selectedBranch.clinicLocationAddress || '-' }}</p>
                    </div>
                    <div class="rounded-lg border border-slate-600 bg-slate-800/70 p-3">
                      <p class="text-[11px] uppercase tracking-wide text-slate-400">Postal Code</p>
                      <p class="mt-1 text-sm text-white">{{ selectedBranch.clinicPostalCode || '-' }}</p>
                    </div>
                  </div>

                  <div class="overflow-hidden rounded-xl border border-slate-600 bg-slate-900/80">
                    <div ref="branchMapEl" class="h-56 min-h-56 w-full"></div>
                    <p v-if="mapLoading" class="border-t border-slate-700 px-4 py-3 text-xs text-slate-400">
                      Loading map...
                    </p>
                    <p v-else-if="mapError" class="border-t border-slate-700 px-4 py-3 text-xs text-amber-300">
                      {{ mapError }}
                    </p>
                    <p v-else-if="!branchCoordinates" class="border-t border-slate-700 px-4 py-3 text-xs text-slate-400">
                      No saved pin yet. The map is centered on Cavite until a location is selected.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section v-else-if="activeTab === 'policies'" class="space-y-4">
              <div class="overflow-hidden rounded-2xl border border-slate-600 bg-slate-700/60">
                <div class="flex flex-col gap-4 border-b border-slate-600 bg-slate-800/50 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-start gap-3"><span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-300"><Icon icon="mdi:shield-check-outline" class="h-6 w-6" /></span><div><h3 class="text-lg font-semibold text-white">Clinic Policies</h3><p class="mt-1 text-sm text-slate-400">Customer-facing rules currently active for this branch.</p></div></div>
                  <span v-if="visiblePolicies.length" class="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><Icon icon="mdi:eye-check-outline" class="h-4 w-4" /> {{ visiblePolicies.length }} published</span>
                </div>
                <div v-if="visiblePolicies.length" class="grid gap-4 p-5 lg:grid-cols-2">
                  <article v-for="policy in visiblePolicies" :key="policy.key" class="group rounded-xl border border-slate-600 bg-slate-800/75 p-5 transition hover:border-gold-500/60 hover:bg-slate-800">
                    <div class="flex items-start gap-3"><span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" :class="policy.iconClass"><Icon :icon="policy.icon" class="h-5 w-5" /></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h4 class="font-semibold text-slate-100">{{ policy.label }}</h4><span class="rounded-full border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{{ policy.category }}</span></div><p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{{ policy.text }}</p></div></div>
                  </article>
                </div>
                <div v-else class="p-10 text-center"><span class="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-400"><Icon icon="mdi:shield-outline" class="h-6 w-6" /></span><p class="mt-4 font-medium text-slate-200">No published policies yet</p><p class="mt-1 text-sm text-slate-400">Enable and configure policies in Policy Management to show them here.</p></div>
              </div>
            </section>

            <section v-else-if="activeTab === 'products'" class="space-y-4">
              <div v-if="products.length === 0" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 text-slate-300">
                No products or services posted yet for this branch.
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <article
                  v-for="item in products"
                  :key="item.id"
                  class="group overflow-hidden rounded-xl border border-slate-600 bg-slate-700/60 transition hover:-translate-y-0.5 hover:border-gold-500/70 hover:bg-slate-700"
                >
                  <div class="relative h-40 bg-slate-600">
                    <img v-if="listingImage(item)" :src="listingImage(item)" :alt="listingTitle(item)" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <div v-else class="flex h-full items-center justify-center text-slate-400"><Icon icon="mdi:image-outline" class="h-9 w-9" /></div>
                  </div>
                  <div class="p-4">
                    <div class="flex items-start justify-between gap-3"><h3 class="text-white font-semibold">{{ listingTitle(item) }}</h3><span v-if="listingType(item)" class="rounded-full border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{{ listingType(item) }}</span></div>
                    <p class="text-slate-300 text-sm mt-2 line-clamp-3">{{ item.description || 'No description.' }}</p>
                    <div class="mt-4 flex items-center justify-between gap-3"><p class="text-gold-400 text-sm font-semibold">{{ formatAmount(item.price) }}</p><button type="button" @click="openListingDetails(item)" class="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/60 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-500/15 focus:outline-none focus:ring-2 focus:ring-gold-400"><Icon icon="mdi:information-outline" class="h-4 w-4" /> View Details</button></div>
                  </div>
                </article>
              </div>
            </section>

            <section v-else class="space-y-4">
              <div v-if="reviews.length === 0" class="bg-slate-700/60 rounded-xl p-5 border border-slate-600 text-slate-300">
                No reviews yet for this branch.
              </div>

              <div v-else class="space-y-3">
                <article
                  v-for="review in reviews"
                  :key="review.id"
                  class="bg-slate-700/60 rounded-xl border border-slate-600 p-5"
                >
                  <div class="flex items-center justify-between">
                    <p class="text-white font-medium">{{ review.reviewerName || 'Anonymous' }}</p>
                    <p class="text-yellow-400 text-sm">{{ renderStars(review.rating) }}</p>
                  </div>
                  <p class="text-slate-300 text-sm mt-2">{{ review.comment || 'No comment' }}</p>
                  <p class="text-slate-400 text-xs mt-2">{{ formatDate(review.createdAt) }}</p>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>

    <div v-if="selectedListing" class="fixed inset-0 z-50 flex overscroll-contain items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" @click.self="closeListingDetails">
      <section class="max-h-[90vh] w-full max-w-3xl overscroll-contain overflow-y-auto rounded-2xl border border-slate-600 bg-slate-800 shadow-2xl" role="dialog" aria-modal="true" :aria-labelledby="`listing-details-${selectedListing.id}`">
        <header class="flex items-start justify-between gap-4 border-b border-slate-600 px-6 py-5"><div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">{{ listingType(selectedListing) || 'Product or Service' }}</p><h2 :id="`listing-details-${selectedListing.id}`" class="mt-1 text-xl font-bold text-white">{{ listingTitle(selectedListing) }}</h2></div><button type="button" @click="closeListingDetails" class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white" aria-label="Close details"><Icon icon="mdi:close" class="h-5 w-5" /></button></header>
        <div class="grid md:grid-cols-2"><div class="min-h-64 bg-slate-900"><img v-if="listingImage(selectedListing)" :src="listingImage(selectedListing)" :alt="listingTitle(selectedListing)" class="h-full max-h-96 w-full object-cover" /><div v-else class="flex h-64 items-center justify-center text-slate-500"><Icon icon="mdi:image-outline" class="h-12 w-12" /></div></div><div class="p-6"><p class="text-2xl font-bold text-gold-300">{{ formatAmount(selectedListing.price) }}</p><p class="mt-5 whitespace-pre-wrap text-sm leading-6 text-slate-300">{{ selectedListing.description || 'No description has been provided for this listing.' }}</p><dl v-if="listingDetails(selectedListing).length" class="mt-6 grid gap-3"><div v-for="detail in listingDetails(selectedListing)" :key="detail.label" class="rounded-xl border border-slate-600 bg-slate-900/50 p-3"><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{{ detail.label }}</dt><dd class="mt-1 text-sm font-medium text-slate-100">{{ detail.value }}</dd></div></dl><button type="button" @click="closeListingDetails" class="mt-6 w-full rounded-xl border border-gold-500/60 px-4 py-2.5 font-semibold text-gold-200 transition hover:bg-gold-500/10">Close</button></div></div>
      </section>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getFirestore, collection, getDocs, query, where, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, storage } from '@/config/firebaseConfig'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import OwnerPageSkeleton from '@/components/common/OwnerPageSkeleton.vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { useSubscription } from '@/composables/useSubscription'

export default {
  name: 'ClinicPage',
  components: { OwnerSidebar, OwnerPageSkeleton, Icon },
  setup() {
    const db = getFirestore(getApp())
    const { isExpired, initSubscription } = useSubscription()

    const loading = ref(true)
    const branches = ref([])
    const selectedBranchId = ref('')
    const branchScopeLabel = ref('')
    const branchMapEl = ref(null)
    const mapLoading = ref(false)
    const mapError = ref('')
    const products = ref([])
    const reviews = ref([])
    const selectedListing = ref(null)
    const clinicPolicy = ref({})
    const ownerEmail = ref('')
    const activeTab = ref('about')
    const isEditing = ref(false)
    const saving = ref(false)
    const contactNumberError = ref('')
    const operatingHourDays = [
      { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' }, { key: 'wednesday', label: 'Wednesday' }, { key: 'thursday', label: 'Thursday' }, { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' }, { key: 'sunday', label: 'Sunday' }
    ]
    const defaultOperatingHours = () => Object.fromEntries(operatingHourDays.map(({ key }) => [key, { open: '09:00', close: '18:00', closed: key === 'sunday' }]))
    const normalizeOperatingHours = (value) => {
      const defaults = defaultOperatingHours()
      operatingHourDays.forEach(({ key }) => {
        const source = value?.[key] || {}
        defaults[key] = { open: /^\d{2}:\d{2}$/.test(String(source.open || '')) ? source.open : defaults[key].open, close: /^\d{2}:\d{2}$/.test(String(source.close || '')) ? source.close : defaults[key].close, closed: source.closed === true }
      })
      return defaults
    }
    const formatOperatingHours = (value) => {
      if (!value || value.closed === true) return 'Closed'
      const formatTime = (time) => { const [hours, minutes] = String(time || '').split(':').map(Number); if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return ''; return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) }
      const open = formatTime(value.open); const close = formatTime(value.close)
      return open && close ? `${open} – ${close}` : 'Not set'
    }

    const editForm = ref({
      businessEmail: '',
      contactNumber: '',
      description: '',
      services: [],
      operatingHours: defaultOperatingHours(),
      profilePicture: '',
      bannerPicture: ''
    })
    const serviceInput = ref('')
    const profileImageFile = ref(null)
    const bannerImageFile = ref(null)
    const profilePreviewUrl = ref('')
    const bannerPreviewUrl = ref('')
    let branchMap = null
    let branchMarker = null
    let stopPolicyListener = null
    let mapsReady = false
    const caviteBounds = {
      north: 14.459,
      south: 13.709,
      east: 121.199,
      west: 120.626
    }
    const defaultCaviteCenter = { lat: 14.3294, lng: 120.9367 }

    const normalizePhilippineMobile = (value) => {
      let digits = String(value || '').replace(/\D/g, '')
      if (digits.startsWith('63')) digits = digits.slice(2)
      if (digits.startsWith('0')) digits = digits.slice(1)
      return digits.slice(0, 10)
    }

    const validateContactNumber = () => {
      contactNumberError.value = /^9\d{9}$/.test(String(editForm.value.contactNumber || '').trim())
        ? ''
        : 'Enter exactly 10 digits starting with 9.'
      return !contactNumberError.value
    }

    const handleContactNumberInput = (event) => {
      editForm.value.contactNumber = normalizePhilippineMobile(event?.target?.value)
      if (contactNumberError.value) validateContactNumber()
    }

    const tabs = [
      { id: 'about', label: 'About Us' },
      { id: 'products', label: 'Products & Services' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'policies', label: 'Policies' }
    ]

    const policyDefinitions = [
      { key: 'paymentPolicy', enabledKey: 'paymentPolicyEnabled', label: 'Payment Policy', category: 'Services', icon: 'mdi:cash-check', iconClass: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' },
      { key: 'cancellationPolicy', enabledKey: 'cancellationPolicyEnabled', label: 'Cancellation Policy', category: 'Services', icon: 'mdi:calendar-remove-outline', iconClass: 'border-rose-500/35 bg-rose-500/10 text-rose-300' },
      { key: 'reschedulePolicy', enabledKey: 'reschedulePolicyEnabled', label: 'Rescheduling Policy', category: 'Services', icon: 'mdi:calendar-sync-outline', iconClass: 'border-sky-500/35 bg-sky-500/10 text-sky-300' },
      { key: 'noShowPolicy', enabledKey: 'noShowPolicyEnabled', label: 'No-Show Policy', category: 'Services', icon: 'mdi:account-clock-outline', iconClass: 'border-amber-500/35 bg-amber-500/10 text-amber-300' },
      { key: 'consultationPolicy', enabledKey: 'consultationPolicyEnabled', label: 'Consultation Policy', category: 'Services', icon: 'mdi:stethoscope', iconClass: 'border-violet-500/35 bg-violet-500/10 text-violet-300' },
      { key: 'deliveryPolicy', enabledKey: 'deliveryPolicyEnabled', label: 'Pickup & Payment Policy', category: 'Products', icon: 'mdi:shopping-outline', iconClass: 'border-teal-500/35 bg-teal-500/10 text-teal-300' },
      { key: 'productOrderCancellationPolicy', enabledKey: 'productOrderCancellationPolicyEnabled', label: 'Order Cancellation Policy', category: 'Products', icon: 'mdi:package-variant-remove', iconClass: 'border-orange-500/35 bg-orange-500/10 text-orange-300' },
      { key: 'productReturnPolicy', enabledKey: 'productReturnPolicyEnabled', label: 'Product Return Policy', category: 'Products', icon: 'mdi:package-variant-closed-return', iconClass: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-300' },
      { key: 'walkInPolicy', enabledKey: 'walkInPolicyEnabled', label: 'Walk-In Policy', category: 'Walk-In', icon: 'mdi:walk', iconClass: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300' }
    ]

    const visiblePolicies = computed(() => policyDefinitions
      .map((definition) => ({
        ...definition,
        text: String(clinicPolicy.value[definition.key] || '').trim()
      }))
      .filter((policy) => {
        const linked = selectedBranch.value?.enforcedPolicyKeys
        return policy.text && clinicPolicy.value[policy.enabledKey] !== false
          && (!Array.isArray(linked) || linked.includes(policy.key))
      })
    )

    const isOwnerLikeRole = (role) => {
      const normalized = String(role || '').trim().toLowerCase()
      return ['owner', 'clinic admin', 'clinicadmin', 'clinic administrator', 'clinicadministrator'].includes(normalized)
    }

    const selectedBranch = computed(() =>
      branches.value.find((branch) => branch.id === selectedBranchId.value) || null
    )

    const branchCoordinates = computed(() => {
      const branch = selectedBranch.value
      if (!branch) return null

      const location = branch.locationCoordinates || branch.coordinates || branch.location || {}
      const lat = Number(branch.clinicLocationLat ?? branch.latitude ?? branch.lat ?? location.latitude ?? location.lat)
      const lng = Number(branch.clinicLocationLng ?? branch.longitude ?? branch.lng ?? branch.lon ?? location.longitude ?? location.lng)
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
    })

    const organizationClinicName = computed(() => {
      const ownerBranch = branches.value.find((branch) => branch.id === auth.currentUser?.uid) || branches.value[0]
      return ownerBranch?.clinicName || ownerBranch?.clinicBranch || ''
    })

    const displayClinicName = computed(() => {
      if (!selectedBranch.value) return 'Clinic Name'
      return organizationClinicName.value || selectedBranch.value.clinicName || selectedBranch.value.clinicBranch || 'Clinic Name'
    })

    const clinicInitial = computed(() => {
      const source = displayClinicName.value || 'C'
      return source.charAt(0).toUpperCase()
    })

    const formatAmount = (value) => {
      const numeric = Number(value || 0)
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' }).format(numeric)
    }

    const listingTitle = (item) => String(item?.title || item?.productName || item?.serviceName || 'Untitled Listing').trim()
    const listingImage = (item) => String(item?.imageUrl || item?.imageURL || item?.image || '').trim()
    const listingType = (item) => String(item?.listingType || item?.type || item?.category || '').trim()
    const listingDetails = (item) => {
      const details = []
      const category = String(item?.category || '').trim()
      const duration = Number(item?.durationMinutes ?? item?.duration ?? 0)
      const sessions = Number(item?.sessions ?? item?.sessionCount ?? 0)
      const stock = item?.stockQuantity ?? item?.quantity ?? item?.stock
      if (category) details.push({ label: 'Category', value: category })
      if (Number.isFinite(duration) && duration > 0) details.push({ label: 'Duration', value: `${duration} minutes` })
      if (Number.isFinite(sessions) && sessions > 0) details.push({ label: 'Sessions', value: `${sessions}` })
      if (stock !== undefined && stock !== null && String(stock).trim() !== '') details.push({ label: 'Availability', value: Number(stock) > 0 ? `${stock} in stock` : 'Currently unavailable' })
      return details
    }
    const openListingDetails = (item) => { selectedListing.value = item }
    const closeListingDetails = () => { selectedListing.value = null }
    let previousBodyOverflow = ''
    let previousDocumentOverflow = ''
    let previousBodyPosition = ''
    let previousBodyTop = ''
    let previousBodyWidth = ''
    let lockedScrollY = 0
    watch(selectedListing, (item) => {
      if (item) {
        previousBodyOverflow = document.body.style.overflow
        previousDocumentOverflow = document.documentElement.style.overflow
        previousBodyPosition = document.body.style.position
        previousBodyTop = document.body.style.top
        previousBodyWidth = document.body.style.width
        lockedScrollY = window.scrollY
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.top = `-${lockedScrollY}px`
        document.body.style.width = '100%'
        return
      }
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      window.scrollTo(0, lockedScrollY)
    })

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return 'Unknown date'
      return timestamp.toDate().toLocaleDateString()
    }

    const renderStars = (rating) => {
      const numeric = Math.max(0, Math.min(5, Number(rating || 0)))
      return `Rating: ${Math.round(numeric)}/5`
    }

    const waitForMapConstructor = () => new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const tryResolve = async () => {
        if (typeof window.google?.maps?.Map === 'function') {
          resolve()
          return
        }

        // With the modern async Maps loader, `google.maps` can exist before
        // either the legacy Map constructor or the maps library is available.
        // Import the library when possible, then retry briefly while it starts.
        if (typeof window.google?.maps?.importLibrary === 'function') {
          try {
            const mapsLibrary = await window.google.maps.importLibrary('maps')
            if (typeof mapsLibrary?.Map === 'function') {
              resolve()
              return
            }
          } catch {
            // The library can still be bootstrapping immediately after script load.
          }
        }

        if (Date.now() - startedAt >= 8000) {
          reject(new Error('Google Maps did not finish initializing. Check the API key and referrer restrictions.'))
          return
        }
        window.setTimeout(tryResolve, 75)
      }
      void tryResolve()
    })

    const loadMapsScript = () => {
      if (typeof window.google?.maps?.Map === 'function') return Promise.resolve()
      return new Promise((resolve, reject) => {
        const existing = document.getElementById('google-maps-js')
        if (existing) {
          // It may already have fired its load event, so wait for the API
          // itself rather than relying solely on that DOM event.
          waitForMapConstructor().then(resolve).catch(reject)
          existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true })
          return
        }

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
          reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in environment.'))
          return
        }

        const script = document.createElement('script')
        script.id = 'google-maps-js'
        script.async = true
        script.defer = true
        // Do not use loading=async without the Google callback helper. That
        // setting lets this event fire before Map/importLibrary is usable.
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`
        script.onload = () => waitForMapConstructor().then(resolve).catch(reject)
        script.onerror = () => reject(new Error('Failed to load Google Maps'))
        document.head.appendChild(script)
      })
    }

    const initBranchMap = async () => {
      if (!branchMapEl.value || !selectedBranch.value) return

      mapLoading.value = true
      mapError.value = ''
      try {
        if (!mapsReady) {
          await loadMapsScript()
          mapsReady = true
        }
      } catch (error) {
        console.error('Failed to load branch map:', error)
        mapError.value = error?.message || 'The map could not be loaded.'
        mapLoading.value = false
        return
      }

      const center = branchCoordinates.value || defaultCaviteCenter
      const hasCoordinates = Boolean(branchCoordinates.value)

      let MapCtor = window.google?.maps?.Map
      let AdvancedMarkerElement = window.google?.maps?.marker?.AdvancedMarkerElement
      if (window.google?.maps?.importLibrary) {
        try {
          const mapsLib = await window.google.maps.importLibrary('maps')
          MapCtor = mapsLib?.Map || MapCtor
          const markerLib = await window.google.maps.importLibrary('marker')
          AdvancedMarkerElement = markerLib?.AdvancedMarkerElement || AdvancedMarkerElement
        } catch (error) {
          console.error('Failed to import Google Maps libraries:', error)
        }
      }

      if (!MapCtor) {
        mapError.value = 'Google Maps did not provide a map constructor.'
        mapLoading.value = false
        return
      }

      // The About tab and loading skeleton can replace this element. Recreate
      // the map if its old Google Maps canvas has been detached.
      if (branchMap?.getDiv?.() && branchMap.getDiv() !== branchMapEl.value) {
        if (branchMarker?.setMap) branchMarker.setMap(null)
        branchMarker = null
        branchMap = null
      }

      if (!branchMap) {
        branchMap = new MapCtor(branchMapEl.value, {
          center,
          zoom: hasCoordinates ? 15 : 12,
          restriction: { latLngBounds: caviteBounds, strictBounds: true },
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          ...(import.meta.env.VITE_GOOGLE_MAP_ID ? { mapId: import.meta.env.VITE_GOOGLE_MAP_ID } : {})
        })
      } else {
        branchMap.setCenter(center)
      }

      if (branchMarker?.setMap) {
        branchMarker.setMap(null)
      }
      branchMarker = null

      if (hasCoordinates) {
        if (AdvancedMarkerElement && import.meta.env.VITE_GOOGLE_MAP_ID) {
          branchMarker = new AdvancedMarkerElement({
            map: branchMap,
            position: center
          })
        } else if (window.google?.maps?.Marker) {
          branchMarker = new window.google.maps.Marker({
            map: branchMap,
            position: center
          })
        }
      }

      await nextTick()
      window.google?.maps?.event?.trigger(branchMap, 'resize')
      branchMap.setCenter(center)
      mapLoading.value = false
    }

    const hydrateEditForm = () => {
      if (!selectedBranch.value) return

      if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
      if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
      profilePreviewUrl.value = ''
      bannerPreviewUrl.value = ''
      profileImageFile.value = null
      bannerImageFile.value = null

      editForm.value = {
        businessEmail: selectedBranch.value.businessEmail || selectedBranch.value.email || '',
        contactNumber: normalizePhilippineMobile(selectedBranch.value.contactNumber || ''),
        description: selectedBranch.value.description || '',
        services: Array.isArray(selectedBranch.value.services)
          ? selectedBranch.value.services.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        operatingHours: normalizeOperatingHours(selectedBranch.value.operatingHours),
        profilePicture: selectedBranch.value.profilePicture || '',
        bannerPicture: selectedBranch.value.bannerPicture || ''
      }
      serviceInput.value = ''
    }

    const normalizeService = (value) => String(value || '').replace(/\s+/g, ' ').trim()

    const addServiceTag = (rawValue) => {
      const nextLabel = normalizeService(rawValue)
      if (!nextLabel) return
      const exists = editForm.value.services.some((service) => service.toLowerCase() === nextLabel.toLowerCase())
      if (exists) return
      editForm.value.services.push(nextLabel)
    }

    const commitServiceInput = () => {
      if (!serviceInput.value) return
      addServiceTag(serviceInput.value)
      serviceInput.value = ''
    }

    const handleServiceKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        commitServiceInput()
        return
      }
      if (event.key === 'Backspace' && !serviceInput.value && editForm.value.services.length > 0) {
        editForm.value.services.pop()
      }
    }

    const removeServiceTag = (index) => {
      if (index < 0 || index >= editForm.value.services.length) return
      editForm.value.services.splice(index, 1)
    }

    const loadBranchPostsAndReviews = async (branchId) => {
      if (!branchId) {
        products.value = []
        reviews.value = []
        return
      }

      const [productSnapshot, reviewSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId))),
        getDocs(query(collection(db, 'reviews'), where('branchId', '==', branchId)))
      ])

      products.value = productSnapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
      reviews.value = reviewSnapshot.docs
        .map((snap) => ({ id: snap.id, ...snap.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    }

    const listenToBranchPolicies = (branchId) => {
      stopPolicyListener?.()
      stopPolicyListener = null
      clinicPolicy.value = {}
      if (!branchId) return

      stopPolicyListener = onSnapshot(
        doc(db, 'clinicPolicies', branchId),
        (snapshot) => {
          clinicPolicy.value = snapshot.exists() ? snapshot.data() || {} : {}
        },
        (error) => {
          console.error('Failed to load clinic policies:', error)
          clinicPolicy.value = {}
        }
      )
    }

    const selectBranch = async (branchId) => {
      if (!branchId || selectedBranchId.value === branchId) return
      selectedBranchId.value = branchId
      closeListingDetails()
      isEditing.value = false
      hydrateEditForm()
      await loadBranchPostsAndReviews(branchId)
      listenToBranchPolicies(branchId)
    }

    const autoUnpublishExpiredBranches = async () => {
      const published = branches.value.filter((branch) => branch.isPublished === true)
      if (!published.length) return
      try {
        await Promise.all(
          published.map((branch) =>
            updateDoc(doc(db, 'clinics', branch.id), {
              isPublished: false,
              updatedAt: serverTimestamp()
            })
          )
        )
        branches.value = branches.value.map((branch) => ({ ...branch, isPublished: false }))
      } catch (error) {
        console.error('Failed to unpublish expired clinic pages:', error)
      }
    }

    const loadOwnerBranches = async (user) => {
      loading.value = true
      try {
        ownerEmail.value = user.email || ''
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.exists() ? userSnap.data() || {} : {}
        if (userSnap.exists()) {
          ownerEmail.value = userData.email || ownerEmail.value
        }

        if (isOwnerLikeRole(userData.role || userData.customRoleName)) {
          const clinicsSnapshot = await getDocs(
            query(collection(db, 'clinics'), where('ownerId', '==', user.uid))
          )

          branches.value = await Promise.all(
            clinicsSnapshot.docs.map(async (snap) => {
              const data = snap.data()
              return { id: snap.id, ...data, isPublished: data.isPublished === true }
            })
          )
          branchScopeLabel.value = branches.value.length > 1 ? 'Owner-wide clinic pages' : 'Main clinic page'
        } else {
          const assignedBranchId = String(userData.branchId || userData.clinicBranch || '').trim()
          if (assignedBranchId) {
            const clinicSnap = await getDoc(doc(db, 'clinics', assignedBranchId))
            if (clinicSnap.exists()) {
              const data = clinicSnap.data() || {}
              branches.value = [{ id: clinicSnap.id, ...data, isPublished: data.isPublished === true }]
              branchScopeLabel.value = data.clinicBranch || data.clinicName || 'Assigned branch'
            }
          }

          if (!branches.value.length) {
            const assignedByAdminSnapshot = await getDocs(
              query(collection(db, 'clinics'), where('branchAdminId', '==', user.uid))
            )
            branches.value = assignedByAdminSnapshot.docs.map((snap) => {
              const data = snap.data() || {}
              return { id: snap.id, ...data, isPublished: data.isPublished === true }
            })
            branchScopeLabel.value = branches.value.length
              ? (branches.value[0].clinicBranch || branches.value[0].clinicName || 'Assigned branch')
              : ''
          }
        }
        if (isExpired.value && branches.value.length) {
          await autoUnpublishExpiredBranches()
        }
        if (branches.value.length > 0) {
          selectedBranchId.value = branches.value[0].id
          hydrateEditForm()
          await loadBranchPostsAndReviews(selectedBranchId.value)
          listenToBranchPolicies(selectedBranchId.value)
          await nextTick()
          await initBranchMap()
        } else {
          selectedBranchId.value = ''
          products.value = []
          reviews.value = []
          clinicPolicy.value = {}
          stopPolicyListener?.()
          stopPolicyListener = null
          mapError.value = ''
        }
      } catch (error) {
        console.error('Failed to load clinic page:', error)
        branches.value = []
        selectedBranchId.value = ''
        products.value = []
        reviews.value = []
      } finally {
        loading.value = false
        // The map canvas is inside the non-loading branch of the template, so
        // initialize only after that element exists in the DOM.
        if (branches.value.length) {
          await nextTick()
          await initBranchMap()
        }
      }
    }

    const handleProfileUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
        profileImageFile.value = file
        profilePreviewUrl.value = URL.createObjectURL(file)
        editForm.value.profilePicture = profilePreviewUrl.value
      } catch (error) {
        console.error(error)
        toast.error('Failed to process profile image.')
      } finally {
        event.target.value = ''
      }
    }

    const handleBannerUpload = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
        bannerImageFile.value = file
        bannerPreviewUrl.value = URL.createObjectURL(file)
        editForm.value.bannerPicture = bannerPreviewUrl.value
      } catch (error) {
        console.error(error)
        toast.error('Failed to process banner image.')
      } finally {
        event.target.value = ''
      }
    }

    const startEdit = () => {
      if (!selectedBranch.value) return
      activeTab.value = 'about'
      isEditing.value = true
      hydrateEditForm()
    }

    const cancelEdit = () => {
      isEditing.value = false
      hydrateEditForm()
    }

    const saveEdit = async () => {
      if (!selectedBranch.value?.id) return
      if (!validateContactNumber()) {
        toast.error('Enter a valid Philippine mobile number before saving.')
        return
      }
      saving.value = true
      try {
        commitServiceInput()
        const clinicId = selectedBranch.value.id
        const sanitizeImageUrl = (value) => {
          const source = String(value || '').trim()
          if (!source) return ''
          if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('gs://')) {
            return source
          }
          return ''
        }

        let profilePictureUrl = sanitizeImageUrl(selectedBranch.value.profilePicture)
        let bannerPictureUrl = sanitizeImageUrl(selectedBranch.value.bannerPicture)

        if (profileImageFile.value) {
          const extension = (profileImageFile.value.name?.split('.').pop() || 'jpg').toLowerCase()
          const profilePath = `clinicMedia/${clinicId}/profile-${Date.now()}.${extension}`
          const profileRef = storageRef(storage, profilePath)
          await uploadBytes(profileRef, profileImageFile.value)
          profilePictureUrl = await getDownloadURL(profileRef)
        }

        if (bannerImageFile.value) {
          const extension = (bannerImageFile.value.name?.split('.').pop() || 'jpg').toLowerCase()
          const bannerPath = `clinicMedia/${clinicId}/banner-${Date.now()}.${extension}`
          const bannerRef = storageRef(storage, bannerPath)
          await uploadBytes(bannerRef, bannerImageFile.value)
          bannerPictureUrl = await getDownloadURL(bannerRef)
        }

        const uniqueServices = editForm.value.services
          .map((entry) => normalizeService(entry))
          .filter(Boolean)
          .filter((entry, index, list) => list.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index)

        const payload = {
          businessEmail: (editForm.value.businessEmail || '').trim(),
          contactNumber: `+63${editForm.value.contactNumber}`,
          description: (editForm.value.description || '').trim(),
          services: uniqueServices,
          operatingHours: normalizeOperatingHours(editForm.value.operatingHours),
          profilePicture: profilePictureUrl,
          bannerPicture: bannerPictureUrl,
          updatedAt: serverTimestamp()
        }
        await updateDoc(doc(db, 'clinics', clinicId), payload)

        branches.value = branches.value.map((branch) =>
          branch.id === clinicId ? { ...branch, ...payload } : branch
        )

        if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
        if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
        profilePreviewUrl.value = ''
        bannerPreviewUrl.value = ''
        profileImageFile.value = null
        bannerImageFile.value = null

        isEditing.value = false
        toast.success('Branch clinic page updated.')
      } catch (error) {
        console.error('Failed to save clinic page info:', error)
        toast.error('Failed to save clinic info.')
      } finally {
        saving.value = false
      }
    }

    const togglePublish = async () => {
      if (!selectedBranch.value?.id || saving.value || isExpired.value) return
      saving.value = true
      try {
        const nextState = !(selectedBranch.value.isPublished === true)
        await updateDoc(doc(db, 'clinics', selectedBranch.value.id), {
          isPublished: nextState,
          updatedAt: serverTimestamp()
        })

        branches.value = branches.value.map((branch) =>
          branch.id === selectedBranch.value.id ? { ...branch, isPublished: nextState } : branch
        )

        toast.success(nextState ? 'Clinic page is now public.' : 'Clinic page is now hidden from public view.')
      } catch (error) {
        console.error('Failed to toggle publish state:', error)
        toast.error('Failed to update publish status.')
      } finally {
        saving.value = false
      }
    }

    let unsubscribeAuth = null
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          loading.value = false
          branches.value = []
          selectedBranchId.value = ''
          products.value = []
          reviews.value = []
          clinicPolicy.value = {}
          stopPolicyListener?.()
          stopPolicyListener = null
          return
        }
        await initSubscription()
        await loadOwnerBranches(user)
      })
    })

    watch([selectedBranchId, activeTab], async () => {
      await nextTick()
      await initBranchMap()
    })

    onUnmounted(() => {
      if (profilePreviewUrl.value) URL.revokeObjectURL(profilePreviewUrl.value)
      if (bannerPreviewUrl.value) URL.revokeObjectURL(bannerPreviewUrl.value)
      if (unsubscribeAuth) unsubscribeAuth()
      stopPolicyListener?.()
      if (branchMarker?.setMap) branchMarker.setMap(null)
      branchMap = null
      branchMarker = null
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
    })

    return {
      loading,
      branches,
      selectedBranchId,
      branchScopeLabel,
      selectedBranch,
      products,
      selectedListing,
      reviews,
      visiblePolicies,
      ownerEmail,
      activeTab,
      tabs,
      displayClinicName,
      clinicInitial,
      formatAmount,
      listingTitle,
      listingImage,
      listingType,
      listingDetails,
      openListingDetails,
      closeListingDetails,
      formatDate,
      renderStars,
      isEditing,
      saving,
      editForm,
      operatingHourDays,
      formatOperatingHours,
      startEdit,
      cancelEdit,
      saveEdit,
      togglePublish,
      selectBranch,
      branchMapEl,
      branchCoordinates,
      mapLoading,
      mapError,
      serviceInput,
      handleServiceKeydown,
      commitServiceInput,
      removeServiceTag,
      handleProfileUpload,
      handleBannerUpload,
      isExpired
    }
  }
}
</script>

