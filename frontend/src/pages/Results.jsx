import React, { useEffect, useState, useRef } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, TreePine, Ruler, Leaf, Wind, BarChart3, Share2, Camera, Sparkles, Zap } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { getMeasurementById } from '../services/firebase.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { format } from 'date-fns'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import toast from 'react-hot-toast'

const spring = { type: 'spring', stiffness: 300, damping: 24 }

const stagger = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.09 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: spring },
}

function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  )
}

function FloatingOrb({ x, y, size, color, delay, duration }) {
  return (
    <motion.div
      className="fixed rounded-full pointer-events-none"
      style={{
        left: x, top: y, width: size, height: size,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        filter: 'blur(50px)', opacity: 0.22, zIndex: 0,
      }}
      animate={{ y: [0, -28, 0], x: [0, 10, 0], scale: [1, 1.12, 1] }}
      transition={{ repeat: Infinity, duration, delay, ease: 'easeInOut' }}
    />
  )
}

function MetricCard({ icon: Icon, label, value, unit, color, bg, subtext, delay = 0 }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -5, scale: 1.02, boxShadow: `0 16px 40px ${color}22` }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className="rounded-3xl p-5 relative overflow-hidden cursor-default"
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
      }}
    >
      {/* bg glow blob */}
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          className="p-2 rounded-2xl"
          style={{ backgroundColor: bg }}
          whileHover={{ scale: 1.15, rotate: 8 }}
          transition={spring}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </motion.div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-extrabold font-mono" style={{ color }}>{value}</span>
        <span className="text-sm font-semibold text-gray-400">{unit}</span>
      </div>
      {subtext && <p className="text-[11px] text-gray-400 mt-1">{subtext}</p>}
    </motion.div>
  )
}

