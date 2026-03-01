/**
 * MarkingCanvas
 * =============
 * Lets the user place 3 marks on a tree photo:
 *   Step 1 – Base   : where the trunk meets the ground  (red  dot)
 *   Step 2 – My Height : where YOUR head would be standing next to trunk (blue dot)
 *   Step 3 – Tree Top  : topmost leaf / crown pixel  (green dot)
 *
 * Returns normalised fractional coords (0-1) via onMarksComplete({ base, ref, top }).
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, CheckCircle2, MapPin } from 'lucide-react'

const STEPS = [
  {
    key:   'base',
    label: 'Tree Base',
    hint:  'Tap where the trunk meets the ground',
    color: '#ef4444',   // red
    bg:    '#fee2e2',
    num:   1,
  },
  {
    key:   'ref',
    label: 'Your Height',
    hint:  'Tap where YOUR head would be if you stood next to the trunk',
    color: '#3b82f6',   // blue
    bg:    '#dbeafe',
    num:   2,
  },
  {
    key:   'top',
    label: 'Tree Top',
    hint:  'Tap the very top of the tree crown',
    color: '#22c55e',   // green
    bg:    '#dcfce7',
    num:   3,
  },
]

export default function MarkingCanvas({ imageSrc, onMarksComplete, onReset }) {
  const containerRef = useRef(null)
  const [marks, setMarks] = useState({})   // { base: {x,y}, ref: {x,y}, top: {x,y} }
  const [step, setStep]   = useState(0)    // 0=base, 1=ref, 2=top, 3=done

  // Compute which step keys are done
  const stepsDone = STEPS.slice(0, step).map(s => s.key)

  const handleTap = useCallback((e) => {
    if (step >= 3) return
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) / rect.width
    const y = (clientY - rect.top)  / rect.height
    const key = STEPS[step].key
    const newMarks = { ...marks, [key]: { x, y } }
    setMarks(newMarks)
    const nextStep = step + 1
    setStep(nextStep)
    if (nextStep === 3) {
      onMarksComplete({
        base_y_frac: newMarks.base.y,
        ref_y_frac:  newMarks.ref.y,
        top_y_frac:  newMarks.top.y,
        base_x_frac: newMarks.base.x,
      })
    }
  }, [step, marks, onMarksComplete])

  const handleReset = () => {
    setMarks({})
    setStep(0)
    if (onReset) onReset()
  }

  const currentStep = step < 3 ? STEPS[step] : null

  return (
    <div className="flex flex-col gap-3">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                background: i <  step ? s.color : i === step ? s.bg : '#f3f4f6',
                color:      i <  step ? '#fff'  : i === step ? s.color : '#9ca3af',
                border:     `1.5px solid ${i <= step ? s.color : '#e5e7eb'}`,
              }}
            >
              <span>{s.num}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleReset}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </motion.button>
      </div>

      {/* Instruction bar */}
      <AnimatePresence mode="wait">
        {currentStep && (
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: currentStep.bg, color: currentStep.color }}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span><strong>Step {currentStep.num}:</strong> {currentStep.hint}</span>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-green-50 text-green-700"
          >
            <CheckCircle2 className="w-4 h-4" />
            All 3 marks placed! Enter your height below then tap Analyze.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image canvas */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden cursor-crosshair select-none"
        style={{ touchAction: 'none' }}
        onClick={handleTap}
        onTouchEnd={handleTap}
      >
        <img
          src={imageSrc}
          alt="Tree"
          className="w-full block"
          draggable={false}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        />

        {/* Render placed dots */}
        {STEPS.map((s) => {
          const m = marks[s.key]
          if (!m) return null
          return (
            <motion.div
              key={s.key}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                position:  'absolute',
                left:      `${m.x * 100}%`,
                top:       `${m.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              {/* Outer ring */}
              <div
                className="rounded-full flex items-center justify-center shadow-lg"
                style={{
                  width: 32, height: 32,
                  background: s.color,
                  border: '3px solid white',
                  boxShadow: `0 0 0 2px ${s.color}88`,
                }}
              >
                <span className="text-white text-xs font-extrabold">{s.num}</span>
              </div>
              {/* Connecting line downward to base */}
              {s.key !== 'base' && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '100%',
                    width: 2,
                    height: 10,
                    background: s.color,
                    opacity: 0.5,
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </motion.div>
          )
        })}

        {/* Vertical guide line between base and top when all marks placed */}
        {step === 3 && marks.base && marks.top && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <line
              x1={`${marks.base.x * 100}%`}
              y1={`${marks.base.y * 100}%`}
              x2={`${marks.top.x * 100}%`}
              y2={`${marks.top.y * 100}%`}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
          </svg>
        )}

        {/* Tap overlay hint when no marks yet */}
        {step === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full"
            >
              👆 Tap to place Mark 1 (Tree Base)
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
