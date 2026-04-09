<template>
  <div class="customer-center-page flex customer-theme min-h-screen bg-slate-900">
    <CustomerSidebar class="flex-shrink-0" />

    <main class="flex-1 p-4 md:p-8">
      <button
        type="button"
        class="mb-4 inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        @click="goBack"
      >
        <span class="text-lg leading-none">‹</span>
        <span class="text-sm font-medium">Back</span>
      </button>

      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="relative h-56 md:h-64 bg-slate-700">
          <img v-if="center.bannerPicture" :src="center.bannerPicture" alt="Clinic banner" class="w-full h-full object-cover" />
          <div v-else class="absolute inset-0 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500"></div>
        </div>

        <div class="px-4 md:px-8 pb-8">
          <div class="relative -mt-16 md:-mt-20 z-10 flex flex-col md:flex-row md:items-end gap-4">
            <div class="h-28 w-28 md:h-36 md:w-36 rounded-full border-4 border-slate-800 bg-slate-700 overflow-hidden shadow-xl">
              <img v-if="center.profilePicture" :src="center.profilePicture" alt="Clinic profile" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 pt-1 md:pt-0">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 class="text-2xl md:text-5xl font-bold text-white">{{ center.name || 'Center' }}</h1>
                  <p class="text-slate-300 mt-1">{{ center.location || 'Location not set' }}</p>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 self-start rounded-full border border-rose-300/70 bg-rose-500/25 px-4 py-2 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/25 transition hover:bg-rose-500/35 hover:border-rose-200 hover:text-white"
                  title="Report this center"
                  @click="openReportModal"
                >
                  <Icon icon="mdi:flag-outline" class="h-5 w-5" />
                  <span>Report Center</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="branchOptions.length > 1" class="mt-5 rounded-2xl border border-slate-600 bg-slate-900/50 p-4">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Branch Selector</p>
                <p class="mt-1 text-sm text-slate-300">
                  Choose a branch to view its products, services, and booking availability.
                </p>
              </div>
              <div class="w-full md:w-[340px]">
                <select
                  v-model="selectedBranchId"
                  class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  @change="selectBranch"
                >
                  <option v-for="branch in branchOptions" :key="branch.id" :value="branch.id">
                    {{ branch.label }}
                  </option>
                </select>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-400">
              Showing: <span class="text-slate-200">{{ selectedBranchLabel }}</span>
            </p>
          </div>

          <div class="mt-6 border-t border-slate-700 pt-4">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab"
                @click="activeTab = tab"
                :class="[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-gold-700 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                ]"
              >
                {{ tab }}
              </button>
            </div>
          </div>

          <div class="mt-6">
          <div v-if="activeTab === 'About Us'">
            <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
              <h3 class="text-white font-semibold mb-2">Description</h3>
              <p class="text-slate-200 leading-relaxed">
                {{ center.description || 'No description available yet.' }}
              </p>
            </div>

            <div class="mt-4 bg-slate-700/60 rounded-xl p-5 border border-slate-600">
              <h3 class="text-white font-semibold mb-2">Offered Services</h3>
              <div v-if="center.services.length" class="flex flex-wrap gap-2">
                <span
                  v-for="(service, index) in center.services"
                  :key="`center-service-${index}-${service}`"
                  class="inline-flex items-center px-3 py-1 rounded-full border border-[#9a7d5c] bg-[#d8c2a2] text-[#4d3724] text-xs font-medium"
                >
                  {{ service }}
                </span>
              </div>
              <p v-else class="text-slate-400 text-sm">No services listed yet.</p>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h4 class="text-slate-200 font-medium mb-2">Contact</h4>
                <p class="text-slate-300 text-sm">Email: {{ center.businessEmail || center.email || 'Not set' }}</p>
                <p class="text-slate-300 text-sm mt-1">Phone: {{ center.contactNumber || 'Not set' }}</p>
              </div>
              <div class="bg-slate-700/60 rounded-xl p-5 border border-slate-600">
                <h4 class="text-slate-200 font-medium mb-2">Address</h4>
                <p class="text-slate-300 text-sm">{{ center.location || 'Not set' }}</p>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'Products & Services'">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
              <div class="flex w-full md:w-auto gap-3">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search..."
                  class="px-3 py-2 rounded-lg bg-slate-800 text-[#4d3724] placeholder:text-[#7a5a3d] border border-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              <button @click="goToCart" class="px-4 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white">
                My Cart ({{ cartCount }})
              </button>
            </div>

            <div v-if="loading" class="text-slate-400 py-10">Loading products and services...</div>
            <div v-else-if="!filteredProducts.length && !filteredServices.length && !filteredConsultations.length" class="text-slate-400 py-10">
              No matching products, services, or consultations found.
            </div>

            <div v-else class="space-y-8">
              <section class="rounded-2xl border border-slate-600 bg-slate-700/35 p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Products</p>
                    <h3 class="mt-1 text-xl font-semibold text-white">Available Products</h3>
                  </div>
                  <span class="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                    {{ filteredProducts.length }}
                  </span>
                </div>

                <div v-if="filteredProducts.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredProducts" :key="item.id" class="bg-slate-700/60 rounded-xl border border-slate-600 overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-white">{{ item.title || item.name }}</h3>
                      <p class="text-[#5a3925] mt-2">PHP {{ Number(item.price || 0).toFixed(2) }}</p>
                      <p class="text-slate-300 text-sm mt-1">{{ item.description || 'No description.' }}</p>

                      <div class="mt-4 flex items-center space-x-2">
                        <button @click="addToCart(item)" class="px-3 py-2 rounded-lg bg-gold-700 hover:bg-gold-800 text-white">
                          Add to Cart
                        </button>
                        <input type="number" min="1" v-model.number="item.quantity" class="w-16 px-2 py-1 rounded-lg bg-slate-800 text-white border border-slate-500" />
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="text-sm text-slate-400">No products posted yet.</p>
              </section>

              <section class="rounded-2xl border border-slate-600 bg-slate-700/35 p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Services</p>
                    <h3 class="mt-1 text-xl font-semibold text-white">Services Offered</h3>
                  </div>
                  <span class="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                    {{ filteredServices.length }}
                  </span>
                </div>

                <div v-if="filteredServices.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredServices" :key="item.id" class="bg-slate-700/60 rounded-xl border border-slate-600 overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-white">{{ item.title || item.name }}</h3>
                      <p class="text-[#5a3925] mt-2">PHP {{ Number(item.price || 0).toFixed(2) }}</p>
                      <p class="text-slate-300 text-sm mt-1">{{ item.description || 'No description.' }}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span
                          v-if="item.requiresConsultationFirst"
                          class="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200"
                        >
                          Consultation required
                        </span>
                        <span
                          v-if="item.requiresConsultationFirst && item.consultationFee != null"
                          class="rounded-full border border-orange-300/40 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-200"
                        >
                          Fee PHP {{ Number(item.consultationFee || 0).toFixed(2) }}
                        </span>
                        <span
                          v-if="item.followUpAllowed"
                          class="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200"
                        >
                          Follow-up allowed
                        </span>
                        <span
                          v-if="item.durationMinutes"
                          class="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200"
                        >
                          {{ item.durationMinutes }} mins
                        </span>
                      </div>

                      <div class="mt-4">
                        <button
                          @click="toggleServiceForBooking(item)"
                          :class="[
                            'px-3 py-2 rounded-lg text-white',
                            isServiceSelected(item)
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          ]"
                        >
                          {{ isServiceSelected(item) ? 'Selected for Booking' : 'Add to Booking' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="text-sm text-slate-400">No services posted yet.</p>
              </section>

              <section class="rounded-2xl border border-slate-600 bg-slate-700/35 p-5">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Consultations</p>
                    <h3 class="mt-1 text-xl font-semibold text-white">Consultation Posts</h3>
                  </div>
                  <span class="rounded-full border border-slate-500 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                    {{ filteredConsultations.length }}
                  </span>
                </div>

                <div v-if="filteredConsultations.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div v-for="item in filteredConsultations" :key="item.id" class="bg-slate-700/60 rounded-xl border border-slate-600 overflow-hidden">
                    <img :src="item.imageUrl || fallbackImage" alt="Item image" class="w-full h-40 object-cover rounded mb-4" />
                    <div class="p-4">
                      <h3 class="text-xl font-semibold text-white">{{ item.title || item.name }}</h3>
                      <p class="text-[#5a3925] mt-2">PHP {{ Number(item.consultationFee || item.price || 0).toFixed(2) }}</p>
                      <p class="text-slate-300 text-sm mt-1">{{ item.description || 'No description.' }}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span class="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200">
                          Consultation
                        </span>
                        <span
                          v-if="item.durationMinutes"
                          class="rounded-full border border-sky-300/40 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200"
                        >
                          {{ item.durationMinutes }} mins
                        </span>
                      </div>
                      <p class="mt-3 text-xs font-semibold text-orange-200">
                        Book this separately from regular services.
                      </p>
                      <div class="mt-4">
                        <button
                          @click="toggleConsultationForBooking(item)"
                          :class="[
                            'px-3 py-2 rounded-lg text-white',
                            isConsultationSelected(item)
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-orange-600 hover:bg-orange-700'
                          ]"
                        >
                          {{ isConsultationSelected(item) ? 'Selected for Booking' : 'Book Consultation' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p v-else class="text-sm text-slate-400">No consultation posts yet.</p>
              </section>
            </div>

            <div v-if="selectedServices.length" class="booking-panel mt-8 rounded-2xl border p-6">
              <div>
                <h4 class="text-lg font-semibold text-white mb-1">Book Appointment</h4>
                <p class="text-xs text-slate-300">Choose one or more services, then pick a schedule from the calendar.</p>
              </div>

              <div class="mt-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_340px] gap-4 items-start">
                <div>
                  <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Appointment Date</label>
                  <div class="booking-calendar rounded-2xl border p-4">
                    <p v-if="bookingAvailabilityHint" class="mb-4 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {{ bookingAvailabilityHint }}
                    </p>
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canGoToPreviousBookingMonth"
                        @click="changeBookingCalendarMonth(-1)"
                      >
                        <Icon icon="mdi:chevron-left" class="h-5 w-5" />
                      </button>
                      <p class="text-sm font-semibold text-white">{{ bookingCalendarMonthLabel }}</p>
                      <button
                        type="button"
                        class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        :disabled="!canGoToNextBookingMonth"
                        @click="changeBookingCalendarMonth(1)"
                      >
                        <Icon icon="mdi:chevron-right" class="h-5 w-5" />
                      </button>
                    </div>

                    <div class="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
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
                    <p class="mt-4 text-xs text-slate-300">{{ selectedBookingDateLabel }}</p>
                  </div>
                </div>
                <div class="space-y-4">
                  <div class="booking-sidecard rounded-2xl border p-4 text-white">
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Selected Services</p>
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
                  <div class="booking-sidecard rounded-2xl border p-4 text-white">
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Selected Schedule</p>
                    <p class="mt-3 text-sm font-semibold text-white">{{ bookingScheduleSummary }}</p>
                    <p class="mt-2 text-sm text-slate-300">
                      Assigned Practitioner:
                      <span class="ml-1 font-semibold text-white">{{ assignedPractitioner?.fullName || '-' }}</span>
                    </p>
                    <p class="mt-3 text-xs text-slate-300">
                      Full payment due:
                      <span class="ml-1 font-semibold text-white">PHP {{ bookingDueAmount.toFixed(2) }}</span>
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      System commission ({{ serviceCommissionPercent }}%):
                      <span class="ml-1 font-semibold text-white">PHP {{ bookingCommissionAmount.toFixed(2) }}</span>
                    </p>
                    <p class="mt-1 text-xs text-slate-300">
                      Clinic share:
                      <span class="ml-1 font-semibold text-white">PHP {{ bookingNetAmount.toFixed(2) }}</span>
                    </p>
                    <p v-if="selectedServiceDurationMinutes" class="mt-1 text-xs text-slate-300">
                      Total duration:
                      <span class="ml-1 font-semibold text-white">{{ selectedServiceDurationMinutes }} mins</span>
                    </p>
                    <div class="mt-4 border-t border-slate-700 pt-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Available Schedules</p>
                      <div v-if="slotsForSelectedDate.length" class="mt-3 grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                        <button
                          v-for="slot in slotsForSelectedDate"
                          :key="slot.key"
                          type="button"
                          class="booking-slot rounded-xl border px-3 py-3 text-left transition"
                          :class="bookingForm.slotKey === slot.key ? 'is-selected' : ''"
                          @click="bookingForm.slotKey = slot.key"
                        >
                          <p class="text-sm font-semibold">
                            Starts at {{ minutesToTime12(parseClockToMinutes(slot.time)) }}
                          </p>
                        </button>
                      </div>
                      <div v-else class="mt-3 rounded-xl border border-dashed border-slate-600 bg-slate-900/50 px-4 py-6 text-sm text-slate-300">
                        {{ hasBookingAvailability ? 'No available time slots for the selected date.' : 'No booking schedule is available yet for this branch.' }}
                      </div>
                    </div>
                    <div class="mt-4 border-t border-slate-700 pt-4">
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Payment Method</p>
                      <div class="mt-2 grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'E-Wallet'
                            ? 'border-emerald-300 bg-emerald-500/15 text-emerald-100'
                            : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800'"
                          @click="bookingPaymentMethod = 'E-Wallet'"
                        >
                          <span class="block font-semibold">E-Wallet</span>
                          <span class="mt-1 block text-xs opacity-80">GCash only.</span>
                        </button>
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'Card'
                            ? 'border-emerald-300 bg-emerald-500/15 text-emerald-100'
                            : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800'"
                          @click="bookingPaymentMethod = 'Card'"
                        >
                          <span class="block font-semibold">Card</span>
                          <span class="mt-1 block text-xs opacity-80">Use credit or debit card.</span>
                        </button>
                        <button
                          type="button"
                          class="rounded-xl border px-3 py-3 text-left text-sm transition"
                          :class="bookingPaymentMethod === 'Bank Transfer'
                            ? 'border-emerald-300 bg-emerald-500/15 text-emerald-100'
                            : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800'"
                          @click="bookingPaymentMethod = 'Bank Transfer'"
                        >
                          <span class="block font-semibold">Bank Transfer</span>
                          <span class="mt-1 block text-xs opacity-80">Uses the bank options from subscription checkout.</span>
                        </button>
                      </div>
                      <div class="mt-3">
                        <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                          Mobile Number <span v-if="bookingPaymentMethod === 'E-Wallet'">*</span>
                        </label>
                        <div class="mt-1 flex items-stretch overflow-hidden rounded-xl border bg-slate-900" :class="bookingPhoneError ? 'border-rose-400' : 'border-slate-700'">
                          <span class="inline-flex items-center border-r border-slate-700 px-3 text-sm font-semibold text-slate-300">+63</span>
                          <input
                            v-model.trim="bookingForm.contactNumber"
                            type="tel"
                            inputmode="tel"
                            autocomplete="tel"
                            maxlength="10"
                            pattern="[0-9]{10}"
                            placeholder="9123456789"
                            class="w-full bg-transparent px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            :required="bookingPaymentMethod === 'E-Wallet'"
                            :aria-invalid="Boolean(bookingPhoneError)"
                            :aria-describedby="bookingPhoneError ? 'booking-phone-error' : undefined"
                            @input="handleBookingPhoneInput"
                            @blur="validateBookingPhoneNumber"
                          />
                        </div>
                        <p class="mt-1 text-xs text-slate-400">
                          {{ bookingPaymentMethod === 'E-Wallet' ? 'Required for GCash checkout.' : 'Optional unless you want to prefill your contact number.' }}
                        </p>
                        <p v-if="bookingPhoneError" id="booking-phone-error" class="mt-1 text-xs text-rose-300">{{ bookingPhoneError }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="availabilityMessage" class="booking-notice mt-2 text-xs">{{ availabilityMessage }}</p>
              <textarea v-model="bookingForm.notes" rows="3" class="mt-4 w-full px-3 py-2 rounded-lg bg-slate-900 text-white border border-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Notes (optional)"></textarea>
              <div class="mt-4 flex gap-3">
                <button
                  @click="submitBooking"
                  :disabled="bookingPaymentSaving"
                  class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-950/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ bookingPaymentSaving ? 'Processing...' : 'Confirm Booking' }}
                </button>
                <button @click="clearBookingSelection" class="px-4 py-2 rounded-lg border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800">Cancel</button>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'Reviews'">
            <div v-if="reviews.length === 0" class="text-slate-300 italic">No reviews yet.</div>
            <div v-else class="space-y-3">
              <article
                v-for="review in reviews"
                :key="review.id"
                class="bg-slate-700/60 rounded-xl border border-slate-600 p-4"
              >
                <p class="text-white font-medium">{{ review.reviewerName || 'Anonymous' }}</p>
                <p class="text-slate-300 mt-2">"{{ review.comment || 'No comment' }}"</p>
              </article>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
    <button
      type="button"
      class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gold-700 text-white shadow-lg hover:bg-gold-800 transition flex items-center justify-center"
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

    <div v-if="showChatModal" class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-2xl bg-slate-800 border border-slate-700 shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div>
            <h3 class="text-white font-semibold">Chat with {{ center.name || 'Clinic' }}</h3>
            <p class="text-xs text-slate-400">This chat is for inquiries and appointments.</p>
          </div>
          <button type="button" class="text-slate-300 hover:text-white" @click="closeChat">
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
        <div class="px-4 pt-4">
          <p class="text-xs text-slate-400 mb-2">Quick questions</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="question in quickQuestions"
              :key="question.key"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs bg-slate-700 text-slate-200 hover:bg-slate-600 transition"
              @click="sendQuickQuestion(question)"
            >
              {{ question.label }}
            </button>
          </div>
        </div>
        <div ref="chatScrollRef" class="px-4 py-4 max-h-[45vh] overflow-y-auto space-y-3">
          <div v-if="chatMessages.length === 0" class="text-sm text-slate-400 text-center">No messages yet. Say hello!</div>
          <div
            v-for="message in chatMessages"
            :key="message.id"
            class="flex"
            :class="message.senderId === currentUserId ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
              :class="message.senderRole === 'system'
                ? 'bg-emerald-700 text-white'
                : message.senderId === currentUserId
                  ? 'bg-gold-700 text-white'
                  : 'bg-slate-700 text-slate-100'"
            >
              <p class="whitespace-pre-wrap">{{ message.text }}</p>
              <p class="mt-1 text-[10px] text-slate-300/80">
                {{ formatChatTime(message.createdAt) }}
              </p>
            </div>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-slate-700">
          <div class="flex items-center gap-2">
            <input
              v-model="chatInput"
              type="text"
              placeholder="Type your message..."
              class="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
            <button
              type="button"
              class="px-3 py-2 rounded-lg bg-gold-700 text-white hover:bg-gold-800 transition"
              @click="sendChat"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showReportModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h3 class="text-lg font-semibold text-white">Report This Center</h3>
            <p class="text-xs text-slate-400">Share any issue you encountered with this clinic page or center.</p>
          </div>
          <button type="button" class="text-slate-300 hover:text-white" @click="closeReportModal">
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <form class="space-y-4 px-5 py-5" @submit.prevent="submitCenterReport">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Category</label>
              <select
                v-model="reportForm.category"
                class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                <option disabled value="">Select category</option>
                <option>Fraud or Scam Concern</option>
                <option>False Information</option>
                <option>Unprofessional Conduct</option>
                <option>Pricing or Billing Issue</option>
                <option>Safety Concern</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Severity</label>
              <select
                v-model="reportForm.severity"
                class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Subject</label>
            <input
              v-model.trim="reportForm.subject"
              type="text"
              class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Short summary of your report"
              required
            />
          </div>

          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Description</label>
            <textarea
              v-model.trim="reportForm.description"
              rows="4"
              class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Tell us what happened."
              required
            ></textarea>
          </div>

          <div>
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Proof Photo (optional)</label>
            <div class="rounded-xl border border-dashed border-slate-600 bg-slate-900/60 p-4">
              <input
                type="file"
                accept="image/*"
                class="text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-600/90 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-500"
                @change="handleReportFileChange"
              />
              <p class="mt-2 text-xs text-slate-500">PNG or JPG, up to 5MB.</p>
              <div v-if="reportProofPreview" class="mt-3 flex items-center gap-4">
                <img :src="reportProofPreview" alt="Report proof preview" class="h-24 w-28 rounded-lg border border-slate-700 object-cover" />
                <button type="button" class="text-xs text-amber-300 hover:text-white" @click="clearReportProof">Remove file</button>
              </div>
              <p v-if="reportFileError" class="mt-2 text-xs text-rose-400">{{ reportFileError }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p class="text-xs text-slate-400">This report goes to the system administrator for review.</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                @click="closeReportModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmittingReport"
                class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ isSubmittingReport ? 'Submitting...' : 'Submit Report' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { addCartItem, readCart } from '@/utils/customerCart'
import { hasExpiredSuspension, restoreExpiredSuspension } from '@/utils/centerSuspension'
import { buildWeekScheduleMap, resolveWeekAssignments } from '@/utils/employeeSchedules'
import { calculateCommissionAmount, calculateNetAmount, getServiceCommissionPercent } from '@/utils/transactionFees'
import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'

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
const showReportModal = ref(false)
const isSubmittingReport = ref(false)
const reportProofFile = ref(null)
const reportProofPreview = ref('')
const reportFileError = ref('')
const reportForm = ref({
  category: '',
  severity: 'Medium',
  subject: '',
  description: '',
})
let savedPageBodyOverflow = ''
let savedPageHtmlOverflow = ''
const REPORT_WINDOW_DAYS = 90
const AUTO_SUSPEND_REPORT_THRESHOLD = 4
const AUTO_SUSPEND_DURATION_DAYS = 7
const CLINIC_ADMIN_ROLES = ['owner', 'clinic admin', 'clinicadmin', 'clinicadministrator']
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
const hasBookingAvailability = computed(() => availableSlots.value.length > 0)
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
  const blockingStatuses = new Set(['scheduled', 'approved', 'paid', 'completed', 'in progress', 'ongoing', 'held'])

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

const isCenterSuspended = (value) => String(value || '').trim().toLowerCase().includes('suspend')

const bookingForm = ref({
  slotKey: '',
  date: '',
  time: '',
  endTime: '',
  contactNumber: '',
  notes: '',
})

const resetReportForm = () => {
  reportForm.value = {
    category: '',
    severity: 'Medium',
    subject: '',
    description: '',
  }
  clearReportProof()
}

const clearReportProofPreview = () => {
  if (reportProofPreview.value) {
    URL.revokeObjectURL(reportProofPreview.value)
  }
  reportProofPreview.value = ''
}

const clearReportProof = () => {
  reportProofFile.value = null
  reportFileError.value = ''
  clearReportProofPreview()
}

const handleReportFileChange = (event) => {
  const file = event.target.files?.[0]
  reportFileError.value = ''

  if (!file) {
    clearReportProof()
    return
  }

  if (!file.type.startsWith('image/')) {
    reportFileError.value = 'Please upload a valid image file.'
    clearReportProof()
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    reportFileError.value = 'Image size must be below 5MB.'
    clearReportProof()
    return
  }

  clearReportProofPreview()
  reportProofFile.value = file
  reportProofPreview.value = URL.createObjectURL(file)
}

const openReportModal = () => {
  if (!auth.currentUser) {
    toast.error('Please log in first.')
    router.push('/login')
    return
  }
  showReportModal.value = true
}

const closeReportModal = () => {
  showReportModal.value = false
  resetReportForm()
}

const toJsDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const isCountedReportStatus = (value) => String(value || '').trim().toLowerCase() !== 'dismissed'

const getClinicAdminRecipients = async (branchId) => {
  const recipients = new Set()
  const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
  if (clinicSnap.exists()) {
    const clinicData = clinicSnap.data() || {}
    const ownerId = String(clinicData.ownerId || '').trim()
    if (ownerId) {
      recipients.add(ownerId)
    }
  }

  const staffSnap = await getDocs(query(collection(db, 'users'), where('branchId', '==', branchId)))
  staffSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {}
    const normalizedRole = String(data.role || '').trim().toLowerCase()
    if (CLINIC_ADMIN_ROLES.includes(normalizedRole)) {
      recipients.add(docSnap.id)
    }
  })

  return recipients
}

const syncCenterReportSummary = async (branchId) => {
  const reportsSnap = await getDocs(query(collection(db, 'supportTickets'), where('centerId', '==', branchId)))
  const reports = reportsSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }))
  const windowStart = Date.now() - (REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const validReports = reports.filter((report) => {
    const createdAt = toJsDate(report.createdAt)
    if (!createdAt) return false
    if (createdAt.getTime() < windowStart) return false
    if (String(report.reportTargetType || '').trim().toLowerCase() !== 'clinic_center') return false
    return isCountedReportStatus(report.status)
  })

  const clinicRef = doc(db, 'clinics', branchId)
  const clinicSnap = await getDoc(clinicRef)
  if (!clinicSnap.exists()) {
    return { validReportCount: validReports.length, autoSuspended: false }
  }

  const clinicData = clinicSnap.data() || {}
  const normalizedStatus = String(clinicData.status || '').trim().toLowerCase()
  const normalizedModerationStatus = String(clinicData.moderationStatus || '').trim().toLowerCase()
  const alreadySuspended = normalizedStatus.includes('suspend') || normalizedModerationStatus.includes('suspend')

  const updates = {
    reportCount: reports.length,
    validReportCount: validReports.length,
    lastReportedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  let autoSuspended = false
  if (!alreadySuspended && validReports.length >= AUTO_SUSPEND_REPORT_THRESHOLD) {
    autoSuspended = true
    updates.status = 'Suspended'
    updates.moderationStatus = 'Auto Suspended'
    updates.isPublished = false
    updates.suspendedAt = serverTimestamp()
    updates.suspensionEndsAt = new Date(Date.now() + (AUTO_SUSPEND_DURATION_DAYS * 24 * 60 * 60 * 1000))
    updates.suspensionReason = `Automatically suspended after ${validReports.length} valid reports within ${REPORT_WINDOW_DAYS} days.`
    updates.suspensionSource = 'auto_reports'
  }

  await updateDoc(clinicRef, updates)
  return { validReportCount: validReports.length, autoSuspended }
}

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
  if (hasExpiredSuspension(data)) {
    await restoreExpiredSuspension(db, branchId, data)
    data.status = 'Active'
    data.moderationStatus = 'Resolved'
    data.isPublished = true
    data.suspendedAt = null
    data.suspensionEndsAt = null
    data.suspensionReason = ''
    data.suspensionSource = ''
  }

  const clinicStatus = String(data.status || '').trim()
  const moderationStatus = String(data.moderationStatus || '').trim()
  const published = data.isPublished === true
  const centerBlocked =
    !published ||
    String(clinicStatus).toLowerCase() === 'inactive' ||
    isCenterSuspended(clinicStatus) ||
    isCenterSuspended(moderationStatus)

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

const availableSlots = computed(() => {
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
        if (overlapsBlockedRange(normalizedMinutes, normalizedMinutes + slotDurationMinutes, blockedRanges)) {
          continue
        }
        slots.push({
          key,
          date: dateKey,
          time,
          endTime: minutesToTime(endMinutes),
          practitionerId: practitioner.id,
          practitionerName: practitioner.fullName,
          endLabel: `${dateKey} - until ${minutesToTime12(endMinutes)} - ${practitioner.fullName}`,
          label: `${dateKey} • ${minutesToTime12(normalizedMinutes)} - ${minutesToTime12(endMinutes)} • ${practitioner.fullName}`
        })
      }
    })
  }

  return slots
})