export default function Results() {
  const { id }            = useParams()
  const location          = useLocation()
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id || id === 'preview' || location.pathname.includes('preview')) {
      const result = location.state?.result
      if (result) {
        setData({
          measurements:     result.measurements,
          confidence:       result.confidence,
          modelVersions:    result.model_versions,
          processingTimeMs: result.processing_time_ms,
          referenceObject:  location.state?.refType ?? null,
          debug:            result.debug ?? null,
          timestamp:        null,
        })
      } else {
        setError('No result data found')
      }
      setLoading(false)
      return
    }
    getMeasurementById(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, location.state])

  if (loading) return <LoadingSpinner fullscreen label="Loading results…" />
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
        <div className="inline-flex p-4 rounded-3xl mb-4 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
          <TreePine className="w-10 h-10 text-white" />
        </div>
        <p className="text-red-500 font-semibold mb-5">{error}</p>
        <Link to="/" className="btn-primary">← Back Home</Link>
      </motion.div>
    </div>
  )

  const { measurements: _m, confidence: c, imageUrl, timestamp, referenceObject, modelVersions, processingTimeMs, debug } = data
  const m = {
    heightM:    _m?.height_m    ?? _m?.heightM    ?? 0,
    diameterCm: _m?.diameter_cm ?? _m?.diameterCm ?? 0,
    biomassKg:  _m?.biomass_kg  ?? _m?.biomassKg  ?? 0,
    carbonKg:   _m?.carbon_kg   ?? _m?.carbonKg   ?? 0,
    co2Kg:      _m?.co2_kg      ?? _m?.co2Kg      ?? 0,
  }
  const date = timestamp?.toDate ? format(timestamp.toDate(), 'PPpp') : null
  const overall = Math.round((c?.overall ?? 0) * 100)

  const radarData = [
    { subject: 'Detection',    value: Math.round((c?.detection    ?? 0) * 100) },
    { subject: 'Segmentation', value: Math.round((c?.segmentation ?? 0) * 100) },
    { subject: 'Keypoints',    value: Math.round((c?.keypoint     ?? 0) * 100) },
    { subject: 'Overall',      value: Math.round((c?.overall      ?? 0) * 100) },
    { subject: 'Calibration',  value: Math.round((c?.calibration  ?? 0.9) * 100) },
  ]

  const confidenceColor = overall >= 80 ? '#16a34a' : overall >= 60 ? '#d97706' : '#dc2626'

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Tree Measurement — TreeMeasure AI',
        text: `🌳 Tree: ${m.heightM.toFixed(2)} m tall, ${m.diameterCm.toFixed(1)} cm trunk diameter. Powered by TreeMeasure AI.`,
        url: window.location.href,
      })
    } catch (_) {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied!')
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden relative"
      style={{ background: 'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #fce7f3 100%)' }}>

      {/* ── Background Orbs ────────────────────────── */}
      <FloatingOrb x="2%"   y="5%"  size={240} color="#a855f7" delay={0}   duration={7}   />
      <FloatingOrb x="70%"  y="8%"  size={180} color="#ec4899" delay={1.5} duration={8}   />
      <FloatingOrb x="60%"  y="60%" size={200} color="#7c3aed" delay={0.8} duration={6.5} />
      <FloatingOrb x="5%"   y="65%" size={160} color="#3b82f6" delay={2}   duration={7.5} />

      <div className="page-container relative z-10">

        {/* ── Header ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="flex items-center justify-between mb-8"
        >
          <motion.div whileHover={{ x: -3 }} transition={spring}>
            <Link to="/capture"
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-purple-600 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
          </motion.div>
          <motion.button
            onClick={handleShare}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            transition={spring}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-purple-600
                       bg-white/80 border border-purple-200 shadow-md hover:shadow-lg transition-shadow"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </motion.button>
        </motion.div>

        {/* ── Hero Banner ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="rounded-3xl p-7 mb-8 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
            boxShadow: '0 20px 60px rgba(124,58,237,0.35)',
          }}
        >
          {/* decorative rings */}
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full border-2 border-white/10 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full border border-white/10 pointer-events-none" />

          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="inline-flex p-3.5 rounded-3xl mb-4 relative z-10"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
          >
            <TreePine className="w-8 h-8 text-white" />
          </motion.div>

          <h1 className="text-2xl font-extrabold text-white mb-1 relative z-10">Measurement Results</h1>
          {date && <p className="text-white/60 text-xs relative z-10">{date}</p>}

          {/* Confidence badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: 0.3 }}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-2xl relative z-10"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
          >
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-bold text-sm font-mono">{overall}%</span>
            <span className="text-white/70 text-xs">AI confidence</span>
          </motion.div>
        </motion.div>

        {/* ── Tree Image ─────────────────────────────── */}
        {imageUrl && (
          <FadeIn>
            <motion.div
              whileHover={{ scale: 1.01, boxShadow: '0 20px 60px rgba(124,58,237,0.18)' }}
              transition={spring}
              className="rounded-3xl overflow-hidden mb-8 max-h-72"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.8)' }}
            >
              <img src={imageUrl} alt="Measured tree" className="w-full h-full object-cover" />
            </motion.div>
          </FadeIn>
        )}

        {/* ── Tree Dimensions ────────────────────────── */}
        <FadeIn>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Tree Dimensions</h2>
              <Sparkles className="w-4 h-4 text-pink-400" />
            </div>
            <motion.div
              className="grid grid-cols-2 gap-4"
              variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-30px' }}
            >
              <MetricCard icon={TreePine} label="Height"   value={m.heightM.toFixed(2)}   unit="m"  color="#7c3aed" bg="#ede9fe" subtext="ground to crown apex" />
              <MetricCard icon={Ruler}    label="Diameter" value={m.diameterCm.toFixed(1)} unit="cm" color="#2563eb" bg="#dbeafe" subtext="trunk at breast height" />
            </motion.div>
          </div>
        </FadeIn>

        {/* ── Ecological Estimates ───────────────────── */}
        <FadeIn delay={0.05}>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="w-4 h-4 text-green-500" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Ecological Estimates</h2>
            </div>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-30px' }}
            >
              <MetricCard icon={Leaf}     label="Biomass"   value={m.biomassKg.toFixed(1)} unit="kg" color="#16a34a" bg="#dcfce7" subtext="above-ground dry biomass" />
              <MetricCard icon={TreePine} label="Carbon"    value={m.carbonKg.toFixed(1)}  unit="kg" color="#0891b2" bg="#cffafe" subtext="stored carbon (≈ 0.5×biomass)" />
              <MetricCard icon={Wind}     label="CO₂ Equiv" value={m.co2Kg.toFixed(1)}     unit="kg" color="#9333ea" bg="#f3e8ff" subtext="CO₂ sequestered" />
            </motion.div>
          </div>
        </FadeIn>

        {/* ── Confidence Radar ───────────────────────── */}
        <FadeIn delay={0.08}>
          <motion.div
            whileHover={{ boxShadow: '0 20px 60px rgba(124,58,237,0.12)' }}
            transition={spring}
            className="rounded-3xl p-6 mb-8"
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Model Confidence</h2>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={spring}
                className="flex items-baseline gap-1"
              >
                <span className="text-3xl font-extrabold font-mono" style={{ color: confidenceColor }}>
                  {overall}%
                </span>
                <span className="text-xs text-gray-400">overall</span>
              </motion.div>
            </div>

            {/* Confidence bar strips */}
            <div className="space-y-3 mb-6">
              {radarData.map(({ subject, value }, i) => (
                <div key={subject}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 font-medium">{subject}</span>
                    <span className="font-bold font-mono text-gray-700">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e9d5ff" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Radar name="Confidence" dataKey="value"
                  stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.18} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, 'Confidence']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </FadeIn>

        {/* ── Technical Details ──────────────────────── */}
        <FadeIn delay={0.1}>
          <motion.div
            whileHover={{ boxShadow: '0 16px 40px rgba(124,58,237,0.1)' }}
            transition={spring}
            className="rounded-3xl p-6 mb-8"
            style={{
              background: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
            }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Technical Details</h2>
            <div className="space-y-3">
              {[
                ['Reference Object', referenceObject?.replace('_', ' ').toUpperCase() ?? '—', '#7c3aed'],
                ['Scale Method',     debug?.calibration_method === 'reference_object'
                                       ? '✅ Object detected'
                                       : debug?.calibration_method === 'contour_detection'
                                         ? '🔷 Shape detected'
                                         : '⚠️ Estimated', '#d97706'],
                ['Scale (px/mm)',    debug?.pixels_per_mm ? `${debug.pixels_per_mm} px/mm` : '—', '#0891b2'],
                ['YOLOv8 Version',   modelVersions?.yolo     ?? '—', '#2563eb'],
                ['Mask R-CNN',       modelVersions?.maskrcnn ?? '—', '#16a34a'],
                ['Keypoint Model',   modelVersions?.keypoint ?? '—', '#0891b2'],
                ['Processing Time',  processingTimeMs ? `${processingTimeMs} ms` : '—', '#d97706'],
              ].map(([k, v, color], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...spring, delay: i * 0.06 }}
                  className="flex justify-between items-center py-2 border-b border-purple-50 last:border-0"
                >
                  <span className="text-xs text-gray-400 font-medium">{k}</span>
                  <span className="text-xs font-bold font-mono" style={{ color }}>{v}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </FadeIn>

        {/* ── Calculation Methods ────────────────────── */}
        <FadeIn delay={0.12}>
          <motion.div
            className="rounded-3xl p-6 mb-8 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 60%, #fce7f3 100%)',
              border: '1px solid rgba(167,139,250,0.3)',
              boxShadow: '0 4px 24px rgba(124,58,237,0.08)',
            }}
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">How It Was Calculated</h2>
            <div className="space-y-3 text-xs leading-relaxed">
              {[
                { label: 'Height',   color: '#7c3aed', text: 'Pixel distance between HRNet keypoints (crown apex → trunk base) × pixel-to-metre ratio from reference object.' },
                { label: 'Diameter', color: '#2563eb', text: 'Trunk width in pixels at DBH (1.3 m) from Mask R-CNN segmentation mask × calibration factor.' },
                { label: 'Biomass',  color: '#16a34a', text: 'Chave et al. allometric equation — B = 0.0509 × ρ × D² × H (broadleaf tropical, ρ=0.6 g/cm³).' },
                { label: 'Carbon',   color: '#0891b2', text: 'C = B × 0.5 (IPCC biomass-to-carbon conversion factor).' },
                { label: 'CO₂',      color: '#9333ea', text: 'CO₂ = C × 3.67 (molecular weight ratio CO₂/C).' },
              ].map(({ label, color, text }, i) => (
                <motion.p
                  key={label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ ...spring, delay: i * 0.07 }}
                  className="text-gray-500"
                >
                  <span className="font-bold" style={{ color }}>{label}: </span>{text}
                </motion.p>
              ))}
            </div>
          </motion.div>
        </FadeIn>

        {/* ── CTA Buttons ────────────────────────────── */}
        <FadeIn delay={0.14}>
          <div className="flex gap-3 pb-8">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring} className="flex-1">
              <Link to="/capture" className="btn-primary w-full justify-center">
                <Camera className="w-4 h-4" /> New Measurement
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring} className="flex-1">
              <Link to="/history" className="btn-secondary w-full justify-center">
                View History
              </Link>
            </motion.div>
          </div>
        </FadeIn>

      </div>
    </div>
  )
}