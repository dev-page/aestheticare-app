<template>
  <div class="module-theme min-h-screen bg-slate-900 p-4 md:p-8">
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            type="button"
            class="mb-3 inline-flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
            @click="goBack"
          >
            <span class="text-lg leading-none">&#8249;</span>
            <span class="text-sm font-medium">Back</span>
          </button>
          <h1 class="text-2xl font-bold text-white md:text-3xl">Scan Attendance QR</h1>
          <p class="mt-1 text-slate-400">
            Scan the clinic admin QR for today to record your attendance.
          </p>
        </div>

        <div class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-right md:min-w-[240px]">
          <p class="text-xs uppercase tracking-wide text-slate-400">Today</p>
          <p class="text-lg font-semibold text-white">{{ todayLabel }}</p>
          <p class="text-sm text-slate-300">{{ liveTime }}</p>
        </div>
      </header>

      <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white">QR Scanner</h2>
              <p class="text-sm text-slate-400">Allow camera access and point your device at the attendance QR.</p>
            </div>

            <button
              type="button"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isScanning"
              @click="startScanner"
            >
              {{ isScanning ? 'Scanner Active' : 'Start Scanner' }}
            </button>
          </div>

          <div class="mt-5 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <div id="attendance-qr-reader" class="min-h-[320px]"></div>
          </div>

          <p class="mt-4 text-sm" :class="statusClass">
            {{ statusMessage }}
          </p>
        </article>

        <aside class="space-y-4">
          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Employee</p>
            <h2 class="mt-2 text-lg font-semibold text-white">{{ employeeName }}</h2>
            <div class="mt-4 space-y-2 text-sm text-slate-300">
              <p><span class="text-slate-400">Role:</span> {{ employeeRole }}</p>
              <p><span class="text-slate-400">Branch:</span> {{ branchLabel }}</p>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Latest Result</p>
            <div v-if="lastAttendanceAction" class="mt-3 space-y-2 text-sm text-slate-300">
              <p><span class="text-slate-400">Action:</span> {{ lastAttendanceAction }}</p>
              <p><span class="text-slate-400">Time:</span> {{ lastAttendanceTime }}</p>
              <p><span class="text-slate-400">Method:</span> QR Scan</p>
            </div>
            <p v-else class="mt-3 text-sm text-slate-400">
              No scan recorded in this session yet.
            </p>
          </section>

          <section class="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">How It Works</p>
            <ol class="mt-3 space-y-2 text-sm text-slate-300">
              <li>1. Open the scanner and allow camera access.</li>
              <li>2. Scan the clinic admin QR for today.</li>
              <li>3. The system validates branch and date automatically.</li>
              <li>4. Your attendance is saved as time in or time out.</li>
            </ol>
          </section>
        </aside>
      </section>
    </div>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'vue3-toastify'
import { useRouter } from 'vue-router'
import { auth, db } from '@/config/firebaseConfig'
import { classifyAttendanceRecord } from '@/utils/attendanceStatus'

const READER_ID = 'attendance-qr-reader'

