<script>
import { usePageLoading } from '@/composables/usePageLoading'

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getFirestore, collection, getDocs, onSnapshot, doc, query, where, updateDoc } from 'firebase/firestore'
import { getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import ContractAppearanceSelect from '@/components/common/ContractAppearanceSelect.vue'
import { compensationApi } from '@/utils/compensationApi'
import { employeeSpecialtyTypes } from '../../../../../shared/practitionerTeam.js'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import { sortRecordsNewestFirst } from '@/utils/sortRecords'
import { loadClinicDocsByIds, loadOwnerBranchScope } from '@/utils/ownerBranchScope'
import { OTP_API_BASE } from '@/utils/runtimeConfig'
import { storage } from '@/config/firebaseConfig'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscription } from '@/composables/useSubscription'
import CreateAccountScheduleStep from './hr/CreateAccountScheduleStep.vue'
import CreateAccountCommissionAgreements from '@/components/common/CreateAccountCommissionAgreements.vue'
import { hasPractitionerPermissions } from '../../../../../shared/practitionerTeam.js'

export default {
  name: 'OwnerStaff',
  components: { OwnerSidebar, Modal, ContractAppearanceSelect, CreateAccountScheduleStep, CreateAccountCommissionAgreements },
  props: { embedded: { type: Boolean, default: false } },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const db = getFirestore(getApp())
    const auth = getAuth(getApp())
    const { hasPermission, isClinicAdminOwner } = usePermissions()
    const { hasFeature } = useSubscription()
    const canUpdateStaff = computed(() => hasPermission('staff:update'))
    const canDisableStaff = computed(() => hasPermission('staff:disable'))
    const canManageRoles = computed(() => hasPermission('roles:manage'))
    const canViewShifts = computed(() => hasFeature('hr') && hasPermission('hr:view'))
    const canCreateShifts = computed(() => hasFeature('hr') && hasPermission('hr:create'))
    const canAssignShifts = computed(() => hasFeature('hr') && hasPermission('hr:update'))
    const canManagePay = computed(() => hasFeature('payroll') && hasPermission('payroll:update'))
    const canManageCommissions = computed(() => hasFeature('payroll') && isClinicAdminOwner.value === true)
    const editTabs = [
      { id: 'personal', label: 'Personal & Contact Info' },
      { id: 'role', label: 'Role & Branch' },
      { id: 'schedule', label: 'Shift Assignment' },
      { id: 'compensation', label: 'Base Pay & Commissions' },
    ]
    const activeEditTab = ref('personal')
    const scheduleStepRef = ref(null)
    const commissionEditorRef = ref(null)
    const scheduleLoadError = ref('')
    const commissionLoadError = ref('')
    const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const blankAssignments = () => Object.fromEntries(scheduleDays.map(day => [day, '']))
    const nextScheduleMonday = () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const [year, month, day] = today.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day))
      date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7))
      return date.toISOString().slice(0, 10)
    }
    const scheduleDraft = ref({ branchId: '', effectiveFrom: '', weeklyHoursCap: 0, assignments: blankAssignments(), assignmentLabels: {} })
    const originalScheduleDraft = ref(null)
    const commissionDraft = ref({ rates: [] })
    const originalCommissionDraft = ref(null)
    const basePay = ref({ basePayModel: 'hourly', basePay: '', monthlyBaseHours: 176 })
    const staffList = ref([])
    const branches = ref([])
    const customRoles = ref([])
    const currentOwnerId = ref('')

    const showEditModal = ref(false)
    const searchQuery = ref('')
    const editErrors = ref({})
    const loadingSpecialty = ref(false)
    const specialtyError = ref('')
    const savingEmployee = ref(false)
    const originalSpecialty = ref({ type: '', credentialNumber: '' })
    const practitionerCredentialsVerified = ref(false)
    const licenseFile = ref(null)
    const licenseOcrResult = ref(null)
    const licenseOcrBusy = ref(false)
    let licenseOcrSequence = 0
    const licenseOcrNameMatched = computed(() => licenseOcrResult.value?.nameMatch?.status === 'match')
    const selectedRoleRecords = computed(() => {
      const ids = Array.isArray(currentStaff.value.customRoleIds) ? currentStaff.value.customRoleIds : []
      return customRoles.value.filter(role => ids.includes(role.id))
    })
    const showPractitionerFields = computed(() => {
      const hasSelectedRoles = Array.isArray(currentStaff.value.customRoleIds) && currentStaff.value.customRoleIds.length > 0
      if (hasSelectedRoles) return selectedRoleRecords.value.some(role =>
        /\bpractitioner\b/i.test(String(role.name || '')) || hasPractitionerPermissions(role.permissions)
      )
      return /\bpractitioner\b/i.test(String(currentStaff.value.role || currentStaff.value.customRoleName || ''))
        || hasPractitionerPermissions(currentStaff.value.effectivePermissions)
    })
    const showLicenseField = computed(() => showPractitionerFields.value && Boolean(String(currentStaff.value.practitionerType || '').trim() || String(currentStaff.value.credentialNumber || '').trim()))
    const isStudentIntern = computed(() => currentStaff.value.engagementType === 'student_intern')
    const selectedClinicLocations = computed(() => {
      const ids = new Set(Array.isArray(currentStaff.value.branchIds) ? currentStaff.value.branchIds : [])
      const unique = new Map()
      branches.value.filter(branch => ids.has(branch.id)).forEach(branch => {
        const location = String(branch.clinicLocation || '').trim()
        const key = location.toLocaleLowerCase()
        if (location && !unique.has(key)) unique.set(key, location)
      })
      return [...unique.values()]
    })
    let staffUnsubscribers = []

    const currentStaff = ref({
      id: null,
      firstName: '',
      middleName: '',
      lastName: '',
      suffix: '',
      email: '',
      phoneNumber: '',
      role: '',
      customRoleId: '',
      customRoleIds: [],
      customRoleName: '',
      branchId: '',
      branchIds: [],
      clinicLocations: [],
      engagementType: 'employee',
      employmentType: 'Full-time',
      weeklyHoursTarget: 40,
      userType: 'Staff',
      status: 'Active'
    })

    const chunkArray = (items, size = 10) => {
      const chunks = []
      for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size))
      }
      return chunks
    }

    const clearStaffListeners = () => {
      staffUnsubscribers.forEach((unsubscribe) => unsubscribe?.())
      staffUnsubscribers = []
    }

    const applyStaffDocs = (staffDocs) => {
      const uniqueStaff = Array.from(new Map(staffDocs.map((staff) => [staff.id, staff])).values())
        .filter((user) => !user.archived)
      staffList.value = sortRecordsNewestFirst(uniqueStaff.map(staff => {
        const assignedBranchIds = Array.isArray(staff.branchIds) && staff.branchIds.length ? staff.branchIds : [staff.branchId].filter(Boolean)
        const branch = branches.value.find(b => b.id === staff.branchId)
        return {
          ...staff,
          clinicBranch: branch ? branch.clinicBranch : '',
          clinicLocation: branch ? branch.clinicLocation : '',
          assignedBranchNames: assignedBranchIds.map(id => branches.value.find(b => b.id === id)?.clinicBranch || id),
          customRoleName: String(staff.customRoleName || '').trim(),
          createdAt: staff.archivedAt || staff.createdAt || staff.updatedAt || null,
        }
      }))
    }

    const subscribeStaff = () => {
      clearStaffListeners()
      const ownerBranchIds = branches.value.map(branch => branch.id).filter(Boolean)
      if (ownerBranchIds.length === 0) {
        staffList.value = []
        return
      }

      const chunks = chunkArray(ownerBranchIds)
      const recordsByChunk = chunks.map(() => [])
      chunks.forEach((chunk, chunkIndex) => {
        const staffQuery = query(
          collection(db, "users"),
          where("branchId", "in", chunk),
          where("userType", "==", "Staff")
        )
        const unsubscribe = pageListener(onSnapshot, staffQuery, (snapshot) => {
          recordsByChunk[chunkIndex] = snapshot.docs.map((staffDoc) => ({ id: staffDoc.id, ...staffDoc.data() }))
          applyStaffDocs(recordsByChunk.flat())
        }, (error) => {
          console.error('Failed to subscribe to employee updates:', error)
          toast.error('Live employee updates are temporarily unavailable.')
        })
        staffUnsubscribers.push(unsubscribe)
      })
    }

    const loadBranches = trackPageLoad(async () => {
      const user = auth.currentUser
      if (!user) {
        branches.value = []
        currentOwnerId.value = ''
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid
      const branchDocs = await loadClinicDocsByIds(db, scope.branchIds?.length ? scope.branchIds : [scope.branchId || ''])
      branches.value = branchDocs.map((branch) => ({
        id: branch.id,
        clinicBranch: branch.clinicBranch,
        clinicLocation: branch.clinicLocation
      }))
    })

    const loadCustomRoles = trackPageLoad(async () => {
      const user = auth.currentUser
      if (!user) {
        customRoles.value = []
        return
      }

      const scope = await loadOwnerBranchScope(db, user.uid)
      currentOwnerId.value = scope.ownerId || user.uid

      const rolesSnapshot = await getDocs(
        query(collection(db, 'clinicRoles'), where('ownerId', '==', currentOwnerId.value))
      )
      customRoles.value = rolesSnapshot.docs
        .map((roleDoc) => {
          const data = roleDoc.data() || {}
          const permissions = Array.isArray(data.permissions)
            ? data.permissions.map((value) => String(value || '').trim()).filter(Boolean)
            : []

          return {
            id: roleDoc.id,
            name: String(data.name || '').trim(),
            permissions,
          }
        })
        .filter((role) => role.name && role.permissions.length > 0)
        .sort((left, right) => left.name.localeCompare(right.name))
    })

    onMounted(trackPageLoad(async() => {
      await loadBranches()
      await loadCustomRoles()
      subscribeStaff()

    }))

    onUnmounted(() => clearStaffListeners())

    watch(
      () => currentStaff.value.customRoleIds,
      (nextCustomRoleIds) => {
        const ids = Array.isArray(nextCustomRoleIds) ? nextCustomRoleIds : []
        const selectedRoles = customRoles.value.filter((role) => ids.includes(role.id))
        currentStaff.value.customRoleId = ids[0] || ''
        currentStaff.value.customRoleName = selectedRoles.map((role) => role.name).join(', ')
        currentStaff.value.role = selectedRoles.map((role) => role.name).join(', ') || currentStaff.value.role || ''
      },
      { deep: true }
    )

    const openEditModal = async (staff) => {
      if (!canUpdateStaff.value) return
      editErrors.value = {}
      licenseFile.value = null
      licenseOcrResult.value = null
      licenseOcrBusy.value = false
      licenseOcrSequence += 1
      currentStaff.value = {
        ...staff,
        middleName: String(staff.middleName || ''),
        suffix: String(staff.suffix || ''),
        phoneNumber: String(staff.phoneNumber || '').replace(/^\+63/, '').replace(/\D/g, '').slice(0, 10),
        engagementType: String(staff.engagementType || (String(staff.employmentType || '').toLowerCase().includes('intern') ? '' : 'employee')),
        employmentType: String(staff.employmentType || ''),
        weeklyHoursTarget: Number(staff.weeklyHoursTarget || (String(staff.employmentType || '').toLowerCase().includes('full') ? 40 : 0)),
        practitionerType: staff.practitionerType || '',
        credentialNumber: '',
        customRoleId: String(staff.customRoleId || '').trim(),
        customRoleIds: Array.isArray(staff.customRoleIds) && staff.customRoleIds.length
          ? staff.customRoleIds
          : [String(staff.customRoleId || '').trim()].filter(Boolean),
        customRoleName: String(staff.customRoleName || '').trim(),
        branchIds: Array.isArray(staff.branchIds) && staff.branchIds.length ? staff.branchIds : [staff.branchId].filter(Boolean),
      }
      updateCurrentStaffLocation()
      activeEditTab.value = 'personal'
      scheduleLoadError.value = ''
      commissionLoadError.value = ''
      basePay.value = {
        basePayModel: staff.basePayModel || 'hourly',
        basePay: staff.basePay == null ? '' : Number(staff.basePay),
        monthlyBaseHours: Number(staff.monthlyBaseHours || 176),
      }
      commissionDraft.value = { rates: [] }
      originalCommissionDraft.value = null
      scheduleDraft.value = {
        branchId: staff.branchId || staff.branchIds?.[0] || '',
        effectiveFrom: nextScheduleMonday(),
        weeklyHoursCap: Number(staff.weeklyHoursTarget || 0),
        assignments: blankAssignments(),
        assignmentLabels: {},
      }
      originalScheduleDraft.value = null
      showEditModal.value = true
      loadingSpecialty.value = true
      specialtyError.value = ''
      try {
        const requests = [compensationApi(`/staff/${encodeURIComponent(staff.id)}/practitioner-details`)]
        const scheduleBranchId = String(staff.branchId || staff.branchIds?.[0] || '').trim()
        if (canViewShifts.value && scheduleBranchId) {
          const params = new URLSearchParams({ branchId: scheduleBranchId, effectiveFrom: nextScheduleMonday() })
          requests.push(compensationApi(`/staff/${encodeURIComponent(staff.id)}/recurring-schedule?${params}`))
        } else requests.push(Promise.resolve(null))
        if (canManageCommissions.value && showPractitionerFields.value) requests.push(compensationApi(`/practitioner-profiles/${encodeURIComponent(staff.id)}`))
        else requests.push(Promise.resolve(null))
        const [detailsResult, scheduleResult, practitionerProfileResult] = await Promise.allSettled(requests)
        if (currentStaff.value.id !== staff.id) return
        if (detailsResult.status !== 'fulfilled') throw detailsResult.reason
        const details = detailsResult.value
        const scheduleResultValue = scheduleResult.status === 'fulfilled' ? scheduleResult.value : null
        const practitionerProfile = practitionerProfileResult.status === 'fulfilled' ? practitionerProfileResult.value : null
        if (scheduleResult.status === 'rejected') scheduleLoadError.value = scheduleResult.reason?.message || 'Unable to load the employee schedule.'
        if (practitionerProfileResult.status === 'rejected') commissionLoadError.value = practitionerProfileResult.reason?.message || 'Unable to load practitioner service commissions.'
        currentStaff.value.practitionerType = details.type
        currentStaff.value.credentialNumber = details.credentialNumber
        originalSpecialty.value = { ...details }
        practitionerCredentialsVerified.value = practitionerProfile?.credentialsVerified === true
        const nextEffectiveFrom = nextScheduleMonday()
        const resolvedSchedule = scheduleResultValue?.schedule
        const latestSchedule = scheduleResultValue?.latestSchedule
        const hasFutureSchedule = latestSchedule?.effectiveFrom > nextEffectiveFrom
        const savedSchedule = hasFutureSchedule ? latestSchedule : resolvedSchedule
        if (savedSchedule) {
          scheduleDraft.value = {
            ...savedSchedule,
            branchId: scheduleBranchId,
            effectiveFrom: hasFutureSchedule ? latestSchedule.effectiveFrom : nextEffectiveFrom,
            weeklyHoursCap: Number(savedSchedule.weeklyHoursCap || staff.weeklyHoursTarget || 0),
            assignments: { ...blankAssignments(), ...(savedSchedule.assignments || {}) },
            assignmentLabels: { ...(savedSchedule.assignmentLabels || {}) },
          }
        }
        originalScheduleDraft.value = JSON.stringify(scheduleDraft.value)
        commissionDraft.value = {
          rates: Array.isArray(practitionerProfile?.rates) ? practitionerProfile.rates.map(rate => ({ ...rate })) : [],
        }
        originalCommissionDraft.value = JSON.stringify(commissionDraft.value)
      } catch (error) { specialtyError.value = error?.message || 'Unable to load professional details. Close and reopen the employee to retry.' }
      finally { loadingSpecialty.value = false }
    }

    const changeStaffArrangement = (value) => {
      currentStaff.value.engagementType = value
      if (value === 'student_intern') {
        currentStaff.value.employmentType = 'Intern'
        currentStaff.value.weeklyHoursTarget = ''
      } else if (value === 'employee') {
        if (!['Full-time', 'Part-time'].includes(currentStaff.value.employmentType)) currentStaff.value.employmentType = 'Full-time'
        if (currentStaff.value.employmentType === 'Full-time') currentStaff.value.weeklyHoursTarget = 40
      }
      clearEditError('engagementType')
      clearEditError('employmentType')
      clearEditError('weeklyHoursTarget')
    }

    const changeEmploymentType = (value) => {
      currentStaff.value.employmentType = value
      currentStaff.value.weeklyHoursTarget = value === 'Full-time' ? 40 : ''
      clearEditError('employmentType')
      clearEditError('weeklyHoursTarget')
    }

    const clearEditError = (field) => {
      if (!editErrors.value[field]) return
      const nextErrors = { ...editErrors.value }
      delete nextErrors[field]
      editErrors.value = nextErrors
    }

    const normalizeCredentialNumber = () => {
      currentStaff.value.credentialNumber = String(currentStaff.value.credentialNumber || '').replace(/\D/g, '').slice(0, 7)
      clearEditError('credentialNumber')
    }

    const handleEditPhoneInput = (event) => {
      const phone = String(event?.target?.value || '').replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '').slice(0, 10)
      currentStaff.value.phoneNumber = phone
      if (event?.target) event.target.value = phone
      clearEditError('phoneNumber')
    }

    const handleLicenseFile = async event => {
      const sequence = ++licenseOcrSequence
      licenseOcrBusy.value = false
      const file = event?.target?.files?.[0] || null
      licenseFile.value = null
      licenseOcrResult.value = null
      if (!file) return
      const contentType = String(file.type || '').toLowerCase()
      if (!['image/jpeg', 'image/png'].includes(contentType)) {
        toast.error('Upload one JPEG or PNG image so OCR can read the credential.')
        event.target.value = ''
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File must be 5MB or smaller.')
        event.target.value = ''
        return
      }
      licenseFile.value = file
      const branchId = String(currentStaff.value.branchId || currentStaff.value.branchIds?.[0] || '').trim()
      if (!branchId) {
        licenseOcrResult.value = { status: 'manual_review', reason: 'No clinic branch is assigned. Enter the license number manually and ask the clinic owner to review the document.' }
        return
      }
      licenseOcrBusy.value = true
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
          reader.onerror = () => reject(new Error('Unable to read the selected image.'))
          reader.readAsDataURL(file)
        })
        const token = await auth.currentUser?.getIdToken()
        const response = await fetch(`${OTP_API_BASE}/practitioner-license/ocr`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ branchId, employeeId: currentStaff.value.id, contentType, base64 }) })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to process this credential image.')
        if (sequence !== licenseOcrSequence) return
        licenseOcrResult.value = payload.data || null
        if (payload.data?.nameMatch?.status === 'match' && payload.data?.licenseNumber) currentStaff.value.credentialNumber = payload.data.licenseNumber
      } catch (error) {
        if (sequence === licenseOcrSequence) licenseOcrResult.value = { status: 'manual_review', reason: error.message || 'OCR is unavailable. Enter the number manually and review the document.' }
      } finally {
        if (sequence === licenseOcrSequence) licenseOcrBusy.value = false
      }
    }

    const normalizePhoneNumber = (value) => {
      const digits = String(value || '').replace(/\D/g, '')
      if (digits.startsWith('63') && digits.length === 12) return `+${digits}`
      if (digits.startsWith('0') && digits.length === 11) return `+63${digits.slice(1)}`
      if (digits.startsWith('9') && digits.length === 10) return `+63${digits}`
      return ''
    }

    const validateEditStaff = () => {
      const staff = currentStaff.value
      const errors = {}
      const nameRegex = /^[A-Za-z\s]+$/
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (!String(staff.firstName || '').trim()) errors.firstName = 'First name is required.'
      else if (!nameRegex.test(String(staff.firstName).trim())) errors.firstName = 'Only letters and spaces are allowed.'
      if (String(staff.middleName || '').trim() && !nameRegex.test(String(staff.middleName).trim())) errors.middleName = 'Only letters and spaces are allowed.'
      if (!String(staff.lastName || '').trim()) errors.lastName = 'Last name is required.'
      else if (!nameRegex.test(String(staff.lastName).trim())) errors.lastName = 'Only letters and spaces are allowed.'
      if (String(staff.suffix || '').trim() && !/^[A-Za-z\s.]+$/.test(String(staff.suffix).trim())) errors.suffix = 'Use letters, spaces, and periods only.'
      if (!String(staff.email || '').trim()) errors.email = 'Email is required.'
      else if (!emailRegex.test(String(staff.email).trim())) errors.email = 'Enter a valid email address.'
      if (!String(staff.phoneNumber || '').trim()) errors.phoneNumber = 'Phone number is required.'
      else if (!/^9\d{9}$/.test(String(staff.phoneNumber || '').trim()) || !normalizePhoneNumber(staff.phoneNumber)) errors.phoneNumber = 'Enter exactly 10 digits starting with 9.'
      if (!Array.isArray(staff.branchIds) || !staff.branchIds.length) errors.branchId = 'Select at least one branch.'
      if (!String(staff.clinicLocation || '').trim()) errors.clinicLocation = 'Clinic location is required.'
      if (!['employee', 'student_intern'].includes(staff.engagementType)) errors.engagementType = 'Choose employee or student intern / OJT.'
      else if (staff.engagementType === 'student_intern' && staff.employmentType !== 'Intern') errors.employmentType = 'Student intern / OJT arrangement is required.'
      else if (staff.engagementType === 'employee' && !['Full-time', 'Part-time'].includes(staff.employmentType)) errors.employmentType = 'Choose full-time or part-time.'
      const weeklyHours = Number(staff.weeklyHoursTarget)
      if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > 48) errors.weeklyHoursTarget = 'Enter agreed weekly hours from 1 to 48.'
      else if (staff.engagementType === 'employee' && staff.employmentType === 'Full-time' && weeklyHours < 40) errors.weeklyHoursTarget = 'Full-time employees must have at least 40 agreed weekly hours.'
      else if (staff.engagementType === 'employee' && staff.employmentType === 'Part-time' && weeklyHours >= 40) errors.weeklyHoursTarget = 'Part-time employees must have fewer than 40 agreed weekly hours.'
      if (showPractitionerFields.value && staff.practitionerType && !employeeSpecialtyTypes.includes(staff.practitionerType)) errors.practitionerType = 'Choose one of the suggested professional specialties.'
      const credentialNumber = String(staff.credentialNumber || '').trim()
      if (showPractitionerFields.value && credentialNumber && !/^\d{7}$/.test(credentialNumber)) errors.credentialNumber = 'Enter exactly 7 digits.'
      if (canManagePay.value && !isStudentIntern.value && String(basePay.value.basePay || '').trim()) {
        const rawRate = String(basePay.value.basePay || '').trim()
        const rate = Number(rawRate)
        if (!['hourly', 'daily', 'monthly-retainer'].includes(basePay.value.basePayModel)) errors.basePay = 'Choose a valid pay model.'
        else if (!Number.isFinite(Number(basePay.value.monthlyBaseHours)) || Number(basePay.value.monthlyBaseHours) < 1 || Number(basePay.value.monthlyBaseHours) > 744) errors.basePay = 'Agreed monthly hours must be between 1 and 744.'
        else if (!Number.isFinite(rate) || rate <= 0 || rate > 1000000 || !/^\d+(\.\d{1,2})?$/.test(rawRate)) errors.basePay = 'Enter a valid base pay rate up to PHP 1,000,000 with two decimal places.'
      }

      editErrors.value = errors
      return Object.keys(errors).length === 0
    }

    const updateCurrentStaffLocation = () => {
      currentStaff.value.branchId = currentStaff.value.branchIds?.[0] || ''
      const branch = branches.value.find((entry) => entry.id === currentStaff.value.branchId)
      currentStaff.value.clinicBranch = branch?.clinicBranch || ''
      currentStaff.value.clinicLocations = selectedClinicLocations.value
      currentStaff.value.clinicLocation = selectedClinicLocations.value.join(', ')
    }

    const deactivateStaff = async (staff) => {
      if (!canDisableStaff.value) return
      const fullName = `${staff.firstName} ${staff.lastName}`
      if (staff.status === 'Active') {
        const result = await Swal.fire({
          title: 'Confirm Deactivation',
          text: `Are you sure you want to deactivate ${fullName}? They will not be able to log in.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, deactivate',
          cancelButtonText: 'Cancel'
        })

        if (!result.isConfirmed) {
          toast.info("Deactivation cancelled.")
          return
        }

        try {
          await compensationApi(`/staff/${encodeURIComponent(staff.id)}/status`, 'PATCH', { status: 'Inactive' })
          staff.status = 'Inactive'
          toast.success(`${fullName} has been deactivated.`)
        } catch (error) {
          toast.error(error.message || 'Failed to deactivate staff.')
        }
      } else {
        try {
          await compensationApi(`/staff/${encodeURIComponent(staff.id)}/status`, 'PATCH', { status: 'Active' })
          staff.status = 'Active'
          toast.success(`${fullName} has been reactivated.`)
        } catch (error) {
          toast.error(error.message || 'Failed to reactivate staff.')
        }
      }
    }


    const saveStaff = async () => {
      if (savingEmployee.value || loadingSpecialty.value || licenseOcrBusy.value || specialtyError.value) return
      if (!canUpdateStaff.value) {
        toast.error('You do not have permission to update employee profiles.')
        return
      }
      const { firstName, lastName, email, phoneNumber } = currentStaff.value
      const fullName = [firstName, currentStaff.value.middleName, lastName, currentStaff.value.suffix].map(value => String(value || '').trim()).filter(Boolean).join(' ')
      const selectedRoleIds = Array.isArray(currentStaff.value.customRoleIds)
        ? currentStaff.value.customRoleIds
        : [currentStaff.value.customRoleId].filter(Boolean)
      if (canManageRoles.value && !selectedRoleIds.length) {
        toast.error('Assign at least one clinic role to this employee.')
        return
      }

      if (!validateEditStaff()) {
        const firstError = Object.values(editErrors.value)[0]
        toast.error(firstError || 'Please fix the highlighted fields.')
        return
      }

      const scheduleChanged = originalScheduleDraft.value !== null && JSON.stringify(scheduleDraft.value) !== originalScheduleDraft.value
      if (scheduleChanged && canAssignShifts.value) {
        if (scheduleLoadError.value) { toast.error('The saved schedule did not load, so it cannot be safely updated. Close and reopen this employee after the schedule service is available.'); return }
        if (scheduleStepRef.value?.validationError) { toast.error(scheduleStepRef.value.validationError); activeEditTab.value = 'schedule'; return }
      }
      const commissionChanged = originalCommissionDraft.value !== null && JSON.stringify(commissionDraft.value) !== originalCommissionDraft.value
      if (commissionChanged && canManageCommissions.value && showPractitionerFields.value && commissionEditorRef.value?.validationError) {
        toast.error(commissionEditorRef.value.validationError)
        activeEditTab.value = 'compensation'
        return
      }
      if (commissionChanged && commissionLoadError.value) { toast.error('Practitioner agreements did not load, so they cannot be safely updated. Close and reopen this employee to retry.'); return }

      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)

      let profileSaved = false
      try {
        if (currentStaff.value.id) {
          const result = await Swal.fire({
            title: 'Confirm Update',
            text: `Do you want to update ${fullName}'s information?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, update',
            cancelButtonText: 'Cancel'
          })

          if (!result.isConfirmed) {
            toast.info("Update cancelled.")
            return
          }

          savingEmployee.value = true
          let licenseDocument = null
          const practitionerDetailsChanged = currentStaff.value.practitionerType !== originalSpecialty.value.type || currentStaff.value.credentialNumber !== originalSpecialty.value.credentialNumber || Boolean(licenseFile.value)
          if (licenseFile.value) {
            const ownerId = auth.currentUser?.uid
            const safeName = licenseFile.value.name.replace(/[^\w.\-]+/g, '_')
            const path = `practitioner-licenses/${ownerId}/${currentStaff.value.id}/${Date.now()}-${safeName}`
            const fileRef = storageRef(storage, path)
            await uploadBytes(fileRef, licenseFile.value, { contentType: licenseFile.value.type })
            licenseDocument = { url: await getDownloadURL(fileRef), name: licenseFile.value.name }
          }
          if (showPractitionerFields.value && (currentStaff.value.practitionerType !== originalSpecialty.value.type || currentStaff.value.credentialNumber !== originalSpecialty.value.credentialNumber || licenseDocument)) {
            await compensationApi(`/staff/${currentStaff.value.id}/practitioner-details`, 'POST', { type: currentStaff.value.practitionerType, credentialNumber: currentStaff.value.credentialNumber, licenseDocument })
          }
          const staffUpdates = {
            firstName: currentStaff.value.firstName.trim(),
            middleName: currentStaff.value.middleName.trim(),
            lastName: currentStaff.value.lastName.trim(),
            suffix: currentStaff.value.suffix.trim(),
            fullName,
            email: currentStaff.value.email.trim(),
            phoneNumber: normalizedPhoneNumber,
            engagementType: currentStaff.value.engagementType,
            employmentType: currentStaff.value.employmentType,
            weeklyHoursTarget: Number(currentStaff.value.weeklyHoursTarget),
            branchIds: currentStaff.value.branchIds,
          }
          if (canManageRoles.value) staffUpdates.customRoleIds = selectedRoleIds
          await compensationApi(`/staff/${encodeURIComponent(currentStaff.value.id)}/profile`, 'PATCH', staffUpdates)
          profileSaved = true
          if (canManagePay.value && !isStudentIntern.value && String(basePay.value.basePay || '').trim()) {
            const payUpdates = {
              basePay: Number(Number(basePay.value.basePay).toFixed(2)),
              basePayModel: basePay.value.basePayModel,
              monthlyBaseHours: Number(basePay.value.monthlyBaseHours || 176),
            }
            await updateDoc(doc(db, 'users', currentStaff.value.id), payUpdates)
          }
          if (scheduleChanged && canAssignShifts.value) {
            await compensationApi(`/staff/${encodeURIComponent(currentStaff.value.id)}/recurring-schedule`, 'PUT', {
              branchId: scheduleDraft.value.branchId,
              effectiveFrom: scheduleDraft.value.effectiveFrom,
              weeklyHoursCap: Number(scheduleDraft.value.weeklyHoursCap || currentStaff.value.weeklyHoursTarget),
              assignments: { ...scheduleDraft.value.assignments },
            })
          }
          if (commissionChanged && canManageCommissions.value && showPractitionerFields.value) {
            await compensationApi(`/practitioner-profiles/${encodeURIComponent(currentStaff.value.id)}`, 'POST', {
              type: currentStaff.value.practitionerType || originalSpecialty.value.type,
              credentialNumber: currentStaff.value.credentialNumber || originalSpecialty.value.credentialNumber,
              credentialsVerified: practitionerDetailsChanged ? false : practitionerCredentialsVerified.value,
              approvedServiceIds: [],
              rates: commissionDraft.value.rates,
            })
            practitionerCredentialsVerified.value = practitionerDetailsChanged ? false : practitionerCredentialsVerified.value
          }
          toast.success(`${fullName}'s information updated successfully!`)
          showEditModal.value = false
          loadBranches()
        }
      } catch (err) {
        console.error(err)
        toast.error(profileSaved ? `Employee profile was saved, but another tab could not be saved: ${err.message || 'Please retry that tab.'}` : err.message || 'Unable to save employee changes.')
      } finally {
        savingEmployee.value = false
      }
    }

    const filteredStaffList = computed(() => {
      const records = Array.isArray(staffList.value) ? staffList.value : []
      if (!searchQuery.value.trim()) return records
      const query = searchQuery.value.toLowerCase()
      return records.filter(staff =>
        [staff.firstName, staff.lastName, staff.fullName, staff.email, staff.role, staff.employmentType, staff.engagementType].some((value) =>
          String(value || '').toLowerCase().includes(query)
        ) ||
        (staff.clinicBranch && staff.clinicBranch.toLowerCase().includes(query)) ||
        (staff.clinicLocation && staff.clinicLocation.toLowerCase().includes(query))
      )
    })

    return {
      pageLoading,
      staffList,
      branches,
      showEditModal,
      currentStaff,
      editErrors,
      clearEditError,
      editTabs,
      activeEditTab,
      scheduleStepRef,
      scheduleDraft,
      scheduleLoadError,
      commissionDraft,
      commissionEditorRef,
      commissionLoadError,
      basePay,
      canViewShifts,
      canCreateShifts,
      canAssignShifts,
      canManagePay,
      canManageCommissions,
      showPractitionerFields,
      selectedClinicLocations,
      isStudentIntern,
      changeStaffArrangement,
      changeEmploymentType,
      openEditModal,
      updateCurrentStaffLocation,
      deactivateStaff,
      canUpdateStaff,
      canDisableStaff,
      canManageRoles,
      saveStaff,
      searchQuery,
      filteredStaffList,
      customRoles,
      employeeSpecialtyTypes, loadingSpecialty, specialtyError, showLicenseField, savingEmployee,
      licenseFile, licenseOcrResult, licenseOcrBusy, licenseOcrNameMatched, handleLicenseFile, normalizeCredentialNumber, handleEditPhoneInput
    }
  }
}
</script>

