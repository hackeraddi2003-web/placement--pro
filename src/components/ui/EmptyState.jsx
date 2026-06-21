export default function EmptyState({ icon: Icon, title, copy }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={28} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.5 }} />}
      <div className="empty-state-title">{title}</div>
      {copy && <div className="empty-state-copy">{copy}</div>}
    </div>
  )
}
