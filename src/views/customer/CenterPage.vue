<template>
  <div class="customer-center-page flex customer-theme min-h-screen bg-[#efe3d0]">
    <CustomerSidebar class="flex-shrink-0" />

    <main class="center-main flex-1 p-4 md:p-8">
      <button
        type="button"
        class="mb-4 inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        @click="goBack"
      >
        <span class="text-lg leading-none">‹</span>
        <span class="text-sm font-medium">Back</span>
      </button>

      <div class="center-shell overflow-hidden">
        <div class="relative h-56 md:h-72">
          <img v-if="center.bannerPicture" :src="center.bannerPicture" alt="Clinic banner" class="w-full h-full object-cover" />
          <div v-else class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,227,197,0.95),_rgba(196,149,107,0.88)_42%,_rgba(113,74,50,0.94)_100%)]"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-[rgba(33,18,10,0.48)] via-[rgba(33,18,10,0.08)] to-transparent"></div>
        </div>

        <div class="px-4 md:px-8 pb-8">
          <div class="relative -mt-16 md:-mt-20 z-10 flex flex-col md:flex-row md:items-end gap-4">
            <div class="center-avatar h-28 w-28 md:h-36 md:w-36 rounded-full overflow-hidden shadow-[0_18px_40px_rgba(72,43,26,0.22)]">
              <img v-if="center.profilePicture" :src="center.profilePicture" alt="Clinic profile" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 pt-1 md:pt-0">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 class="text-3xl md:text-5xl font-bold text-[#3d281d]">{{ center.name || 'Center' }}</h1>
                  <p class="mt-2 text-[#6f4a2d]">{{ center.location || 'Location not set' }}</p>
                </div>
              </div>
            </div>
          </div>

          <div v-if="branchOptions.length > 1" class="mt-5 rounded-[1.5rem] border border-[#e0c09a] bg-[rgba(255,250,243,0.95)] p-4 shadow-[0_18px_44px_rgba(87,56,35,0.08)]">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6a4d]">Branch Selector</p>
                <p class="mt-1 text-sm text-[#6f4a2d]">
                  Choose a branch to view its products, services, and booking availability.
                </p>
              </div>
              <div class="w-full md:w-[340px]">
                <select
                  v-model="selectedBranchId"
                  class="w-full rounded-2xl border border-[#e0c09a] bg-[#fffaf3] px-4 py-3 text-[#3d281d] shadow-sm outline-none transition focus:border-[#c99563] focus:ring-4 focus:ring-[#e8bf8a]/30"
                  @change="selectBranch"
                >
                  <option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">
                    {{ branch.label }}
                  </option>
                </select>
              </div>
            </div>
            <p class="mt-3 text-xs text-[#8b6a4d]">
              Showing: <span class="font-semibold text-[#3d281d]">{{ selectedBranchLabel }}</span>
            </p>
          </div>

          <div class="mt-6 border-t border-[#ebd6bc] pt-4">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab"
                @click="activeTab = tab"
                :class="[
                  'center-tab-button px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                  activeTab === tab
                    ? 'is-active'
                    : ''
                ]"
              >
                {{ tab }}
              </button>
            </div>
          </div>

          <div class="mt-6">
          <div v-if="activeTab === 'About Us'">
            <div class="center-panel p-5">
              <h3 class="center-panel-title mb-2">Description</h3>
              <p class="center-panel-copy leading-relaxed">
                {{ center.description || 'No description available yet.' }}
              </p>
            </div>

            <div class="center-panel mt-4 p-5">
              <h3 class="center-panel-title mb-2">Offered Services</h3>
              <div v-if="center.services.length" class="flex flex-wrap gap-2">
                <span
                  v-for="(service, index) in center.services"
                  :key="`center-service-${index}-${service}`"
                  class="center-service-pill inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                >
                  {{ service }}
                </span>
              </div>
              <p v-else class="center-panel-copy text-sm">No services listed yet.</p>
            </div>

            <div class="center-panel-grid mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="center-panel p-5">
                <h4 class="center-panel-title mb-2">Contact</h4>
                <p class="center-panel-copy text-sm">Email: {{ center.businessEmail || center.email || 'Not set' }}</p>
                <p class="center-panel-copy text-sm mt-1">Phone: {{ center.contactNumber || 'Not set' }}</p>
              </div>
              <div class="center-panel p-5">
                <h4 class="center-panel-title mb-2">Address</h4>
                <p class="center-panel-copy text-sm">{{ center.location || 'Not set' }}</p>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'Products & Services'">
            <div class="center-toolbar flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
              <div class="flex w-full md:w-auto gap-3">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search..."
                  class="center-search-input px-3 py-2 rounded-2xl"
                />
              </div>
              <button @click="goToCart" class="center-cart-button px-4 py-2 rounded-2xl text-white">
                My Cart ({{ cartCount }})
              </button>
            </div>

            <div v-if="loading" class="center-muted-state py-10">Loading products and services...</div>
            <div v-else-if="!filteredProducts.length && !filteredServices.length && !filteredConsultations.length" class="center-muted-state py-10">
              No matching products, services, or consultations found.
            </div>

            <div v-else class="space-y-8">
              <section class="center-section-card p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="center-kicker">Products</p>
                    <h3 class="mt-1 text-xl font-semibold text-[#3d281d]">Available Products</h3>
                  </div>
                  <span class="center-count-pill px-3 py-1 text-xs font-medium">
                    {{ filteredProducts.length }}
                  </span>
                </div>

                <div v-if="filteredProducts.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredProducts" :key="item.id" class="center-item-card overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-[#3d281d]">{{ item.title || item.name }}</h3>
                      <p class="mt-2 text-[#8b6a4d]">PHP {{ Number(item.price || 0).toFixed(2) }}</p>
                      <p class="mt-1 text-sm text-[#6f4a2d]">{{ item.description || 'No description.' }}</p>

                      <div class="mt-4 flex items-center space-x-2">
                        <button @click="addToCart(item)" class="center-action-button px-3 py-2 rounded-xl text-white">
                          Add to Cart
                        </button>
                        <input type="number" min="1" v-model.number="item.quantity" class="center-qty-input w-16 px-2 py-1 rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="center-muted-state text-sm">No products posted yet.</p>
              </section>

              <section class="center-section-card p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="center-kicker">Services</p>
                    <h3 class="mt-1 text-xl font-semibold text-[#3d281d]">Services Offered</h3>
                  </div>
                  <span class="center-count-pill px-3 py-1 text-xs font-medium">
                    {{ filteredServices.length }}
                  </span>
                </div>

                <div v-if="filteredServices.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredServices" :key="item.id" class="center-item-card overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-[#3d281d]">{{ item.title || item.name }}</h3>
                      <p class="mt-2 text-[#8b6a4d]">PHP {{ Number(item.price || 0).toFixed(2) }}</p>
                      <p class="mt-1 text-sm text-[#6f4a2d]">{{ item.description || 'No description.' }}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span
                          v-if="item.requiresConsultationFirst"
                          class="center-badge center-badge-warm px-2 py-1 text-[11px] font-medium"
                        >
                          Consultation required
                        </span>
                        <span
                          v-if="item.requiresConsultationFirst && item.consultationFee != null"
                          class="center-badge center-badge-warm px-2 py-1 text-[11px] font-medium"
                        >
                          Fee PHP {{ Number(item.consultationFee || 0).toFixed(2) }}
                        </span>
                        <span
                          v-if="item.followUpAllowed"
                          class="center-badge center-badge-soft px-2 py-1 text-[11px] font-medium"
                        >
                          Follow-up allowed
                        </span>
                        <span
                          v-if="item.durationMinutes"
                          class="center-badge center-badge-soft px-2 py-1 text-[11px] font-medium"
                        >
                          {{ item.durationMinutes }} mins
                        </span>
                      </div>

                      <div class="mt-4">
                        <button
                          @click="toggleServiceForBooking(item)"
                          :class="[
                            'center-action-button px-3 py-2 rounded-xl text-white',
                            isServiceSelected(item)
                              ? 'is-warm'
                              : 'is-cool'
                          ]"
                        >
                          {{ isServiceSelected(item) ? 'Selected for Booking' : 'Add to Booking' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="center-muted-state text-sm">No services posted yet.</p>
              </section>

              <section class="center-section-card p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="center-kicker">Consultations</p>
                    <h3 class="mt-1 text-xl font-semibold text-[#3d281d]">Consultation Posts</h3>
                  </div>
                  <span class="center-count-pill px-3 py-1 text-xs font-medium">
                    {{ filteredConsultations.length }}
                  </span>
                </div>

                <div v-if="filteredConsultations.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredConsultations" :key="item.id" class="center-item-card overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-[#3d281d]">{{ item.title || item.name }}</h3>
                      <p class="mt-2 text-[#8b6a4d]">PHP {{ Number(item.consultationFee || item.price || 0).toFixed(2) }}</p>
                      <p class="mt-1 text-sm text-[#6f4a2d]">{{ item.description || 'No description.' }}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span class="center-badge center-badge-warm px-2 py-1 text-[11px] font-medium">
                          Consultation
                        </span>
                        <span
                          v-if="item.durationMinutes"
                          class="center-badge center-badge-soft px-2 py-1 text-[11px] font-medium"
                        >
                          {{ item.durationMinutes }} mins
                        </span>
                      </div>
                      <p class="mt-3 text-xs font-semibold text-[#8b6a4d]">
                        Book this separately from regular services.
                      </p>
                      <div class="mt-4">
                        <button
                          @click="toggleConsultationForBooking(item)"
                          :class="[
                            'center-action-button px-3 py-2 rounded-xl text-white',
                            isConsultationSelected(item)
                              ? 'is-warm'
                              : 'is-cool'
                          ]"
                        >
                          {{ isConsultationSelected(item) ? 'Selected for Booking' : 'Book Consultation' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="center-muted-state text-sm">No consultation posts yet.</p>
              </section>
            </div>

            <div v-if="selectedServices.length" class="booking-panel center-booking-panel mt-8 rounded-2xl border p-6">
              <div>
                <h4 class="center-panel-title text-lg font-semibold mb-1">Book Appointment</h4>
                <p class="center-panel-copy text-xs">Choose one or more services, then pick a schedule from the calendar.</p>
              </div>

              <div class="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_340px] gap-4 items-start">
                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6a4d]">Appointment Date</label>
                  <div class="booking-calendar rounded-2xl border p-4">
                    <p v-if="bookingAvailabilityHint" class="mb-4 rounded-xl border border-[#e8c494]/70 bg-[#fff5e6] px-3 py-2 text-xs text-[#8b6a4d]">
                      {{ bookingAvailabilityHint }}
                    </p>
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e0c09a] text-[#6f4a2d] transition hover:bg-[#f6ead8] disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canGoToPreviousBookingMonth"
                        @click="changeBookingCalendarMonth(-1)"
                      >
                        <Icon icon="mdi:chevron-left" class="h-5 w-5" />
                      </button>
                      <p class="text-sm font-semibold text-[#3d281d]">{{ bookingCalendarMonthLabel }}</p>
                      <button
                        type="button"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e0c09a] text-[#6f4a2d] transition hover:bg-[#f6ead8] disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canGoToNextBookingMonth"
                        @click="changeBookingCalendarMonth(1)"
                      >
                        <Icon icon="mdi:chevron-right" class="h-5 w-5" />
                      </button>
                    </div>

                    <div class="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6a4d]">
                      <span v-for="day in bookingCalendarWeekdays" :key="day">{{ day }}</span>
                    </div>
                    <div class="mt-2 grid grid-cols-7 gap-2">
                      <button
                        v-for="day in bookingCalendarDays"
                        :key="day.dateKey"
                        type="button"
                        class="booking-day aspect-square rounded-xl border text-sm font-medium transition flex flex-col items-center justify-between py-2"
                        :class="[
                          day.isSelected ? 'is-selected shadow-lg shadow-amber-900/30' : '',
                          day.isAvailable ? 'is-available' : '',
                          !day.isAvailable ? 'is-disabled' : '',
                          day.inCurrentMonth ? '' : 'opacity-55'
                        ]"
                        :disabled="!day.isAvailable"
                        @click="selectBookingDate(day.dateKey)"
                      >
                        <span class="leading-none">{{ day.dayNumber }}</span>
                        <span
                          class="booking-day-dot"
                          :class="day.isSelected ? 'booking-day-dot-selected' : day.isAvailable ? 'booking-day-dot-available' : 'booking-day-dot-disabled'"
                        ></span>
                      </button>
                    </div>
                    <p class="mt-4 text-xs text-[#8b6a4d]">{{ selectedBookingDateLabel }}</p>
                  </div>
                </div>
                <div class="space-y-4">
                  <div class="booking-sidecard rounded-2xl border p-4 text-[#3d281d]">
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6a4d]">Selected Services</p>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <span
                        v-for="service in selectedServices"
                        :key="service.id"
                        class="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200"
                      >
                        {{ service.title || service.name }}
                        <button type="button" class="text-amber-100 hover:text-white" @click="removeSelectedService(service.id)">
                          <Icon icon="mdi:close" class="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                    <p v-if="bookingRulesNotice" class="mt-3 text-xs text-amber-200">{{ bookingRulesNotice }}</p>
                  </div>
                  <div class="booking-sidecard rounded-2xl border p-4 text-[#3d281d]">
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6a4d]">Selected Schedule</p>
                    <p class="mt-3 text-sm font-semibold text-[#3d281d]">{{ bookingScheduleSummary }}</p>
                    <p class="mt-2 text-sm text-[#8b6a4d]">
                      Assigned Practitioner:
                      <span class="ml-1 font-semibold text-[#3d281d]">{{ assignedPractitioner?.fullName || '-' }}</span>
                    </p>
                    <p class="mt-3 text-xs text-[#8b6a4d]">
                      Full payment due:
                      <span class="ml-1 font-semibold text-[#3d281d]">PHP {{ bookingDueAmount.toFixed(2) }}</span>
                    </p>
                    <p class="mt-1 text-xs text-[#8b6a4d]">
                      System commission ({{ serviceCommissionPercent }}%):
                      <span class="ml-1 font-semibold text-[#3d281d]">PHP {{ bookingCommissionAmount.toFixed(2) }}</span>
                    </p>
                    <p class="mt-1 text-xs text-[#8b6a4d]">
                      Clinic share:
                      <span class="ml-1 font-semibold text-[#3d281d]">PHP {{ bookingNetAmount.toFixed(2) }}</span>
                    </p>
                    <p v-if="selectedServiceDurationMinutes" class="mt-1 text-xs text-[#8b6a4d]">
                      Total duration:
                      <span class="ml-1 font-semibold text-[#3d281d]">{{ selectedServiceDurationMinutes }} mins</span>
                    </p>
                    <div class="mt-4 border-t border-[#e6cfb0] pt-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b6a4d]">Time Slots</p>
                      <div v-if="slotsForSelectedDate.length" class="mt-3 grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                        <button
                          v-for="slot in slotsForSelectedDate"
                          :key="slot.key"
                          type="button"
                          class="booking-slot rounded-xl border px-3 py-3 text-left transition"
                          :class="[
                            bookingForm.slotKey === slot.key ? 'is-selected' : '',
                            slot.isAvailable ? '' : 'is-disabled'
                          ]"
                          :disabled="!slot.isAvailable"
                          @click="selectBookingSlot(slot)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <p class="text-sm font-semibold">
                              Starts at {{ minutesToTime12(parseClockToMinutes(slot.time)) }}
                            </p>
                            <span v-if="!slot.isAvailable" class="rounded-full border border-[#d9be9b] bg-[#fff7ec] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b6a4d]">
                              Unavailable
                            </span>
                          </div>
                        </button>
                      </div>
                      <div v-else class="mt-3 rounded-xl border border-dashed border-[#d9be9b] bg-[#fff7ec] px-4 py-6 text-sm text-[#6f4a2d]">
                        {{ hasBookingAvailability ? 'No available time slots for the selected date.' : 'No booking schedule is available yet for this branch.' }}
                      </div>
                    </div>
                    <div class="mt-4 border-t border-[#e6cfb0] pt-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6a4d]">Payment Method</p>
                      <div class="mt-2 grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'E-Wallet'
                            ? 'border-[#c99563] bg-[#fff1df] text-[#3d281d]'
                            : 'border-[#e0c09a] bg-[#fffaf3] text-[#6f4a2d] hover:bg-[#fff2e1]'"
                          @click="bookingPaymentMethod = 'E-Wallet'"
                        >
                          <span class="block font-semibold">E-Wallet</span>
                          <span class="mt-1 block text-xs opacity-80">GCash only.</span>
                        </button>
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'Card'
                            ? 'border-[#c99563] bg-[#fff1df] text-[#3d281d]'
                            : 'border-[#e0c09a] bg-[#fffaf3] text-[#6f4a2d] hover:bg-[#fff2e1]'"
                          @click="bookingPaymentMethod = 'Card'"
                        >
                          <span class="block font-semibold">Card</span>
                          <span class="mt-1 block text-xs opacity-80">Use credit or debit card.</span>
                        </button>
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'Bank Transfer'
                            ? 'border-[#c99563] bg-[#fff1df] text-[#3d281d]'
                            : 'border-[#e0c09a] bg-[#fffaf3] text-[#6f4a2d] hover:bg-[#fff2e1]'"
                          @click="bookingPaymentMethod = 'Bank Transfer'"
                        >
                          <span class="block font-semibold">Bank Transfer</span>
                          <span class="mt-1 block text-xs opacity-80">Uses the bank options from subscription checkout.</span>
                        </button>
                      </div>
                      <div class="mt-3">
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6a4d]">
                          Mobile Number <span v-if="bookingPaymentMethod === 'E-Wallet'">*</span>
                        </label>
                        <div class="mt-1 flex items-stretch overflow-hidden rounded-xl border bg-[#fffaf3]" :class="bookingPhoneError ? 'border-rose-400' : 'border-[#e0c09a]'">
                          <span class="inline-flex items-center border-r border-[#e0c09a] px-3 text-sm font-semibold text-[#6f4a2d]">+63</span>
                          <input
                            v-model.trim="bookingForm.contactNumber"
                            type="tel"
                            inputmode="tel"
                            autocomplete="tel"
                            maxlength="10"
                            pattern="[0-9]{10}"
                            placeholder="9123456789"
                            class="w-full bg-transparent px-3 py-3 text-sm text-[#3d281d] placeholder:text-[#a78a6e] focus:outline-none"
                            :required="bookingPaymentMethod === 'E-Wallet'"
                            :aria-invalid="Boolean(bookingPhoneError)"
                            :aria-describedby="bookingPhoneError ? 'booking-phone-error' : undefined"
                            @input="handleBookingPhoneInput"
                            @blur="validateBookingPhoneNumber"
                          />
                        </div>
                        <p class="mt-1 text-xs text-[#8b6a4d]">
                          {{ bookingPaymentMethod === 'E-Wallet' ? 'Required for GCash checkout.' : 'Optional unless you want to prefill your contact number.' }}
                        </p>
                        <p v-if="bookingPhoneError" id="booking-phone-error" class="mt-1 text-xs text-rose-600">{{ bookingPhoneError }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="availabilityMessage" class="booking-notice mt-2 text-xs">{{ availabilityMessage }}</p>
              <textarea v-model="bookingForm.notes" rows="3" class="mt-4 w-full px-3 py-3 rounded-2xl bg-[#fffaf3] text-[#3d281d] border border-[#e0c09a] placeholder:text-[#a78a6e] focus:outline-none focus:ring-4 focus:ring-[#e8bf8a]/20" placeholder="Notes (optional)"></textarea>
              <div class="mt-4 flex gap-3">
                <button
                  @click="submitBooking"
                  :disabled="bookingPaymentSaving"
                  class="px-4 py-2 rounded-2xl bg-[#8d5a3b] hover:bg-[#6f4329] text-white shadow-md shadow-amber-950/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ bookingPaymentSaving ? 'Processing...' : 'Confirm Booking' }}
                </button>
                <button @click="clearBookingSelection" class="px-4 py-2 rounded-2xl border border-[#e0c09a] bg-[#fffaf3] text-[#6f4a2d] hover:bg-[#fff2e1]">Cancel</button>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'Reviews'">
            <div v-if="reviews.length === 0" class="center-muted-state italic">No reviews yet.</div>
            <div v-else class="space-y-3">
              <article
                v-for="review in reviews"
                :key="review.id"
                class="center-review-card p-4"
              >
                <p class="font-medium text-[#3d281d]">{{ review.reviewerName || 'Anonymous' }}</p>
                <p class="mt-2 text-[#6f4a2d]">"{{ review.comment || 'No comment' }}"</p>
              </article>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
    <button
      type="button"
      class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#8d5a3b] text-white shadow-lg hover:bg-[#6f4329] transition flex items-center justify-center"
      title="Chat with clinic"
      @click="openChat"
    >
      <Icon icon="mdi:chat-processing-outline" class="h-6 w-6" />
      <span
        v-if="unreadChatCount > 0"
        class="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-red-500 text-[11px] leading-5 text-white font-semibold flex items-center justify-center"
      >
        {{ unreadChatCount }}
      </span>
    </button>

    <div v-if="showChatModal" class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[rgba(31,18,11,0.55)] p-4 backdrop-blur-sm">
      <div class="w-full max-w-lg rounded-[1.75rem] border border-[#e0c09a] bg-[#fffaf3] shadow-[0_30px_80px_rgba(60,34,18,0.26)]">
        <div class="flex items-center justify-between border-b border-[#efd7ba] px-4 py-3">
          <div>
            <h3 class="font-semibold text-[#3d281d]">Chat with {{ center.name || 'Clinic' }}</h3>
            <p class="text-xs text-[#8b6a4d]">This chat is for inquiries and appointments.</p>
          </div>
          <button type="button" class="text-[#8b6a4d] hover:text-[#3d281d]" @click="closeChat">
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
        <div class="px-4 pt-4">
          <p class="mb-2 text-xs text-[#8b6a4d]">Quick questions</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="question in quickQuestions"
              :key="question.key"
              type="button"
              class="rounded-full border border-[#e0c09a] bg-[#fff2e1] px-3 py-1.5 text-xs text-[#6f4a2d] transition hover:bg-[#ffe8cc]"
              @click="sendQuickQuestion(question)"
            >
              {{ question.label }}
            </button>
          </div>
        </div>
        <div ref="chatScrollRef" class="px-4 py-4 max-h-[45vh] overflow-y-auto space-y-3">
          <div v-if="chatMessages.length === 0" class="text-center text-sm text-[#8b6a4d]">No messages yet. Say hello!</div>
          <div
            v-for="message in chatMessages"
            :key="message.id"
            class="flex"
            :class="message.senderId === currentUserId ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
              :class="message.senderRole === 'system'
                ? 'bg-[#8d5a3b] text-white'
                : message.senderId === currentUserId
                  ? 'bg-[#6f4329] text-white'
                  : 'bg-[#f5eadc] text-[#3d281d]'"
            >
              <p class="whitespace-pre-wrap">{{ message.text }}</p>
              <p class="mt-1 text-[10px] text-[#a78a6e]">
                {{ formatChatTime(message.createdAt) }}
              </p>
            </div>
          </div>
        </div>
        <div class="border-t border-[#efd7ba] px-4 py-3">
          <div class="flex items-center gap-2">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Type your message..."
              class="flex-1 rounded-2xl border border-[#e0c09a] bg-white px-3 py-2 text-[#3d281d] placeholder:text-[#a78a6e] focus:outline-none focus:ring-4 focus:ring-[#e8bf8a]/20"
            />
            <button
              type="button"
              class="rounded-2xl bg-[#8d5a3b] px-3 py-2 text-white transition hover:bg-[#6f4329]"
              @click="sendChat"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { addCartItem, readCart } from '@/utils/customerCart'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'
import { calculateCommissionAmount, calculateNetAmount, getServiceCommissionPercent } from '@/utils/transactionFees'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import { OTP_API_BASE } from '@/utils/runtimeConfig'

const route = useRoute()
const router = useRouter()
const centerId = String(route.params.id || '')

const tabs = ['About Us', 'Products & Services', 'Reviews']
const activeTab = ref('About Us')
const loading = ref(true)
const reviews = ref([])
const items = ref([])
const searchQuery = ref('')
const cartCount = ref(0)
const showChatModal = ref(false)
const chatInput = ref('')
const chatMessages = ref([])
const currentUserId = ref('')
const chatThreadId = ref('')
const chatScrollRef = ref(null)
const customerProfile = ref(null)
const unreadChatCount = ref(0)
const customerLastReadAt = ref(null)
let savedPageBodyOverflow = ''
let savedPageHtmlOverflow = ''
const quickQuestions = [
  { key: 'services', label: 'What services do you offer?' },
  { key: 'contact', label: 'How can I contact you?' },
  { key: 'location', label: 'Where are you located?' },
  { key: 'price', label: 'What is your price range?' },
  { key: 'booking', label: 'How do I book an appointment?' },
]
let chatUnsubscribe = null
let threadUnsubscribe = null
let unreadUnsubscribe = null
let appointmentsUnsubscribe = null
let bookingReservationsUnsubscribe = null
const selectedServices = ref([])
const fallbackImage = 'https://via.placeholder.com/300x200?text=AesthetiCare'
const bookingPaymentMethod = ref('E-Wallet')
const bookingBankTransferPaymentTypes = ['dob', 'dob_ubp', 'brankas_bdo', 'brankas_landbank', 'brankas_metrobank']
const bookingPaymentTypes = computed(() =>
  bookingPaymentMethod.value === 'Bank Transfer'
    ? bookingBankTransferPaymentTypes
    : bookingPaymentMethod.value === 'Card'
      ? ['card']
      : ['gcash']
)
const bookingPaymentSaving = ref(false)
const bookingPhoneError = ref('')
const bookingPaymentPendingKey = 'customer_booking_pending_paymongo'
const serviceCommissionPercent = getServiceCommissionPercent()
const branches = ref([])
const selectedBranchId = ref(centerId)
const activeBranchId = computed(() => String(selectedBranchId.value || centerId).trim() || centerId)
const branchOptions = computed(() =>
  branches.value.map((branch) => ({
    ...branch,
    label: `${branch.name}${branch.location ? ` - ${branch.location}` : ''}${branch.isMainBranch ? ' (Main)' : ''}`
  }))
)
const selectedBranchLabel = computed(() => {
  const branch = branchOptions.value.find((entry) => entry.id === activeBranchId.value)
  return branch ? branch.label : 'Selected branch'
})
const practitioners = ref([])
const practitionerSchedules = ref({})
const appointments = ref([])
const bookingReservations = ref([])
const assignedPractitioner = ref(null)
const availabilityMessage = ref('')
const hasBookingAvailability = computed(() => bookingSlots.value.length > 0)
const bookingAvailabilityHint = computed(() => {
  if (hasBookingAvailability.value) return ''
  if (!practitioners.value.length) {
    return 'Booking is not available yet because this branch has no practitioners with consultation access.'
  }
  if (!Object.keys(practitionerSchedules.value || {}).length) {
    return 'Booking is not available yet because no practitioner schedules have been assigned yet.'
  }
  return 'Booking is not available yet because no time slots can be generated from the current schedules.'
})
const selectedServiceTotal = computed(() =>
  selectedServices.value.reduce((sum, service) => sum + Number(service.price || 0), 0)
)
const selectedServiceDurationMinutes = computed(() =>
  selectedServices.value.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0)
)
const bookingDurationMinutes = computed(() => Math.max(Number(selectedServiceDurationMinutes.value || 0), 30))
const selectedServiceCommission = computed(() =>
  calculateCommissionAmount(selectedServiceTotal.value, serviceCommissionPercent)
)
const bookingDueAmount = computed(() => selectedServiceTotal.value)
const bookingCommissionAmount = computed(() => selectedServiceCommission.value)
const bookingNetAmount = computed(() => selectedServiceNetAmount.value)
const selectedServiceNetAmount = computed(() =>
  calculateNetAmount(selectedServiceTotal.value, selectedServiceCommission.value)
)
const selectedServicesRequireConsultation = computed(() =>
  selectedServices.value.some((service) => Boolean(service.requiresConsultationFirst))
)
const selectedServicesAllowFollowUp = computed(() =>
  selectedServices.value.some((service) => Boolean(service.followUpAllowed))
)

