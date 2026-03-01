import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000, // 2 minutes – inference can be slow
})

// ─── Request interceptor – attach Firebase id token ───────────────────
api.interceptors.request.use(async (config) => {
  try {
    const { auth } = await import('./firebase.js')
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (_) { /* unauthenticated request */ }
  return config
})

// ─── Response interceptor – normalize errors ──────────────────────────
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'An unknown error occurred'
    return Promise.reject(new Error(message))
  }
)

// ─── API methods ───────────────────────────────────────────────────────

/**
 * Upload an image and run the full AI inference pipeline.
 * @param {File}   imageFile      – the captured photo
 * @param {string} referenceType – 'a4' | 'credit_card' | 'phone'
 * @param {object} metadata      – { userId, species?, lat?, lng? }
 * @param {function} onProgress  – (percent:number) => void
 */
export async function analyzeTree(imageFile, referenceType, metadata, onProgress) {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('reference_type', referenceType)
  form.append('metadata', JSON.stringify(metadata))

  return api.post('/inference/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
}

/**
 * Measure tree using 3-point user marks (no reference object needed).
 * @param {File}   imageFile     – the tree photo
 * @param {object} marks        – { base_y_frac, ref_y_frac, top_y_frac, base_x_frac }
 * @param {number} userHeightM  – user's real height in metres
 * @param {function} onProgress – (percent:number) => void
 */
export async function markMeasureTree(imageFile, marks, userHeightM, onProgress) {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('base_y_frac',   marks.base_y_frac.toFixed(6))
  form.append('ref_y_frac',    marks.ref_y_frac.toFixed(6))
  form.append('top_y_frac',    marks.top_y_frac.toFixed(6))
  form.append('base_x_frac',   (marks.base_x_frac ?? 0.5).toFixed(6))
  form.append('user_height_m', userHeightM.toFixed(2))

  return api.post('/inference/mark-measure', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100))
    },
  })
}

/**
 * Get a cached inference result by its job ID.
 */
export const getInferenceResult = (jobId) =>
  api.get(`/inference/result/${jobId}`)

/**
 * Get health status and loaded model versions from the backend.
 */
export const getBackendHealth = () => api.get('/health')

/**
 * Get aggregated statistics for the authenticated user.
 */
export const getUserStats = () => api.get('/measurements/stats')

export default api
