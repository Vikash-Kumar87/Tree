import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { History as HistoryIcon, TreePine, Ruler, ChevronRight, Search, Leaf, Camera, Trash2 } from 'lucide-react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getUserMeasurements, deleteMeasurement } from '../services/firebase.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const spring = { type: 'spring', stiffness: 300, damping: 24 }
const STAT_COLORS = ['#7c3aed', '#ec4899', '#2563eb', '#16a34a']

// Normalise snake_case from older saved docs → camelCase
function normMeasurements(raw = {}) {
  return {
    heightM:    raw.height_m    ?? raw.heightM    ?? 0,
    diameterCm: raw.diameter_cm ?? raw.diameterCm ?? 0,
    biomassKg:  raw.biomass_kg  ?? raw.biomassKg  ?? 0,
    carbonKg:   raw.carbon_kg   ?? raw.carbonKg   ?? 0,
    co2Kg:      raw.co2_kg      ?? raw.co2Kg      ?? 0,
  }
}

export default function History() {
  const { user }                      = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState('newest') // newest|tallest|widest
  const [deletingId, setDeletingId]   = useState(null)

  const handleDelete = async (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this measurement? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteMeasurement(id)
      setMeasurements(prev => prev.filter(m => m.id !== id))
      toast.success('Measurement deleted')
    } catch (err) {
      toast.error('Delete failed: ' + (err?.message ?? err))
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getUserMeasurements(user.uid)
      .then(docs => setMeasurements(docs
        .sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
        .map(m => ({
        ...m,
        measurements: normMeasurements(m.measurements),
      }))))
      .catch(err => {
        console.error('Failed to load history:', err)
        if (err?.code === 'permission-denied' || err?.message?.includes('permissions')) {
          toast.error('Firestore rules not set — see README for setup steps', { duration: 6000 })
        } else {
          toast.error('Could not load history: ' + (err?.message ?? err))
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  const filtered = useMemo(() => {
    let arr = [...measurements]
    if (search) {
      const q = search.toLowerCase()
      arr = arr.filter(m =>
        m.referenceObject?.toLowerCase().includes(q) ||
        m.measurements?.heightM?.toFixed(2).includes(q)
      )
    }
    if (sort === 'tallest') arr.sort((a, b) => (b.measurements?.heightM ?? 0) - (a.measurements?.heightM ?? 0))
    else if (sort === 'widest') arr.sort((a, b) => (b.measurements?.diameterCm ?? 0) - (a.measurements?.diameterCm ?? 0))
    return arr
  }, [measurements, search, sort])

  // Aggregate stats
  const stats = useMemo(() => ({
    count:      measurements.length,
    totalCarbon: measurements.reduce((s, m) => s + (m.measurements?.carbonKg ?? 0), 0),
    avgHeight:  measurements.length
      ? measurements.reduce((s, m) => s + (m.measurements?.heightM ?? 0), 0) / measurements.length
      : 0,
    avgDiam:    measurements.length
      ? measurements.reduce((s, m) => s + (m.measurements?.diameterCm ?? 0), 0) / measurements.length
      : 0,
  }), [measurements])

  return (
    <div className="page-container">
      {/* ─── Header ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex items-center gap-2 mb-1"
      >
        <span className="inline-flex p-2 rounded-2xl" style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
          <HistoryIcon className="w-5 h-5 text-white" />
        </span>
        <h1 className="section-title mb-0">Measurement History</h1>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="section-subtitle"
      >All your past tree measurements.</motion.p>

      {/* ─── Stats ────────────────────────────────────── */}
      {!loading && measurements.length > 0 && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          {[
            { label: 'Total Trees',   value: stats.count,                  unit: '',    icon: TreePine },
            { label: 'Avg Height',    value: stats.avgHeight.toFixed(1),   unit: ' m',  icon: Ruler },
            { label: 'Avg Diameter',  value: stats.avgDiam.toFixed(1),     unit: ' cm', icon: Ruler },
            { label: 'Carbon Stored', value: stats.totalCarbon.toFixed(0), unit: ' kg', icon: Leaf },
          ].map(({ label, value, unit, icon: Icon }, i) => (
            <motion.div
              key={label}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: spring } }}
              whileHover={{ y: -4, boxShadow: `0 10px 30px ${STAT_COLORS[i]}22` }}
              className="card p-4 text-center cursor-default"
            >
              <div className="inline-flex p-2 rounded-xl mb-2" style={{ backgroundColor: `${STAT_COLORS[i]}18` }}>
                <Icon className="w-4 h-4" style={{ color: STAT_COLORS[i] }} />
              </div>
              <p className="text-xl font-extrabold font-mono" style={{ color: STAT_COLORS[i] }}>{value}{unit}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ─── Controls ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.15 }}
        className="flex gap-3 mb-5"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
          <input
            type="text"
            className="input-field pl-9 py-2.5 text-sm"
            placeholder="Search measurements…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <select
          className="input-field w-auto px-3 py-2.5 text-sm"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="tallest">Tallest</option>
          <option value="widest">Widest</option>
        </select>
      </motion.div>

      {/* ─── List ─────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner label="Loading history…" />
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring}
          className="card text-center py-16 px-8"
          style={{ background: 'linear-gradient(135deg,#f5f3ff,#fce7f3)' }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="inline-flex p-4 rounded-3xl mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}
          >
            <HistoryIcon className="w-10 h-10 text-white" />
          </motion.div>
          <p className="text-gray-600 font-semibold mb-1">
            {measurements.length === 0 ? 'No measurements yet.' : 'No results match your search.'}
          </p>
          <p className="text-gray-400 text-sm mb-5">Start by scanning your first tree!</p>
          {measurements.length === 0 && (
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
              <Link to="/capture" className="btn-primary">
                <Camera className="w-4 h-4" /> Start Measuring
              </Link>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="space-y-3"
        >
          <AnimatePresence initial={false}>
          {filtered.map((m, idx) => {
            const date = m.timestamp?.toDate
              ? formatDistanceToNow(m.timestamp.toDate(), { addSuffix: true })
              : '—'
            const conf = Math.round((m.confidence?.overall ?? 0) * 100)
            const confColor = conf >= 90 ? '#16a34a' : conf >= 75 ? '#d97706' : '#dc2626'

            return (
              <motion.div
                key={m.id}
                variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0, transition: spring } }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                whileHover={{ x: 4, boxShadow: '0 8px 28px rgba(124,58,237,0.12)' }}
                className="relative"
              >
                <Link
                  to={`/results/${m.id}`}
                  className="card flex items-center gap-4 p-4 group pr-14"
                >
                  {/* Thumbnail */}
                  <motion.div
                    className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-purple-100"
                    whileHover={{ scale: 1.08 }}
                    transition={spring}
                  >
                    {m.imageUrl
                      ? <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#ede9fe,#fce7f3)' }}>
                          <TreePine className="w-7 h-7 text-purple-400" />
                        </div>
                    }
                  </motion.div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <TreePine className="w-3.5 h-3.5 text-purple-500" />
                        {m.measurements?.heightM?.toFixed(2)} m
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Ruler className="w-3 h-3" />
                        {m.measurements?.diameterCm?.toFixed(1)} cm
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Leaf className="w-3 h-3 text-green-400" />
                        {m.measurements?.carbonKg?.toFixed(0)} kg C
                      </span>
                      <span>{date}</span>
                    </div>
                  </div>

                  {/* Confidence + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-extrabold font-mono" style={{ color: confColor }}>{conf}%</span>
                    <motion.div
                      className="p-1.5 rounded-xl bg-purple-50"
                      whileHover={{ x: 3 }}
                      transition={spring}
                    >
                      <ChevronRight className="w-4 h-4 text-purple-400" />
                    </motion.div>
                  </div>
                </Link>

                {/* Delete button — outside Link so click doesn't navigate */}
                <motion.button
                  onClick={(e) => handleDelete(e, m.id)}
                  disabled={deletingId === m.id}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title="Delete measurement"
                >
                  {deletingId === m.id
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
                    : <Trash2 className="w-4 h-4" />}
                </motion.button>
              </motion.div>
            )
          })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