const normalizeAppointmentStatus = (value) => String(value || '').trim().toLowerCase()

const getAppointmentDurationMinutes = (appointment) => {
  const explicitDuration = Number(
    appointment?.totalServiceDurationMinutes ||
    appointment?.consultationForServiceDurationMinutes ||
    appointment?.consultationDurationMinutes ||
    appointment?.durationMinutes ||
    0
  )
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) return explicitDuration

  const serviceDurations = Array.isArray(appointment?.serviceDurations)
    ? appointment.serviceDurations.map((value) => Number(value || 0)).filter((value) => value > 0)
    : []
  if (serviceDurations.length) {
    return serviceDurations.reduce((sum, value) => sum + value, 0)
  }

  return 60
}

const buildBlockedRanges = (appointmentList = []) => {
  const blocked = new Map()
  const blockingStatuses = new Set(['scheduled', 'approved', 'paid', 'cancellation requested', 'reschedule requested', 'completed', 'in progress', 'ongoing', 'held'])

  appointmentList.forEach((appointment) => {
    const date = String(appointment?.date || '').trim()
    const practitionerId = String(
      appointment?.assignedPractitionerId || appointment?.practitionerId || ''
    ).trim()
    const status = normalizeAppointmentStatus(appointment?.status)
    if (!date || !practitionerId || !blockingStatuses.has(status)) return

    const start = parseClockToMinutes(appointment?.time)
    if (start === null) return
    const appointmentDuration = getAppointmentDurationMinutes(appointment)
    const end = parseClockToMinutes(appointment?.endTime)
    const normalizedEnd =
      end !== null && end > start
        ? end
        : start + appointmentDuration

    const key = `${date}|${practitionerId}`
    const nextList = blocked.get(key) || []
    nextList.push({ start, end: normalizedEnd })
    blocked.set(key, nextList)
  })

  return blocked
}

