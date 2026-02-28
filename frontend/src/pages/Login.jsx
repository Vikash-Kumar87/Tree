import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { TreePine, Sparkles, Leaf, Zap, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import { loginWithGoogle } from '../services/firebase.js'

const spring = { type: 'spring', stiffness: 300, damping: 24 }

const features = [
  { icon: Leaf,     label: 'YOLOv8 Detection',        color: '#7c3aed', bg: '#ede9fe' },
  { icon: Shield,   label: 'Mask R-CNN Segmentation', color: '#2563eb', bg: '#dbeafe' },
  { icon: Zap,      label: 'HRNet Keypoints',          color: '#ec4899', bg: '#fce7f3' },
  { icon: Sparkles, label: 'Carbon Estimation',        color: '#16a34a', bg: '#dcfce7' },
]

function FloatingOrb({ x, y, size, color, delay, duration }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x, top: y, width: size, height: size,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        filter: 'blur(40px)',
        opacity: 0.35,
      }}
      animate={{ y: [0, -30, 0], x: [0, 12, 0], scale: [1, 1.15, 1] }}
      transition={{ repeat: Infinity, duration, delay, ease: 'easeInOut' }}
    />
  )
}

function Particle({ x, y, delay }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full bg-purple-400 pointer-events-none"
      style={{ left: x, top: y }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0], y: [0, -24, -48] }}
      transition={{ repeat: Infinity, duration: 2.4, delay, ease: 'easeInOut' }}
    />
  )
}

export default function Login() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await loginWithGoogle()
      toast.success('Welcome!')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #fce7f3 100%)' }}
    >
      {/* ── Animated Background Orbs ────────────────────── */}
      <FloatingOrb x="5%"  y="10%" size={220} color="#a855f7" delay={0}   duration={6}   />
      <FloatingOrb x="70%" y="5%"  size={180} color="#ec4899" delay={1.5} duration={7}   />
      <FloatingOrb x="60%" y="65%" size={200} color="#7c3aed" delay={0.8} duration={8}   />
      <FloatingOrb x="10%" y="70%" size={160} color="#3b82f6" delay={2}   duration={5.5} />
      <FloatingOrb x="40%" y="80%" size={120} color="#ec4899" delay={1}   duration={6.5} />

      {/* ── Floating Particles ──────────────────────────── */}
      <Particle x="15%"  y="25%"  delay={0}   />
      <Particle x="80%"  y="20%"  delay={0.7} />
      <Particle x="25%"  y="75%"  delay={1.3} />
      <Particle x="70%"  y="70%"  delay={0.4} />
      <Particle x="55%"  y="40%"  delay={1.8} />
      <Particle x="88%"  y="55%"  delay={1.0} />

      {/* ── Card ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        className="w-full max-w-md relative z-10"
      >
        <div
          className="rounded-3xl p-10 text-center relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 80px rgba(124,58,237,0.14), 0 4px 24px rgba(0,0,0,0.06)',
            border: '1px solid rgba(255,255,255,0.85)',
          }}
        >
          {/* Inner card decoration blobs */}
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }} />

          {/* ── Logo with glow pulse ─────────────────────── */}
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring, delay: 0.15 }}
            className="mb-8 relative inline-block"
          >
            {/* Outer pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
              animate={{ scale: [1, 1.22, 1], opacity: [0.45, 0, 0.45] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
            />
            {/* Inner pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.6, delay: 0.4, ease: 'easeInOut' }}
            />
            {/* Icon box */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="inline-flex p-5 rounded-3xl shadow-2xl relative z-10"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
            >
              <motion.div
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              >
                <TreePine className="w-14 h-14 text-white" />
              </motion.div>
            </motion.div>
          </motion.div>

          {/* ── Title ───────────────────────────────────── */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.25 }}
            className="text-3xl font-extrabold mb-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            TreeMeasure AI
          </motion.h1>

          {/* ── Subtitle ────────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.33 }}
            className="text-gray-500 text-sm mb-8 leading-relaxed"
          >
            Measure tree height &amp; diameter instantly with AI-powered<br />
            computer vision.{' '}
            <span className="font-semibold text-purple-500">95–99%</span> real-world accuracy.
          </motion.p>

          {/* ── Feature Pills — staggered entrance ──────── */}
          <motion.div
            className="flex flex-wrap justify-center gap-2 mb-8"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.4 } } }}
          >
            {features.map(({ icon: Icon, label, color, bg }) => (
              <motion.div
                key={label}
                variants={{ hidden: { opacity: 0, y: 10, scale: 0.88 }, show: { opacity: 1, y: 0, scale: 1 } }}
                whileHover={{ y: -3, scale: 1.06, boxShadow: `0 6px 20px ${color}33` }}
                whileTap={{ scale: 0.95 }}
                transition={spring}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-default"
                style={{ backgroundColor: bg, color }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </motion.div>
            ))}
          </motion.div>

          {/* ── Mini stat strip ─────────────────────────── */}
          <motion.div
            className="grid grid-cols-3 gap-2 mb-8"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } } }}
          >
            {[
              { value: '97%',  label: 'Accuracy',  color: '#7c3aed' },
              { value: '2.8s', label: 'Avg Speed', color: '#ec4899' },
              { value: '200+', label: 'Species',   color: '#2563eb' },
            ].map(({ value, label, color }) => (
              <motion.div
                key={label}
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: spring } }}
                whileHover={{ y: -3, boxShadow: `0 8px 24px ${color}22` }}
                className="rounded-2xl py-3 px-2 text-center"
                style={{ background: `${color}0d`, border: `1px solid ${color}22` }}
              >
                <p className="text-lg font-extrabold font-mono" style={{ color }}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Google Sign-In Button ───────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.72 }}
          >
            <motion.button
              onClick={handleGoogleLogin}
              disabled={loading}
              whileHover={{ scale: 1.03, boxShadow: '0 12px 40px rgba(0,0,0,0.16)' }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl
                         bg-white text-gray-800 font-semibold text-sm shadow-xl
                         transition-colors duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ border: '1px solid rgba(0,0,0,0.07)' }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="spinner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, rotate: 360 }}
                    exit={{ opacity: 0 }}
                    transition={{ rotate: { repeat: Infinity, duration: 0.7, ease: 'linear' }, opacity: { duration: 0.15 } }}
                    className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full"
                  />
                ) : (
                  <motion.div
                    key="google-icon"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
              <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
            </motion.button>
          </motion.div>

          {/* ── Footer note ─────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-5 text-xs text-gray-400 leading-relaxed"
          >
            By signing in you agree to our Terms of Service.<br />
            Images are stored securely on Firebase Cloud Storage.
          </motion.p>
        </div>

        {/* Bottom tag */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="text-center text-xs text-purple-400 mt-5 tracking-wide"
        >
          Powered by YOLOv8 · Mask R-CNN · HRNet · Firebase · FastAPI
        </motion.p>
      </motion.div>
    </div>
  )
}