export default {
  name: 'AttendanceQrScan',
  setup() {
    const router = useRouter()

    const currentUserId = ref('')
    const currentBranchId = ref('')
    const employeeName = ref('Loading...')
    const employeeRole = ref('-')
    const branchLabel = ref('Loading...')
    const employeeShiftStart = ref('')
    const employeeShiftEnd = ref('')
    const attendanceRecord = ref({})
    const html5QrCode = ref(null)
    const isScanning = ref(false)
    const isProcessing = ref(false)
    const statusMessage = ref('Ready to scan today’s attendance QR.')
    const statusTone = ref('neutral')
    const lastAttendanceAction = ref('')
    const lastAttendanceTime = ref('')
    const nowRef = ref(new Date())

    const todayKey = computed(() => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    })

    const todayLabel = computed(() =>
      nowRef.value.toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    )

    const liveTime = computed(() =>
      nowRef.value.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    )

    const statusClass = computed(() => {
      if (statusTone.value === 'error') return 'text-rose-400'
      if (statusTone.value === 'success') return 'text-emerald-400'
      return 'text-slate-400'
    })

    const getFallbackPath = () => {
      const role = String(employeeRole.value || '').toLowerCase()
      if (role === 'manager') return '/manager/dashboard'
      if (role === 'receptionist') return '/receptionist/dashboard'
      if (role === 'practitioner') return '/practitioner/dashboard'
      if (role === 'finance') return '/finance/dashboard'
      if (role === 'hr') return '/hr/dashboard'
      return '/login'
    }

    const goBack = () => {
      if (window.history.length > 1) {
        router.back()
        return
      }
      router.push(getFallbackPath())
    }

    const getAttendanceDocRef = () => doc(db, 'attendance', `${currentUserId.value}_${todayKey.value}`)

    const loadEmployeeProfile = async () => {
      const user = auth.currentUser
      if (!user) return

      currentUserId.value = user.uid
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      if (!userSnap.exists()) {
        toast.error('Employee profile not found.')
        router.push('/login')
        return
      }

      const data = userSnap.data() || {}
      currentBranchId.value = String(data.branchId || '').trim()
      employeeRole.value = String(data.role || '').trim() || '-'
      employeeName.value =
        String(data.fullName || '').trim() ||
        `${String(data.firstName || '').trim()} ${String(data.lastName || '').trim()}`.trim() ||
        String(data.email || '').trim() ||
        'Employee'

      if (currentBranchId.value) {
        const branchSnap = await getDoc(doc(db, 'clinics', currentBranchId.value))
        if (branchSnap.exists()) {
          const branchData = branchSnap.data() || {}
          branchLabel.value = `${branchData.clinicBranch || 'Branch'}${branchData.clinicLocation ? ` - ${branchData.clinicLocation}` : ''}`
        } else {
          branchLabel.value = currentBranchId.value
        }
      } else {
        branchLabel.value = 'No branch assigned'
      }

      employeeShiftStart.value = String(data.shiftStart || '').trim()
      employeeShiftEnd.value = String(data.shiftEnd || '').trim()

      const attendanceSnap = await getDoc(getAttendanceDocRef())
      attendanceRecord.value = attendanceSnap.exists() ? attendanceSnap.data() || {} : {}
    }

    const setStatus = (message, tone = 'neutral') => {
      statusMessage.value = message
      statusTone.value = tone
    }

    const processQrPayload = async (decodedText) => {
      if (isProcessing.value) return
      isProcessing.value = true

      try {
        let payload = null
        try {
          payload = JSON.parse(decodedText)
        } catch (_error) {
          setStatus('Invalid QR format. Please scan a clinic attendance QR.', 'error')
          toast.error('Invalid QR format.')
          return
        }

        if (payload?.type !== 'attendance-qr') {
          setStatus('This QR is not an attendance QR.', 'error')
          toast.error('This QR is not valid for attendance.')
          return
        }

        if (String(payload.date || '').trim() !== todayKey.value) {
          setStatus('This QR is not valid for today anymore.', 'error')
          toast.error('This attendance QR is expired.')
          return
        }

        if (String(payload.branchId || '').trim() !== currentBranchId.value) {
          setStatus('This QR belongs to a different branch.', 'error')
          toast.error('This QR is not for your branch.')
          return
        }

        const qrDocId = `${currentBranchId.value}_${todayKey.value}`
        const qrSnap = await getDoc(doc(db, 'attendanceDailyQRCodes', qrDocId))
        if (!qrSnap.exists()) {
          setStatus('The attendance QR record could not be found.', 'error')
          toast.error('Attendance QR record not found.')
          return
        }

        const savedQr = qrSnap.data() || {}
        if (String(savedQr.token || '').trim() !== String(payload.token || '').trim()) {
          setStatus('This attendance QR token does not match the latest record.', 'error')
          toast.error('Attendance QR is invalid.')
          return
        }

        const now = new Date()
        const timeLabel = now.toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })

        const existingSnap = await getDoc(getAttendanceDocRef())
        const existing = existingSnap.exists() ? existingSnap.data() || {} : {}

        let action = ''
        const payloadToSave = {
          employeeId: currentUserId.value,
          employeeName: employeeName.value,
          role: employeeRole.value,
          branchId: currentBranchId.value,
          date: todayKey.value,
          attendanceMethod: 'qr',
          qrToken: String(payload.token || '').trim(),
          shiftStart: employeeShiftStart.value || existing.shiftStart || '',
          shiftEnd: employeeShiftEnd.value || existing.shiftEnd || '',
          updatedAt: serverTimestamp(),
          createdAt: existing.createdAt || serverTimestamp(),
        }

        if (!existing.timeIn) {
          action = 'Clock In'
          payloadToSave.timeIn = timeLabel
          payloadToSave.status = 'Logged'
        } else if (!existing.timeOut) {
          action = 'Clock Out'
          payloadToSave.timeOut = timeLabel
          payloadToSave.status = 'Logged'
        } else {
          setStatus('You already recorded both time in and time out for today.', 'error')
          toast.info('Attendance already completed for today.')
          return
        }

        const nextRecord = { ...existing, ...payloadToSave }
        const attendanceMeta = classifyAttendanceRecord({
          timeIn: nextRecord.timeIn,
          timeOut: nextRecord.timeOut,
          shiftStart: nextRecord.shiftStart,
          shiftEnd: nextRecord.shiftEnd,
        })

        Object.assign(payloadToSave, attendanceMeta)

        await setDoc(getAttendanceDocRef(), payloadToSave, { merge: true })
        attendanceRecord.value = { ...existing, ...payloadToSave }
        lastAttendanceAction.value = action
        lastAttendanceTime.value = timeLabel
        setStatus(`${action} recorded successfully using today’s QR.`, 'success')
        toast.success(`${action} recorded successfully.`)
      } catch (error) {
        console.error('Failed to process attendance QR:', error)
        setStatus('Unable to process the scanned QR right now.', 'error')
        toast.error('Failed to process attendance QR.')
      } finally {
        isProcessing.value = false
      }
    }

    const startScanner = async () => {
      if (isScanning.value) return

      await nextTick()
      try {
        if (!html5QrCode.value) {
          html5QrCode.value = new Html5Qrcode(READER_ID)
        }

        await html5QrCode.value.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            await processQrPayload(decodedText)
          },
          () => {}
        )

        isScanning.value = true
        setStatus('Scanner is active. Point your camera at the attendance QR.')
      } catch (error) {
        console.error('Failed to start QR scanner:', error)
        setStatus('Unable to start the QR scanner. Please allow camera access.', 'error')
        toast.error('Unable to start QR scanner.')
      }
    }

    const stopScanner = async () => {
      if (!html5QrCode.value || !isScanning.value) return
      try {
        await html5QrCode.value.stop()
        await html5QrCode.value.clear()
      } catch (_error) {
        // ignore scanner cleanup issues
      } finally {
        isScanning.value = false
      }
    }

    let unsubscribeAuth = null
    let clockInterval = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.push('/login')
          return
        }
        await loadEmployeeProfile()
        await startScanner()
      })

      clockInterval = setInterval(() => {
        nowRef.value = new Date()
      }, 1000)
    })

    onUnmounted(async () => {
      await stopScanner()
      if (unsubscribeAuth) unsubscribeAuth()
      if (clockInterval) clearInterval(clockInterval)
    })

    return {
      branchLabel,
      employeeName,
      employeeRole,
      goBack,
      isScanning,
      lastAttendanceAction,
      lastAttendanceTime,
      liveTime,
      startScanner,
      statusClass,
      statusMessage,
      todayLabel,
    }
  },
}
</script>