const overlapsBlockedRange = (candidateStart, candidateEnd, blockedRanges = []) =>
  blockedRanges.some((range) => candidateStart < range.end && candidateEnd > range.start)
const bookingRulesNotice = computed(() => {
  if (!selectedServices.value.length) return ''
  const notices = []
  if (selectedServicesRequireConsultation.value) {
    notices.push('Please make sure you have consulted first before booking this service.')
  }
  if (selectedServicesAllowFollowUp.value) {
    notices.push('Follow-up support is available for at least one selected service.')
  }
  return notices.join(' ')
})

const center = ref({
  id: centerId,
  name: '',
  location: '',
  description: '',
  email: '',
  businessEmail: '',
  contactNumber: '',
  services: [],
  profilePicture: '',
  bannerPicture: '',
  status: '',
  moderationStatus: '',
  isPublished: false,
})

const buildCenterModel = (branchId, data = {}) => ({
  id: branchId,
  name: data.clinicName || data.clinicBranch || 'Center',
  location: data.clinicLocation || '',
  description: data.description || '',
  email: data.email || '',
  businessEmail: data.businessEmail || '',
  contactNumber: data.contactNumber || '',
  services: Array.isArray(data.services) ? data.services.filter(Boolean) : [],
  profilePicture: data.profilePicture || '',
  bannerPicture: data.bannerPicture || '',
  status: String(data.status || '').trim(),
  moderationStatus: String(data.moderationStatus || '').trim(),
  isPublished: data.isPublished === true,
})

const syncSelectedBranchInUrl = async (branchId) => {
  const nextQuery = { ...route.query }
  if (branchId && branchId !== centerId) {
    nextQuery.branch = branchId
  } else {
    delete nextQuery.branch
  }

  const currentBranchQuery = String(route.query.branch || '').trim()
  const nextBranchQuery = String(nextQuery.branch || '').trim()
  if (currentBranchQuery === nextBranchQuery) return

  await router.replace({
    name: 'customer-center',
    params: { id: centerId },
    query: nextQuery,
  }).catch(() => {})
}

