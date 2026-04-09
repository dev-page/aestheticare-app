const FACE_API_SCRIPT_URL =
  import.meta.env.VITE_FACE_API_SCRIPT_URL ||
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'

const FACE_API_MODEL_URL =
  import.meta.env.VITE_FACE_API_MODEL_URL ||
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

let faceApiInstance = null
let faceApiLoadingPromise = null

const ensureFaceApiScript = async () => {
  if (window.faceapi) return window.faceapi

  const existingScript = document.querySelector('script[data-face-api="vladmandic"]')
  if (existingScript) {
    await new Promise((resolve, reject) => {
      if (window.faceapi) {
        resolve()
        return
      }
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load face-api.js.')), {
        once: true,
      })
    })
    return window.faceapi
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = FACE_API_SCRIPT_URL
    script.async = true
    script.dataset.faceApi = 'vladmandic'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load face-api.js script.'))
    document.head.appendChild(script)
  })

  return window.faceapi
}

export const initializeFaceRecognition = async () => {
  if (faceApiInstance) return faceApiInstance
  if (faceApiLoadingPromise) return faceApiLoadingPromise

  faceApiLoadingPromise = (async () => {
    const api = await ensureFaceApiScript()
    if (!api) throw new Error('face-api.js did not initialize.')

    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
      api.nets.faceLandmark68Net.loadFromUri(FACE_API_MODEL_URL),
      api.nets.faceRecognitionNet.loadFromUri(FACE_API_MODEL_URL),
    ])

    faceApiInstance = api
    return faceApiInstance
  })()

  try {
    return await faceApiLoadingPromise
  } finally {
    faceApiLoadingPromise = null
  }
}

export const extractSingleFaceDescriptor = async (input, options = {}) => {
  const api = await initializeFaceRecognition()
  const detectorOptions = new api.TinyFaceDetectorOptions({
    inputSize: Number(options.inputSize || 416),
    scoreThreshold: Number(options.scoreThreshold || 0.5),
  })

  const detections = await api
    .detectAllFaces(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (!Array.isArray(detections) || detections.length === 0) {
    return {
      ok: false,
      reason: 'no_face',
      message: 'No face detected.',
      descriptor: null,
      detections: [],
    }
  }

  if (detections.length > 1) {
    return {
      ok: false,
      reason: 'multiple_faces',
      message: 'Multiple faces detected.',
      descriptor: null,
      detections,
    }
  }

  return {
    ok: true,
    reason: 'ok',
    message: '',
    descriptor: Array.from(detections[0].descriptor || []),
    detections,
  }
}

export const euclideanDistance = (descriptorA = [], descriptorB = []) => {
  if (!Array.isArray(descriptorA) || !Array.isArray(descriptorB)) return Number.POSITIVE_INFINITY
  if (descriptorA.length === 0 || descriptorA.length !== descriptorB.length) return Number.POSITIVE_INFINITY

  let sum = 0
  for (let i = 0; i < descriptorA.length; i += 1) {
    const diff = Number(descriptorA[i] || 0) - Number(descriptorB[i] || 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export const findBestFaceMatch = ({
  probeDescriptor = [],
  referenceDescriptors = [],
  threshold = 0.55,
}) => {
  if (!Array.isArray(probeDescriptor) || probeDescriptor.length === 0) {
    return {
      matched: false,
      bestDistance: Number.POSITIVE_INFINITY,
      bestIndex: -1,
      threshold,
    }
  }

  let bestDistance = Number.POSITIVE_INFINITY
  let bestIndex = -1

  for (let i = 0; i < referenceDescriptors.length; i += 1) {
    const candidate = referenceDescriptors[i]
    const distance = euclideanDistance(probeDescriptor, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }

  return {
    matched: bestDistance <= threshold,
    bestDistance,
    bestIndex,
    threshold,
  }
}