<template>
  <div class="flex flex-row owner-theme w-full" :class="embedded ? '' : 'bg-slate-900 min-h-screen'">
    <OwnerSidebar v-if="!embedded" />

    <component v-page-loading="{ active: pageLoading, variant: 'table', columns: 8, rows: 5, header: !embedded }" :is="embedded ? 'div' : 'main'" class="staff-management-main flex-1 min-w-0" :class="embedded ? '' : 'p-4 sm:p-6 lg:p-8'">
      <!-- Header -->
      <div v-if="!embedded" class="mb-6 flex flex-col gap-2">
        <div>
          <p class="staff-eyebrow">People & access</p>
          <h1 class="text-2xl md:text-3xl font-bold text-white mb-1">Employee Management</h1>
          <p class="text-slate-400 text-sm md:text-base">Manage employee accounts and roles at branch level.</p>
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-4">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search employees, roles, branches..."
          aria-label="Search employees"
          class="staff-search w-full max-w-xl px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Employee Table -->
      <div class="staff-list-shell bg-slate-800 rounded-xl p-3 sm:p-5 border border-slate-700">
        <div class="staff-list-heading">
          <div>
            <h2 class="text-lg font-semibold text-white">Employee accounts</h2>
            <p class="text-sm text-slate-400">{{ filteredStaffList.length }} employee{{ filteredStaffList.length === 1 ? '' : 's' }} shown</p>
          </div>
          <span class="staff-list-caption">Use Edit to update access or branch assignment</span>
        </div>

        <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left border-collapse staff-table">
          <thead>
            <tr class="text-slate-400 uppercase text-xs sm:text-sm border-b border-slate-700">
              <th class="py-2 px-2 sm:py-3 sm:px-4">Name</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Email</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Phone Number</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Role</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Branch</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Location</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Status</th>
              <th class="py-2 px-2 sm:py-3 sm:px-4">Actions</th>
            </tr>
          </thead>
          <tbody class="text-white">
            <tr v-for="staff in filteredStaffList" :key="staff.id" class="hover:bg-slate-700 transition-colors">
              <!-- Name column now combines firstName + lastName -->
              <td class="py-2 px-2 sm:py-3 sm:px-4 font-medium">{{ staff.firstName }} {{ staff.lastName }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.email }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.phoneNumber || '-' }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <div>{{ staff.role || '-' }}<span v-if="staff.practitionerType"> / {{ staff.practitionerType }}</span></div>
                <div v-if="staff.customRoleName" class="text-xs text-cyan-300">{{ staff.customRoleName }}</div>
                <div class="mt-1 text-xs text-slate-400">{{ staff.engagementType === 'student_intern' ? 'Student intern / OJT' : !staff.engagementType && staff.employmentType === 'Intern' ? 'Needs arrangement review' : `Employee · ${staff.employmentType || 'Not set'}` }}<span v-if="staff.weeklyHoursTarget"> · {{ staff.weeklyHoursTarget }} h/week</span></div>
              </td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.assignedBranchNames?.join(', ') || staff.clinicBranch }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">{{ staff.clinicLocation || '-' }}</td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <span
                  :class="[
                    'inline-flex whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium',
                    staff.status === 'Active'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  ]"
                >
                  {{ staff.status }}
                </span>
              </td>
              <td class="py-2 px-2 sm:py-3 sm:px-4">
                <div class="flex flex-wrap gap-2">
                <button v-if="canUpdateStaff" type="button" @click="openEditModal(staff)" :aria-label="`Edit ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Edit employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-white transition hover:bg-yellow-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.1 2.1 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621"/><path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></g></svg>
                </button>
                <button v-if="canDisableStaff" type="button" @click="deactivateStaff(staff)" :aria-label="`Disable ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Disable employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h32v32H0z" fill="none"/><path fill="currentColor" d="M2.293 2.293a1 1 0 0 1 1.414 0l26 26a1 1 0 1 1-1.414 1.414l-3.127-3.127A13.94 13.94 0 0 1 16 30C8.268 30 2 23.732 2 16c0-3.506 1.288-6.712 3.418-9.168L2.293 3.707a1 1 0 0 1 0-1.414m4.545 5.959A11.95 11.95 0 0 0 4 16c0 6.627 5.373 12 12 12c2.954 0 5.656-1.07 7.746-2.84l-2.554-2.554C19.912 23.805 18.062 24.5 16 24.5c-3.866 0-7-2.428-7-6.071A2.43 2.43 0 0 1 11.429 16h3.157zM16 2c7.732 0 14 6.268 14 14c0 2.962-.921 5.708-2.491 7.97l-1.444-1.442A11.94 11.94 0 0 0 28 16c0-6.627-5.373-12-12-12c-2.409 0-4.65.712-6.53 1.934L8.028 4.49A13.94 13.94 0 0 1 16 2m4.571 14A2.43 2.43 0 0 1 23 18.429q-.002.494-.077.957L19.538 16zM16 7a3.75 3.75 0 0 1 1.653 7.115l-5.02-5.02A3.75 3.75 0 0 1 16 7"/></svg>
                </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredStaffList.length === 0">
              <td colspan="8" class="py-6 text-center text-slate-400">No Results Found</td>
            </tr>
          </tbody>
        </table>
        </div>

        <div class="space-y-3 md:hidden">
          <article v-for="staff in filteredStaffList" :key="`card-${staff.id}`" class="staff-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-white">{{ staff.fullName || `${staff.firstName} ${staff.lastName}` }}</h3>
                <p class="truncate text-sm text-slate-400">{{ staff.email || '-' }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ staff.engagementType === 'student_intern' ? 'Student intern / OJT' : !staff.engagementType && staff.employmentType === 'Intern' ? 'Needs arrangement review' : `Employee · ${staff.employmentType || 'Not set'}` }}<span v-if="staff.weeklyHoursTarget"> · {{ staff.weeklyHoursTarget }} h/week</span></p>
              </div>
              <span
                :class="[
                  'shrink-0 inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
                  staff.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                ]"
              >{{ staff.status }}</span>
            </div>
            <dl class="staff-card-details">
              <div><dt>Role</dt><dd>{{ staff.role || '-' }}</dd></div>
              <div><dt>Assigned branches</dt><dd>{{ staff.assignedBranchNames?.join(', ') || staff.clinicBranch || '-' }}</dd></div>
              <div><dt>Location</dt><dd>{{ staff.clinicLocation || '-' }}</dd></div>
              <div><dt>Phone</dt><dd>{{ staff.phoneNumber || '-' }}</dd></div>
            </dl>
            <div class="flex gap-2 border-t border-slate-700/80 pt-3">
              <button v-if="canUpdateStaff" type="button" @click="openEditModal(staff)" :aria-label="`Edit ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Edit employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-white transition hover:bg-yellow-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h24v24H0z" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.1 2.1 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621"/><path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></g></svg>
              </button>
              <button v-if="canDisableStaff" type="button" @click="deactivateStaff(staff)" :aria-label="`Disable ${staff.fullName || `${staff.firstName} ${staff.lastName}`}`" title="Disable employee" class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="h-5 w-5" fill="none" aria-hidden="true"><path d="M0 0h32v32H0z" fill="none"/><path fill="currentColor" d="M2.293 2.293a1 1 0 0 1 1.414 0l26 26a1 1 0 1 1-1.414 1.414l-3.127-3.127A13.94 13.94 0 0 1 16 30C8.268 30 2 23.732 2 16c0-3.506 1.288-6.712 3.418-9.168L2.293 3.707a1 1 0 0 1 0-1.414m4.545 5.959A11.95 11.95 0 0 0 4 16c0 6.627 5.373 12 12 12c2.954 0 5.656-1.07 7.746-2.84l-2.554-2.554C19.912 23.805 18.062 24.5 16 24.5c-3.866 0-7-2.428-7-6.071A2.43 2.43 0 0 1 11.429 16h3.157zM16 2c7.732 0 14 6.268 14 14c0 2.962-.921 5.708-2.491 7.97l-1.444-1.442A11.94 11.94 0 0 0 28 16c0-6.627-5.373-12-12-12c-2.409 0-4.65.712-6.53 1.934L8.028 4.49A13.94 13.94 0 0 1 16 2m4.571 14A2.43 2.43 0 0 1 23 18.429q-.002.494-.077.957L19.538 16zM16 7a3.75 3.75 0 0 1 1.653 7.115l-5.02-5.02A3.75 3.75 0 0 1 16 7"/></svg>
              </button>
            </div>
          </article>
          <div v-if="filteredStaffList.length === 0" class="py-8 text-center text-slate-400">No Results Found</div>
        </div>
      </div>

      <!-- Edit Modal -->
      <Modal :isOpen="showEditModal" panelClass="employee-edit-modal" :panel-style="{ maxWidth: '1100px', maxHeight: '92vh', background: '#fffdf9', color: '#3d281d' }" :close-on-backdrop="!savingEmployee" @close="!savingEmployee && (showEditModal = false)">
        <template #header>
          <div><p class="employee-edit-eyebrow">STAFF PROFILE</p><h2 class="employee-edit-title">Edit {{ currentStaff.fullName || `${currentStaff.firstName} ${currentStaff.lastName}` }}</h2><p class="employee-edit-caption">Update the same personal, employment, schedule, and compensation details used when creating this account.</p></div>
        </template>

        <template #body>
          <div class="employee-edit-form" :aria-busy="savingEmployee">
            <nav class="employee-edit-tabs" role="tablist" aria-label="Employee account details">
              <button v-for="tab in editTabs" :key="tab.id" type="button" role="tab" :aria-selected="activeEditTab === tab.id" :aria-controls="`employee-edit-panel-${tab.id}`" :class="{ 'is-active': activeEditTab === tab.id }" @click="activeEditTab = tab.id">{{ tab.label }}</button>
            </nav>

            <section v-show="activeEditTab === 'personal'" id="employee-edit-panel-personal" class="employee-edit-tab-panel" role="tabpanel" aria-label="Personal and contact information">
              <h3>Personal Information</h3>
              <div class="employee-edit-grid">
                <label>First Name<input v-model="currentStaff.firstName" type="text" autocomplete="given-name" @input="clearEditError('firstName')" /><span v-if="editErrors.firstName" class="employee-edit-error">{{ editErrors.firstName }}</span></label>
                <label>Middle Name<input v-model="currentStaff.middleName" type="text" autocomplete="additional-name" @input="clearEditError('middleName')" /><span v-if="editErrors.middleName" class="employee-edit-error">{{ editErrors.middleName }}</span></label>
                <label>Last Name<input v-model="currentStaff.lastName" type="text" autocomplete="family-name" @input="clearEditError('lastName')" /><span v-if="editErrors.lastName" class="employee-edit-error">{{ editErrors.lastName }}</span></label>
                <label>Suffix<input v-model="currentStaff.suffix" type="text" autocomplete="honorific-suffix" placeholder="Optional" @input="clearEditError('suffix')" /><span v-if="editErrors.suffix" class="employee-edit-error">{{ editErrors.suffix }}</span></label>
              </div>
              <h3>Contact Information</h3>
              <div class="employee-edit-grid">
                <label>Email<input v-model.trim="currentStaff.email" type="email" autocomplete="email" @input="clearEditError('email')" /><span v-if="editErrors.email" class="employee-edit-error">{{ editErrors.email }}</span></label>
                <label>Phone Number
                  <div class="employee-phone-input"><span>+63</span><input :value="currentStaff.phoneNumber" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="9XXXXXXXXX" @input="handleEditPhoneInput" /></div>
                  <span class="employee-edit-caption">Enter 10 digits starting with 9.</span><span v-if="editErrors.phoneNumber" class="employee-edit-error">{{ editErrors.phoneNumber }}</span>
                </label>
              </div>
            </section>

            <section v-show="activeEditTab === 'role'" id="employee-edit-panel-role" class="employee-edit-tab-panel" role="tabpanel" aria-label="Role and branch assignment">
              <div class="employee-edit-status-row"><div><span class="employee-edit-caption">Account status</span><strong>{{ currentStaff.status || 'Unknown' }}</strong></div><span class="employee-edit-caption">Change status from the employee list actions.</span></div>
              <h3>Role & Employment</h3>
              <div class="employee-edit-grid">
                <div class="employee-edit-field"><label>Roles</label><div class="employee-edit-choices"><label v-for="role in customRoles" :key="role.id"><input v-model="currentStaff.customRoleIds" type="checkbox" :value="role.id" :disabled="!canManageRoles" /><span>{{ role.name }}</span></label><p v-if="!customRoles.length">No roles available.</p></div><p class="employee-edit-caption">Select the roles this employee needs. Role changes require Manage Roles permission.</p></div>
                <div class="employee-edit-field"><ContractAppearanceSelect id="employee-edit-arrangement" :model-value="currentStaff.engagementType" @update:model-value="changeStaffArrangement" label="Employment arrangement" :options="[{ value: '', label: 'Choose arrangement' }, { value: 'employee', label: 'Employee' }, { value: 'student_intern', label: 'Student intern / OJT' }]" /><span v-if="editErrors.engagementType" class="employee-edit-error">{{ editErrors.engagementType }}</span></div>
                <div v-if="!isStudentIntern" class="employee-edit-field"><ContractAppearanceSelect id="employee-edit-employment-type" :model-value="currentStaff.employmentType" @update:model-value="changeEmploymentType" label="Employment type" :options="[{ value: '', label: 'Choose employment type' }, { value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }, ...(currentStaff.employmentType === 'Intern' ? [{ value: 'Intern', label: 'Legacy intern — classify above' }] : [])]" /><span v-if="editErrors.employmentType" class="employee-edit-error">{{ editErrors.employmentType }}</span></div>
                <label>Agreed Weekly Hours<input v-model.number="currentStaff.weeklyHoursTarget" type="number" :min="currentStaff.employmentType === 'Full-time' ? 40 : 1" max="48" step="0.5" @input="clearEditError('weeklyHoursTarget')" /><span class="employee-edit-caption">Full-time is 40–48 hours. Maximum is 48.</span><span v-if="editErrors.weeklyHoursTarget" class="employee-edit-error">{{ editErrors.weeklyHoursTarget }}</span></label>
              </div>
              <h3>Branch Assignment</h3>
              <div class="employee-edit-grid">
                <div class="employee-edit-field"><label>Assigned Branches</label><div class="employee-edit-choices"><label v-for="branch in branches" :key="branch.id"><input v-model="currentStaff.branchIds" type="checkbox" :value="branch.id" @change="updateCurrentStaffLocation(); clearEditError('branchId')" /><span>{{ branch.clinicBranch }} — {{ branch.clinicLocation }}</span></label></div><p class="employee-edit-caption">The first selected branch is primary.</p><span v-if="editErrors.branchId" class="employee-edit-error">{{ editErrors.branchId }}</span></div>
                <label>Clinic Locations<input :value="selectedClinicLocations.join(', ')" type="text" readonly placeholder="Select one or more branches" /><span class="employee-edit-caption">Each selected location is shown once.</span></label>
              </div>
              <fieldset v-if="showPractitionerFields" class="employee-professional-fields" :disabled="loadingSpecialty || savingEmployee || !!specialtyError">
                <legend>Professional Information</legend>
                <p v-if="loadingSpecialty" role="status" class="employee-edit-caption">Loading professional details...</p>
                <ContractAppearanceSelect id="employee-edit-specialty" label="Professional specialty" v-model="currentStaff.practitionerType" :options="[{ value: '', label: 'Not specified' }, ...employeeSpecialtyTypes.map(type => ({ value: type, label: type }))]" @update:model-value="clearEditError('practitionerType')" />
                <span v-if="editErrors.practitionerType" class="employee-edit-error" role="alert">{{ editErrors.practitionerType }}</span>
                <template v-if="showLicenseField">
                  <div class="employee-license-fields">
                    <label for="employee-edit-license">Credential / license number<input id="employee-edit-license" v-model.trim="currentStaff.credentialNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Enter 7 digits" @input="normalizeCredentialNumber" /><span v-if="editErrors.credentialNumber" class="employee-edit-error">{{ editErrors.credentialNumber }}</span></label>
                    <label for="employee-edit-license-file">Replacement credential image (optional)<input id="employee-edit-license-file" type="file" accept="image/jpeg,image/png" @change="handleLicenseFile" /><span v-if="currentStaff.practitionerLicenseName && !licenseFile" class="employee-edit-caption">Current document: {{ currentStaff.practitionerLicenseName }}</span><a v-if="currentStaff.practitionerLicenseUrl && !licenseFile" class="employee-license-link" :href="currentStaff.practitionerLicenseUrl" target="_blank" rel="noopener">View current license document</a></label>
                  </div>
                  <p class="employee-edit-caption">Changing professional details or uploading a replacement requires a new credential review.</p>
                  <p v-if="licenseOcrBusy" class="employee-edit-caption" role="status">Reading the credential with OCR…</p>
                  <div v-else-if="licenseOcrResult" class="employee-license-ocr" aria-live="polite"><strong>OCR suggestion · owner review required</strong><p>{{ licenseOcrResult.reason }}</p><template v-if="licenseOcrNameMatched"><p v-if="licenseOcrResult.confidence != null">Text recognition confidence: {{ Math.round(licenseOcrResult.confidence * 100) }}%</p><details v-if="licenseOcrResult.extractedText"><summary>View extracted text</summary><pre>{{ licenseOcrResult.extractedText }}</pre></details></template></div>
                </template>
              </fieldset>
              <p v-if="specialtyError" class="employee-edit-error" role="alert">{{ specialtyError }}</p>
            </section>

            <section v-show="activeEditTab === 'schedule'" id="employee-edit-panel-schedule" class="employee-edit-tab-panel" role="tabpanel" aria-label="Shift assignment">
              <p v-if="scheduleLoadError" class="employee-edit-error" role="alert">{{ scheduleLoadError }}</p>
              <CreateAccountScheduleStep v-else-if="canViewShifts" ref="scheduleStepRef" v-model="scheduleDraft" :employee-id="currentStaff.id" :branch-id="currentStaff.branchIds?.[0] || ''" :branch-name="branches.find(branch => branch.id === (currentStaff.branchIds?.[0] || ''))?.clinicBranch || 'Selected branch'" :employment-type="currentStaff.employmentType" :weekly-hours-target="Number(currentStaff.weeklyHoursTarget || 0)" :can-view-shifts="canViewShifts" :can-create-shifts="canCreateShifts" :can-assign-shifts="canAssignShifts" allow-empty-schedule />
              <p v-else class="employee-edit-caption">Shift schedules are available to accounts with HR schedule access.</p>
            </section>

            <section v-show="activeEditTab === 'compensation'" id="employee-edit-panel-compensation" class="employee-edit-tab-panel" role="tabpanel" aria-label="Base pay and commissions">
              <h3>Base Pay</h3>
              <p v-if="isStudentIntern" class="employee-edit-caption">Student interns / OJT are not included in employee payroll. Record approved allowances in Finance → Other Expenses.</p>
              <template v-else>
                <p v-if="!canManagePay" class="employee-edit-caption">You can view the saved pay details, but Payroll Update permission is required to change them.</p>
                <div class="employee-edit-grid">
                  <div class="employee-edit-field"><ContractAppearanceSelect id="employee-edit-pay-model" v-model="basePay.basePayModel" label="Pay model" :disabled="!canManagePay" :options="[{ value: 'hourly', label: 'Hourly / Professional Fee' }, { value: 'daily', label: 'Daily' }, { value: 'monthly-retainer', label: 'Monthly Retainer' }]" /></div>
                  <label>Rate (PHP)<input v-model="basePay.basePay" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" :disabled="!canManagePay" /><span v-if="editErrors.basePay" class="employee-edit-error">{{ editErrors.basePay }}</span></label>
                  <label v-if="basePay.basePayModel === 'monthly-retainer'">Agreed Monthly Hours<input v-model.number="basePay.monthlyBaseHours" type="number" min="1" max="744" step="1" :disabled="!canManagePay" /></label>
                </div>
                <p class="employee-edit-caption">New employee start dates use the effective week set under Shift Assignment. Existing recorded start dates are retained for paid-leave eligibility.</p>
              </template>
              <h3>Service Commissions</h3>
              <p v-if="commissionLoadError" class="employee-edit-error" role="alert">{{ commissionLoadError }}</p>
              <CreateAccountCommissionAgreements v-else-if="showPractitionerFields && canManageCommissions" ref="commissionEditorRef" v-model="commissionDraft" :branch-ids="currentStaff.branchIds" />
              <p v-else-if="showPractitionerFields" class="employee-edit-caption">The clinic owner can update this practitioner's commission agreements.</p>
              <p v-else class="employee-edit-caption">Service commissions are available for Practitioner roles and roles with consultation permissions.</p>
            </section>
          </div>
        </template>

        <template #footer>
          <div class="flex flex-col sm:flex-row justify-end sm:space-x-2 space-y-2 sm:space-y-0">
            <button type="button" :disabled="savingEmployee" @click="showEditModal = false" class="employee-edit-cancel">Cancel</button>
            <button v-if="canUpdateStaff" type="button" :aria-busy="savingEmployee" :disabled="savingEmployee || loadingSpecialty || licenseOcrBusy || !!specialtyError" class="employee-edit-save app-form-action" @click="saveStaff">{{ savingEmployee ? 'Saving...' : 'Save Changes' }}</button>
          </div>
        </template>
      </Modal>
    </component>
  </div>