const stopBranchSensitiveListeners = () => {
  stopChatListener()
  if (threadUnsubscribe) {
    threadUnsubscribe()
    threadUnsubscribe = null
  }
  if (unreadUnsubscribe) {
    unreadUnsubscribe()
    unreadUnsubscribe = null
  }
  if (appointmentsUnsubscribe) {
    appointmentsUnsubscribe()
    appointmentsUnsubscribe = null
  }
  if (bookingReservationsUnsubscribe) {
    bookingReservationsUnsubscribe()
    bookingReservationsUnsubscribe = null
  }
  if (bookingReservations.value.length) {
    bookingReservations.value = []
  }
  chatThreadId.value = ''
  chatMessages.value = []
  unreadChatCount.value = 0
  appointments.value = []
}

const selectBranch = async () => {
  const nextBranchId = activeBranchId.value
  if (!nextBranchId) return

  loading.value = true
  stopBranchSensitiveListeners()
  selectedServices.value = []
  assignedPractitioner.value = null
  availabilityMessage.value = ''
  bookingForm.value = {
    slotKey: '',
    date: '',
    time: '',
    endTime: '',
    notes: '',
  }
  items.value = []
  reviews.value = []
  practitioners.value = []
  practitionerSchedules.value = {}

  try {
    await syncSelectedBranchInUrl(nextBranchId)
    await loadBranchData(nextBranchId)
    syncCartCount()
    if (auth.currentUser) {
      currentUserId.value = auth.currentUser.uid
      await startUnreadListener()
    }
  } catch (error) {
    console.error(error)
    toast.error('Failed to load the selected branch.')
  } finally {
    loading.value = false
  }
}

const bookingForm = ref({
  slotKey: '',
  date: '',
  time: '',
  endTime: '',
  contactNumber: '',
  notes: '',
})

const setPageScrollLocked = (locked) => {
  if (typeof document === 'undefined') return
  if (locked) {
    savedPageBodyOverflow = document.body.style.overflow
    savedPageHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return
  }
  document.body.style.overflow = savedPageBodyOverflow || ''
  document.documentElement.style.overflow = savedPageHtmlOverflow || ''
}

const SLOT_STEP_MINUTES = 30
const SLOT_DAYS_LOOKAHEAD = 365
const bookingCalendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const parseClockToMinutes = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (hhmm) {
    const hour = Number(hhmm[1])
    const minute = Number(hhmm[2])
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/)
  if (!ampm) return null

  let hour = Number(ampm[1])
  const minute = Number(ampm[2])
  const marker = ampm[3].toUpperCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null
  if (marker === 'PM' && hour !== 12) hour += 12
  if (marker === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

const minutesToTime = (value) => {
  if (!Number.isFinite(value)) return ''
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins}`
}

const minutesToTime12 = (value) => {
  if (!Number.isFinite(value)) return ''
  const minutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
  const rawHours = Math.floor(minutes / 60)
  const mins = String(minutes % 60).padStart(2, '0')
  const period = rawHours >= 12 ? 'PM' : 'AM'
  const hour12 = rawHours % 12 === 0 ? 12 : rawHours % 12
  return `${hour12}:${mins} ${period}`
}

const toDateInput = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const parseDateInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getWeekStartKey = (date) => {
  const currentDay = date.getDay()
  const diffToMonday = (currentDay + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMonday)
  return toDateInput(monday)
}

const extractShiftWindowMinutes = (shiftLabel) => {
  const label = String(shiftLabel || '').trim()
  if (!label) return null
  const base = label.includes('||') ? String(label.split('||').pop() || '').trim() : label
  const [startRaw, endRaw] = base.split('-').map((part) => String(part || '').trim())
  if (!startRaw || !endRaw) return null
  const start = parseClockToMinutes(startRaw)
  const end = parseClockToMinutes(endRaw)
  if (start === null || end === null) return null
  return { start, end }
}

const loadPractitionerSchedules = async (list) => {
  const pairs = await Promise.all(
    list.map(async (practitioner) => {
      const scheduleSnap = await getDocs(collection(db, 'users', practitioner.id, 'schedules'))
      const weekMap = buildWeekScheduleMap(scheduleSnap.docs.map((snap) => ({ id: snap.id, data: snap.data() || {} })))
      return [practitioner.id, weekMap]
    })
  )
  practitionerSchedules.value = Object.fromEntries(pairs)
}

const startAppointmentsListener = async (branchId) => {
  if (appointmentsUnsubscribe) {
    appointmentsUnsubscribe()
    appointmentsUnsubscribe = null
  }

  const appointmentsQuery = query(collection(db, 'appointments'), where('branchId', '==', branchId))
  appointmentsUnsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
    appointments.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  })
}

const startBookingReservationsListener = async (branchId) => {
  if (bookingReservationsUnsubscribe) {
    bookingReservationsUnsubscribe()
    bookingReservationsUnsubscribe = null
  }

  const reservationsQuery = query(collection(db, 'bookingReservations'), where('branchId', '==', branchId))
  bookingReservationsUnsubscribe = onSnapshot(reservationsQuery, (snapshot) => {
    bookingReservations.value = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  })
}

const fetchBranchAppointmentsSnapshot = async (branchId) => {
  const snapshot = await getDocs(query(collection(db, 'appointments'), where('branchId', '==', branchId)))
  return snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
}

const loadPractitioners = async (branchId = activeBranchId.value) => {
  const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
  const ownerId = clinicSnap.exists() ? String(clinicSnap.data()?.ownerId || '').trim() : ''
  const allowedRoleIds = new Set()

  if (ownerId) {
    const rolesSnap = await getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
    rolesSnap.docs.forEach((roleDoc) => {
      const data = roleDoc.data() || {}
      const permissions = Array.isArray(data.permissions)
        ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
        : []
      if (permissions.includes('consultations:view')) {
        allowedRoleIds.add(roleDoc.id)
      }
    })
  }

  if (!allowedRoleIds.size) {
    practitioners.value = []
    practitionerSchedules.value = {}
    return
  }

  const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', '==', branchId)))
  const list = snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .filter((user) => {
      const userType = String(user.userType || '').trim().toLowerCase()
      const customRoleId = String(user.customRoleId || '').trim()
      return userType === 'staff' && !user.archived && allowedRoleIds.has(customRoleId)
    })
    .map((user) => ({
      ...user,
      fullName:
        String(user.fullName || '').trim() ||
        `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim() ||
        'Unnamed Practitioner'
    }))
    .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')))
  practitioners.value = list
  await loadPractitionerSchedules(list)
}

const loadBranchData = async (branchId) => {
  const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
  if (!clinicSnap.exists()) {
    throw new Error('Branch not found.')
  }

  const data = clinicSnap.data() || {}

  const clinicStatus = String(data.status || '').trim()
  const moderationStatus = String(data.moderationStatus || '').trim()
  const published = data.isPublished === true
  const centerBlocked = !published || String(clinicStatus).toLowerCase() === 'inactive'

  if (centerBlocked) {
    throw new Error('Center unavailable.')
  }

  center.value = buildCenterModel(branchId, data)

  const [postSnap, reviewSnap] = await Promise.all([
    getDocs(query(collection(db, 'productServicePosts'), where('branchId', '==', branchId))),
    getDocs(query(collection(db, 'reviews'), where('branchId', '==', branchId))),
  ])

  items.value = postSnap.docs.map((snap) => {
    const post = snap.data() || {}
    return {
      id: snap.id,
      type: post.postType || 'Service',
      name: post.productName || post.serviceName || post.consultationName || post.title || 'Unnamed',
      title: post.title || '',
      description: post.description || '',
      price: Number(post.price || 0),
      consultationName: post.consultationName || '',
      requiresConsultationFirst: Boolean(post.requiresConsultationFirst),
      consultationFee: post.consultationFee != null ? Number(post.consultationFee) : null,
      followUpAllowed: Boolean(post.followUpAllowed),
      followUpWindowDays: post.followUpWindowDays != null ? Number(post.followUpWindowDays) : null,
      durationMinutes: post.durationMinutes != null ? Number(post.durationMinutes) : null,
      imageUrl: post.imageUrl || '',
      quantity: 1,
    }
  })

  reviews.value = reviewSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  await startAppointmentsListener(branchId)
  await startBookingReservationsListener(branchId)
  await loadPractitioners(branchId)
  if (selectedServices.value.length) {
    syncSelectedSlot()
  }
}

const bookingSlots = computed(() => {
  if (!practitioners.value.length) return []
  const slotDurationMinutes = Number(bookingDurationMinutes.value || 0)
  if (slotDurationMinutes <= 0) return []
  const blockedMap = buildBlockedRanges([...appointments.value, ...bookingReservations.value])
  const slots = []
  const today = new Date()
  const todayKey = toDateInput(today)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  for (let offset = 0; offset < SLOT_DAYS_LOOKAHEAD; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    const dateKey = toDateInput(date)
    const weekKey = getWeekStartKey(date)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })

    practitioners.value.forEach((practitioner) => {
      const assignments = resolveWeekAssignments(practitionerSchedules.value?.[practitioner.id] || {}, weekKey)
      const shiftLabel = String(assignments?.[dayName] || '').trim()
      if (!shiftLabel) return
      const windowMinutes = extractShiftWindowMinutes(shiftLabel)
      if (!windowMinutes) return

      let { start, end } = windowMinutes
      if (end < start) {
        end += 24 * 60
      }

      let slotStart = start
      if (dateKey === todayKey && slotStart <= nowMinutes) {
        slotStart = nowMinutes + SLOT_STEP_MINUTES
      }

      const blockedRanges = blockedMap.get(`${dateKey}|${practitioner.id}`) || []

      for (let minutes = slotStart; minutes + slotDurationMinutes <= end; minutes += SLOT_STEP_MINUTES) {
        const normalizedMinutes = minutes % (24 * 60)
        const time = minutesToTime(normalizedMinutes)
        const key = `${dateKey}|${time}|${practitioner.id}`
        const endMinutes = (normalizedMinutes + slotDurationMinutes) % (24 * 60)
        slots.push({
          key,
          date: dateKey,
          time,
          endTime: minutesToTime(endMinutes),
          practitionerId: practitioner.id,
          practitionerName: practitioner.fullName,
          endLabel: `${dateKey} - until ${minutesToTime12(endMinutes)} - ${practitioner.fullName}`,
          label: `${dateKey} • ${minutesToTime12(normalizedMinutes)} - ${minutesToTime12(endMinutes)} • ${practitioner.fullName}`,
          isAvailable: !overlapsBlockedRange(normalizedMinutes, normalizedMinutes + slotDurationMinutes, blockedRanges),
        })
      }
    })
  }

  return slots
})

const availableDates = computed(() => [...new Set(bookingSlots.value.map((slot) => slot.date))])
const availableDateSet = computed(() => new Set(availableDates.value))
const bookingCalendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const setBookingCalendarMonth = (value) => {
  const parsed =
    parseDateInput(value) ||
    parseDateInput(availableDates.value[0]) ||
    new Date()
  bookingCalendarMonth.value = new Date(parsed.getFullYear(), parsed.getMonth(), 1)
}

