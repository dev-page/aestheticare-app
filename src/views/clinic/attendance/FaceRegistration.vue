<template>
  <div class="module-theme min-h-screen bg-slate-900 p-4 md:p-8">
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="flex flex-col gap-2">
        <button
          type="button"
          class="self-start inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          @click="goBack"
        >
          <span class="text-lg leading-none">‹</span>
          <span class="text-sm font-medium">Back</span>
        </button>
        <h1 class="text-2xl md:text-3xl font-bold text-white">Face Registration</h1>
        <p class="text-slate-400">
          Register your face after changing your password. Capture at least 3 clear samples.
        </p>
        <p class="text-slate-300 text-sm">Employee: {{ employeeName }}</p>
      </header>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <h2 class="text-lg font-semibold text-white">Before You Start</h2>
        <ul class="list-disc pl-5 space-y-1 text-slate-300 text-sm">
          <li>Stay in a well-lit area. Avoid dark rooms or strong backlight.</li>
          <li>Keep your full face centered and clearly visible in the camera frame.</li>
          <li>Remove mask, cap, or anything blocking your eyes, nose, or mouth.</li>
          <li>Only one face should appear on camera during capture.</li>
          <li>Hold still for each sample and avoid blurry motion.</li>
        </ul>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h2 class="text-lg font-semibold text-white">Camera</h2>

        <div class="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden min-h-[260px] flex items-center justify-center relative">
          <video
            ref="videoRef"
            class="w-full h-full object-cover"
            autoplay
            playsinline
            muted
          ></video>
          <p
            v-if="!cameraReady"
            class="absolute inset-0 text-slate-400 text-sm p-4 text-center flex items-center justify-center bg-slate-900/80"
          >
            Camera is not available. Please allow camera permission.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            :disabled="!cameraReady || !faceApiReady || isSubmitting || samples.length >= maxSamples"
            @click="captureSample"
          >
            Capture Sample ({{ samples.length }}/{{ maxSamples }})
          </button>

          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            :disabled="samples.length < minRequiredSamples || isSubmitting"
            @click="submitRegistration"
          >
            {{ isSubmitting ? 'Saving...' : 'Save Face Registration' }}
          </button>
        </div>

        <p v-if="alreadyRegistered" class="text-emerald-400 text-sm">
          Face registration already exists. Saving again will replace existing samples.
        </p>
        <p v-if="faceApiLoading" class="text-slate-300 text-sm">
          Loading face-api.js models...
        </p>
        <p v-else-if="faceApiReady" class="text-emerald-400 text-sm">
          face-api.js ready. Capture with one clear face in frame.
        </p>
        <p v-else-if="faceApiError" class="text-red-400 text-sm">
          {{ faceApiError }}
        </p>
      </section>

      <section class="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h2 class="text-lg font-semibold text-white">Captured Samples</h2>

        <div v-if="samples.length === 0" class="text-slate-400 text-sm">
          No captured samples yet.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <article
            v-for="(sample, index) in samples"
            :key="sample.id"
            class="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
          >
            <img :src="sample.preview" :alt="`Face sample ${index + 1}`" class="w-full h-44 object-cover" />
            <div class="p-3 flex items-center justify-between">
              <p class="text-slate-300 text-sm">Sample {{ index + 1 }}</p>
              <button
                type="button"
                class="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-500"
                :disabled="isSubmitting"
                @click="removeSample(index)"
              >
                Remove
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <canvas ref="canvasRef" class="hidden"></canvas>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import { auth, db, storage } from '@/config/firebaseConfig'

