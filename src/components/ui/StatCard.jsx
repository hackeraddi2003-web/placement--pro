export default function StatCard({ icon: Icon, label, value, accent = 'amber', delta }) {
  return (
    <div className="panel stat-card">
      <div className="stat-card-top">
        <div
          className="stat-card-icon"
          style={{
            background: `var(--signal-${accent}-dim)`,
            color: `var(--signal-${accent})`,
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
        {delta && <span className="stat-card-delta" style={{ color: `var(--signal-${accent})` }}>{delta}</span>}
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  )
}