const bookingCalendarMonthLabel = computed(() =>
  bookingCalendarMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const selectedBookingDateLabel = computed(() => {
  const parsed = parseDateInput(bookingForm.value.date)
  return parsed
    ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Choose a date from the calendar.'
})

const bookingScheduleSummary = computed(() => {
  if (!bookingForm.value.time) {
    return 'Choose one available schedule from the list.'
  }
  return minutesToTime12(parseClockToMinutes(bookingForm.value.time))
})

const bookingCalendarDays = computed(() => {
  const year = bookingCalendarMonth.value.getFullYear()
  const month = bookingCalendarMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateKey = toDateInput(date)
    return {
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isAvailable: availableDateSet.value.has(dateKey),
      isSelected: bookingForm.value.date === dateKey,
    }
  })
})

const canGoToPreviousBookingMonth = computed(() => {
  const firstAllowed = new Date()
  firstAllowed.setDate(1)
  firstAllowed.setHours(0, 0, 0, 0)
  return (
    bookingCalendarMonth.value.getFullYear() > firstAllowed.getFullYear()
    || (
      bookingCalendarMonth.value.getFullYear() === firstAllowed.getFullYear()
      && bookingCalendarMonth.value.getMonth() > firstAllowed.getMonth()
    )
  )
})

const canGoToNextBookingMonth = computed(() => {
  const lastAllowed = new Date()
  lastAllowed.setDate(lastAllowed.getDate() + Math.max(0, SLOT_DAYS_LOOKAHEAD - 1))
  lastAllowed.setHours(0, 0, 0, 0)
  return (
    bookingCalendarMonth.value.getFullYear() < lastAllowed.getFullYear()
    || (
      bookingCalendarMonth.value.getFullYear() === lastAllowed.getFullYear()
      && bookingCalendarMonth.value.getMonth() < lastAllowed.getMonth()
    )
  )
})

const changeBookingCalendarMonth = (offset) => {
  const next = new Date(bookingCalendarMonth.value)
  next.setMonth(next.getMonth() + offset)
  bookingCalendarMonth.value = new Date(next.getFullYear(), next.getMonth(), 1)
}

const selectBookingDate = (dateKey) => {
  if (!availableDateSet.value.has(dateKey)) return
  bookingForm.value.date = dateKey
}

const slotsForSelectedDate = computed(() => {
  if (!bookingForm.value.date) return []
  return bookingSlots.value.filter((slot) => slot.date === bookingForm.value.date)
})

const selectBookingSlot = (slot) => {
  if (!slot?.isAvailable) return
  bookingForm.value.slotKey = slot.key
}

const syncSelectedSlot = () => {
  availabilityMessage.value = ''
  const slot = bookingSlots.value.find((entry) => entry.key === bookingForm.value.slotKey)
  if (!slot || !slot.isAvailable) {
    assignedPractitioner.value = null
    bookingForm.value.time = ''
    bookingForm.value.endTime = ''
    if (bookingForm.value.slotKey) {
      bookingForm.value.slotKey = ''
    }
    if (selectedServices.value.length) {
      availabilityMessage.value = 'Select an available schedule to continue.'
    }
    return
  }

  assignedPractitioner.value = practitioners.value.find((p) => p.id === slot.practitionerId) || null
  bookingForm.value.date = slot.date
  bookingForm.value.time = slot.time
  bookingForm.value.endTime = slot.endTime
}

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())

const filteredProducts = computed(() => {
  return items.value.filter((item) => {
    if (item.type !== 'Product') return false
    if (!normalizedSearchQuery.value) return true
    return (item.title || item.name || '').toLowerCase().includes(normalizedSearchQuery.value)
  })
})

const filteredServices = computed(() => {
  return items.value.filter((item) => {
    if (item.type !== 'Service') return false
    if (!normalizedSearchQuery.value) return true
    return (item.title || item.name || '').toLowerCase().includes(normalizedSearchQuery.value)
  })
})

const filteredConsultations = computed(() => {
  return items.value.filter((item) => {
    if (item.type !== 'Consultation') return false
    if (!normalizedSearchQuery.value) return true
    return (item.title || item.name || '').toLowerCase().includes(normalizedSearchQuery.value)
  })
})

const syncCartCount = () => {
  cartCount.value = readCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'customer-home' })
}

const goToCart = () => router.push({ name: 'customer-cart' })

const addToCart = (item) => {
  addCartItem({
    id: item.id,
    branchId: activeBranchId.value,
    branchName: center.value.name,
    name: item.title || item.name,
    variation: 'Default',
    price: Number(item.price || 0),
    quantity: Math.max(1, Number(item.quantity || 1)),
    imageUrl: item.imageUrl || '',
  })
  syncCartCount()
  toast.success('Added to cart.')
}

watch(() => bookingForm.value.date, () => {
  bookingForm.value.slotKey = ''
  bookingForm.value.time = ''
  bookingForm.value.endTime = ''
  assignedPractitioner.value = null
  if (bookingForm.value.date) {
    setBookingCalendarMonth(bookingForm.value.date)
  }
  const nextSlot = slotsForSelectedDate.value.find((slot) => slot.isAvailable)
  if (nextSlot) {
    bookingForm.value.slotKey = nextSlot.key
  }
  if (selectedServices.value.length && bookingForm.value.date && !nextSlot) {
    availabilityMessage.value = 'No available time slots are open on that date.'
  } else if (selectedServices.value.length) {
    availabilityMessage.value = 'Select an available schedule to continue.'
  } else {
    availabilityMessage.value = ''
  }
})

watch(() => bookingForm.value.slotKey, () => {
  syncSelectedSlot()
})

watch(() => bookingPaymentMethod.value, () => {
  validateBookingPhoneNumber()
})

watch(availableDates, (dates) => {
  if (!dates.length) {
    bookingCalendarMonth.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    bookingForm.value.date = ''
    return
  }

  if (!bookingForm.value.date || !dates.includes(bookingForm.value.date)) {
    bookingForm.value.date = dates[0]
    return
  }

  setBookingCalendarMonth(bookingForm.value.date)
}, { immediate: true })

const openChat = () => {
  if (!auth.currentUser) {
    toast.error('Please log in to chat.')
    router.push('/login')
    return
  }
  showChatModal.value = true
  startChatListener()
  markCustomerRead()
}

const closeChat = () => {
  showChatModal.value = false
  markCustomerRead()
  stopChatListener()
}

const resolveCustomerProfile = async () => {
  const user = auth.currentUser
  if (!user) return null
  if (customerProfile.value) return customerProfile.value

  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const userData = userSnap.exists() ? userSnap.data() : {}
  const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user.email || 'Customer'
  const profile = {
    id: user.uid,
    name,
    email: user.email || userData.email || '',
    contactNumber: String(userData.contactNumber || userData.phoneNumber || user.phoneNumber || '').trim(),
  }
  customerProfile.value = profile
  return profile
}

const ensureChatThread = async () => {
  const user = auth.currentUser
  if (!user) return null
  const profile = await resolveCustomerProfile()
  const threadId = `${activeBranchId.value}_${user.uid}`
  chatThreadId.value = threadId

  const threadRef = doc(db, 'chatThreads', threadId)
  const threadSnap = await getDoc(threadRef)
  if (!threadSnap.exists()) {
    await setDoc(threadRef, {
      branchId: activeBranchId.value,
      customerId: user.uid,
      customerName: profile?.name || 'Customer',
      customerEmail: profile?.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: '',
      lastMessageAt: null,
      customerLastReadAt: null,
    })
  }
  return threadRef
}

const scrollChatToBottom = async () => {
  await nextTick()
  if (chatScrollRef.value) {
    chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
  }
}

const startChatListener = async () => {
  if (chatUnsubscribe) chatUnsubscribe()
  const user = auth.currentUser
  if (!user) return
  currentUserId.value = user.uid
  const threadRef = await ensureChatThread()
  if (!threadRef) return

  const messagesRef = collection(db, 'chatThreads', chatThreadId.value, 'messages')
  const q = query(messagesRef)
  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    chatMessages.value = snapshot.docs
      .map((snap) => ({ id: snap.id, ...snap.data() }))
      .sort((a, b) => {
        const aServer = a.createdAt?.seconds || 0
        const bServer = b.createdAt?.seconds || 0
        if (aServer !== bServer) return aServer - bServer
        const aClient = Number(a.clientCreatedAt || 0)
        const bClient = Number(b.clientCreatedAt || 0)
        return aClient - bClient
      })
    scrollChatToBottom()
  })
}

const startUnreadListener = async () => {
  if (unreadUnsubscribe) unreadUnsubscribe()
  const user = auth.currentUser
  if (!user) return
  const threadRef = await ensureChatThread()
  if (!threadRef) return

  if (threadUnsubscribe) threadUnsubscribe()
  threadUnsubscribe = onSnapshot(threadRef, (snap) => {
    const data = snap.exists() ? snap.data() : {}
    customerLastReadAt.value = data.customerLastReadAt || null
  })

  const messagesRef = collection(db, 'chatThreads', chatThreadId.value, 'messages')
  const q = query(messagesRef)
  unreadUnsubscribe = onSnapshot(q, (snapshot) => {
    const lastRead = customerLastReadAt.value
    unreadChatCount.value = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data()
      if (data.senderRole !== 'receptionist') return false
      if (!lastRead?.toDate || !data.createdAt?.toDate) return !showChatModal.value
      return data.createdAt.toDate() > lastRead.toDate()
    }).length
  })
}

