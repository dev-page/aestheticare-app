<template>
  <div class="support-shell">
    <EmployeeTopbar
      title=""
      :plan-label="planLabel"
      :is-expired="isExpired"
      :sidebar-collapsed="sidebarCollapsed"
      :panel-key="panelKey"
      :badge-label="badgeLabel"
      :badge-tone="badgeTone"
      :badge-variant="badgeVariant"
      :badge-status-label="badgeStatusLabel"
      :show-badge-status="showBadgeStatus"
      :use-sidebar-offset="true"
    />

    <div class="flex flex-1 min-w-0">
      <component :is="sidebarComponent" v-if="sidebarComponent" />
      <main class="support-main">
      <div class="support-content">
      <div class="support-header">
        <h1 class="support-title">Report an Issue</h1>
        <p class="support-subtitle">
          Help us improve by sharing any bugs, errors, or concerns you encounter.
        </p>
      </div>

      <section class="support-panel">
        <form class="space-y-5" @submit.prevent="submitReport">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="support-field-label">Reported By</label>
              <div class="support-display-field">
                {{ reporterName || 'User' }}
              </div>
            </div>
            <div>
              <label class="support-field-label">Contact Email</label>
              <div class="support-display-field">
                {{ reporterEmail || 'No email available' }}
              </div>
            </div>
          </div>

          <div>
            <label class="support-field-label">Subject</label>
            <input
              v-model.trim="subject"
              type="text"
              class="support-input"
              placeholder="Short summary of the issue"
              required
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="support-field-label">Category</label>
              <select
                v-model="category"
                class="support-input"
                required
              >
                <option disabled value="">Select category</option>
                <option>Bug/Error</option>
                <option>Data Issue</option>
                <option>Performance</option>
                <option>Billing/Payments</option>
                <option>Feature Request</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label class="support-field-label">Severity</label>
              <select
                v-model="severity"
                class="support-input"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label class="support-field-label">Where did it happen?</label>
            <input
              v-model.trim="location"
              type="text"
              class="support-input"
              placeholder="Example: Owner Dashboard > Attendance"
            />
          </div>

          <div>
            <label class="support-field-label">Description</label>
            <textarea
              v-model.trim="description"
              rows="5"
              class="support-input support-textarea"
              placeholder="Describe what happened, and what you expected."
              required
            ></textarea>
          </div>

          <div>
            <label class="support-field-label">Steps to Reproduce (optional)</label>
            <textarea
              v-model.trim="steps"
              rows="3"
              class="support-input support-textarea"
              placeholder="Step 1... Step 2... Step 3..."
            ></textarea>
          </div>

          <div>
            <label class="support-field-label">Upload Proof (optional)</label>
            <div class="support-upload-box">
              <input
                type="file"
                accept="image/*"
                @change="handleFileChange"
                class="support-file-input"
              />
              <p class="support-upload-note">PNG, JPG up to 5MB.</p>
              <div v-if="proofPreview" class="flex items-center gap-4">
                <img :src="proofPreview" alt="Proof preview" class="support-preview-image" />
                <div class="support-preview-copy">
                  <p class="font-semibold">{{ proofFile?.name }}</p>
                  <button type="button" class="support-remove-file" @click="clearProof">
                    Remove file
                  </button>
                </div>
              </div>
              <p v-if="fileError" class="support-file-error">{{ fileError }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              :disabled="submitting"
              class="support-submit-button"
            >
              {{ submitting ? 'Submitting...' : 'Submit Report' }}
            </button>
            <span class="support-note">Reports are visible to the system administrator only.</span>
          </div>
        </form>
      </section>
      </div>
      </main>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getFirestore, addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { onAuthStateChanged } from 'firebase/auth'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, storage } from '@/config/firebaseConfig'
import { toast } from 'vue3-toastify'
import { useSubscription } from '@/composables/useSubscription'
import EmployeeTopbar from '@/components/common/EmployeeTopbar.vue'

import CustomerSidebar from '@/components/sidebar/CustomerSidebar.vue'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import EmployeeSidebar from '@/components/sidebar/EmployeeSidebar.vue'