const availableDates = computed(() => [...new Set(availableSlots.value.map((slot) => slot.date))])
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
    : 'Choose an available date from the calendar.'
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
  return availableSlots.value.filter((slot) => slot.date === bookingForm.value.date)
})

const syncSelectedSlot = () => {
  availabilityMessage.value = ''
  const slot = availableSlots.value.find((entry) => entry.key === bookingForm.value.slotKey)
  if (!slot) {
    assignedPractitioner.value = null
    bookingForm.value.time = ''
    bookingForm.value.endTime = ''
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
  const nextSlot = slotsForSelectedDate.value[0]
  if (nextSlot) {
    bookingForm.value.slotKey = nextSlot.key
  }
  if (selectedServices.value.length && bookingForm.value.date && !slotsForSelectedDate.value.length) {
    availabilityMessage.value = 'No practitioner slots are available on that date.'
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

watch(showReportModal, (isOpen) => {
  setPageScrollLocked(isOpen)
})

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
    await fetch(`${(import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/appointments/reservations/${reservationId}`, {
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
  if (!bookingForm.value.slotKey || !bookingForm.value.date || !bookingForm.value.time || !assignedPractitioner.value) {
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

  const response = await fetch(`${(import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/paymongo/create-checkout-session`, {
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
    const response = await fetch(`${(import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/appointments/finalize-booking`, {
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
    const response = await fetch(`${(import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')}/paymongo/checkout-session/${pending.checkoutSessionId}`, {
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
    String(center.value.status || '').trim().toLowerCase() === 'inactive' ||
    isCenterSuspended(center.value.status) ||
    isCenterSuspended(center.value.moderationStatus)
  ) {
    toast.error('This center is currently unavailable for booking.')
    router.replace({ name: 'centers' })
    return
  }
  if (!selectedServices.value.length || !bookingForm.value.slotKey || !bookingForm.value.date || !bookingForm.value.time || !assignedPractitioner.value) {
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

const submitCenterReport = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error('Please log in first.')
    router.push('/login')
    return
  }

  if (!reportForm.value.category || !reportForm.value.subject || !reportForm.value.description) {
    toast.error('Please complete the report details.')
    return
  }

  isSubmittingReport.value = true

  try {
    const profile = await resolveCustomerProfile()
    const ticketRef = doc(collection(db, 'supportTickets'))
    let proofPath = ''
    let proofUrl = ''

    if (reportProofFile.value) {
      proofPath = `support-tickets/${user.uid}/${ticketRef.id}/${reportProofFile.value.name}`
      const fileRef = storageRef(storage, proofPath)
      await uploadBytes(fileRef, reportProofFile.value)
      proofUrl = await getDownloadURL(fileRef)
    }

    await setDoc(ticketRef, {
      userId: user.uid,
      userEmail: profile?.email || user.email || '',
      userName: profile?.name || 'Customer',
      role: 'Customer',
      userType: 'customer',
      branchId: activeBranchId.value,
      subject: reportForm.value.subject,
      category: reportForm.value.category,
      severity: reportForm.value.severity,
      location: `Customer Center Page > ${center.value.name || 'Center'}`,
      description: reportForm.value.description,
      steps: '',
      proofUrl,
      proofPath,
      status: 'Open',
      centerId: activeBranchId.value,
      centerName: center.value.name || 'Center',
      reportTargetType: 'clinic_center',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'notifications'), {
      recipientRole: 'Superadmin',
      senderId: user.uid,
      type: 'center_report',
      title: 'Center Report Submitted',
      message: `${center.value.name || 'Center'} was reported by ${profile?.name || 'Customer'}.`,
      link: '/superadmin/tickets',
      read: false,
      createdAt: serverTimestamp(),
    })

    const clinicAdminRecipients = await getClinicAdminRecipients(activeBranchId.value)

    await Promise.all(
      Array.from(clinicAdminRecipients)
        .filter((recipientUserId) => recipientUserId && recipientUserId !== user.uid)
        .map((recipientUserId) =>
          addDoc(collection(db, 'notifications'), {
            recipientUserId,
            senderId: user.uid,
            type: 'center_report_notice',
            title: 'Center Report Filed',
            message: `${center.value.name || 'Your center'} has been reported and is awaiting super admin review.`,
            link: '/notifications',
            read: false,
            createdAt: serverTimestamp(),
          })
        )
    )

    const moderationSummary = await syncCenterReportSummary(activeBranchId.value)

    if (moderationSummary.autoSuspended) {
      await Promise.all(
        Array.from(clinicAdminRecipients)
          .filter((recipientUserId) => recipientUserId && recipientUserId !== user.uid)
          .map((recipientUserId) =>
            addDoc(collection(db, 'notifications'), {
              recipientUserId,
              senderId: user.uid,
              type: 'center_auto_suspension',
              title: 'Center Automatically Suspended',
              message: `${center.value.name || 'Your center'} was automatically suspended after reaching ${moderationSummary.validReportCount} valid reports.`,
              link: '/notifications',
              read: false,
              createdAt: serverTimestamp(),
            })
          )
      )

      await addDoc(collection(db, 'notifications'), {
        recipientRole: 'Superadmin',
        senderId: user.uid,
        type: 'center_auto_suspension',
        title: 'Center Automatically Suspended',
        message: `${center.value.name || 'Center'} reached ${moderationSummary.validReportCount} valid reports and was automatically suspended for ${AUTO_SUSPEND_DURATION_DAYS} days.`,
        link: '/superadmin/tickets',
        read: false,
        createdAt: serverTimestamp(),
      })
    }

    await addDoc(collection(db, 'notifications'), {
      recipientUserId: user.uid,
      senderId: user.uid,
      type: 'center_report',
      title: 'Center Report Submitted',
      message: `Your report for ${center.value.name || 'this center'} has been received.`,
      link: '/notifications',
      read: false,
      createdAt: serverTimestamp(),
    })

    toast.success(
      moderationSummary.autoSuspended
        ? `Your report has been submitted. This center is now automatically suspended for ${AUTO_SUSPEND_DURATION_DAYS} days pending review.`
        : 'Your report has been submitted.'
    )
    closeReportModal()
  } catch (error) {
    console.error(error)
    toast.error('Failed to submit the report.')
  } finally {
    isSubmittingReport.value = false
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
        const available = published && status !== 'inactive' && !isCenterSuspended(status) && !isCenterSuspended(moderationStatus)
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
  clearReportProofPreview()
})

const formatChatTime = (timestamp) => {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.customer-center-page {
  color: #f8fafc;
}

.customer-center-page main {
  background:
    radial-gradient(circle at top left, rgba(217, 119, 6, 0.14), transparent 30%),
    radial-gradient(circle at bottom right, rgba(15, 23, 42, 0.35), transparent 28%),
    linear-gradient(180deg, #1b120d 0%, #120c09 100%);
}

.customer-center-page main :deep(.booking-panel) {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.22);
}

.customer-center-page main :deep(.booking-card) {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
  border-color: rgba(148, 163, 184, 0.25);
}

.customer-center-page main :deep(.booking-calendar) {
  background: rgba(15, 23, 42, 0.94);
  border-color: rgba(148, 163, 184, 0.18);
}

.customer-center-page main :deep(.booking-day) {
  background: rgba(30, 41, 59, 0.96);
  color: #f8fafc;
  border-color: rgba(100, 116, 139, 0.35);
}

.customer-center-page main :deep(.booking-day:hover) {
  background: rgba(71, 85, 105, 0.95);
}

.customer-center-page main :deep(.booking-day.is-selected) {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: #fff;
  border-color: rgba(45, 212, 191, 0.95);
  box-shadow: 0 12px 28px rgba(13, 148, 136, 0.35);
}

.customer-center-page main :deep(.booking-day.is-available) {
  background: rgba(16, 185, 129, 0.12);
  color: #d1fae5;
  border-color: rgba(16, 185, 129, 0.45);
}

.customer-center-page main :deep(.booking-day.is-disabled) {
  background: rgba(15, 23, 42, 0.55);
  color: rgba(148, 163, 184, 0.7);
}

.customer-center-page main :deep(.booking-day-dot) {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  margin-top: 0.3rem;
  transition: transform 0.18s ease, opacity 0.18s ease, background-color 0.18s ease;
}

.customer-center-page main :deep(.booking-day-dot-available) {
  background: #34d399;
  opacity: 0.95;
}

.customer-center-page main :deep(.booking-day-dot-selected) {
  background: #fbbf24;
  transform: scale(1.1);
  opacity: 1;
}

.customer-center-page main :deep(.booking-day-dot-disabled) {
  background: rgba(148, 163, 184, 0.35);
  opacity: 0.6;
}

.customer-center-page main :deep(.booking-slot) {
  background: rgba(15, 23, 42, 0.94);
  border-color: rgba(100, 116, 139, 0.35);
  color: #f8fafc;
}

.customer-center-page main :deep(.booking-slot.is-selected) {
  background: rgba(217, 119, 6, 0.18);
  border-color: rgba(251, 191, 36, 0.9);
  color: #fff;
}

.customer-center-page main :deep(.booking-sidecard) {
  background: rgba(15, 23, 42, 0.92);
  border-color: rgba(148, 163, 184, 0.22);
}

.customer-center-page main :deep(.booking-notice) {
  color: #fde68a;
}
</style>