const markCustomerRead = async () => {
  const user = auth.currentUser
  if (!user) return
  if (!chatThreadId.value) return
  try {
    await setDoc(
      doc(db, 'chatThreads', chatThreadId.value),
      { customerLastReadAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    )
    unreadChatCount.value = 0
  } catch (error) {
    console.error(error)
  }
}

const stopChatListener = () => {
  if (chatUnsubscribe) {
    chatUnsubscribe()
    chatUnsubscribe = null
  }
}

const sendChat = async () => {
  if (!chatInput.value.trim()) {
    toast.error('Please enter a message.')
    return
  }
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in first.')
    router.push('/login')
    return
  }

  try {
    const profile = await resolveCustomerProfile()
    const threadRef = await ensureChatThread()
    if (!threadRef) return

    const messageText = chatInput.value.trim()
    chatInput.value = ''

    const messagePayload = {
      text: messageText,
      senderId: user.uid,
      senderName: profile?.name || 'Customer',
      senderEmail: profile?.email || '',
      senderRole: 'customer',
      createdAt: serverTimestamp(),
    }

    await addDoc(collection(db, 'chatThreads', chatThreadId.value, 'messages'), messagePayload)

    await setDoc(
      threadRef,
      {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )

    await addDoc(collection(db, 'messages'), {
      branchId: activeBranchId.value,
      subject: `New chat message from ${profile?.name || 'Customer'}`,
      senderName: profile?.name || 'Customer',
      senderEmail: profile?.email || '',
      body: messageText,
      isRead: false,
      type: 'chat',
      threadId: chatThreadId.value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error(error)
    toast.error('Failed to send message.')
  }
}

const formatPriceRange = () => {
  const formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', currencyDisplay: 'code' })
  const productPrices = items.value
    .filter((item) => item.type === 'Product')
    .map((item) => Number(item.price || 0))
    .filter((price) => price > 0)
  const servicePrices = items.value
    .filter((item) => item.type === 'Service')
    .map((item) => Number(item.price || 0))
    .filter((price) => price > 0)
  const consultationPrices = items.value
    .filter((item) => item.type === 'Consultation')
    .map((item) => Number(item.consultationFee || item.price || 0))
    .filter((price) => price > 0)

  const formatRange = (prices, label) => {
    if (!prices.length) return `${label}: not listed yet.`
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max
      ? `${label}: around ${formatter.format(min)}.`
      : `${label}: ${formatter.format(min)} to ${formatter.format(max)}.`
  }

  if (!productPrices.length && !servicePrices.length && !consultationPrices.length) {
    return 'Pricing is not available yet. Please ask the receptionist for a quote.'
  }

  return `${formatRange(productPrices, 'Products')} ${formatRange(servicePrices, 'Services')} ${formatRange(consultationPrices, 'Consultations')}`.trim()
}

const buildQuickAnswer = (key) => {
  switch (key) {
    case 'services':
      if (!center.value.services.length) return 'We do not have a published services list yet.'
      return `We currently offer: ${center.value.services.join(', ')}.`
    case 'contact':
      return `You can reach us at ${center.value.contactNumber || 'our phone'} or ${center.value.businessEmail || center.value.email || 'our email'}.`
    case 'location':
      return center.value.location
        ? `We are located at ${center.value.location}.`
        : 'Our location is not set yet.'
    case 'price':
      return formatPriceRange()
    case 'booking':
      return 'To book, go to Products & Services, select a service, then choose a date and time. You can also chat with the receptionist for help.'
    default:
      return 'Thanks for your question. A receptionist will reply soon.'
  }
}

const sendQuickQuestion = async (question) => {
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in to chat.')
    router.push('/login')
    return
  }
  try {
    await ensureChatThread()
    const profile = await resolveCustomerProfile()
    const threadId = chatThreadId.value
    const questionText = question?.label || 'Quick question'
    const answerText = buildQuickAnswer(question?.key)

    const baseTime = Date.now()
    await addDoc(collection(db, 'chatThreads', threadId, 'messages'), {
      text: questionText,
      senderId: user.uid,
      senderName: profile?.name || 'Customer',
      senderEmail: profile?.email || '',
      senderRole: 'customer',
      createdAt: serverTimestamp(),
      clientCreatedAt: baseTime
    })

    await addDoc(collection(db, 'chatThreads', threadId, 'messages'), {
      text: answerText,
      senderId: 'system',
      senderName: 'AesthetiCare',
      senderRole: 'system',
      createdAt: serverTimestamp(),
      clientCreatedAt: baseTime + 1
    })

    await setDoc(
      doc(db, 'chatThreads', threadId),
      {
        lastMessage: answerText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  } catch (error) {
    console.error(error)
    toast.error('Failed to send quick answer.')
  }
}

const isServiceSelected = (item) => selectedServices.value.some((service) => service.id === item.id)

const isConsultationSelected = (item) => isServiceSelected(item)

const toggleServiceForBooking = (item) => {
  if (isServiceSelected(item)) {
    removeSelectedService(item.id)
    return
  }

  selectedServices.value = [...selectedServices.value, item]
  if (!bookingForm.value.date && availableDates.value.length) {
    bookingForm.value.date = availableDates.value[0]
  }
  availabilityMessage.value = 'Select an available schedule to continue.'
}

const toggleConsultationForBooking = (item) => {
  if (isServiceSelected(item)) {
    clearBookingSelection()
    return
  }

  selectedServices.value = [item]
  if (!bookingForm.value.date && availableDates.value.length) {
    bookingForm.value.date = availableDates.value[0]
  }
  availabilityMessage.value = 'Select an available schedule to continue.'
}

const removeSelectedService = (serviceId) => {
  selectedServices.value = selectedServices.value.filter((service) => service.id !== serviceId)
  if (!selectedServices.value.length) {
    clearBookingSelection()
  }
}

const clearBookingSelection = () => {
  selectedServices.value = []
  assignedPractitioner.value = null
  availabilityMessage.value = ''
  bookingPhoneError.value = ''
  bookingForm.value = {
    slotKey: '',
    date: '',
    time: '',
    endTime: '',
    contactNumber: '',
    notes: '',
  }
}

const createBookingNotification = async ({ title, message, link = '/customer/appointments' }) => {
  const user = auth.currentUser
  if (!user) return
  await addDoc(collection(db, 'notifications'), {
    recipientUserId: user.uid,
    title: String(title || 'Notification').trim(),
    message: String(message || '').trim(),
    link,
    read: false,
    deleted: false,
    createdAt: serverTimestamp(),
  })
}

const normalizePhilippineMobileNumber = (value) => {
  const raw = String(value || '').trim().replace(/[^\d+]/g, '')
  if (!raw) return ''
  const digits = raw.startsWith('+') ? raw.slice(1) : raw
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`
  if (/^639\d{9}$/.test(digits)) return `+${digits}`
  return String(value || '').trim()
}

const normalizePhilippineMobileNumberForPayMongo = (value) => {
  const digits = String(value || '').trim().replace(/\D/g, '')
  if (!digits) return ''
  if (/^9\d{9}$/.test(digits)) return `09${digits}`
  if (/^09\d{9}$/.test(digits)) return digits.slice(0, 11)
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(3)}`
  return digits.slice(0, 11)
}

const isValidPhilippineMobileNumber = (value) => {
  const raw = String(value || '').trim().replace(/[^\d+]/g, '')
  if (!raw) return false
  const digits = raw.startsWith('+') ? raw.slice(1) : raw
  return /^9\d{9}$/.test(digits) || /^09\d{9}$/.test(digits) || /^639\d{9}$/.test(digits)
}

const displayPhilippineMobileNumber = (value) => {
  const normalized = normalizePhilippineMobileNumber(value)
  if (normalized.startsWith('+63')) return normalized.slice(3)
  if (normalized.startsWith('639')) return normalized.slice(2)
  return String(value || '').trim()
}

const sanitizeBookingPhoneInput = (value) => {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return digits.slice(0, 10)
}

const handleBookingPhoneInput = () => {
  bookingForm.value.contactNumber = sanitizeBookingPhoneInput(bookingForm.value.contactNumber)
  validateBookingPhoneNumber()
}

const validateBookingPhoneNumber = () => {
  if (bookingPaymentMethod.value !== 'E-Wallet') {
    bookingPhoneError.value = ''
    return true
  }

  const phone = String(bookingForm.value.contactNumber || '').trim()
  if (!phone) {
    bookingPhoneError.value = 'Mobile number is required for GCash payments.'
    return false
  }
  if (!/^[9]\d{9}$/.test(phone)) {
    bookingPhoneError.value = 'Enter exactly 10 digits after +63, starting with 9.'
    return false
  }

  bookingPhoneError.value = ''
  return true
}

const savePendingBookingPayMongoState = (state) => {
  localStorage.setItem(bookingPaymentPendingKey, JSON.stringify(state))
}

const loadPendingBookingPayMongoState = () => {
  try {
    const raw = localStorage.getItem(bookingPaymentPendingKey)
    return raw ? JSON.parse(raw) : null
  } catch (_error) {
    return null
  }
}

const clearPendingBookingPayMongoState = () => {
  localStorage.removeItem(bookingPaymentPendingKey)
}

const createBookingReservation = async ({
  flowType,
  consultationFeePeso = 0,
  amountPeso = 0,
} = {}) => {
  return {
    id: '',
    fallback: true,
    flowType,
    amountPeso,
    consultationFeePeso,
  }
}

const releaseBookingReservation = async (reservationId) => {
  if (!reservationId) return
  try {
    const user = auth.currentUser
    if (!user) return
    await fetch(`${OTP_API_BASE}/appointments/reservations/${reservationId}`, {
      method: 'DELETE',
      headers: await (async () => {
        const token = await user.getIdToken()
        return { Authorization: `Bearer ${token}` }
      })(),
    })
  } catch (error) {
    console.error('Failed to release booking reservation:', error)
  }
}

const buildBookingPayMongoLineItems = ({ flowType = 'booking', consultationFeePeso = 0 } = {}) => {
  if (flowType === 'consultation') {
    return [{
      name: 'Online Consultation',
      amount: Math.round(Number(consultationFeePeso || 0) * 100),
      currency: 'PHP',
      quantity: 1,
    }]
  }

  return selectedServices.value.map((service) => ({
    name: service.title || service.name || 'Service',
    amount: Math.round(Number(service.price || 0) * 100),
    currency: 'PHP',
    quantity: 1,
  }))
}

const createBookingPayMongoCheckoutSession = async ({
  amountPeso,
  description,
  referencePrefix,
  flowType,
  consultationFeePeso = 0,
  reservationId = '',
  customerPhone = '',
} = {}) => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Please log in first.')
  }
  if (!selectedServices.value.length) {
    throw new Error('Please select at least one service.')
  }
  if (Number(amountPeso || 0) <= 0) {
    throw new Error('The selected service needs a valid price before payment can continue.')
  }
  const selectedSlot = bookingSlots.value.find((entry) => entry.key === bookingForm.value.slotKey)
  if (!selectedSlot || !selectedSlot.isAvailable || !bookingForm.value.date || !bookingForm.value.time || !assignedPractitioner.value) {
    throw new Error('Please choose an available schedule.')
  }

  const referenceNumber = `${referencePrefix || 'APT'}-${Date.now()}`
  const successUrl = `${window.location.origin}${route.path}?branch=${activeBranchId.value}&paymongo_status=success`
  const cancelUrl = `${window.location.origin}${route.path}?branch=${activeBranchId.value}&paymongo_status=cancelled`
  const paymentMethodType = 'card'
  const profile = await resolveCustomerProfile()
  const customerName = profile?.name || user.email || 'Customer'
  const payerPhone = normalizePhilippineMobileNumberForPayMongo(
    customerPhone ||
    bookingForm.value.contactNumber ||
    profile?.contactNumber ||
    user.phoneNumber ||
    ''
  )
  if (bookingPaymentMethod.value === 'E-Wallet' && !isValidPhilippineMobileNumber(payerPhone)) {
    throw new Error('GCash payments require a valid mobile number.')
  }

  const response = await fetch(`${OTP_API_BASE}/paymongo/create-checkout-session`, {
    method: 'POST',
    headers: await (async () => {
      const token = await user.getIdToken()
      return {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    })(),
    body: JSON.stringify({
      amount: Math.round(Number(amountPeso || 0) * 100),
      paymentMethodType,
      paymentMethodTypes: bookingPaymentTypes.value,
      description,
      referenceNumber,
      billing: {
        name: customerName,
        email: user.email || '',
        phone: payerPhone,
      },
      metadata: {
        module: 'customer_order',
        source: 'paymongo_checkout',
        flowType,
        customerId: user.uid,
        customerEmail: user.email || '',
        customerName,
        paymentMethod: bookingPaymentMethod.value,
        customerPhone: payerPhone,
        branchId: activeBranchId.value,
        centerId: centerId,
        practitionerId: assignedPractitioner.value.id,
        practitionerName: assignedPractitioner.value.fullName,
        reservationId,
        appointmentDate: bookingForm.value.date,
        appointmentTime: bookingForm.value.time,
        totalServiceDurationMinutes: selectedServiceDurationMinutes.value,
        paymentCoverage: 'full',
        commissionPercent: serviceCommissionPercent,
        commissionAmount: flowType === 'consultation'
          ? calculateCommissionAmount(Number(amountPeso || 0), serviceCommissionPercent)
          : selectedServiceCommission.value,
      },
      lineItems: buildBookingPayMongoLineItems({
        flowType,
        consultationFeePeso,
      }),
      successUrl,
      cancelUrl,
    }),
  })

  const raw = await response.text()
  let payload = null
  try {
    payload = JSON.parse(raw)
  } catch (_error) {
    throw new Error(`Backend returned non-JSON response (${response.status}). Check backend URL/port and ensure /paymongo endpoints exist.`)
  }
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to create PayMongo checkout session.')
  }

  return {
    session: payload.data,
    referenceNumber,
  }
}

const finalizeSuccessfulBooking = async (pending, payload) => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Please log in first.')
  }
  const flowType = String(pending.flowType || 'booking').trim().toLowerCase()

  const payments = Array.isArray(payload?.data?.payments) ? payload.data.payments : []
  const firstPayment = payments[0] || {}
  const paymentAttrs = firstPayment?.attributes || {}
  const paymentMethodType =
    paymentAttrs?.payment_method?.type ||
    paymentAttrs?.source?.type ||
    paymentAttrs?.type ||
    pending.paymentMethod

  const profile = await resolveCustomerProfile()
  const customerName = profile?.name || user.email || 'Customer'
  const selectedServiceNames = Array.isArray(pending.selectedServices)
    ? pending.selectedServices.map((service) => service.title || service.name || '').filter(Boolean)
    : []
  const selectedServiceIds = Array.isArray(pending.selectedServices)
    ? pending.selectedServices.map((service) => service.id).filter(Boolean)
    : []
  const selectedServiceDurations = Array.isArray(pending.selectedServices)
    ? pending.selectedServices.map((service) => Number(service.durationMinutes || 0)).filter((value) => value > 0)
    : []
  const totalAmount = flowType === 'consultation'
    ? Number(pending.consultationFee || 0)
    : Number(pending.total || 0)
  const commissionAmount = Number(pending.commissionAmount || 0)
  const netAmount = Number(pending.netAmount || 0)
  if (pending.reservationId) {
    const response = await fetch(`${OTP_API_BASE}/appointments/finalize-booking`, {
      method: 'POST',
      headers: await (async () => {
        const token = await user.getIdToken()
        return {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        }
      })(),
      body: JSON.stringify({
        reservationId: pending.reservationId || '',
        paymongoCheckoutSessionId: pending.checkoutSessionId || null,
        paymongoStatus: payload?.data?.status || null,
        paymongoPaidAt: payload?.data?.paid_at || null,
        paymongoPaymentId: firstPayment?.id || null,
        paymongoPaymentMethodType: paymentMethodType || null,
        paymentMethod: pending.paymentMethod || paymentMethodType || 'GCash',
        paymongoPayload: payload?.data || null,
      }),
    })

    const raw = await response.text()
    let result = null
    try {
      result = JSON.parse(raw)
    } catch (_error) {
      throw new Error(`Backend returned non-JSON response (${response.status}).`)
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Failed to finalize the booking.')
    }
  } else {
    const bookingDoc = {
      customerId: user.uid,
      customerName,
      clientName: customerName,
      practitionerId: pending.practitionerId || '',
      assignedPractitionerId: pending.practitionerId || '',
      practitionerName: pending.practitionerName || '',
      assignedPractitionerName: pending.practitionerName || '',
      service: selectedServiceNames.join(', ') || 'Service',
      services: selectedServiceNames,
      serviceIds: selectedServiceIds,
      serviceDetails: Array.isArray(pending.selectedServices) ? pending.selectedServices : [],
      serviceDurations: selectedServiceDurations,
      totalServiceDurationMinutes: Number(pending.totalServiceDurationMinutes || selectedServiceDurations.reduce((sum, value) => sum + value, 0) || 0),
      customerPhone: pending.customerPhone || '',
      date: pending.date || '',
      time: pending.time || '',
      endTime: pending.endTime || '',
      notes: pending.notes || '',
      status: 'Scheduled',
      paymentStatus: 'Paid',
      source: 'paymongo_checkout',
      paymentMethod: pending.paymentMethod || paymentMethodType || 'GCash',
      paymentCoverage: 'full',
      amount: totalAmount,
      amountPaid: totalAmount,
      totalAmount,
      commissionPercent: Number(pending.commissionPercent || serviceCommissionPercent),
      commissionAmount,
      merchantNetAmount: netAmount,
      requiresConsultationFirst: Boolean(pending.requiresConsultationFirst),
      followUpAllowed: Boolean(pending.followUpAllowed),
      followUpWindowDays: pending.followUpWindowDays != null ? Number(pending.followUpWindowDays) : null,
      branchId: pending.branchId || activeBranchId.value,
      centerId: pending.centerId || centerId || pending.branchId || activeBranchId.value,
      paymongoCheckoutSessionId: pending.checkoutSessionId || null,
      paymongoStatus: payload?.data?.status || null,
      paymongoPaidAt: payload?.data?.paid_at || null,
      paymongoPaymentId: firstPayment?.id || null,
      paymongoPaymentMethodType: paymentMethodType || null,
      referenceNumber: pending.referenceNumber || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reservationId: '',
    }

    await addDoc(collection(db, 'appointments'), bookingDoc)
  }

  await createBookingNotification({
    title: flowType === 'consultation' ? 'Consultation Scheduled' : 'Booking Confirmed',
    message: flowType === 'consultation'
      ? `Your online consultation for ${selectedServiceNames.join(', ') || 'selected service'} has been paid and scheduled.`
      : `Your booking for ${selectedServiceNames.join(', ') || 'selected service'} has been paid and confirmed.`,
    link: '/customer/appointments',
  })
}