</template>

<style scoped>
:global(.app-modal-panel.employee-edit-modal) { background: #fffdf9 !important; color: #3d281d !important; border: 1px solid #ecd6be; border-radius: 16px; }
:global(.employee-edit-modal > div:first-child), :global(.employee-edit-modal > div:last-child) { background: #fffdf9; padding: 20px 24px; }
:global(.employee-edit-modal > div:first-child > button) { color: #765d4c; border: 1px solid #ecd6be; border-radius: 8px; padding: 5px; }
.employee-edit-eyebrow { color: #9b603d; font-size: 10px; letter-spacing: .15em; font-weight: 700; }
.employee-edit-title { color: #3d281d; font-size: 23px; font-weight: 700; margin: 5px 0; }
.employee-edit-caption { font-size: 12px; color: #765d4c !important; line-height: 1.6; margin-top: 6px; }
.employee-edit-form { padding: 4px 8px; color: #3d281d; }
.employee-edit-form label { color: #5d4536 !important; font-size: 13px; font-weight: 600; }
.employee-edit-form input:not([type=checkbox]) { display: block; width: 100%; padding: 11px 12px; min-height: 44px; margin-top: 6px; border: 1px solid #dec19e !important; border-radius: 9px; background: #fffdf9 !important; color: #3d281d !important; }
.employee-edit-form input:read-only { background: #f7f0e6 !important; }
.employee-edit-form input:focus { outline: 2px solid #d7aa7d; outline-offset: 2px; }
.employee-edit-form :is(.text-slate-400, .text-white) { color: #765d4c !important; }
.employee-edit-form :deep(.appearance-select) { margin: 0; }
.employee-edit-tabs { display: flex; gap: 6px; margin: 0 0 18px; overflow-x: auto; border-bottom: 1px solid #ecd6be; }
.employee-edit-tabs button { flex: 0 0 auto; padding: 11px 14px; border-bottom: 3px solid transparent; color: #765d4c; font-size: 13px; font-weight: 600; white-space: nowrap; }
.employee-edit-tabs button:hover, .employee-edit-tabs button:focus-visible { color: #805337; }
.employee-edit-tabs button.is-active { color: #70482e; border-bottom-color: #a46d45; }
.employee-edit-tab-panel { min-height: 300px; padding: 2px 4px 12px; }
.employee-edit-tab-panel h3 { margin: 4px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #ecd6be; color: #3d281d; font-size: 17px; font-weight: 700; }
.employee-edit-tab-panel h3:not(:first-child) { margin-top: 22px; }
.employee-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
.employee-edit-grid > label, .employee-edit-grid > .employee-edit-field { min-width: 0; }
.employee-edit-caption { display: block; color: #765d4c !important; font-size: 12px; line-height: 1.5; margin-top: 6px; }
.employee-edit-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding: 12px 14px; border: 1px solid #ecd6be; border-radius: 10px; background: #fffaf3; }
.employee-edit-status-row strong { display: block; margin-top: 3px; color: #3d281d; font-size: 14px; }
.employee-phone-input { display: flex; align-items: center; gap: 0; margin-top: 6px; }
.employee-edit-form .employee-phone-input span { flex: 0 0 auto; padding: 11px 12px; border: 1px solid #dec19e; border-right: 0; border-radius: 9px 0 0 9px; background: #f7f0e6; color: #765d4c; }
.employee-edit-form .employee-phone-input input { min-width: 0; width: 1px; margin: 0; border-radius: 0 9px 9px 0; }
.employee-edit-field > .employee-edit-error, .employee-edit-grid label > .employee-edit-error { display: block; }
.employee-edit-tab-panel .employee-professional-fields { margin-top: 22px; }
.employee-edit-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; border: 1px solid #ecd6be; border-radius: 10px; max-height: 180px; overflow-y: auto; }
.employee-edit-choices label { display: flex; align-items: flex-start; gap: 9px; padding: 8px; background: #fffaf3; border-radius: 7px; font-weight: 400; }
.employee-edit-choices input { margin-top: 3px; accent-color: #8d5a3b; flex-shrink: 0; width: 15px; height: 15px; }
.employee-professional-fields { padding: 18px; border: 1px solid #ecd6be; border-radius: 12px; }
.employee-professional-fields legend { padding: 0 6px; font-size: 14px; font-weight: 600; color: #3d281d; }
.employee-professional-fields label { display: block; margin-top: 12px; }
.employee-professional-fields input[type="file"] { padding: 8px; background: #fffaf3 !important; color: #5d4536 !important; }
.employee-license-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 12px; margin-top: 12px; }
.employee-license-field { min-width: 0; }
.employee-license-field label { margin-top: 0 !important; }
.employee-license-field input[type="file"] { box-sizing: border-box; min-height: 44px; }
.employee-license-link { display: inline-block; margin-top: 6px; color: #805337; font-size: 12px; text-decoration: underline; }
.employee-license-ocr { margin-top: 10px; padding: 12px; border: 1px solid #e8c99f; border-radius: 9px; background: #fbf1df; color: #5d4536; font-size: 12px; }
.employee-license-ocr strong { color: #805337; }
.employee-license-ocr p { margin-top: 5px; }
.employee-license-ocr details { margin-top: 8px; }
.employee-license-ocr summary { display: flex; align-items: center; gap: 8px; width: fit-content; cursor: pointer; list-style: none; font-weight: 600; }
.employee-license-ocr summary::-webkit-details-marker { display: none; }
.employee-license-ocr summary::after { content: ''; width: 7px; height: 7px; margin-left: 2px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform .16s ease; }
.employee-license-ocr details[open] summary::after { transform: rotate(225deg) translate(-1px, -1px); }
.employee-license-ocr pre { max-height: 160px; margin-top: 8px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 6px; background: #fffdf9; padding: 9px; font: 11px/1.5 ui-monospace, monospace; }
.employee-edit-error { color: #a13732; font-size: 12px; margin-top: 8px; }
.employee-edit-cancel, .employee-edit-save { padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; min-height: 42px; }
.employee-edit-cancel { border: 1px solid #dec19e; background: #fffdf9; color: #70482e; }
.employee-edit-save { border: 1px solid #8d5a3b; background: #8d5a3b; color: #fffdf9; }
.employee-edit-save:hover { background: #74462d; }
.employee-edit-cancel:disabled, .employee-edit-save:disabled { opacity: .55; cursor: not-allowed; }
@media(max-width: 640px) { .employee-edit-choices, .employee-license-fields, .employee-edit-grid { grid-template-columns: 1fr; } .employee-edit-form { padding: 0; } .employee-edit-status-row { align-items: flex-start; flex-direction: column; } }
.staff-management-main {
  background: radial-gradient(circle at 90% 0%, rgba(126, 78, 46, 0.14), transparent 32rem);
}

.staff-eyebrow {
  margin-bottom: 0.35rem;
  color: #d8b38f;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.staff-search {
  box-shadow: 0 12px 30px rgba(25, 12, 7, 0.18);
}

.staff-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(123, 79, 55, 0.35);
  padding: 0.35rem 0.5rem 1rem;
}

.staff-list-caption {
  color: #cbb19c;
  font-size: 0.75rem;
  text-align: right;
}

.staff-table th {
  padding: 0.9rem 0.75rem;
  white-space: nowrap;
}

.staff-table td {
  padding: 1rem 0.75rem;
  vertical-align: middle;
}

.staff-table tbody tr {
  border-bottom: 1px solid rgba(123, 79, 55, 0.2);
}

.staff-table tbody tr:last-child {
  border-bottom: 0;
}

.staff-card {
  border: 1px solid rgba(123, 79, 55, 0.42);
  border-radius: 0.9rem;
  background: rgba(38, 23, 16, 0.76);
  padding: 1rem;
}

.staff-card-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
  margin: 1rem 0;
}

.staff-card-details dt {
  color: #a88d7a;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.staff-card-details dd {
  overflow-wrap: anywhere;
  color: #f2dfd0;
  font-size: 0.88rem;
  margin-top: 0.2rem;
}

@media (max-width: 639px) {
  .staff-list-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .staff-list-caption {
    text-align: left;
  }
}

@media (min-width: 768px) and (max-width: 1100px) {
  .staff-table th,
  .staff-table td {
    padding-left: 0.55rem;
    padding-right: 0.55rem;
  }
}
</style>
