import React from 'react'

/**
 * Circular confidence gauge + textual indicator.
 * confidence: 0–1 float
 */
export default function ConfidenceScore({ confidence, size = 80, strokeWidth = 8 }) {
  const pct    = Math.round(confidence * 100)
  const radius = (size - strokeWidth) / 2
  const circ   = 2 * Math.PI * radius
  const offset = circ - (pct / 100) * circ

  const color =
    pct >= 90 ? '#4ade80' :
    pct >= 75 ? '#facc15' :
    pct >= 60 ? '#fb923c' : '#f87171'

  const label =
    pct >= 90 ? 'Excellent' :
    pct >= 75 ? 'Good' :
    pct >= 60 ? 'Fair' : 'Low'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        {/* background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#1a2e1a"
          strokeWidth={strokeWidth}
        />
        {/* progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      {/* centre text is inside the svg rotation so we overlay it */}
      <div className="absolute flex flex-col items-center" style={{ width: size, marginTop: -(size / 2 + 18) }}>
        <span className="font-bold font-mono text-sm" style={{ color }}>{pct}%</span>
      </div>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
      <span className="text-[10px] text-gray-500">Confidence</span>
    </div>
  )
}