const handleBookingPayMongoReturn = async () => {
  const status = String(route.query.paymongo_status || '').toLowerCase()
  if (!status) return

  const pending = loadPendingBookingPayMongoState()
  if (!pending?.checkoutSessionId) {
    return
  }

  if (status === 'cancelled') {
    await releaseBookingReservation(pending.reservationId || '')
    clearPendingBookingPayMongoState()
    await Swal.fire({
      title: 'Payment Cancelled',
      text: 'Your appointment payment was cancelled.',
      icon: 'info',
      timer: 1600,
      showConfirmButton: false,
    })
    await router.replace({ name: 'customer-center', params: { id: centerId }, query: route.query.branch ? { branch: route.query.branch } : {} })
    return
  }

  if (status !== 'success') return

  bookingPaymentSaving.value = true
  try {
    const response = await fetch(`${OTP_API_BASE}/paymongo/checkout-session/${pending.checkoutSessionId}`, {
      headers: await (async () => {
        const user = auth.currentUser
        if (!user) throw new Error('Please log in first.')
        const token = await user.getIdToken()
        return { Authorization: `Bearer ${token}` }
      })(),
    })
    const raw = await response.text()
    let payload = null
    try {
      payload = JSON.parse(raw)
    } catch (_error) {
      throw new Error(`Backend returned non-JSON response (${response.status}). Check backend URL/port and ensure /paymongo endpoints exist.`)
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Failed to verify PayMongo payment.')
    }
    if (!payload?.data?.isPaid) {
      throw new Error('Payment is not yet marked as paid in PayMongo.')
    }

    await finalizeSuccessfulBooking(pending, payload)
    clearPendingBookingPayMongoState()
    toast.success('Appointment booked successfully.')
    clearBookingSelection()
    await router.replace({ name: 'customer-appointments' })
  } catch (error) {
    console.error(error)
    await releaseBookingReservation(pending.reservationId || '')
    toast.error(error?.message || 'Failed to finalize the booking payment.')
    await router.replace({ name: 'customer-center', params: { id: centerId }, query: route.query.branch ? { branch: route.query.branch } : {} })
  } finally {
    bookingPaymentSaving.value = false
  }
}