export default {
  name: 'SupportReport',
  components: {
    EmployeeTopbar,
    CustomerSidebar,
    OwnerSidebar,
    EmployeeSidebar
  },
  setup() {
    const db = getFirestore(getApp())
    const router = useRouter()
    const { activePlan, isExpired, initSubscription } = useSubscription()

    const role = ref('')
    const userType = ref('')
    const branchId = ref('')
    const reporterName = ref('')
    const reporterEmail = ref('')
    const sidebarCollapsed = ref(false)

    const subject = ref('')
    const category = ref('')
    const severity = ref('Medium')
    const location = ref('')
    const description = ref('')
    const steps = ref('')
    const proofFile = ref(null)
    const proofPreview = ref('')
    const fileError = ref('')
    const submitting = ref(false)
    const panelKey = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (typeValue === 'customer' || roleValue === 'customer') return 'customer'
      if (typeValue === 'staff') return 'employee'
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return 'owner'
      return ''
    })

    const planLabel = computed(() => {
      const raw = String(activePlan.value || '').trim().toLowerCase()
      if (!raw) return 'Plan'
      if (raw.includes('free')) return 'FreePlan'
      if (raw.includes('basic')) return 'Basic'
      if (raw.includes('premium')) return 'Premium'
      return activePlan.value
    })

    const badgeLabel = computed(() => {
      if (panelKey.value === 'customer') {
        try {
          return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }).format(new Date())
        } catch (_error) {
          return ''
        }
      }
      return ''
    })

    const badgeTone = computed(() => (panelKey.value === 'customer' ? 'neutral' : ''))
    const badgeVariant = computed(() => (panelKey.value === 'customer' ? 'date' : 'plan'))
    const showBadgeStatus = computed(() => panelKey.value !== 'customer')
    const badgeStatusLabel = computed(() => (isExpired.value ? 'Expired' : 'Active'))

    const sidebarComponent = computed(() => {
      const roleValue = String(role.value || '').toLowerCase()
      const typeValue = String(userType.value || '').toLowerCase()

      if (!roleValue && !typeValue) return null
      if (roleValue.includes('superadmin')) return null
      if (typeValue === 'customer' || roleValue === 'customer') return CustomerSidebar
      if (typeValue === 'staff') return EmployeeSidebar
      if (roleValue === 'clinic admin' || roleValue === 'clinicadmin' || roleValue === 'owner') return OwnerSidebar
      return CustomerSidebar
    })

    const clearProofPreview = () => {
      if (proofPreview.value) URL.revokeObjectURL(proofPreview.value)
      proofPreview.value = ''
    }

    const clearProof = () => {
      proofFile.value = null
      fileError.value = ''
      clearProofPreview()
    }

    const handleFileChange = (event) => {
      const file = event.target.files?.[0]
      fileError.value = ''

      if (!file) {
        clearProof()
        return
      }

      if (!file.type.startsWith('image/')) {
        fileError.value = 'Please upload a valid image file.'
        clearProof()
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        fileError.value = 'Image size must be below 5MB.'
        clearProof()
        return
      }

      clearProofPreview()
      proofFile.value = file
      proofPreview.value = URL.createObjectURL(file)
    }

    const resetForm = () => {
      subject.value = ''
      category.value = ''
      severity.value = 'Medium'
      location.value = ''
      description.value = ''
      steps.value = ''
      clearProof()
    }

    const submitReport = async () => {
      if (!subject.value || !category.value || !description.value) {
        toast.error('Please complete the required fields before submitting.')
        return
      }

      const user = auth.currentUser
      if (!user) {
        toast.error('You must be logged in to submit a report.')
        return
      }

      submitting.value = true

      try {
        const ticketRef = doc(collection(db, 'supportTickets'))
        let proofPath = ''
        let proofUrl = ''

        if (proofFile.value) {
          proofPath = `support-tickets/${user.uid}/${ticketRef.id}/${proofFile.value.name}`
          const fileRef = storageRef(storage, proofPath)
          await uploadBytes(fileRef, proofFile.value)
          proofUrl = await getDownloadURL(fileRef)
        }

        await setDoc(ticketRef, {
          userId: user.uid,
          userEmail: reporterEmail.value || user.email || '',
          userName: reporterName.value || '',
          role: role.value || '',
          userType: userType.value || '',
          branchId: branchId.value || '',
          subject: subject.value,
          category: category.value,
          severity: severity.value,
          location: location.value,
          description: description.value,
          steps: steps.value,
          proofUrl,
          proofPath,
          status: 'Open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        await addDoc(collection(db, 'notifications'), {
          recipientRole: 'Superadmin',
          senderId: user.uid,
          type: 'support_issue',
          title: 'New Issue Report',
          message: `${subject.value || 'New report'}${reporterName.value ? ` • ${reporterName.value}` : ''}`,
          link: '/superadmin/tickets',
          read: false,
          createdAt: serverTimestamp()
        })

        await addDoc(collection(db, 'notifications'), {
          recipientUserId: user.uid,
          senderId: user.uid,
          type: 'support_issue',
          title: 'Report Submitted',
          message: `Subject: ${subject.value || 'Untitled'} — We received your report. Our team will review it and update you soon.`,
          link: '/notifications',
          read: false,
          createdAt: serverTimestamp()
        })

        toast.success('Your report has been submitted. Thank you!')
        resetForm()
      } catch (error) {
        console.error('Error submitting support report:', error)
        toast.error('Unable to submit your report right now.')
      } finally {
        submitting.value = false
      }
    }

    const syncSidebarCollapsed = () => {
      if (!panelKey.value) return
      sidebarCollapsed.value = localStorage.getItem(`sidebar:${panelKey.value}:collapsed`) === '1'
    }

    let sidebarHandler = null
    let unsubscribeAuth = null
    onMounted(() => {
      initSubscription()
      syncSidebarCollapsed()
      sidebarHandler = (event) => {
        const detail = event?.detail || {}
        if (detail.panelKey && detail.panelKey === panelKey.value) {
          sidebarCollapsed.value = Boolean(detail.collapsed)
        }
      }
      window.addEventListener('sidebar-collapsed-change', sidebarHandler)

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return
        reporterEmail.value = user.email || ''

        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (!userSnap.exists()) return

        const data = userSnap.data()
        role.value = data.role || ''
        userType.value = data.userType || ''
        branchId.value = data.branchId || ''
        reporterName.value = `${data.firstName || ''} ${data.lastName || ''}`.trim()

        if (String(role.value || '').toLowerCase().includes('superadmin')) {
          router.replace('/superadmin/tickets')
        }
      })
    })

    watch(panelKey, () => {
      syncSidebarCollapsed()
    })

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth()
      if (sidebarHandler) {
        window.removeEventListener('sidebar-collapsed-change', sidebarHandler)
      }
      clearProofPreview()
    })

    return {
      reporterName,
      reporterEmail,
      subject,
      category,
      severity,
      location,
      description,
      steps,
      proofFile,
      proofPreview,
      fileError,
      submitting,
      sidebarComponent,
      panelKey,
      sidebarCollapsed,
      planLabel,
      isExpired,
      badgeLabel,
      badgeTone,
      badgeVariant,
      badgeStatusLabel,
      showBadgeStatus,
      handleFileChange,
      clearProof,
      submitReport
    }
  }
}
</script>

