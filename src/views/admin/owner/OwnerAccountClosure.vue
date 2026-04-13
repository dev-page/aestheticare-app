<template>
  <div class="flex min-h-screen owner-theme bg-[#2a180f] text-[#f3e7e0]">
    <OwnerSidebar />

    <main class="flex-1 px-4 py-6 md:px-8 closure-page-shell">
      <div class="mx-auto max-w-7xl space-y-6">
        <section class="rounded-[2rem] border border-[#5a3927] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_42%),linear-gradient(180deg,_rgba(58,36,23,0.98),_rgba(42,24,15,0.98))] p-6 shadow-[0_24px_60px_rgba(20,12,8,0.45)]">
          <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.28em] text-[#d2b7a6]">Account & Settings</p>
              <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#f3e7e0]">Account Closure</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-[#e2c7b6]">
                Close owner access safely while preserving clinic records for audit, compliance, and business continuity.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <div class="rounded-2xl border border-[#5a3927] bg-[#24160f] px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">Retention</p>
                <p class="mt-1 text-sm font-semibold text-[#f3e7e0]">7 years</p>
              </div>
              <div class="rounded-2xl border border-[#5a3927] bg-[#24160f] px-4 py-3">
                <p class="text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">Access</p>
                <p class="mt-1 text-sm font-semibold text-[#f3e7e0]">Owner login only</p>
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div class="space-y-6">
            <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-5">
              <div class="flex items-start gap-4">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#5a3927] bg-[#3a2417] text-[#d2b7a6]">
                  <Icon icon="mdi:account-off-outline" class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-[#f3e7e0]">What happens when you close the account</h2>
                  <p class="mt-2 text-sm leading-6 text-[#e2c7b6]">
                    The owner login is disabled, but clinic records remain in the system for continuity, review, and legal support.
                  </p>
                </div>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-2">
                <div v-for="item in retainedRecords" :key="item.title" class="rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                  <p class="text-sm font-semibold text-[#f3e7e0]">{{ item.title }}</p>
                  <p class="mt-1 text-xs leading-5 text-[#d2b7a6]">{{ item.description }}</p>
                </div>
              </div>
            </article>

            <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold text-[#f3e7e0]">Choose closure type</h2>
                  <p class="mt-1 text-sm text-[#e2c7b6]">Use transfer when another admin will take over the main branch. Close owner-only if the clinic continues under the same business.</p>
                </div>
                <span class="rounded-full border border-[#5a3927] bg-[#3a2417] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">
                  Preferred: Transfer first
                </span>
              </div>

              <div class="mt-5 grid gap-3">
                <label
                  v-for="option in closureOptions"
                  :key="option.value"
                  class="closure-option"
                  :class="{ 'closure-option-active': form.action === option.value }"
                >
                  <input v-model="form.action" type="radio" :value="option.value" class="mt-1 h-4 w-4 accent-[#8d5a3b]" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-[#f3e7e0]">{{ option.title }}</p>
                    <p class="mt-1 text-xs leading-5 text-[#d2b7a6]">{{ option.description }}</p>
                  </div>
                </label>
              </div>

              <div v-if="form.action === 'transfer'" class="mt-5 rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                <label class="block text-sm font-semibold text-[#f3e7e0]">Transfer ownership email</label>
                <input
                  v-model.trim="form.transferEmail"
                  type="email"
                  placeholder="new-owner@clinic.com"
                  class="mt-2 w-full rounded-xl border border-[#5a3927] bg-[#24160f] px-4 py-3 text-[#f3e7e0] outline-none focus:border-[#8d5a3b]"
                />
                <p class="mt-2 text-xs leading-5 text-[#d2b7a6]">
                  Use this if another admin will take over the clinic before closure.
                </p>
              </div>
            </article>

            <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-5">
              <h2 class="text-lg font-semibold text-[#f3e7e0]">Confirmation</h2>
              <p class="mt-1 text-sm text-[#e2c7b6]">
                Please review the acknowledgements below before submitting the request.
              </p>

              <div class="mt-5 space-y-3">
                <label class="flex items-start gap-3 rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                  <input v-model="form.acknowledgeAccess" type="checkbox" class="mt-1 h-4 w-4 accent-[#8d5a3b]" />
                  <span class="text-sm leading-6 text-[#e2c7b6]">I understand my owner access will be disabled.</span>
                </label>
                <label class="flex items-start gap-3 rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                  <input v-model="form.acknowledgeRetention" type="checkbox" class="mt-1 h-4 w-4 accent-[#8d5a3b]" />
                  <span class="text-sm leading-6 text-[#e2c7b6]">
                    I understand clinic records will remain stored for audit, compliance, and continuity purposes.
                  </span>
                </label>
                <label class="flex items-start gap-3 rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                  <input v-model="form.acknowledgeReview" type="checkbox" class="mt-1 h-4 w-4 accent-[#8d5a3b]" />
                  <span class="text-sm leading-6 text-[#e2c7b6]">
                    I understand full clinic shutdown, if requested, is subject to review and approval.
                  </span>
                </label>
              </div>
            </article>
          </div>

          <aside class="space-y-6">
            <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-5">
              <h2 class="text-lg font-semibold text-[#f3e7e0]">Retention purpose</h2>
              <p class="mt-2 text-sm leading-6 text-[#e2c7b6]">
                We retain closed-account clinic data so the business can preserve history, respond to audits, support legal claims, and keep branch records consistent.
              </p>
              <div class="mt-4 rounded-2xl border border-[#5a3927] bg-[#2a180f] p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">Suggested policy</p>
                <p class="mt-1 text-sm font-semibold text-[#f3e7e0]">Keep records for 7 years after closure</p>
              </div>
            </article>

            <article class="rounded-[1.75rem] border border-[#5a3927] bg-[#24160f] p-5">
              <h2 class="text-lg font-semibold text-[#f3e7e0]">Closure note</h2>
              <p class="mt-2 text-sm text-[#e2c7b6]">
                This request is optional and review-based. If your clinic has another administrator, ownership transfer is the safest route.
              </p>

              <label class="mt-4 block text-sm font-semibold text-[#f3e7e0]">Reason or note</label>
              <textarea
                v-model.trim="form.reason"
                rows="5"
                placeholder="Optional. Add context for the review team."
                class="mt-2 w-full rounded-xl border border-[#5a3927] bg-[#2a180f] px-4 py-3 text-[#f3e7e0] outline-none focus:border-[#8d5a3b]"
              ></textarea>

              <label class="mt-4 block text-sm font-semibold text-[#f3e7e0]">Type to confirm</label>
              <input
                v-model.trim="form.confirmation"
                type="text"
                placeholder="CLOSE MY ACCOUNT"
                class="mt-2 w-full rounded-xl border border-[#5a3927] bg-[#2a180f] px-4 py-3 text-[#f3e7e0] outline-none focus:border-[#8d5a3b]"
              />

              <button
                type="button"
                class="mt-5 w-full rounded-xl bg-[#8d5a3b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#6f4329] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!canSubmit || submitting"
                @click="submitClosureRequest"
              >
                {{ submitting ? 'Submitting...' : 'Submit Closure Request' }}
              </button>
              <p class="mt-3 text-xs leading-5 text-[#d2b7a6]">
                This creates a review request. Depending on the chosen action, the owner account may be closed, the main branch may be transferred, or the clinic may be shut down.
              </p>
            </article>
          </aside>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { getAuth } from 'firebase/auth'
import { addDoc, collection, getDocs, query, serverTimestamp, where, doc, getDoc } from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { auth, db } from '@/config/firebaseConfig'

const RETENTION_CONFIRMATION = 'CLOSE MY ACCOUNT'

const retainedRecords = [
  {
    title: 'Clinic records',
    description: 'Branch info, appointments, clients, and service history stay available for continuity.',
  },
  {
    title: 'Finance history',
    description: 'Payroll, reports, refunds, and transactions remain for auditing and legal review.',
  },
  {
    title: 'Audit logs',
    description: 'Activity records are preserved to track actions taken before account closure.',
  },
  {
    title: 'Branch data',
    description: 'Connected branch records are not removed by closing the owner login.',
  },
]

const closureOptions = [
  {
    value: 'deactivate',
    title: 'Close owner account only',
    description: 'Best if another admin is already handling the clinic. Staff and branch records stay active.',
  },
  {
    value: 'transfer',
    title: 'Transfer main branch ownership',
    description: 'Use this if another clinic admin should take over the main branch before closure.',
  },
  {
    value: 'delete',
    title: 'Request full clinic shutdown',
    description: 'Use this when the clinic is closing and staff accounts should be deactivated too.',
  },
]

const form = reactive({
  action: 'deactivate',
  transferEmail: '',
  reason: '',
  confirmation: '',
  acknowledgeAccess: false,
  acknowledgeRetention: false,
  acknowledgeReview: false,
})

const submitting = ref(false)

const canSubmit = computed(() => {
  const confirmed = form.confirmation.trim().toUpperCase() === RETENTION_CONFIRMATION
  const baseChecks = form.acknowledgeAccess && form.acknowledgeRetention && form.acknowledgeReview && confirmed
  if (!baseChecks) return false
  if (form.action === 'transfer') {
    return Boolean(form.transferEmail.trim())
  }
  return true
})

const submitClosureRequest = async () => {
  if (!canSubmit.value) {
    toast.error('Please complete all confirmations first.')
    return
  }

  submitting.value = true
  try {
    const currentUser = auth.currentUser || getAuth().currentUser
    if (!currentUser) {
      toast.error('You need to be logged in to submit a closure request.')
      return
    }

    const [userSnap, clinicsSnap] = await Promise.all([
      getDoc(doc(db, 'users', currentUser.uid)),
      getDocs(query(collection(db, 'clinics'), where('ownerId', '==', currentUser.uid)))
    ])

    const userData = userSnap.exists() ? userSnap.data() || {} : {}
    const clinicRecords = clinicsSnap.docs.map((clinicDoc) => ({
      id: clinicDoc.id,
      name: clinicDoc.data()?.name || clinicDoc.data()?.clinicName || clinicDoc.data()?.branchName || '',
      branchCode: clinicDoc.data()?.branchCode || clinicDoc.data()?.code || '',
      status: clinicDoc.data()?.status || clinicDoc.data()?.approvalStatus || ''
    }))

    const payload = {
      ownerId: currentUser.uid,
      ownerName: String(userData.fullName || userData.displayName || userData.name || '').trim() || currentUser.displayName || 'Owner',
      ownerEmail: String(userData.email || currentUser.email || '').trim(),
      action: form.action,
      actionLabel:
        form.action === 'transfer'
          ? 'Transfer main branch ownership'
          : form.action === 'delete'
            ? 'Request full clinic shutdown'
            : 'Close owner account only',
      transferEmail: form.action === 'transfer' ? String(form.transferEmail || '').trim() : '',
      reason: String(form.reason || '').trim(),
      clinicRecords,
      clinicCount: clinicRecords.length,
      branchIds: clinicRecords.map((clinic) => clinic.id),
      branchNames: clinicRecords.map((clinic) => clinic.name).filter(Boolean),
      status: 'pending',
      reviewStatus: 'Pending',
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      requestedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      confirmations: {
        access: true,
        retention: true,
        review: true,
      },
    }

    await addDoc(collection(db, 'accountClosureRequests'), payload)

    await addDoc(collection(db, 'notifications'), {
      recipientRole: 'Superadmin',
      senderId: currentUser.uid,
      type: 'account_closure_request',
      title: 'New Account Closure Request',
      message: `${payload.ownerName} submitted an account closure request for ${payload.clinicCount} clinic${payload.clinicCount === 1 ? '' : 's'}.`,
      link: '/superadmin/account-closure-requests',
      read: false,
      createdAt: serverTimestamp(),
    })

    toast.success('Account closure request submitted for review.')
    form.reason = ''
    form.transferEmail = ''
    form.confirmation = ''
    form.acknowledgeAccess = false
    form.acknowledgeRetention = false
    form.acknowledgeReview = false
    form.action = 'deactivate'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.closure-page-shell {
  background:
    radial-gradient(circle at top left, rgba(141, 90, 59, 0.16), transparent 28%),
    radial-gradient(circle at 82% 8%, rgba(201, 149, 99, 0.08), transparent 22%),
    linear-gradient(180deg, #2a180f 0%, #24160f 52%, #1a100b 100%);
}

.closure-option {
  display: flex;
  gap: 0.875rem;
  border-radius: 1.125rem;
  border: 1px solid #5a3927;
  background: #2a180f;
  padding: 1rem;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.closure-option:hover {
  border-color: #8d5a3b;
  background: #3a2417;
  transform: translateY(-1px);
}

.closure-option-active {
  border-color: #8d5a3b;
  background: #3a2417;
}
</style>
