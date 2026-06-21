import { useMemo } from 'react'

/**
 * GitHub-style activity heatmap.
 * `data` is a map of 'YYYY-MM-DD' -> intensity (0-4)
 */
export default function ActivityHeatmap({ data = {}, weeks = 18 }) {
  const days = useMemo(() => {
    const result = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Align to the most recent Saturday so columns are full weeks
    const endDay = today.getDay() // 0 = Sunday
    const totalDays = weeks * 7
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key, level: data[key] || 0 })
    }
    return result
  }, [data, weeks])

  // group into columns of 7 (weeks)
  const columns = []
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7))
  }

  const levelColor = (level) => {
    if (level === 0) return 'var(--bg-panel-raised)'
    if (level === 1) return 'var(--signal-amber-dim)'
    if (level === 2) return 'color-mix(in srgb, var(--signal-amber) 50%, var(--bg-panel-raised))'
    if (level === 3) return 'var(--signal-amber)'
    return 'var(--signal-teal)'
  }

  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
      {columns.map((col, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {col.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.level > 0 ? 'active' : 'no activity'}`}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: levelColor(day.level),
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