<style scoped>
.support-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.support-main {
  flex: 1;
  padding: 1.5rem 1.4rem 2rem;
  background:
    radial-gradient(circle at top left, rgba(241, 212, 170, 0.34), transparent 26%),
    radial-gradient(circle at 82% 8%, rgba(198, 148, 108, 0.2), transparent 20%),
    linear-gradient(180deg, #fbf5e8 0%, #f8ecd9 52%, #f4e1c6 100%);
}

.support-content {
  display: grid;
  gap: 1rem;
}

.support-header,
.support-panel {
  border-radius: 1.75rem;
  border: 1px solid rgba(230, 193, 150, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 44px rgba(87, 56, 35, 0.08);
}

.support-header {
  padding: 1.25rem;
}

.support-panel {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.35rem;
}

.support-title {
  margin: 0;
  color: #3d281d;
  font-family: "Playfair Display", "Times New Roman", serif;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1;
}

.support-subtitle,
.support-note,
.support-upload-note,
.support-display-field,
.support-preview-copy {
  color: rgba(76, 54, 40, 0.76);
}

.support-subtitle {
  margin: 0.75rem 0 0;
  line-height: 1.7;
}

.support-field-label {
  display: block;
  margin-bottom: 0.5rem;
  color: #8c6d55;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.support-display-field,
.support-input {
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(230, 193, 150, 0.9);
  background: rgba(255, 255, 255, 0.92);
  color: #342419;
  outline: none;
}

.support-input {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.support-textarea {
  resize: none;
}

.support-input::placeholder {
  color: #b08b6e;
}

.support-input:focus {
  border-color: rgba(198, 148, 108, 0.9);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}

.support-upload-box {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px dashed rgba(198, 148, 108, 0.7);
  background: rgba(255, 249, 240, 0.86);
}

.support-file-input {
  color: #5a3d2d;
  font-size: 0.92rem;
}

.support-file-input::file-selector-button {
  margin-right: 0.75rem;
  border: 0;
  border-radius: 0.85rem;
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  padding: 0.7rem 0.95rem;
  font-weight: 700;
}

.support-preview-image {
  width: 8rem;
  height: 6rem;
  border-radius: 0.9rem;
  object-fit: cover;
  border: 1px solid rgba(230, 193, 150, 0.8);
}

.support-remove-file {
  color: #8d5a3b;
  font-size: 0.78rem;
  font-weight: 700;
}

.support-file-error {
  color: #b85e5e;
  font-size: 0.76rem;
}

.support-submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.82rem 1.15rem;
  border-radius: 1rem;
  border: 1px solid rgba(126, 78, 53, 0.24);
  background: linear-gradient(120deg, #b57f5c 0%, #8d5a3b 48%, #6e4330 100%);
  color: #fff8eb;
  font-size: 0.86rem;
  font-weight: 700;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.support-submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.support-submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 1280px) {
  .support-main {
    padding: 1.7rem 2rem 2.2rem;
  }
}

@media (max-width: 767px) {
  .support-main {
    padding: 1rem 1rem 1.5rem;
  }

  .support-panel {
    padding: 1.1rem;
  }
}
</style>