export default {
  name: 'FaceRegistration',
  setup() {
    const FACE_API_SCRIPT_URL =
      import.meta.env.VITE_FACE_API_SCRIPT_URL ||
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'
    const FACE_API_MODEL_URL =
      import.meta.env.VITE_FACE_API_MODEL_URL ||
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

    const router = useRouter()
    const minRequiredSamples = 3
    const maxSamples = 5

    const currentUserId = ref('')
    const employeeName = ref('Loading...')
    const alreadyRegistered = ref(false)

    const videoRef = ref(null)
    const canvasRef = ref(null)
    const cameraReady = ref(false)
    const cameraStream = ref(null)

    const faceApiReady = ref(false)
    const faceApiLoading = ref(false)
    const faceApiError = ref('')
    const faceApiInstance = ref(null)

    const samples = ref([])
    const isSubmitting = ref(false)

    const canSubmit = computed(() => samples.value.length >= minRequiredSamples)

    const goBack = () => {
      if (window.history.length > 1) {
        router.back()
        return
      }
      router.push('/login')
    }

    const stopCamera = () => {
      if (!cameraStream.value) return
      cameraStream.value.getTracks().forEach((track) => track.stop())
      cameraStream.value = null
      cameraReady.value = false
    }

    const attachStreamToVideo = async () => {
      await nextTick()
      if (!videoRef.value || !cameraStream.value) return
      videoRef.value.srcObject = cameraStream.value
      try {
        await videoRef.value.play()
      } catch (error) {
        console.error('Video playback failed:', error)
      }
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        cameraStream.value = stream
        cameraReady.value = true
        await attachStreamToVideo()
      } catch (error) {
        cameraReady.value = false
        toast.error('Unable to access camera.')
        console.error(error)
      }
    }

    const loadFaceApiLibrary = async () => {
      if (window.faceapi) return window.faceapi

      const existingScript = document.querySelector('script[data-face-api="vladmandic"]')
      if (existingScript) {
        await new Promise((resolve, reject) => {
          if (window.faceapi) {
            resolve()
            return
          }
          existingScript.addEventListener('load', () => resolve(), { once: true })
          existingScript.addEventListener('error', () => reject(new Error('Failed to load face-api.js.')), { once: true })
        })
        return window.faceapi
      }

      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = FACE_API_SCRIPT_URL
        script.async = true
        script.dataset.faceApi = 'vladmandic'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load face-api.js from CDN.'))
        document.head.appendChild(script)
      })

      return window.faceapi
    }

    const initializeFaceApi = async () => {
      if (faceApiReady.value) return true
      if (faceApiLoading.value) return false

      faceApiLoading.value = true
      faceApiError.value = ''
      try {
        const api = await loadFaceApiLibrary()
        if (!api) throw new Error('face-api.js global object is unavailable.')

        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
          api.nets.faceLandmark68Net.loadFromUri(FACE_API_MODEL_URL),
          api.nets.faceRecognitionNet.loadFromUri(FACE_API_MODEL_URL),
        ])

        faceApiInstance.value = api
        faceApiReady.value = true
        return true
      } catch (error) {
        faceApiReady.value = false
        faceApiError.value = error?.message || 'Failed to initialize face-api.js.'
        return false
      } finally {
        faceApiLoading.value = false
      }
    }

    const capturePhotoBlob = async () => {
      if (!videoRef.value || !canvasRef.value) return null

      const video = videoRef.value
      const canvas = canvasRef.value
      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, width, height)

      const preview = canvas.toDataURL('image/jpeg', 0.9)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))

      if (!blob) return null
      return { blob, preview }
    }

    const captureSample = async () => {
      if (!cameraReady.value) {
        toast.error('Camera is not ready.')
        return
      }
      if (!faceApiReady.value) {
        const ready = await initializeFaceApi()
        if (!ready) {
          toast.error(faceApiError.value || 'face-api.js is not ready.')
          return
        }
      }
      if (samples.value.length >= maxSamples) {
        toast.info(`Maximum of ${maxSamples} samples reached.`)
        return
      }

      const api = faceApiInstance.value
      if (!api || !videoRef.value) {
        toast.error('face-api.js is not ready.')
        return
      }

      const detections = await api
        .detectAllFaces(videoRef.value, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors()

      if (!Array.isArray(detections) || detections.length === 0) {
        toast.error('No face detected. Center your face and try again.')
        return
      }

      if (detections.length > 1) {
        toast.error('Multiple faces detected. Keep only one face in frame.')
        return
      }

      const isFacingCamera = (detection) => {
        const landmarks = detection?.landmarks
        if (!landmarks) {
          return { ok: false, message: 'Face landmarks not detected. Please try again.' }
        }

        const leftEye = landmarks.getLeftEye()
        const rightEye = landmarks.getRightEye()
        const nose = landmarks.getNose()

        if (!leftEye?.length || !rightEye?.length || !nose?.length) {
          return { ok: false, message: 'Unable to validate face direction. Try again.' }
        }

        const avg = (points) =>
          points.reduce(
            (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
            { x: 0, y: 0 }
          )

        const leftEyeCenterRaw = avg(leftEye)
        const rightEyeCenterRaw = avg(rightEye)
        const noseCenterRaw = avg(nose)

        const leftEyeCenter = {
          x: leftEyeCenterRaw.x / leftEye.length,
          y: leftEyeCenterRaw.y / leftEye.length,
        }
        const rightEyeCenter = {
          x: rightEyeCenterRaw.x / rightEye.length,
          y: rightEyeCenterRaw.y / rightEye.length,
        }
        const noseCenter = {
          x: noseCenterRaw.x / nose.length,
          y: noseCenterRaw.y / nose.length,
        }

        const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x)
        if (!eyeDistance || eyeDistance < 20) {
          return { ok: false, message: 'Move a bit closer to the camera.' }
        }

        const eyeTilt = Math.abs(rightEyeCenter.y - leftEyeCenter.y) / eyeDistance
        const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2
        const noseOffset = Math.abs(noseCenter.x - eyeMidX) / eyeDistance

        // Basic frontal-face thresholds.
        if (eyeTilt > 0.12) {
          return { ok: false, message: 'Keep your head level and look straight at the camera.' }
        }
        if (noseOffset > 0.18) {
          return { ok: false, message: 'Face the camera directly (avoid turning left or right).' }
        }

        return { ok: true, message: '' }
      }

      const facingCheck = isFacingCamera(detections[0])
      if (!facingCheck.ok) {
        toast.error(facingCheck.message)
        return
      }

      const photo = await capturePhotoBlob()
      if (!photo) {
        toast.error('Failed to capture sample.')
        return
      }

      samples.value.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        preview: photo.preview,
        blob: photo.blob,
        descriptor: Array.from(detections[0].descriptor || []),
      })
    }

    const removeSample = (index) => {
      samples.value.splice(index, 1)
    }

    const uploadSamples = async () => {
      const uploaded = []
      for (let i = 0; i < samples.value.length; i += 1) {
        const item = samples.value[i]
        const filePath = `faceRegistrations/${currentUserId.value}/${Date.now()}_${i + 1}.jpg`
        const fileRef = storageRef(storage, filePath)
        await uploadBytes(fileRef, item.blob)
        const url = await getDownloadURL(fileRef)
        uploaded.push({
          index: i + 1,
          url,
          path: filePath,
          descriptor: item.descriptor,
          uploadedAt: new Date().toISOString(),
        })
      }
      return uploaded
    }

    const computeMeanDescriptor = (uploadedSamples) => {
      if (!uploadedSamples.length) return []
      const first = uploadedSamples[0]?.descriptor
      if (!Array.isArray(first) || first.length === 0) return []

      const sum = new Array(first.length).fill(0)
      for (const sample of uploadedSamples) {
        if (!Array.isArray(sample.descriptor) || sample.descriptor.length !== first.length) continue
        for (let i = 0; i < first.length; i += 1) {
          sum[i] += Number(sample.descriptor[i] || 0)
        }
      }
      return sum.map((value) => value / uploadedSamples.length)
    }

    const submitRegistration = async () => {
      if (!canSubmit.value) {
        toast.error(`Capture at least ${minRequiredSamples} samples first.`)
        return
      }
      if (!currentUserId.value) {
        toast.error('Missing user context.')
        return
      }
      if (isSubmitting.value) return

      isSubmitting.value = true
      try {
        const uploadedSamples = await uploadSamples()
        const meanDescriptor = computeMeanDescriptor(uploadedSamples)

        const userRef = doc(db, 'users', currentUserId.value)
        await setDoc(
          userRef,
          {
            faceRegistration: {
              registered: true,
              registeredAt: serverTimestamp(),
              sampleCount: uploadedSamples.length,
              model: 'face-api.js (@vladmandic/face-api)',
              descriptorSize: meanDescriptor.length,
              meanDescriptor,
              samples: uploadedSamples,
            },
          },
          { merge: true }
        )

        toast.success('Face registration saved.')
      } catch (error) {
        console.error('Failed to save face registration:', error)
        toast.error(error?.message || 'Failed to save face registration.')
      } finally {
        isSubmitting.value = false
      }
    }

    const loadUserProfile = async (uid) => {
      const userSnap = await getDoc(doc(db, 'users', uid))
      if (!userSnap.exists()) {
        employeeName.value = 'Unknown Staff'
        return
      }
      const data = userSnap.data()
      const firstName = String(data.firstName || '').trim()
      const lastName = String(data.lastName || '').trim()
      employeeName.value =
        String(data.name || '').trim() ||
        `${firstName} ${lastName}`.trim() ||
        String(data.email || '').trim() ||
        'Unknown Staff'
      alreadyRegistered.value = Boolean(data?.faceRegistration?.registered)
    }

    let unsubscribeAuth = null

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.push('/login')
          return
        }

        currentUserId.value = user.uid
        await loadUserProfile(user.uid)
        await initializeFaceApi()
        await startCamera()
      })
    })

    onUnmounted(() => {
      stopCamera()
      if (unsubscribeAuth) unsubscribeAuth()
    })

    return {
      employeeName,
      alreadyRegistered,
      minRequiredSamples,
      maxSamples,
      cameraReady,
      faceApiReady,
      faceApiLoading,
      faceApiError,
      videoRef,
      canvasRef,
      samples,
      isSubmitting,
      goBack,
      captureSample,
      removeSample,
      submitRegistration,
    }
  },
}
</script>
