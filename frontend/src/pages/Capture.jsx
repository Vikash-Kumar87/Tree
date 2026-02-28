import React, { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Camera, Upload, RefreshCw, Zap, Image, Info, ChevronDown, Sparkles, Layers, ArrowDown, ArrowUp, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { useAuth } from '../context/AuthContext.jsx'
import { analyzeTree } from '../services/api.js'
import { saveMeasurement } from '../services/firebase.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const spring = { type: 'spring', stiffness: 300, damping: 24 }

// ─── Tall-tree: vertically stitch two shots (crop + stack, no alpha tricks) ──
async function stitchImages(bottomSrc, topSrc) {
  // dataURL → Blob → ImageBitmap  (more reliable than new Image() on mobile)
  const srcToBitmap = async (src) => {
    const res  = await fetch(src)
    const blob = await res.blob()
    return createImageBitmap(blob)
  }

  const [bottomBmp, topBmp] = await Promise.all([
    srcToBitmap(bottomSrc),
    srcToBitmap(topSrc),
  ])

  // Scale both to the same width
  const W   = Math.max(bottomBmp.width, topBmp.width)
  const bH  = Math.round(bottomBmp.height * (W / bottomBmp.width))
  const tH  = Math.round(topBmp.height    * (W / topBmp.width))

  // Crop 15% from the bottom of the crown shot and top of base shot
  // to remove the redundant overlap zone cleanly (no blending artifacts)
  const cropH  = Math.round(Math.min(bH, tH) * 0.15)
  const totalH = (tH - cropH) + (bH - cropH)

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  // Crown at top (crop its bottom cropH to remove overlap)
  ctx.drawImage(topBmp, 0, 0, topBmp.width, topBmp.height - Math.round(topBmp.height * 0.15), 0, 0, W, tH - cropH)
  // Base below (crop its top cropH to remove duplicate zone)
  const srcCropY = Math.round(bottomBmp.height * 0.15)
  ctx.drawImage(bottomBmp, 0, srcCropY, bottomBmp.width, bottomBmp.height - srcCropY, 0, tH - cropH, W, bH - cropH)

  // Draw a subtle darkening seam line so the join is visually clear
  const seamGrad = ctx.createLinearGradient(0, tH - cropH - 6, 0, tH - cropH + 6)
  seamGrad.addColorStop(0,   'rgba(0,0,0,0)')
  seamGrad.addColorStop(0.5, 'rgba(0,0,0,0.18)')
  seamGrad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = seamGrad
  ctx.fillRect(0, tH - cropH - 6, W, 12)

  return canvas.toDataURL('image/jpeg', 0.92)
}

// Compress an image (dataURL or blob URL) to a small JPEG data-URL
async function compressImage(src, maxWidth = 320) {
  if (!src) return ''
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = src
    })
    const scale = Math.min(1, maxWidth / img.width)
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return ''
  }
}

const REFERENCE_TYPES = [
  { id: 'a4',          label: 'A4 Paper',     dims: '210 × 297 mm', icon: '📄' },
  { id: 'credit_card', label: 'Credit Card',  dims: '85.6 × 54 mm', icon: '💳' },
  { id: 'phone',       label: 'Smartphone',   dims: 'Auto-detect',  icon: '📱' },
]

const CAMERA_CONSTRAINTS = {
  facingMode: { ideal: 'environment' },   // prefer rear camera
  width:  { ideal: 1920 },
  height: { ideal: 1080 },
}

