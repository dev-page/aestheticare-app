<template>
  <div :class="embedded ? 'verification-embedded' : 'flex module-theme bg-slate-900 min-h-screen'">
    <SuperAdminSidebar v-if="!embedded" />

    <main v-page-loading="{ active: pageLoading, variant: 'table', columns: 4, rows: 5 }" :class="embedded ? 'min-w-0' : 'min-w-0 flex-1 p-8'">
      <div class="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Clinic Verification</h1>
          <p class="text-slate-400">Pending clinic owner registrations waiting for admin approval.</p>
        </div>

        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
          :disabled="loading"
          :aria-label="loading ? 'Refreshing clinics' : 'Refresh clinics'"
          :title="loading ? 'Refreshing clinics' : 'Refresh clinics'"
          @click="refreshClinicLists"
        >
          <svg aria-hidden="true" class="h-4 w-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg>
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-rose-400">{{ error }}</p>
      <input v-model.trim="registrationSearch" type="search" placeholder="Filter clinic, owner, email, status, or plan..." class="mb-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" />

      <nav class="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 p-2" aria-label="Clinic verification categories">
        <button
          v-for="tab in verificationTabs"
          :key="tab.id"
          type="button"
          class="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition"
          :class="activeTab === tab.id ? 'verification-tab-active shadow-sm' : 'text-[#5a3b28] hover:bg-[#f3e4d1] hover:text-[#3d2518]'"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="activeTab = tab.id"
        >
          {{ tab.label }} <span class="ml-1 text-xs opacity-80">({{ tab.count }})</span>
        </button>
      </nav>

      <section v-if="activeTab === 'ocr'" class="overflow-hidden rounded-xl border border-emerald-700/60 bg-slate-800 shadow-sm">
        <div class="flex flex-col gap-3 border-b border-slate-700 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-white">OCR Verified</h2>
            <p class="mt-0.5 text-sm text-slate-400">Ready for administrator approval.</p>
          </div>
          <button
            type="button"
            class="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed"
            :class="selectedOcrVerified.length
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'border border-slate-600 bg-slate-900/60 text-slate-500'"
            :disabled="processing || !selectedOcrVerified.length"
            @click="batchApproveOcrVerified"
          >
            {{ selectedOcrVerified.length ? `Batch approve (${selectedOcrVerified.length})` : 'Select registrations to approve' }}
          </button>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full min-w-[620px] table-fixed text-sm">
          <colgroup>
            <col class="w-14" />
            <col />
            <col />
            <col class="w-24" />
          </colgroup>
          <thead class="border-b border-slate-700 bg-slate-900/40">
            <tr>
              <th class="px-4 py-3 text-center"><input type="checkbox" aria-label="Select all OCR verified registrations" :checked="ocrVerifiedClinics.length && selectedOcrVerified.length === ocrVerifiedClinics.length" @change="toggleAllOcrVerified($event.target.checked)" /></th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Full Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Email</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td class="px-4 py-5 text-center text-slate-300" colspan="4">Loading registrations...</td>
            </tr>
            <tr v-else-if="!ocrVerifiedClinics.length">
              <td class="px-4 py-5 text-center text-slate-400" colspan="4">No OCR-verified registrations.</td>
            </tr>
            <tr v-for="row in paginatedOcrClinics" :key="row.id" class="border-b border-slate-700/50 transition-colors last:border-b-0 hover:bg-slate-700/25">
              <td class="px-4 py-3 text-center"><input type="checkbox" :value="row.id" v-model="selectedOcrVerified" :aria-label="`Select ${row.fullName}`" /></td>
              <td class="px-4 py-3 font-medium text-slate-100" :title="row.fullName">
                <span class="block truncate">{{ row.fullName }}</span>
                <span v-if="row.verificationResults?.some(result => result.checks.expiryWarning)" class="mt-1 block text-[11px] font-medium text-amber-300">Document expiring within 30 days</span>
              </td>
              <td class="truncate px-4 py-3 text-slate-300" :title="row.email || 'No email available'">{{ row.email || '—' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                  @click="openDetails(row)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <TablePagination v-model:page="ocrPage" v-model:page-size="registrationPageSize" :total-items="ocrVerifiedClinics.length" />
      </section>

      <section v-else-if="activeTab === 'manual'" class="bg-slate-800 border border-amber-700/60 rounded-xl overflow-hidden">
        <div class="px-4 py-4 border-b border-slate-700"><h2 class="text-lg font-semibold text-white">Manual Review Required</h2><p class="text-sm text-slate-400">Review document details individually before deciding.</p></div>
        <table class="w-full text-sm"><thead class="border-b border-slate-700"><tr><th class="text-left text-slate-300 px-4 py-3">Full Name</th><th class="text-left text-slate-300 px-4 py-3">OCR result</th><th class="text-left text-slate-300 px-4 py-3">Action</th></tr></thead>
          <tbody><tr v-if="loading"><td class="px-4 py-3 text-slate-200" colspan="3">Loading registrations...</td></tr><tr v-else-if="!manualReviewClinics.length"><td class="px-4 py-3 text-slate-400" colspan="3">No registrations need manual review.</td></tr>
            <tr v-for="row in paginatedManualClinics" :key="row.id" class="border-b border-slate-700/50 last:border-b-0"><td class="px-4 py-3 text-slate-100">{{ row.fullName }}</td><td class="px-4 py-3"><span class="px-2 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/20 text-amber-300">{{ row.verificationStatus || 'Not processed' }}</span></td><td class="px-4 py-3"><button type="button" class="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs" @click="openDetails(row)">Review</button></td></tr>
          </tbody></table>
        <TablePagination v-model:page="manualPage" v-model:page-size="registrationPageSize" :total-items="manualReviewClinics.length" />
      </section>

      <section v-else-if="activeTab === 'rejected'" class="bg-slate-800 border border-rose-700/60 rounded-xl overflow-hidden">
        <div class="px-4 py-4 border-b border-slate-700"><h2 class="text-lg font-semibold text-white">Rejected Registrations</h2><p class="text-sm text-slate-400">Overview of clinic registrations that were rejected, including the recorded reason.</p></div>
        <div class="overflow-x-auto"><table class="rejected-registration-table w-full min-w-[620px] text-sm"><thead class="border-b border-slate-700"><tr><th class="text-left text-slate-300 px-4 py-3">Applicant</th><th class="text-left text-slate-300 px-4 py-3">Email</th><th class="text-left text-slate-300 px-4 py-3">Rejection reason</th><th class="text-left text-slate-300 px-4 py-3">Rejected date</th></tr></thead><tbody><tr v-if="loadingRejectedRegistrations"><td class="px-4 py-3 text-slate-200" colspan="4">Loading rejected registrations...</td></tr><tr v-else-if="!filteredRejectedRegistrations.length"><td class="px-4 py-3 text-slate-400" colspan="4">No rejected clinic registrations.</td></tr><tr v-for="row in paginatedRejectedRegistrations" :key="row.id" class="border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/25"><td class="px-4 py-3 text-slate-100">{{ row.applicantName || 'Unnamed Applicant' }}</td><td class="px-4 py-3 text-slate-300">{{ row.email || '—' }}</td><td class="px-4 py-3 text-slate-300 whitespace-normal">{{ row.reason || 'No reason recorded' }}</td><td class="px-4 py-3 text-slate-300">{{ formatDateValue(row.rejectedAt) }}</td></tr></tbody></table></div>
        <TablePagination v-model:page="rejectedPage" v-model:page-size="registrationPageSize" :total-items="filteredRejectedRegistrations.length" />
      </section>
      <section v-else class="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div class="px-4 py-4 border-b border-slate-700">
          <h2 class="text-lg font-semibold text-white">Approved Clinics</h2>
          <p class="text-slate-400 text-sm">List of clinics that have been approved and verified.</p>
        </div>
        <table class="w-full text-sm">
          <thead class="border-b border-slate-700">
            <tr>
              <th class="text-left text-slate-300 px-4 py-3">Clinic Name</th>
              <th class="text-left text-slate-300 px-4 py-3">Owner</th>
              <th class="text-left text-slate-300 px-4 py-3">Subscription</th>
              <th class="text-left text-slate-300 px-4 py-3">Center Status</th>
              <th class="text-left text-slate-300 px-4 py-3">Verified Date</th>
              <th class="text-left text-slate-300 px-4 py-3">Reported Issues</th>
              <th class="text-left text-slate-300 px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingVerifiedClinics">
              <td class="px-4 py-3 text-slate-200" colspan="7">Loading approved clinics...</td>
            </tr>
            <tr v-else-if="!verifiedClinics.length">
              <td class="px-4 py-3 text-slate-200" colspan="7">No approved clinics yet.</td>
            </tr>
            <tr
              v-else
              v-for="clinic in paginatedVerifiedClinics"
              :key="clinic.id"
              class="border-b border-slate-700/60 last:border-b-0"
            >
              <td class="px-4 py-3 text-slate-100">
                <div class="font-semibold">{{ clinic.clinicName || clinic.clinicBranch || 'Unnamed Clinic' }}</div>
                <div class="text-xs text-slate-400">{{ clinic.clinicLocation || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <div class="font-medium">{{ clinic.ownerName }}</div>
                <div class="text-xs text-slate-400">{{ clinic.ownerEmail || '-' }}</div>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <div class="font-medium">{{ clinic.planLabel }}</div>
                <div class="text-xs text-slate-400">Status: {{ clinic.paymentStatus || '-' }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-md text-xs font-medium" :class="statusClass(clinic.centerStatus)">
                  {{ clinic.centerStatus }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-300">{{ clinic.approvedAtLabel }}</td>
              <td class="px-4 py-3">
                <span class="rounded-md border px-2 py-1 text-xs font-medium" :class="clinic.complaintCount ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200'">
                  {{ clinic.complaintCount }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs"
                  @click="openDetails(clinic)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <TablePagination v-model:page="approvedPage" v-model:page-size="registrationPageSize" :total-items="filteredVerifiedClinics.length" />
      </section>

      <div v-if="showModal && selectedRecord" class="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
        <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <div class="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 class="text-2xl text-white font-semibold">Clinic Registration Details</h2>
              <p class="text-slate-400 text-sm">{{ isAwaitingResubmission(selectedRecord) ? 'Waiting for the applicant to submit replacement documents.' : isPendingRecord(selectedRecord) ? 'Review and approve/reject this clinic owner registration.' : 'View the approved clinic registration and its verification record.' }}</p>
            </div>
            <button class="text-slate-300 hover:text-white" @click="closeModal">Close</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Full Name</p>
              <p class="text-white">{{ selectedRecord.fullName }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Email</p>
              <p class="text-white">{{ selectedRecord.email || '-' }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Clinic Name</p>
              <p class="text-white">{{ selectedRecord.clinicName || '-' }}</p>
            </div>
            <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-1">Clinic Location</p>
              <p class="text-white">{{ selectedRecord.clinicLocation || '-' }}</p>
            </div>
          </div>

          <section class="mb-6">
            <h3 class="text-white font-semibold mb-3">Registration Details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div v-for="item in [
                ['Birth Date', formatDateValue(selectedRecord.birthDate)],
                ['Contact Number', selectedRecord.contactNumber],
                ['Business Permit Holder', selectedRecord.permitHolderName],
                ['Registrant / Permit Holder', selectedRecord.permitHolderIsRegistrant === true ? 'Same person' : selectedRecord.permitHolderIsRegistrant === false ? 'Different people — authorization review required' : 'Not declared'],
                ['Registrant Role / Relationship', selectedRecord.permitHolderRelationship],
                ['House / Building Number', selectedRecord.clinicBuildingNumber],
                ['Street / Subdivision / Village', selectedRecord.clinicStreetName],
                ['Barangay', selectedRecord.clinicBarangay],
                ['Province', selectedRecord.clinicProvince],
                ['Postal Code', selectedRecord.clinicPostalCode],
                ['Resolved Address', selectedRecord.clinicLocationAddress],
              ['Coordinates', selectedRecord.clinicLocationLat && selectedRecord.clinicLocationLng ? `${selectedRecord.clinicLocationLat}, ${selectedRecord.clinicLocationLng}` : 'Not available'],
              ]" :key="item[0]" class="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <p class="text-xs text-slate-400 mb-1">{{ item[0] }}</p>
                <p class="text-sm text-white break-words">{{ item[1] || '-' }}</p>
              </div>
            </div>
          </section>

          <section class="mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 class="text-white font-semibold mb-3">Registration Submissions</h3>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p class="text-xs text-slate-400">Document submissions used</p>
                <p class="mt-1 text-lg font-semibold text-white">{{ selectedRecord.submissionAttemptCount || 0 }} of {{ selectedRecord.submissionAttemptLimit || 3 }}</p>
                <p class="mt-1 text-xs text-slate-500">Includes the original submission and any resubmissions. Rejection history: {{ selectedRecord.resubmissionCount || 0 }}.</p>
              </div>
              <div v-if="selectedRecord.registrationLockedUntil" class="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p class="text-xs text-red-200">Registration lockout ends</p>
                <p class="mt-1 text-sm font-semibold text-white">{{ formatDateValue(selectedRecord.registrationLockedUntil) }}</p>
              </div>
            </div>
          </section>

          <section class="mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 class="text-white font-semibold mb-3">Clinic Platform Agreement</h3>
            <div v-if="selectedRecord.platformAgreementAcceptance" class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-slate-400">Signed by</p>
                <p class="text-white break-words">{{ selectedRecord.platformAgreementAcceptance.signerName || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">Signer email</p>
                <p class="text-white break-words">{{ selectedRecord.platformAgreementAcceptance.signerEmail || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">Agreement version</p>
                <p class="text-white break-words">{{ selectedRecord.platformAgreementAcceptance.version || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">Accepted at</p>
                <p class="text-white">{{ formatDateValue(selectedRecord.platformAgreementAcceptance.acceptedAt) }}</p>
              </div>
              <div class="md:col-span-2">
                <p class="text-xs text-slate-400 mb-2">Electronic signature</p>
                <img
                  v-if="selectedRecord.platformAgreementAcceptance.signatureImage"
                  :src="selectedRecord.platformAgreementAcceptance.signatureImage"
                  alt="Clinic platform agreement electronic signature"
                  class="max-h-28 max-w-full rounded-lg border border-slate-600 bg-white object-contain p-2"
                />
                <p v-else class="text-slate-400">Signature image unavailable.</p>
              </div>
            </div>
            <p v-else class="text-sm text-slate-400">No clinic agreement acceptance was recorded for this registration.</p>
          </section>

          <section class="mb-6 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="text-white font-semibold">Automatic Verification and OCR</h3>
                <p class="text-xs text-slate-400">Document text extraction and automatic checks ran when the applicant uploaded each file.</p>
              </div>
              <span class="px-2 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/20 text-amber-200 capitalize">
                {{ selectedRecord.verificationStatus || 'Not processed' }}
              </span>
            </div>
            <p class="mt-2 text-xs text-slate-400">
              Processed: {{ formatDateValue(selectedRecord.verificationProcessedAt) }}
              <span v-if="selectedRecord.verificationThreshold !== null"> · Automatic threshold: {{ Math.round(Number(selectedRecord.verificationThreshold) * 100) }}%</span>
            </p>
            <div class="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-slate-300">Total verification score</span>
                <strong class="text-lg text-white">{{ getOverallConfidence(selectedRecord.verificationResults) === null ? 'Not available' : `${getOverallConfidence(selectedRecord.verificationResults)}%` }}</strong>
              </div>
              <p class="mt-1 text-[11px] text-slate-500">Weighted OCR and consistency checks. This does not prove document authenticity.</p>
              <div v-if="getOverallConfidence(selectedRecord.verificationResults) !== null" class="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  class="h-full rounded-full bg-emerald-500 transition-all"
                  :style="{ width: `${getOverallConfidence(selectedRecord.verificationResults)}%` }"
                ></div>
              </div>
            </div>
            <div v-if="selectedRecord.verificationResults?.length" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <article v-for="result in selectedRecord.verificationResults" :key="result.key" class="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <p class="text-sm font-medium text-slate-100">{{ documentLabel(result.key) }}</p>
                  <div class="flex flex-wrap justify-end gap-1.5">
                    <span v-if="result.checks.expiryWarning" class="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">Expiring soon</span>
                    <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize" :class="result.status === 'verified' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'">{{ result.status }}</span>
                  </div>
                </div>
                <div class="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Document score</p>
                    <p class="mt-1 text-2xl font-semibold text-white">{{ result.confidence }}<span class="text-base text-slate-400">%</span></p>
                  </div>
                  <div class="w-24 pb-1">
                    <div class="h-2 overflow-hidden rounded-full bg-slate-700">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="result.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-400'"
                        :style="{ width: `${Math.min(100, Math.max(0, result.confidence))}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div class="mt-4 border-t border-slate-800 pt-3">
                  <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Assessment</p>
                  <p class="mt-1 text-xs leading-relaxed text-slate-300">{{ result.reason }}</p>
                  <p v-if="result.checks.expiryDate" class="mt-2 text-xs" :class="result.checks.expiryWarning || result.checks.expiryAccountHold ? 'text-amber-200' : 'text-slate-400'">
                    Expiry: {{ result.checks.expiryDate }}<span v-if="result.checks.expiryDaysRemaining !== null"> · {{ result.checks.expiryDaysRemaining }} day{{ result.checks.expiryDaysRemaining === 1 ? '' : 's' }} remaining</span>
                  </p>
                </div>
              </article>
            </div>
            <p v-else class="mt-4 text-xs text-slate-500">No automatic verification result is stored for this registration.</p>
          </section>

          <section class="mb-6">
            <h3 class="text-white font-semibold mb-3">Submitted Documents</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article v-for="docItem in selectedRecord.documents" :key="docItem.key" class="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p class="text-sm text-slate-200 mb-3">{{ docItem.label }}</p>
                <div v-if="docItem.url">
                  <img
                    v-if="docItem.isImage"
                    :src="docItem.url"
                    :alt="docItem.label"
                    class="w-full h-44 object-cover rounded-lg border border-slate-600 mb-2"
                  />
                  <a
                    :href="docItem.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sky-300 hover:text-sky-200 text-xs underline"
                  >
                    Open Document
                  </a>
                </div>

                <p v-else class="text-slate-500 text-xs">No file uploaded.</p>
              </article>
            </div>
          </section>

          <div v-if="isAwaitingResubmission(selectedRecord)" class="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Resubmission was requested. Verification actions will be available again after the applicant submits replacement documents.
          </div>

          <section v-if="isPendingRecord(selectedRecord)" class="mb-4">
            <label class="block text-xs text-slate-400 mb-1">Review remark (required for resubmission or rejection)</label>
            <textarea
              v-model="rejectionRemark"
              rows="3"
              placeholder="Explain what the applicant needs to correct..."
              class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
            ></textarea>
          </section>

          <div v-if="isPendingRecord(selectedRecord)" class="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="processing || isAwaitingResubmission(selectedRecord)"
              @click="approveSelected"
            >
              {{ processing ? 'Processing...' : 'Approve' }}
            </button>

            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="processing || isAwaitingResubmission(selectedRecord)"
              @click="requestResubmission"
            >
              {{ processing ? 'Processing...' : 'Request Resubmission' }}
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="processing || isAwaitingResubmission(selectedRecord)"
              @click="rejectSelected"
            >
              {{ processing ? 'Processing...' : 'Reject' }}
            </button>
          </div>
          <div v-else class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            This clinic is already approved. Approval and rejection actions are unavailable.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { doc, getDoc, getDocs, collection, onSnapshot, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { systemAdminSwal } from '@/utils/systemAdminAlert'
import { db } from '@/config/firebaseConfig'
import SuperAdminSidebar from '@/components/sidebar/SuperAdminSidebar.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import { OTP_BACKEND_CANDIDATES, OTP_BACKEND_URL } from '@/utils/runtimeConfig'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'

const normalizePlanLabel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Not specified'
  if (raw.includes('free')) return 'FreePlan'
  if (raw.includes('basic')) return 'Basic'
  if (raw.includes('premium')) return 'Premium'
  return value
}

const normalizeStatusLabel = (registrationStatus, clinicStatus, userStatus) => {
  const publicStatus = String(registrationStatus || '').trim()
  if (publicStatus) return publicStatus
  const internalStatus = String(clinicStatus || userStatus || '').trim().toLowerCase()
  if (internalStatus.includes('approved')) return 'Approved'
  if (internalStatus.includes('rejected')) return 'Rejected'
  return 'Pending'
}

const isPendingRecord = (record) => {
  const status = String(record?.approvalStatus || record?.status || '').trim().toLowerCase()
  return status.includes('pending approval') || status.includes('manual review') || status.includes('pending')
}

const isAwaitingResubmission = (record) => {
  const status = String(record?.approvalStatus || record?.status || '').trim().toLowerCase()
  return Boolean(record?.resubmissionRequired) && status.includes('pending documents')
}

const formatApplicantName = (user = {}, fallback = {}) => {
  const getValue = (...keys) => keys.map((key) => user[key] || fallback[key]).find(Boolean) || ''
  const parts = [getValue('firstName'), getValue('midName', 'middleName'), getValue('lastName'), getValue('suffix')]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return parts.join(' ') || String(user.fullName || fallback.fullName || '').trim() || 'Unnamed User'
}

const getResubmissionCount = async (email, applicantType) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return 0
  const snapshot = await getDocs(query(
    collection(db, 'registrationRejectionHistory'),
    where('email', '==', normalizedEmail),
  ))
  return snapshot.docs.filter((item) => item.data()?.applicantType === applicantType).length
}

const mapDocs = (submittedDocuments = {}, draftDocuments = {}) => {
  const docs = { ...(draftDocuments || {}), ...(submittedDocuments || {}) }
  const definitions = [
    { key: 'governmentIdRepresentativeFront', label: 'Government-Issued ID of Registrant (Front)' },
    { key: 'governmentIdRepresentativeBack', label: 'Government-Issued ID of Registrant (Back)' },
    { key: 'businessPermit', label: 'Business Permit/Registration' },
    { key: 'dohAccreditation', label: 'DOH License to Operate' },
    { key: 'birRegistration', label: 'BIR 2303 or Certificate of Registration' },
    { key: 'sanitaryCertificate', label: 'Sanitary Certificate' },
  ]
  if (docs.authorizationLetter) {
    definitions.push({ key: 'authorizationLetter', label: 'Authorization Letter / Proof of Authority' })
  }

  return definitions.map((item) => {
    const file = docs?.[item.key] || {}
    const url = String(file?.url || '').trim()
    const type = String(file?.type || '').toLowerCase()
    return {
      key: item.key,
      label: item.label,
      url,
      isImage: type.startsWith('image/'),
      documentNumber: String(file?.documentNumber || file?.number || '').trim(),
      expiryDate: String(file?.expiryDate || '').trim(),
    }
  })
}

const verificationDocumentOrder = [
  'governmentIdRepresentativeFront',
  'governmentIdRepresentativeBack',
  'businessPermit',
  'dohAccreditation',
  'birRegistration',
  'sanitaryCertificate',
  'authorizationLetter',
]

const mapVerificationResults = (verificationResults = {}) => Object.entries(verificationResults || {})
  .sort(([firstKey], [secondKey]) => {
    const firstIndex = verificationDocumentOrder.indexOf(firstKey)
    const secondIndex = verificationDocumentOrder.indexOf(secondKey)
    return (firstIndex < 0 ? verificationDocumentOrder.length : firstIndex)
      - (secondIndex < 0 ? verificationDocumentOrder.length : secondIndex)
  })
  .map(([key, result = {}]) => ({
  key,
  status: String(result.status || 'manual_review').replaceAll('_', ' '),
  confidence: Number.isFinite(Number(result.confidence)) ? Math.round(Number(result.confidence) * 100) : 0,
  ocrConfidence: Number.isFinite(Number(result.ocrConfidence)) ? Math.round(Number(result.ocrConfidence) * 100) : null,
  checks: {
    readableText: result.checks?.readableText ?? null,
    nameMatch: result.checks?.nameMatch ?? null,
    numberMatch: result.checks?.numberMatch ?? result.checks?.documentNumberDetected ?? null,
    expiryValid: result.checks?.expiryValid ?? null,
    expiryDate: String(result.checks?.expiryDate || '').trim(),
    expiryDaysRemaining: Number.isFinite(Number(result.checks?.expiryDaysRemaining)) ? Number(result.checks.expiryDaysRemaining) : null,
    expiryAccountHold: result.checks?.expiryAccountHold === true,
    expiryWarning: result.checks?.expiryWarning === true,
  },
  scoreBreakdown: result.scoreBreakdown || null,
  reason: String(result.reason || 'No verification explanation was returned.'),
  extractedText: String(result.extractedText || '').trim(),
  }))

const formatDateValue = (value) => {
  if (!value) return '-'
  const date = value?.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}

const documentLabel = (key) => ({
  governmentIdRepresentativeFront: 'Government-Issued ID of Registrant (Front)',
  governmentIdRepresentativeBack: 'Government-Issued ID of Registrant (Back)',
  businessPermit: 'Business Permit/Registration',
  dohAccreditation: 'DOH License to Operate',
  birRegistration: 'BIR 2303 or Certificate of Registration',
  sanitaryCertificate: 'Sanitary Certificate',
  authorizationLetter: 'Authorization Letter / Proof of Authority',
}[key] || key)

const getOverallConfidence = (results = []) => {
  const scores = results.map((result) => Number(result.confidence)).filter((score) => Number.isFinite(score))
  if (!scores.length) return null
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
}

const getPlanDurationDays = (planKey) => (planKey === 'free-trial' ? 14 : 30)
const toDateFromPayment = (paidSeconds, createdSeconds) => {
  const baseMillis = paidSeconds
    ? paidSeconds * 1000
    : createdSeconds
      ? createdSeconds * 1000
      : Date.now()
  return new Date(baseMillis)
}

export default {
  name: 'SuperAdminClinicVerification',
  components: { SuperAdminSidebar, TablePagination },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const auth = getAuth()
    const loading = ref(false)
    const processing = ref(false)
    const error = ref('')
    const pendingClinics = ref([])
    const activeTab = ref('ocr')
    const registrationSearch = ref('')
    const registrationPageSize = ref(10)
    const ocrPage = ref(1)
    const manualPage = ref(1)
    const approvedPage = ref(1)
    const rejectedPage = ref(1)
    const rejectedRegistrations = ref([])
    const loadingRejectedRegistrations = ref(false)
    const selectedOcrVerified = ref([])
    const matchesRegistrationSearch = (record) => {
      const keyword = registrationSearch.value.toLowerCase()
      return !keyword || [record.clinicName, record.fullName, record.ownerName, record.email, record.ownerEmail, record.verificationStatus, record.approvalStatus, record.registrationStatus, record.planLabel, record.centerStatus].join(' ').toLowerCase().includes(keyword)
    }
    const filteredPendingClinics = computed(() => pendingClinics.value.filter(matchesRegistrationSearch))
    const ocrVerifiedClinics = computed(() => filteredPendingClinics.value.filter((clinic) => String(clinic.verificationStatus || '').trim().toLowerCase() === 'ocr verified'))
    const manualReviewClinics = computed(() => filteredPendingClinics.value.filter((clinic) => String(clinic.verificationStatus || '').trim().toLowerCase() !== 'ocr verified'))
    const paginatedOcrClinics = computed(() => ocrVerifiedClinics.value.slice((ocrPage.value - 1) * registrationPageSize.value, ocrPage.value * registrationPageSize.value))
    const paginatedManualClinics = computed(() => manualReviewClinics.value.slice((manualPage.value - 1) * registrationPageSize.value, manualPage.value * registrationPageSize.value))
    const filteredRejectedRegistrations = computed(() => rejectedRegistrations.value.filter(matchesRegistrationSearch))
    const paginatedRejectedRegistrations = computed(() => filteredRejectedRegistrations.value.slice((rejectedPage.value - 1) * registrationPageSize.value, rejectedPage.value * registrationPageSize.value))
    const verificationTabs = computed(() => [
      { id: 'ocr', label: 'OCR Verified', count: ocrVerifiedClinics.value.length },
      { id: 'manual', label: 'Manual Review', count: manualReviewClinics.value.length },
      { id: 'rejected', label: 'Rejected', count: rejectedRegistrations.value.length },
      { id: 'approved', label: 'Approved Clinics', count: verifiedClinics.value.length },
    ])
    let unsubscribeClinics = null

    const showModal = ref(false)
    const selectedRecord = ref(null)
    const rejectionRemark = ref('')
    const forcedPlanByEmail = {
      'kenken.leon31@gmail.com': { plan: 'basic', paymentStatus: 'paid' },
    }

    // Verified clinics list
    const verifiedClinics = ref([])
    const loadingVerifiedClinics = ref(false)
    const filteredVerifiedClinics = computed(() => verifiedClinics.value.filter(matchesRegistrationSearch))
    const paginatedVerifiedClinics = computed(() => filteredVerifiedClinics.value.slice((approvedPage.value - 1) * registrationPageSize.value, approvedPage.value * registrationPageSize.value))

    // Paginated verified clinics (infinite scroll / load more)
    const verifiedPageSize = 20
    const verifiedLastDoc = ref(null)
    const hasMoreVerified = ref(true)

    const loadVerifiedClinics = trackPageLoad(async (reset = false) => {
      if (reset) {
        verifiedClinics.value = []
        verifiedLastDoc.value = null
        hasMoreVerified.value = true
      }

      if (!hasMoreVerified.value) return

      loadingVerifiedClinics.value = true
      try {
        let q
        if (!verifiedLastDoc.value) {
          q = query(collection(db, 'clinics'), /* return most recent approved by approvedAt */)
        } else {
          q = query(collection(db, 'clinics'))
        }

        // Use a lightweight page fetch and filter approved client-side to avoid heavy full scans
        // We'll fetch by approvedAt descending if available via backend indexes or createdAt as fallback
        // Build a query with limit to page size
        if (!verifiedLastDoc.value) {
          q = query(collection(db, 'clinics'))
        } else {
          q = query(collection(db, 'clinics'))
        }

        // perform fetch and then filter and sort locally
        const snap = await getDocs(q)
        const approved = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((clinic) => String(clinic.approvalStatus || '').toLowerCase().includes('approved'))

        const rows = await Promise.all(
          approved.map(async (clinic) => {
            const ownerLookupId = clinic.ownerId || clinic.ownerUid || clinic.userId || clinic.uid || clinic.branchAdminId || clinic.id
            const userSnap = await getDoc(doc(db, 'users', ownerLookupId))
            const user = userSnap.exists() ? userSnap.data() : {}
            const clinicName = String(
              clinic.ownerName || clinic.registrantName || clinic.fullName || clinic.applicantName || clinic.branchAdminName || ''
            ).trim()
            const clinicFirstName = String(clinic.firstName || '').trim()
            const clinicLastName = String(clinic.lastName || '').trim()
            const fullName = formatApplicantName(user, clinic).replace('Unnamed User', '').trim()
              || clinicName
              || `${clinicFirstName} ${clinicLastName}`.trim()
              || 'Unnamed Owner'

            const resolvedPlan = clinic.subscriptionPlan || user.subscriptionPlan || clinic.plan || user.plan || ''
            const resolvedPayment = clinic.paymentStatus || user.paymentStatus || ''
            const approvedAt = clinic.approvedAt || user.approvedAt || null
            const complaintsSnap = await getDocs(query(
              collection(db, 'supportTickets'),
              where('branchId', '==', clinic.id),
            ))

            return {
              id: clinic.id,
              approvalStatus: clinic.approvalStatus || 'Approved',
              clinicName: clinic.clinicName || clinic.clinicBranch || '',
              clinicBranch: clinic.clinicBranch || '',
              clinicLocation: clinic.clinicLocation || clinic.clinicLocationAddress || clinic.clinicBranch || '',
              middleName: user.midName || user.middleName || '',
              suffix: user.suffix || '',
              birthDate: user.birthDate || null,
              contactNumber: user.contactNumber || clinic.contactNumber || '',
              authorizedRepPosition: clinic.authorizedRepPosition || user.authorizedRepPosition || '',
              companyName: clinic.companyName || user.companyName || clinic.clinicName || '',
              companyType: clinic.companyType || user.companyType || '',
              clinicLocationAddress: clinic.clinicLocationAddress || '',
              clinicBuildingNumber: clinic.clinicBuildingNumber || '',
              clinicStreetName: clinic.clinicStreetName || '',
              clinicBarangay: clinic.clinicBarangay || '',
              clinicProvince: clinic.clinicProvince || '',
              clinicPostalCode: clinic.clinicPostalCode || '',
              clinicLocationLat: clinic.clinicLocationLat || '',
              clinicLocationLng: clinic.clinicLocationLng || '',
              fullName,
              email: user.email || clinic.ownerEmail || clinic.email || clinic.registrantEmail || clinic.applicantEmail || '',
              ownerName: fullName,
              ownerEmail: user.email || clinic.ownerEmail || clinic.email || clinic.registrantEmail || clinic.applicantEmail || '',
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              centerStatus: clinic.status || clinic.moderationStatus || 'Active',
              approvedAtLabel: approvedAt && approvedAt.toDate ? approvedAt.toDate().toLocaleDateString() : '-',
              approvedAt: approvedAt || null,
              platformAgreementAcceptance: clinic.platformAgreementAcceptance || null,
              permitHolderIsRegistrant: typeof clinic.permitHolderIsRegistrant === 'boolean' ? clinic.permitHolderIsRegistrant : null,
              permitHolderName: clinic.permitHolderName || '',
              permitHolderRelationship: clinic.permitHolderRelationship || '',
              documents: mapDocs(clinic.submittedDocuments || {}, clinic.draftDocuments || {}),
              verificationStatus: clinic.verificationStatus || 'Not processed',
              verificationThreshold: clinic.verificationThreshold || null,
              verificationProcessedAt: clinic.verificationProcessedAt || null,
              verificationResults: mapVerificationResults(clinic.verificationResults),
              complaintCount: complaintsSnap.size,
            }
          })
        )

        const sortedRows = sortRecordsNewestFirst(rows)
        verifiedClinics.value = sortedRows
        hasMoreVerified.value = false
      } catch (err) {
        console.error('Failed to load verified clinics:', err)
        if (!verifiedClinics.value.length) verifiedClinics.value = []
      } finally {
        loadingVerifiedClinics.value = false
      }
    })

    const loadMoreVerifiedClinics = () => loadVerifiedClinics(false)

    const ensurePageInRange = (page, count) => {
      const total = Math.max(1, Math.ceil(count / registrationPageSize.value))
      if (page.value > total) page.value = total
    }
    watch([registrationSearch, registrationPageSize], () => {
      ocrPage.value = 1
      manualPage.value = 1
      approvedPage.value = 1
      rejectedPage.value = 1
    })
    watch(ocrVerifiedClinics, (rows) => ensurePageInRange(ocrPage, rows.length))
    watch(manualReviewClinics, (rows) => ensurePageInRange(manualPage, rows.length))
    watch(filteredVerifiedClinics, (rows) => ensurePageInRange(approvedPage, rows.length))
    watch(filteredRejectedRegistrations, (rows) => ensurePageInRange(rejectedPage, rows.length))

    const fetchFromBackend = trackPageLoad(async (path, options = {}) => {
      const candidates = OTP_BACKEND_CANDIDATES
      let lastError = null

      for (const baseUrl of candidates) {
        try {
          const response = await fetch(`${baseUrl}${path}`, options)
          if (response.status === 404) {
            lastError = new Error(`Endpoint not found on ${baseUrl}`)
            continue
          }
          const contentType = response.headers.get('content-type') || ''
          if (!contentType.toLowerCase().includes('application/json')) {
            lastError = new Error(`Non-JSON response from ${baseUrl}`)
            continue
          }
          return response
        } catch (err) {
          lastError = err
        }
      }

      throw lastError || new Error(`Failed to reach backend service at ${BACKEND_URL}. Ensure otp-backend is running.`)
    })

    const loadPendingClinics = () => {
      if (unsubscribeClinics) unsubscribeClinics()
      loading.value = true
      error.value = ''
      unsubscribeClinics = pageListener(onSnapshot, collection(db, 'clinics'), async (clinicsSnap) => {
        try {
        const clinicRecords = await Promise.all(clinicsSnap.docs.map(async (docSnap) => {
          const clinic = { id: docSnap.id, ...docSnap.data() }
          const wasAutoApproved =
            String(clinic.approvalStatus || '').toLowerCase() === 'approved' &&
            String(clinic.verificationProcessedBy || '').toLowerCase() === 'automatic_processor' &&
            !clinic.approvedBy

          if (wasAutoApproved) {
            await Promise.all([
              updateDoc(doc(db, 'clinics', clinic.id), {
                approvalStatus: 'Pending Approval',
                registrationStatus: 'Pending Review',
                verificationStatus: 'OCR Verified',
                updatedAt: serverTimestamp(),
              }),
              updateDoc(doc(db, 'users', clinic.id), {
                status: 'Pending Review',
                approvalStatus: 'Pending Approval',
                registrationStatus: 'Pending Review',
                verificationStatus: 'OCR Verified',
                updatedAt: serverTimestamp(),
              }),
            ])
            clinic.approvalStatus = 'Pending Approval'
            clinic.registrationStatus = 'Pending Review'
            clinic.verificationStatus = 'OCR Verified'
          }

          return clinic
        }))
        const pending = clinicRecords
          .filter((clinic) => {
            const status = String(clinic.approvalStatus || '').toLowerCase()
            return status.includes('pending approval') || status.includes('manual review') || status.includes('pending documents')
          })

        const rows = await Promise.all(
          pending.map(async (clinic) => {
            const ownerLookupId = clinic.ownerId || clinic.ownerUid || clinic.userId || clinic.uid || clinic.branchAdminId || clinic.id
            const userSnap = await getDoc(doc(db, 'users', ownerLookupId))
            const user = userSnap.exists() ? userSnap.data() : {}
            const clinicName = String(
              clinic.ownerName || clinic.registrantName || clinic.fullName || clinic.applicantName || clinic.branchAdminName || ''
            ).trim()
            const clinicFirstName = String(clinic.firstName || '').trim()
            const clinicLastName = String(clinic.lastName || '').trim()
            const fullName = formatApplicantName(user, clinic).replace('Unnamed User', '').trim()
              || clinicName
              || `${clinicFirstName} ${clinicLastName}`.trim()
              || 'Unnamed User'

            const normalizedEmail = String(user.email || clinic.email || clinic.ownerEmail || clinic.registrantEmail || '').trim().toLowerCase()
            const resubmissionCount = await getResubmissionCount(normalizedEmail, 'clinic')
            const forcedPlan = forcedPlanByEmail[normalizedEmail] || null

            if (forcedPlan) {
              const paymentsSnap = await getDocs(query(
                collection(db, 'planPayments'),
                where('payerEmail', '==', normalizedEmail),
                where('status', '==', 'Paid'),
              ))

              let latestPayment = null
              paymentsSnap.forEach((docSnap) => {
                const data = docSnap.data() || {}
                const createdAt = data.createdAt?.seconds || 0
                if (!latestPayment || createdAt > latestPayment.createdAt) {
                  latestPayment = {
                    id: docSnap.id,
                    paidAtSeconds: Number(data.paymongoPaidAt || 0),
                    createdAt,
                  }
                }
              })

              const startedAt = toDateFromPayment(latestPayment?.paidAtSeconds || 0, latestPayment?.createdAt || 0)
              const expiresAt = new Date(
                startedAt.getTime() + getPlanDurationDays(forcedPlan.plan) * 24 * 60 * 60 * 1000
              )

              await Promise.all([
                updateDoc(doc(db, 'clinics', clinic.id), {
                  subscriptionPlan: forcedPlan.plan,
                  paymentStatus: forcedPlan.paymentStatus,
                  paymentId: latestPayment?.id || clinic.paymentId || user.paymentId || null,
                  subscriptionStartedAt: startedAt,
                  subscriptionExpiresAt: expiresAt,
                }),
                updateDoc(doc(db, 'users', clinic.id), {
                  subscriptionPlan: forcedPlan.plan,
                  paymentStatus: forcedPlan.paymentStatus,
                  paymentId: latestPayment?.id || clinic.paymentId || user.paymentId || null,
                  subscriptionStartedAt: startedAt,
                  subscriptionExpiresAt: expiresAt,
                }),
              ])
            }

            const resolvedPlan = forcedPlan?.plan || clinic.subscriptionPlan || user.subscriptionPlan || clinic.plan || user.plan
            const resolvedPayment = forcedPlan?.paymentStatus || clinic.paymentStatus || user.paymentStatus || '-'

            return {
              id: clinic.id,
              approvalStatus: clinic.approvalStatus || 'Pending Approval',
              registrationStatus: clinic.registrationStatus || user.registrationStatus || '',
              resubmissionRequired: Boolean(clinic.resubmissionRequired),
              submissionAttemptCount: Math.min(3, Math.max(
                Number(clinic.submissionAttemptCount || 0),
                Number(clinic.resubmissionCount || 0) + (clinic.documentsSubmittedAt ? 1 : 0),
              )),
              submissionAttemptLimit: 3,
              registrationLockedUntil: clinic.registrationLockedUntil || null,
              resubmissionCount,
              fullName,
              email: normalizedEmail,
              resubmissionCount,
              middleName: user.midName || user.middleName || '',
              suffix: user.suffix || '',
              birthDate: user.birthDate || null,
              contactNumber: user.contactNumber || clinic.contactNumber || '',
              authorizedRepPosition: clinic.authorizedRepPosition || user.authorizedRepPosition || '',
              companyName: clinic.companyName || user.companyName || clinic.clinicName || '',
              companyType: clinic.companyType || user.companyType || '',
              statusLabel: normalizeStatusLabel(clinic.registrationStatus || user.registrationStatus, clinic.approvalStatus, user.status),
              clinicName: clinic.clinicName || clinic.companyName || user.companyName || '',
              clinicLocation: clinic.clinicLocation || clinic.clinicLocationAddress || '',
              clinicLocationAddress: clinic.clinicLocationAddress || '',
              clinicBuildingNumber: clinic.clinicBuildingNumber || '',
              clinicStreetName: clinic.clinicStreetName || '',
              clinicBarangay: clinic.clinicBarangay || '',
              clinicProvince: clinic.clinicProvince || '',
              clinicPostalCode: clinic.clinicPostalCode || '',
              clinicLocationLat: clinic.clinicLocationLat || '',
              clinicLocationLng: clinic.clinicLocationLng || '',
              planKey: String(resolvedPlan || '').trim().toLowerCase(),
              planLabel: normalizePlanLabel(resolvedPlan),
              paymentStatus: resolvedPayment,
              platformAgreementAcceptance: clinic.platformAgreementAcceptance || null,
              permitHolderIsRegistrant: typeof clinic.permitHolderIsRegistrant === 'boolean' ? clinic.permitHolderIsRegistrant : null,
              permitHolderName: clinic.permitHolderName || '',
              permitHolderRelationship: clinic.permitHolderRelationship || '',
              documents: mapDocs(clinic.submittedDocuments || {}, clinic.draftDocuments || {}),
              verificationStatus: clinic.verificationStatus || 'Not processed',
              verificationThreshold: clinic.verificationThreshold || null,
              verificationProcessedAt: clinic.verificationProcessedAt || null,
              verificationResults: mapVerificationResults(clinic.verificationResults),
              createdAt: clinic.createdAt || user.createdAt || null,
            }
          })
        )

        pendingClinics.value = sortRecordsNewestFirst(rows)
        selectedOcrVerified.value = selectedOcrVerified.value.filter((id) => pendingClinics.value.some((clinic) => clinic.id === id && String(clinic.verificationStatus || '').toLowerCase() === 'ocr verified'))
      } catch (err) {
        console.error('Failed to load pending clinic registrations:', err)
        error.value = 'Failed to load clinic verification list. Please try again.'
      } finally {
        loading.value = false
      }
      }, (snapshotError) => {
        console.error('Failed to listen to pending clinic registrations:', snapshotError)
        error.value = 'Failed to listen for clinic registration updates.'
        loading.value = false
      })
    }

    const loadRejectedRegistrations = async () => {
      loadingRejectedRegistrations.value = true
      try {
        const snapshot = await getDocs(query(collection(db, 'registrationRejectionHistory'), where('applicantType', '==', 'clinic')))
        rejectedRegistrations.value = sortRecordsNewestFirst(snapshot.docs.map((item) => {
          const data = item.data() || {}
          return { id: item.id, ...data, fullName: data.applicantName || data.email || 'Unnamed Applicant', clinicName: data.clinicName || '', rejectionReason: data.reason || '' }
        }))
      } catch (err) {
        console.error('Failed to load rejected clinic registrations:', err)
        error.value = 'Failed to load rejected clinic registrations. Please try again.'
      } finally {
        loadingRejectedRegistrations.value = false
      }
    }

    const refreshClinicLists = async () => {
      await Promise.all([loadPendingClinics(), loadVerifiedClinics(true), loadRejectedRegistrations()])
    }

    const openDetails = (record) => {
      selectedRecord.value = record
      rejectionRemark.value = ''
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      selectedRecord.value = null
      rejectionRemark.value = ''
    }

    const toggleAllOcrVerified = (selected) => {
      selectedOcrVerified.value = selected ? ocrVerifiedClinics.value.map((clinic) => clinic.id) : []
    }

    const batchApproveOcrVerified = async () => {
      const selected = ocrVerifiedClinics.value.filter((clinic) => selectedOcrVerified.value.includes(clinic.id))
      if (!selected.length) return
      const confirmation = await systemAdminSwal.fire({
        title: 'Batch approve registrations?',
        text: `Approve ${selected.length} OCR-verified clinic registration${selected.length === 1 ? '' : 's'}?`,
        icon: 'question', showCancelButton: true, confirmButtonText: 'Approve selected', cancelButtonText: 'Cancel',
      })
      if (!confirmation.isConfirmed) return
      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) throw new Error('Missing authorization token')
        const reviewer = auth.currentUser?.uid || null
        for (const clinic of selected) {
          const response = await fetchFromBackend('/admin/clinic/approve', {
            method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ uid: clinic.id, reviewer, note: 'Batch-approved after OCR verification.' }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || !payload?.success) throw new Error(payload?.error || `Failed to approve ${clinic.fullName}.`)
        }
        selectedOcrVerified.value = []
        await systemAdminSwal.fire({ title: 'Approved', text: `${selected.length} registration${selected.length === 1 ? '' : 's'} approved.`, icon: 'success' })
        await Promise.all([loadPendingClinics(), loadVerifiedClinics(true)])
      } catch (err) {
        error.value = err?.message || 'Batch approval failed.'
      } finally {
        processing.value = false
      }
    }

    const runClinicVerification = async () => {
      if (!selectedRecord.value) return

      const result = await systemAdminSwal.fire({
        title: 'Run Automatic Verification?',
        text: 'The clinic documents will be processed with OCR. Low-confidence results will remain for manual review.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Run verification',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : ''
        if (!token) throw new Error('Missing authorization token')
        const response = await fetchFromBackend('/admin/trigger-clinic-registration-verification', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: selectedRecord.value.id, applicantType: 'clinic' }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Automatic verification failed.')

        await systemAdminSwal.fire({
          title: 'Verification Complete',
          text: payload.data?.status === 'Automatically Verified'
            ? 'All clinic documents passed the automatic verification threshold.'
            : 'The documents require manual review because one or more confidence scores were below the threshold.',
          icon: payload.data?.status === 'Automatically Verified' ? 'success' : 'info',
          confirmButtonText: 'Continue',
        })
        closeModal()
        await loadPendingClinics()
        await loadVerifiedClinics(true)
      } catch (err) {
        console.error('Failed to run clinic document verification:', err)
        error.value = err?.message || 'Automatic verification failed. Please try again.'
      } finally {
        processing.value = false
      }
    }

    const approveSelected = async () => {
      if (!selectedRecord.value) return

      const result = await systemAdminSwal.fire({
        title: 'Approve Registration?',
        text: `Approve ${selectedRecord.value.fullName} as a verified clinic owner?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, approve',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) throw new Error('Missing authorization token')
        const reviewerId = auth.currentUser?.uid || null

        // Call backend to approve so that audit/history and welcome email are handled server-side
        const response = await fetchFromBackend('/admin/clinic/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: selectedRecord.value.id, reviewer: reviewerId, note: '' }),
        })

        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to approve registration')
        }

        await systemAdminSwal.fire({
          title: 'Approved',
          text: 'Clinic registration has been approved.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })

        closeModal()
        await loadPendingClinics()
        await loadVerifiedClinics(true)
      } catch (err) {
        console.error('Failed to approve clinic registration:', err)
        error.value = 'Failed to approve registration. Please try again.'
      } finally {
        processing.value = false
      }
    }

    const requestResubmission = async () => {
      if (!selectedRecord.value) return
      const remark = String(rejectionRemark.value || '').trim()
      if (!remark) {
        await systemAdminSwal.fire({
          title: 'Remark Required',
          text: 'Explain what the applicant must correct before requesting resubmission.',
          icon: 'warning',
        })
        return
      }

      const result = await systemAdminSwal.fire({
        title: 'Request Document Resubmission?',
        text: `Return ${selectedRecord.value.fullName} to document upload while keeping the registration active?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Request resubmission',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) throw new Error('Missing authorization token')
        const response = await fetchFromBackend('/admin/request-clinic-resubmission', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: selectedRecord.value.id,
            resubmissionReason: remark,
            reviewedBy: auth.currentUser?.uid || null,
          }),
        })
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to request document resubmission.')
        }

        await systemAdminSwal.fire({
          title: 'Resubmission Requested',
          text: payload.data?.emailSent
            ? 'The applicant can continue the registration, verify their email again, and upload replacement documents.'
            : 'The account is ready for replacement documents, but the email could not be sent. Contact the applicant manually.',
          icon: 'success',
        })
        closeModal()
        await loadPendingClinics()
      } catch (err) {
        console.error('Failed to request clinic document resubmission:', err)
        error.value = 'Failed to request document resubmission. Please try again.'
      } finally {
        processing.value = false
      }
    }

    const rejectSelected = async () => {
      if (!selectedRecord.value) return
      const remark = String(rejectionRemark.value || '').trim()
      if (!remark) {
        await systemAdminSwal.fire({
          title: 'Remark Required',
          text: 'Please enter a rejection reason before rejecting this registration.',
          icon: 'warning',
        })
        return
        }

      const result = await systemAdminSwal.fire({
        title: 'Reject Registration?',
        text: `Reject ${selectedRecord.value.fullName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, reject',
        cancelButtonText: 'Cancel',
      })
      if (!result.isConfirmed) return

      processing.value = true
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
        if (!token) {
          throw new Error('Missing authorization token')
        }
        const reviewerId = auth.currentUser?.uid || null
        const response = await fetchFromBackend('/admin/reject-clinic-registration', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uid: selectedRecord.value.id,
            rejectionReason: remark,
            reviewedBy: reviewerId,
          }),
        })

        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Failed to reject and delete account.')
        }

        await systemAdminSwal.fire({
          title: 'Rejected',
          text: payload.data?.emailSent
            ? 'Clinic registration was rejected, the account was removed, and an email with the reason and re-registration link was sent.'
            : 'Clinic registration was rejected and the account was removed. The email could not be sent, so contact the applicant manually.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        })

        closeModal()
        await loadPendingClinics()
      } catch (err) {
        console.error('Failed to reject clinic registration:', err)
        error.value = 'Failed to reject registration. Please try again.'
      } finally {
        processing.value = false
      }
    }
    onMounted(trackPageLoad(async () => { await Promise.all([loadPendingClinics(), loadVerifiedClinics(), loadRejectedRegistrations()]) }))
    onUnmounted(() => unsubscribeClinics?.())

    return {
      pageLoading,
      loading,
      processing,
      error,
      pendingClinics,
      activeTab,
      registrationSearch,
      registrationPageSize,
      ocrPage,
      manualPage,
      approvedPage,
      rejectedPage,
      loadingRejectedRegistrations,
      filteredRejectedRegistrations,
      paginatedRejectedRegistrations,
      verificationTabs,
      ocrVerifiedClinics,
      manualReviewClinics,
      paginatedOcrClinics,
      paginatedManualClinics,
      selectedOcrVerified,
      verifiedClinics,
      filteredVerifiedClinics,
      paginatedVerifiedClinics,
      isPendingRecord,
      isAwaitingResubmission,
      loadingVerifiedClinics,
      showModal,
      selectedRecord,
      rejectionRemark,
      loadPendingClinics,
      refreshClinicLists,
      loadVerifiedClinics,
      openDetails,
      closeModal,
      approveSelected,
      toggleAllOcrVerified,
      batchApproveOcrVerified,
      requestResubmission,
      rejectSelected,
      runClinicVerification,
      formatDateValue,
      documentLabel,
      getOverallConfidence,
      statusClass: (value) => {
        const normalized = String(value || '').trim().toLowerCase()
        if (normalized.includes('review')) {
          return 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
        }
        return 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
      }
    }
  },
}
</script>

<style scoped>
.verification-tab-active {
  background-color: #5b3a29 !important;
  color: #fff7e8 !important;
}

.verification-tab-active span { color: #fff7e8 !important; }

.verification-tab-active:hover {
  background-color: #472b1e !important;
  color: #fffdf7 !important;
}

.verification-tab-active:hover span { color: #fffdf7 !important; }

@media (max-width: 640px) {
  .rejected-registration-table {
    display: block;
    min-width: 0 !important;
    white-space: normal;
  }

  .rejected-registration-table thead {
    display: none;
  }

  .rejected-registration-table tbody,
  .rejected-registration-table tr {
    display: block;
    width: 100%;
  }

  .rejected-registration-table tr:not(:has(td[colspan])) {
    padding: 0.5rem 0;
  }

  .rejected-registration-table td:not([colspan]) {
    display: grid;
    grid-template-columns: minmax(6.5rem, 34%) minmax(0, 1fr);
    gap: 0.75rem;
    max-width: none !important;
    overflow: visible !important;
    padding: 0.5rem 0.75rem !important;
    text-align: left;
  }

  .rejected-registration-table td:nth-child(1)::before { content: 'Applicant'; }
  .rejected-registration-table td:nth-child(2)::before { content: 'Email'; }
  .rejected-registration-table td:nth-child(3)::before { content: 'Reason'; }
  .rejected-registration-table td:nth-child(4)::before { content: 'Rejected'; }
  .rejected-registration-table td:not([colspan])::before {
    color: #94a3b8;
    font-size: 0.7rem;
    font-weight: 600;
  }
}
</style>

