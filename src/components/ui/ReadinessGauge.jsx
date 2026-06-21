/**
 * Signature element: a "flight instrument" radial gauge.
 * Used for the Placement Readiness Score on the Dashboard.
 * Deliberately not a generic progress bar — reads like a cockpit dial.
 */
export default function ReadinessGauge({ score = 0, size = 180 }) {
  const radius = size / 2 - 14
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score))
  const dashOffset = circumference * (1 - pct / 100)
  const center = size / 2

  // Tick marks like an instrument dial
  const ticks = Array.from({ length: 24 }, (_, i) => i)

  const color =
    pct >= 75 ? 'var(--signal-teal)' : pct >= 45 ? 'var(--signal-amber)' : 'var(--signal-red)'

  return (
    <div className="gauge-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* tick marks */}
        {ticks.map((i) => {
          const angle = (i / ticks.length) * 360
          const isMajor = i % 6 === 0
          const r1 = radius + 8
          const r2 = isMajor ? radius + 2 : radius + 5
          const rad = (angle * Math.PI) / 180
          return (
            <line
              key={i}
              x1={center + r1 * Math.cos(rad)}
              y1={center + r1 * Math.sin(rad)}
              x2={center + r2 * Math.cos(rad)}
              y2={center + r2 * Math.sin(rad)}
              stroke="var(--border-active)"
              strokeWidth={isMajor ? 1.5 : 1}
            />
          )
        })}

        {/* base track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--bg-panel-raised)"
          strokeWidth={10}
        />

        {/* progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1), stroke 300ms' }}
        />
      </svg>

      <div className="gauge-readout">
        <div className="gauge-value mono" style={{ color }}>
          {Math.round(pct)}
        </div>
        <div className="gauge-label label-eyebrow">READINESS</div>
      </div>
    </div>
  )
}