export default function Capture() {
  const navigate          = useNavigate()
  const { user }          = useAuth()
  const webcamRef         = useRef(null)

  const [mode, setMode]             = useState('camera') // 'camera' | 'upload'
  const [capturedImage, setCapturedImage] = useState(null)
  const [imageFile, setImageFile]   = useState(null)
  const [refType, setRefType]       = useState('a4')
  const [status, setStatus]         = useState('idle') // idle|uploading|analysing|done
  const [progress, setProgress]     = useState(0)
  const [tipOpen, setTipOpen]       = useState(false)

  // Tall-tree multi-shot state
  const [tallMode, setTallMode]     = useState(false)
  const [shotStep, setShotStep]     = useState(1)        // 1=base, 2=crown
  const [bottomShot, setBottomShot] = useState(null)     // dataURL

  // ─── Camera capture ────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedImage(null)
    setImageFile(null)
    setBottomShot(null)
    setShotStep(1)
    setStatus('idle')
  }, [])

  const handleCapture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) { toast.error('Camera not ready'); return }

    if (tallMode) {
      if (shotStep === 1) {
        setBottomShot(imageSrc)
        setShotStep(2)
        toast.success('Base captured! Now shoot the crown 🌿')
      } else {
        toast.loading('Stitching images…', { id: 'stitch' })
        try {
          const stitched = await stitchImages(bottomShot, imageSrc)
          setCapturedImage(stitched)
          const blob = await fetch(stitched).then(r => r.blob())
          setImageFile(new File([blob], 'tall_tree.jpg', { type: 'image/jpeg' }))
          toast.success('Images stitched!', { id: 'stitch' })
        } catch {
          toast.error('Stitch failed — try again', { id: 'stitch' })
          handleRetake()
        }
      }
      return
    }

    // Normal single-shot
    setCapturedImage(imageSrc)
    fetch(imageSrc)
      .then(r => r.blob())
      .then(blob => setImageFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' })))
  }, [webcamRef, tallMode, shotStep, bottomShot, handleRetake])

  const toggleTallMode = useCallback(() => {
    setTallMode(t => !t)
    handleRetake()
  }, [handleRetake])

  // ─── File drop / upload ────────────────────────────────────
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('Image must be under 20 MB'); return }
    setImageFile(file)
    setCapturedImage(URL.createObjectURL(file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    maxFiles: 1,
  })

  // ─── Submit to backend ─────────────────────────────────────
  const handleAnalyse = async () => {
    if (!imageFile) { toast.error('No image selected'); return }
    try {
      // 1. Send image to backend for AI analysis (progress 0→90%)
      setStatus('uploading')
      setProgress(0)
      const result = await analyzeTree(
        imageFile,
        refType,
        { userId: user?.uid || 'anonymous' },
        (pct) => setProgress(Math.min(pct, 90))
      )
      setProgress(100)

      // 2. Try to save to Firestore
      setStatus('analysing')
      let docId = null
      if (user?.uid) {
        try {
          // Normalise snake_case (backend) → camelCase for consistent Firestore schema
          const raw = result.measurements ?? {}
          const measurements = {
            heightM:    raw.height_m    ?? raw.heightM    ?? 0,
            diameterCm: raw.diameter_cm ?? raw.diameterCm ?? 0,
            biomassKg:  raw.biomass_kg  ?? raw.biomassKg  ?? 0,
            carbonKg:   raw.carbon_kg   ?? raw.carbonKg   ?? 0,
            co2Kg:      raw.co2_kg      ?? raw.co2Kg      ?? 0,
          }
          // Compress captured image to a small data-URL so it persists across sessions
          const imageUrl = await compressImage(capturedImage, 320)
          docId = await saveMeasurement({
            userId:           user.uid,
            imageUrl,
            referenceObject:  refType,
            measurements,
            confidence:       result.confidence,
            modelVersions:    result.model_versions,
            processingTimeMs: result.processing_time_ms,
          })
        } catch (saveErr) {
          console.error('Firestore save failed:', saveErr)
          toast.error('Could not save to history: ' + (saveErr?.message ?? saveErr))
        }
      }

      setStatus('done')
      toast.success('Analysis complete!')
      // Navigate with result in state when no docId (unauthenticated)
      if (docId) {
        navigate(`/results/${docId}`)
      } else {
        navigate('/results/preview', { state: { result, refType } })
      }
    } catch (err) {
      setStatus('idle')
      toast.error(err.message || 'Analysis failed. Please try again.')
    }
  }

  const isProcessing = status === 'uploading' || status === 'analysing'

  return (
    <div className="page-container max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex p-2 rounded-2xl" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
            <Camera className="w-5 h-5 text-white" />
          </span>
          <h1 className="section-title mb-0">Capture Tree</h1>
        </div>
        <p className="section-subtitle">Photograph the full tree with a reference object at the base.</p>
      </motion.div>

      {/* ─── Tall Tree Mode Banner ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        className="mb-4"
      >
        <motion.button
          onClick={toggleTallMode}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-sm font-semibold
            ${ tallMode
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-gray-200 bg-white/70 text-gray-500 hover:border-violet-300 hover:text-violet-600'}`}
          style={tallMode ? { boxShadow: '0 4px 20px rgba(124,58,237,0.18)' } : {}}
        >
          <span className={`p-1.5 rounded-xl ${ tallMode ? 'bg-violet-200' : 'bg-gray-100'}`}>
            <Layers className={`w-4 h-4 ${ tallMode ? 'text-violet-600' : 'text-gray-400'}`} />
          </span>
          <div className="flex-1 text-left">
            <span className="block">Tall Tree Mode</span>
            <span className="text-[11px] font-normal opacity-60">Tree too tall for one frame? Take 2 shots — app stitches them</span>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center transition-all ${ tallMode ? 'bg-violet-500 justify-end' : 'bg-gray-200 justify-start'} px-0.5`}>
            <LayoutGroup>
              <motion.div layout layoutId="tallToggleThumb" className="w-5 h-5 rounded-full bg-white shadow" transition={spring} />
            </LayoutGroup>
          </div>
        </motion.button>

        {/* Step indicator for tall mode */}
        <AnimatePresence>
          {tallMode && !capturedImage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex gap-2"
            >
              {[
                { step: 1, icon: ArrowDown, label: 'Shoot Base', sub: 'Include reference object' },
                { step: 2, icon: ArrowUp,   label: 'Shoot Crown', sub: 'Point up to treetop' },
              ].map(({ step, icon: Icon, label, sub }) => (
                <motion.div
                  key={step}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-2xl border-2 transition-all
                    ${ shotStep === step && !bottomShot && step === 1 ? 'border-violet-400 bg-violet-50'
                      : shotStep === step ? 'border-violet-400 bg-violet-50'
                      : step < shotStep || bottomShot ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50 opacity-50'}`}
                >
                  <span className={`p-1.5 rounded-xl ${
                    (step < shotStep || (step === 1 && bottomShot)) ? 'bg-green-200' : 'bg-violet-100'
                  }`}>
                    { (step < shotStep || (step === 1 && bottomShot))
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <Icon className="w-4 h-4 text-violet-600" /> }
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-700">Step {step}: {label}</p>
                    <p className="text-[10px] text-gray-400">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Mode Toggle ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="flex rounded-2xl overflow-hidden border border-purple-200 bg-white/60 mb-6 p-1 gap-1"
      >
        {[{ id: 'camera', icon: Camera, label: 'Camera' }, { id: 'upload', icon: Upload, label: 'Upload' }].map(({ id, icon: Icon, label }) => (
          <motion.button
            key={id}
            type="button"
            onClick={() => { setMode(id); handleRetake() }}
            whileTap={{ scale: 0.96 }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${mode === id
                ? 'text-white shadow-md'
                : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
            style={mode === id ? { background: 'linear-gradient(90deg,#7c3aed,#ec4899)' } : {}}
          >
            <Icon className="w-4 h-4" /> {label}
          </motion.button>
        ))}
      </motion.div>

      {/* ─── Camera / Upload Area ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...spring, delay: 0.15 }}
        className="relative rounded-2xl overflow-hidden mb-6 bg-gray-50 aspect-[4/3] border-2 border-purple-200 shadow-inner"
        style={{ boxShadow: '0 4px 32px rgba(124,58,237,0.10), inset 0 2px 8px rgba(124,58,237,0.04)' }}
      >
        {capturedImage ? (
          <img src={capturedImage} alt="captured" className="w-full h-full object-contain" />
        ) : mode === 'camera' ? (
          <>
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              videoConstraints={CAMERA_CONSTRAINTS}
              className="w-full h-full object-cover"
              playsInline
            />
            {/* Viewfinder overlay */}
            <div className="camera-overlay">
              <div className="absolute inset-6 camera-frame rounded-xl">
                <div className="camera-corner camera-corner-tl" />
                <div className="camera-corner camera-corner-tr" />
                <div className="camera-corner camera-corner-bl" />
                <div className="camera-corner camera-corner-br" />
              </div>
              <div className="scan-line absolute inset-x-0 top-0" />
              {/* Tall mode step 2: show bottom-shot thumbnail */}
              {tallMode && shotStep === 2 && bottomShot && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={spring}
                  className="absolute top-3 right-3 w-16 h-20 rounded-xl overflow-hidden border-2 border-green-400 shadow-lg"
                >
                  <img src={bottomShot} alt="base shot" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 text-[9px] text-center bg-green-500 text-white py-0.5">✓ Base</div>
                </motion.div>
              )}
              {/* Tall mode: dashed overlap guide line on step 2 */}
              {tallMode && shotStep === 2 && (
                <div className="absolute inset-x-6" style={{ bottom: '22%' }}>
                  <div className="border-b-2 border-dashed border-yellow-400 opacity-80" />
                  <p className="text-center text-[10px] text-yellow-300 mt-1">↑ Include this area in the shot</p>
                </div>
              )}
              <div className="absolute bottom-4 inset-x-0 text-center">
                <span className="text-[11px] bg-black/50 text-purple-200 px-3 py-1 rounded-full">
                  { tallMode
                    ? shotStep === 1
                      ? '📄 Step 1 — Frame base with reference object'
                      : '🌿 Step 2 — Point up to shoot the crown'
                    : 'Frame the full tree incl. base + crown'
                  }
                </span>
              </div>
            </div>
          </>
        ) : (
          <div
            {...getRootProps()}
            className={`w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer
              ${isDragActive ? 'bg-purple-50' : 'bg-white'} transition-colors`}
          >
            <input {...getInputProps()} />
            <div className="p-4 rounded-2xl bg-purple-50 border-2 border-dashed border-purple-300">
              <Image className="w-10 h-10 text-purple-400" />
            </div>
            <p className="text-sm text-gray-600 font-medium">
              {isDragActive ? 'Drop image here…' : 'Tap to upload or drag & drop'}
            </p>
            <p className="text-xs text-gray-400">JPG, PNG, WEBP, HEIC — max 20 MB</p>
          </div>
        )}

        {/* Processing overlay */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
            >
              <LoadingSpinner label={status === 'uploading' ? `Uploading… ${progress}%` : 'Running AI analysis…'} />
              {status === 'uploading' && (
                <div className="w-48 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#ec4899)' }}
                  />
                </div>
              )}
              {status === 'analysing' && (
                <div className="space-y-1 text-center">
                  {['Detecting tree…', 'Segmenting trunk…', 'Locating keypoints…', 'Computing measurements…'].map((s, i) => (
                    <p key={i} className="text-xs text-purple-300 animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}>{s}</p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Reference Object Selector ────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.2 }}
        className="card p-4 mb-4"
      >
        <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Reference Object in Photo
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REFERENCE_TYPES.map(({ id, label, dims, icon }, i) => (
            <motion.button
              key={id}
              type="button"
              onClick={() => setRefType(id)}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: 0.25 + i * 0.07 }}
              className={`p-3 rounded-2xl border text-center transition-colors
                ${refType === id
                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white/80 text-gray-500 hover:border-purple-300'}`}
              style={refType === id ? { boxShadow: '0 4px 16px rgba(124,58,237,0.15)' } : {}}
            >
              <motion.span
                className="text-2xl block mb-1"
                animate={refType === id ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >{icon}</motion.span>
              <span className="text-xs font-bold block">{label}</span>
              <span className="text-[10px] text-gray-400 block">{dims}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ─── Tips Accordion ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        className="card p-4 mb-6"
      >
        <button
          type="button"
          onClick={() => setTipOpen(o => !o)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
        >
          <span className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-100">
              <Info className="w-3.5 h-3.5 text-purple-600" />
            </span>
            Photography Tips
          </span>
          <motion.div animate={{ rotate: tipOpen ? 180 : 0 }} transition={spring}>
            <ChevronDown className="w-4 h-4 text-purple-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {tipOpen && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 space-y-2 overflow-hidden"
            >
              {[
                'Stand 3–10 m from the tree so the full trunk is visible.',
                'Place reference object (A4 sheet) flat against the trunk base.',
                'Shoot in landscape mode for taller trees.',
                'Avoid strong backlight — face the sun for even lighting.',
                'Keep the camera level; avoid tilting up.',
                'Ensure the tree top and base are both in frame.',
                'Tall tree? Enable Tall Tree Mode — shoot base first, then crown. App stitches both shots automatically.',
              ].map((tip, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring, delay: i * 0.05 }}
                  className="flex items-start gap-2 text-xs text-gray-500"
                >
                  <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ background: `hsl(${260 + i * 15},70%,55%)` }}>
                    {i + 1}
                  </span>
                  {tip}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Action Buttons ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.35 }}
        className="flex gap-3"
      >
        {!capturedImage && mode === 'camera' ? (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
            type="button"
            onClick={handleCapture}
            className="btn-primary flex-1 py-4 text-base"
          >
            { tallMode
              ? shotStep === 1
                ? <><ArrowDown className="w-5 h-5" /> Shoot Base (Step 1 / 2)</>
                : <><ArrowUp   className="w-5 h-5" /> Shoot Crown (Step 2 / 2)</>
              : <><Camera className="w-5 h-5" /> Capture Photo</>
            }
          </motion.button>
        ) : capturedImage ? (
          <>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleRetake} disabled={isProcessing} className="btn-secondary flex-1"
            >
              <RefreshCw className="w-4 h-4" /> Retake
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleAnalyse} disabled={isProcessing} className="btn-primary flex-1 py-4 text-base"
            >
              <Zap className="w-5 h-5" /> Analyse Tree
            </motion.button>
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
