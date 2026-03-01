import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, deleteDoc, query, where, limit, serverTimestamp } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// -----------------------------------------------------------------------
// Replace these values with your real Firebase project config.
// Store secrets in .env  (VITE_FIREBASE_*) and never commit them.
// -----------------------------------------------------------------------
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app     = initializeApp(firebaseConfig)
const auth    = getAuth(app)
const db      = getFirestore(app)
const storage = getStorage(app)
const googleProvider = new GoogleAuthProvider()

// ─── Auth helpers ──────────────────────────────────────────────────────
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider)
export const logout          = () => signOut(auth)
export const onAuthChange    = (cb) => onAuthStateChanged(auth, cb)

// ─── Storage helpers ───────────────────────────────────────────────────
/**
 * Upload a tree image to Firebase Storage.
 * @param {File}   file
 * @param {string} userId
 * @returns {Promise<string>} public download URL
 */
export async function uploadTreeImage(file, userId) {
  const ext      = file.name.split('.').pop()
  const filename = `trees/${userId}/${Date.now()}.${ext}`
  const storRef  = ref(storage, filename)
  const snapshot = await uploadBytes(storRef, file)
  return getDownloadURL(snapshot.ref)
}

// ─── Firestore helpers ─────────────────────────────────────────────────
/**
 * Firestore schema for a measurement document:
 * {
 *   userId:          string,
 *   imageUrl:        string,
 *   timestamp:       Timestamp,
 *   species:         string | null,
 *   location:        { lat, lng } | null,
 *   measurements: {
 *     heightM:       number,
 *     diameterCm:    number,
 *     biomassKg:     number,
 *     carbonKg:      number,
 *     co2Kg:         number,
 *   },
 *   confidence: {
 *     detection:     number (0-1),
 *     segmentation:  number (0-1),
 *     keypoint:      number (0-1),
 *     overall:       number (0-1),
 *   },
 *   referenceObject: string,
 *   modelVersions: {
 *     yolo:          string,
 *     maskrcnn:      string,
 *     keypoint:      string,
 *   }
 * }
 */

export async function saveMeasurement(data) {
  const col = collection(db, 'measurements')
  const docRef = await addDoc(col, {
    ...data,
    timestamp: serverTimestamp(),
  })
  return docRef.id
}

export async function getUserMeasurements(userId, limitCount = 50) {
  const col = collection(db, 'measurements')
  const q   = query(
    col,
    where('userId', '==', userId),
    limit(limitCount)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getMeasurementById(id) {
  const docRef = doc(db, 'measurements', id)
  const snap   = await getDoc(docRef)
  if (!snap.exists()) throw new Error('Measurement not found')
  return { id: snap.id, ...snap.data() }
}

export async function deleteMeasurement(id) {
  await deleteDoc(doc(db, 'measurements', id))
}

export { auth, db, storage }