const submitBooking = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in first.')
    router.push('/login')
    return
  }
  if (
    center.value.isPublished !== true ||
    String(center.value.status || '').trim().toLowerCase() === 'inactive'
  ) {
    toast.error('This center is currently unavailable for booking.')
    router.replace({ name: 'centers' })
    return
  }
  const selectedSlot = bookingSlots.value.find((entry) => entry.key === bookingForm.value.slotKey)
  if (!selectedServices.value.length || !selectedSlot || !selectedSlot.isAvailable || !bookingForm.value.date || !bookingForm.value.time || !assignedPractitioner.value) {
    toast.error('Please choose an available schedule.')
    return
  }
  if (!validateBookingPhoneNumber()) {
    toast.error(bookingPhoneError.value)
    return
  }

  let heldReservationId = ''
  try {
    bookingPaymentSaving.value = true
    const flowType = 'booking'
    const consultationFee = 0
    const amountPeso = Number(selectedServiceTotal.value || 0)
    const payerPhone = normalizePhilippineMobileNumberForPayMongo(bookingForm.value.contactNumber)

    const reservation = await createBookingReservation({
      flowType,
      consultationFeePeso: consultationFee,
      amountPeso,
    })
    heldReservationId = reservation?.id || reservation?.reservationId || ''

    const latestAppointments = await fetchBranchAppointmentsSnapshot(activeBranchId.value)
    const latestReservationBlocks = bookingReservations.value.filter((reservation) => reservation.id !== heldReservationId)
    const latestBlockedMap = buildBlockedRanges([...latestAppointments, ...latestReservationBlocks])
    const currentSlotStart = parseClockToMinutes(bookingForm.value.time)
    const currentSlotEnd = parseClockToMinutes(bookingForm.value.endTime)
    if (
      currentSlotStart === null ||
      Number.isNaN(currentSlotStart)
    ) {
      throw new Error('Please choose an available schedule.')
    }
    const checkEnd = currentSlotEnd !== null && currentSlotEnd > currentSlotStart
      ? currentSlotEnd
      : currentSlotStart + bookingDurationMinutes.value
    const currentBlockedRanges = latestBlockedMap.get(`${bookingForm.value.date}|${assignedPractitioner.value.id}`) || []
    if (overlapsBlockedRange(currentSlotStart, checkEnd, currentBlockedRanges)) {
      await releaseBookingReservation(heldReservationId)
      throw new Error('That schedule was just taken. Please pick another available time.')
    }

    const { session, referenceNumber } = await createBookingPayMongoCheckoutSession({
      amountPeso,
      description: 'Appointment Full Payment',
      referencePrefix: 'APT',
      flowType,
      consultationFeePeso: consultationFee,
      reservationId: heldReservationId,
      customerPhone: payerPhone,
    })
    savePendingBookingPayMongoState({
      checkoutSessionId: session.id,
      reservationId: heldReservationId,
      selectedServices: selectedServices.value,
      flowType,
      date: bookingForm.value.date,
      time: bookingForm.value.time,
      endTime: bookingForm.value.endTime || '',
      notes: bookingForm.value.notes || '',
      practitionerId: assignedPractitioner.value.id,
      practitionerName: assignedPractitioner.value.fullName,
      branchId: activeBranchId.value,
      centerId,
      total: selectedServiceTotal.value,
      consultationFee,
      commissionPercent: serviceCommissionPercent,
      commissionAmount: selectedServiceCommission.value,
      netAmount: selectedServiceNetAmount.value,
      totalServiceDurationMinutes: selectedServiceDurationMinutes.value,
      paymentMethod: bookingPaymentMethod.value,
      customerPhone: payerPhone,
      paymentCoverage: 'full',
      requiresConsultationFirst: selectedServicesRequireConsultation.value,
      followUpAllowed: selectedServicesAllowFollowUp.value,
      followUpWindowDays: selectedServices.value.find((service) => service.followUpWindowDays != null)?.followUpWindowDays || null,
      referenceNumber,
      createdAt: Date.now(),
    })
    window.location.href = session.checkout_url
  } catch (error) {
    console.error(error)
    const pendingReservationId = heldReservationId || loadPendingBookingPayMongoState()?.reservationId
    if (pendingReservationId) {
      await releaseBookingReservation(pendingReservationId)
      clearPendingBookingPayMongoState()
    } else {
      clearPendingBookingPayMongoState()
    }
    toast.error(error?.message || 'Failed to book appointment.')
  } finally {
    bookingPaymentSaving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const rootSnap = await getDoc(doc(db, 'clinics', centerId))
    if (!rootSnap.exists()) {
      toast.error('Center not found.')
      router.replace({ name: 'centers' })
      return
    }

    const rootData = rootSnap.data() || {}
    const ownerId = String(rootData.ownerId || '').trim()
    const branchSnapshot = ownerId
      ? await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
      : null

    const branchDocs = branchSnapshot?.docs?.length ? branchSnapshot.docs : [rootSnap]
    branches.value = branchDocs
      .map((snap) => {
        const data = snap.data() || {}
        const status = String(data.status || '').trim().toLowerCase()
        const moderationStatus = String(data.moderationStatus || '').trim().toLowerCase()
        const published = data.isPublished === true
        const available = published && status !== 'inactive'
        return {
          id: snap.id,
          name: data.clinicBranch || data.clinicName || 'Center',
          location: data.clinicLocation || '',
          isMainBranch: Boolean(data.isMainBranch),
          available
        }
      })
      .filter((branch) => branch.available)
      .sort((a, b) => {
        if (a.isMainBranch !== b.isMainBranch) return a.isMainBranch ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    const routeBranch = String(route.query.branch || '').trim()
    const preferredBranch = branches.value.some((branch) => branch.id === routeBranch)
      ? routeBranch
      : (branches.value.some((branch) => branch.id === centerId) ? centerId : branches.value[0]?.id || centerId)

    selectedBranchId.value = preferredBranch
    await loadBranchData(preferredBranch)
    await handleBookingPayMongoReturn()
    if (selectedServices.value.length) {
      syncSelectedSlot()
    }
    syncCartCount()
    if (auth.currentUser) {
      currentUserId.value = auth.currentUser.uid
      await startUnreadListener()
    }
  } catch (error) {
    console.error(error)
    const message = String(error?.message || '').toLowerCase()
    if (message.includes('not found')) {
      toast.error('Center not found.')
      router.replace({ name: 'centers' })
    } else if (message.includes('unavailable')) {
      toast.error('This branch is currently unavailable.')
      router.replace({ name: 'centers' })
    } else {
      toast.error('Failed to load center page.')
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  setPageScrollLocked(false)
  stopBranchSensitiveListeners()
})

const formatChatTime = (timestamp) => {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.customer-center-page {
  color: #3d281d;
}

.customer-center-page main {
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.38), transparent 28%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.16), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.center-shell {
  overflow: hidden;
  border: 1px solid rgba(224, 192, 154, 0.8);
  border-radius: 1.75rem;
  background: rgba(255, 251, 244, 0.95);
  box-shadow: 0 24px 60px rgba(84, 54, 34, 0.14);
}

.center-avatar {
  border: 4px solid rgba(255, 250, 243, 0.98);
  background: linear-gradient(180deg, #fff9f2 0%, #f6e5cb 100%);
}

.center-title {
  letter-spacing: -0.03em;
}

.center-tab-button {
  border: 1px solid rgba(224, 192, 154, 0.85);
  background: rgba(255, 251, 244, 0.9);
  color: #7b5534;
  box-shadow: 0 8px 18px rgba(84, 54, 34, 0.08);
}

.center-tab-button.is-active {
  background: linear-gradient(135deg, #8d5a3b 0%, #6f4329 100%);
  color: #fff8eb;
  border-color: rgba(111, 67, 41, 0.95);
  box-shadow: 0 12px 28px rgba(111, 63, 42, 0.18);
}

.center-panel,
.center-section-card,
.center-item-card,
.center-review-card,
.center-branch-card,
.center-toolbar,
.center-search-input,
.center-cart-button {
  border-color: rgba(224, 192, 154, 0.85);
}

.center-panel,
.center-section-card,
.center-item-card,
.center-review-card,
.center-branch-card {
  background: rgba(255, 251, 244, 0.96);
  border: 1px solid rgba(224, 192, 154, 0.85);
  border-radius: 1.5rem;
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.center-panel-title {
  color: #3d281d;
  font-weight: 700;
}

.center-panel-copy,
.center-muted-state {
  color: #6f4a2d;
}

.center-service-pill,
.center-badge,
.center-count-pill {
  border: 1px solid rgba(224, 192, 154, 0.85);
  background: #fff4e6;
  color: #7b5534;
}

.center-badge-warm {
  background: #fff1df;
}

.center-badge-soft {
  background: #f8efe2;
}

.center-count-pill {
  background: #fffaf3;
}

.center-search-input {
  background: #fffaf3;
  border: 1px solid rgba(224, 192, 154, 0.95);
  color: #3d281d;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.center-search-input::placeholder {
  color: #a78a6e;
}

.center-cart-button,
.center-action-button {
  background: linear-gradient(135deg, #8d5a3b 0%, #6f4329 100%);
  box-shadow: 0 14px 26px rgba(111, 63, 42, 0.14);
}

.center-action-button.is-cool {
  background: linear-gradient(135deg, #b57f5c 0%, #8d5a3b 100%);
}

.center-action-button.is-warm {
  background: linear-gradient(135deg, #8d5a3b 0%, #6f4329 100%);
}

.center-qty-input {
  background: #fffaf3;
  border: 1px solid rgba(224, 192, 154, 0.95);
  color: #3d281d;
}

.center-kicker {
  color: #8b6a4d;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.booking-panel {
  background: linear-gradient(180deg, rgba(255, 251, 244, 0.98), rgba(251, 241, 228, 0.98)) !important;
  border: 1px solid rgba(224, 192, 154, 0.95) !important;
  box-shadow: 0 24px 60px rgba(84, 54, 34, 0.12) !important;
}

.customer-center-page main :deep(.booking-calendar) {
  background: rgba(255, 250, 243, 0.98);
  border-color: rgba(224, 192, 154, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.customer-center-page main :deep(.booking-day) {
  background: rgba(255, 250, 243, 0.98);
  color: #6f4a2d;
  border-color: rgba(224, 192, 154, 0.95);
}

.customer-center-page main :deep(.booking-day:hover) {
  background: #f8efe2;
}

.customer-center-page main :deep(.booking-day.is-selected) {
  background: linear-gradient(135deg, #8d5a3b, #6f4329);
  color: #fff;
  border-color: rgba(111, 67, 41, 0.95);
  box-shadow: 0 12px 28px rgba(111, 63, 42, 0.22);
}

.customer-center-page main :deep(.booking-day.is-available) {
  background: rgba(251, 241, 228, 0.96);
  color: #6f4a2d;
  border-color: rgba(224, 192, 154, 0.95);
}

.customer-center-page main :deep(.booking-day.is-disabled) {
  background: rgba(248, 240, 231, 0.92);
  color: rgba(139, 106, 77, 0.55);
}

.customer-center-page main :deep(.booking-day-dot-available) {
  background: #b57f5c;
  opacity: 0.95;
}

.customer-center-page main :deep(.booking-day-dot-selected) {
  background: #8d5a3b;
  transform: scale(1.1);
  opacity: 1;
}

.customer-center-page main :deep(.booking-day-dot-disabled) {
  background: rgba(167, 138, 110, 0.35);
  opacity: 0.6;
}

.customer-center-page main :deep(.booking-slot) {
  background: rgba(255, 250, 243, 0.98);
  border-color: rgba(224, 192, 154, 0.95);
  color: #3d281d;
}

.customer-center-page main :deep(.booking-slot.is-selected) {
  background: rgba(141, 90, 59, 0.12);
  border-color: rgba(141, 90, 59, 0.95);
  color: #3d281d;
}

.customer-center-page main :deep(.booking-slot.is-disabled) {
  background: rgba(248, 240, 231, 0.9);
  border-color: rgba(217, 190, 155, 0.85);
  color: rgba(139, 106, 77, 0.7);
  cursor: not-allowed;
  opacity: 0.82;
}

.customer-center-page main :deep(.booking-sidecard) {
  background: rgba(255, 250, 243, 0.98);
  border-color: rgba(224, 192, 154, 0.95);
}

.customer-center-page main :deep(.booking-notice) {
  color: #8b6a4d;
}

.customer-center-page main .bg-slate-700\/60,
.customer-center-page main .bg-slate-700\/35,
.customer-center-page main .bg-slate-700\/50,
.customer-center-page main .bg-slate-900\/50 {
  background: rgba(255, 251, 244, 0.96) !important;
  border-color: rgba(224, 192, 154, 0.85) !important;
  color: #3d281d !important;
}

.customer-center-page main .text-white {
  color: #3d281d !important;
}

.customer-center-page main .text-slate-200,
.customer-center-page main .text-slate-300 {
  color: #6f4a2d !important;
}

.customer-center-page main .text-slate-400 {
  color: #8b6a4d !important;
}
</style>
