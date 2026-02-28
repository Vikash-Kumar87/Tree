import React from 'react'
import { Link } from 'react-router-dom'
import { TreePine, Camera, BarChart3, Leaf, Zap, Shield, Globe, History, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const features = [
  { icon: Camera,   title: 'AI Camera Capture',   desc: 'Snap a photo with your phone or upload one to start instant AI analysis.', color: '#7c3aed', bg: '#ede9fe' },
  { icon: BarChart3, title: '95–99% Accuracy',    desc: 'Multi-model pipeline using YOLOv8, Mask R-CNN, and HRNet keypoints.',       color: '#2563eb', bg: '#dbeafe' },
  { icon: Leaf,     title: 'Carbon Estimation',   desc: 'Automatically compute biomass, carbon storage, and CO₂ sequestration.',    color: '#16a34a', bg: '#dcfce7' },
  { icon: Zap,      title: 'Real-Time Results',   desc: 'Edge-optimised inference returns measurements in under 3 seconds.',         color: '#d97706', bg: '#fef3c7' },
  { icon: Shield,   title: 'Secure & Private',    desc: 'Firebase Auth + encrypted storage. Your images stay yours.',               color: '#0891b2', bg: '#cffafe' },
  { icon: Globe,    title: 'Climate Impact',      desc: 'Track trees over time to monitor forest health and sequestration trends.',  color: '#9333ea', bg: '#f3e8ff' },
]

const steps = [
  { step: '01', title: 'Place Reference Object', desc: 'Put an A4 sheet, credit card, or phone next to the tree base for scale.', color: '#7c3aed' },
  { step: '02', title: 'Capture Photo',           desc: 'Use the camera screen. Frame the entire tree from base to crown.',        color: '#ec4899' },
  { step: '03', title: 'AI Analysis',             desc: 'YOLOv8 detects, Mask R-CNN segments trunk, HRNet estimates keypoints.',  color: '#2563eb' },
  { step: '04', title: 'View Results',            desc: 'Get height, diameter, biomass, and carbon estimates with confidence.',    color: '#16a34a' },
]

const spring = { type: 'spring', stiffness: 300, damping: 24 }

function FadeInSection({ children, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...spring, delay }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="page-container">

      {/* ─── Hero ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring }}
        className="text-center py-12 px-4"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="inline-flex p-5 rounded-3xl mb-6 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          <TreePine className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          <span className="text-gradient">TreeMeasure AI</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
          Measure tree height &amp; diameter instantly using your smartphone camera — 
          powered by a multi-model deep learning pipeline with 95–99% real-world accuracy.
        </p>
        <motion.div
          className="flex flex-col sm:flex-row gap-3 justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link to="/capture" className="btn-primary text-base px-8 py-3.5">
              <Camera className="w-5 h-5" /> Start Measurement
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link to="/history" className="btn-secondary text-base px-8 py-3.5">
              <BarChart3 className="w-5 h-5" /> View History
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ─── Quick Actions ────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 gap-4 mb-8"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      >
        {[
          { to: '/capture', label: 'Scan Tree',   sub: 'Camera or upload',   icon: Camera,  card: 'action-card action-card-purple' },
          { to: '/history', label: 'My History',  sub: 'Past measurements',  icon: History, card: 'action-card action-card-blue'   },
        ].map(({ to, label, sub, icon: Icon, card }) => (
          <motion.div
            key={to}
            variants={{ hidden: { opacity: 0, scale: 0.88 }, show: { opacity: 1, scale: 1, transition: spring } }}
            whileHover={{ scale: 1.04, y: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link to={to} className={`${card} p-6 text-center`}>
              <motion.div
                className="p-4 rounded-2xl bg-white/25"
                whileHover={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Icon className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <p className="font-bold text-white text-base">{label}</p>
                <p className="text-white/70 text-xs mt-0.5">{sub}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Stat Strip ───────────────────────────────────── */}
      <FadeInSection delay={0.05}>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        >
          {[
            { label: 'Accuracy',     value: '97%',  sub: 'field-validated',   color: '#7c3aed' },
            { label: 'Avg. Time',    value: '2.8s', sub: 'per inference',     color: '#ec4899' },
            { label: 'Tree Species', value: '200+', sub: 'in training data',  color: '#2563eb' },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: spring } }}
              whileHover={{ y: -3, boxShadow: '0 10px 30px rgba(124,58,237,0.13)' }}
              className="card p-4 text-center cursor-default"
            >
              <p className="text-2xl font-extrabold font-mono" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-400">{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </FadeInSection>

      {/* ─── Features ─────────────────────────────────────── */}
      <FadeInSection>
        <section className="mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-extrabold text-gray-800">Why TreeMeasure AI?</h2>
            <Sparkles className="w-5 h-5 text-pink-400" />
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <motion.div
                key={title}
                variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: spring } }}
                whileHover={{ y: -6, scale: 1.02, boxShadow: `0 16px 40px ${color}22` }}
                whileTap={{ scale: 0.98 }}
                className="card p-5 cursor-default"
              >
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    className="p-2.5 rounded-2xl"
                    style={{ backgroundColor: bg }}
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    transition={spring}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </motion.div>
                  <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </FadeInSection>

      {/* ─── How It Works ─────────────────────────────────── */}
      <FadeInSection>
        <section className="mb-12">
          <h2 className="text-xl font-extrabold text-gray-800 mb-6 text-center">How It Works</h2>
          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 hidden sm:block"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #ec4899, #2563eb, #16a34a)' }} />
            <div className="space-y-4">
              {steps.map(({ step, title, desc, color }, i) => (
                <FadeInSection key={step} delay={i * 0.08}>
                  <div className="flex gap-4 sm:pl-14 relative">
                    <motion.div
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center sm:absolute sm:left-1.5 border-2 shadow-md"
                      style={{ backgroundColor: `${color}18`, borderColor: color, boxShadow: `0 0 0 4px ${color}15` }}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ ...spring, delay: i * 0.1 }}
                    >
                      <span className="text-xs font-extrabold" style={{ color }}>{step}</span>
                    </motion.div>
                    <motion.div
                      className="card flex-1 p-4"
                      whileHover={{ x: 4, boxShadow: `0 8px 30px ${color}18` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <h3 className="font-bold text-gray-800 text-sm mb-1">{title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    </motion.div>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <FadeInSection>
        <motion.div
          className="card p-8 text-center overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 60%, #fce7f3 100%)' }}
          whileHover={{ scale: 1.01, boxShadow: '0 20px 60px rgba(124,58,237,0.15)' }}
          transition={spring}
        >
          {/* decorative blobs */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }} />
          <motion.div
            animate={{ rotate: [0, 8, -8, 0], y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="inline-flex mb-3 relative z-10"
          >
            <TreePine className="w-10 h-10 text-purple-500" />
          </motion.div>
          <h3 className="text-xl font-extrabold text-gray-800 mb-2 relative z-10">Ready to measure your first tree?</h3>
          <p className="text-sm text-gray-500 mb-6 relative z-10">It only takes 30 seconds.</p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} className="inline-block relative z-10">
            <Link to="/capture" className="btn-primary">
              <Camera className="w-4 h-4" /> Open Camera
            </Link>
          </motion.div>
        </motion.div>
      </FadeInSection>

    </div>
  )
}
