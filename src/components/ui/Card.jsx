export function Card({ children, className = '' }) {
  return <section className={`card ${className}`.trim()}>{children}</section>
}

export function CardHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="card__header">
      <div className="card__heading">
        {Icon ? (
          <span className="card__icon">
            <Icon size={17} aria-hidden="true" />
          </span>
        ) : null}
        <div>
          <h3 className="card__title">{title}</h3>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function CardBody({ children, flush = false, className = '' }) {
  return <div className={`card__body ${flush ? 'card__body--flush' : ''} ${className}`.trim()}>{children}</div>
}

const TONE_CLASS = {
  default: '',
  profit: 'stat-card--profit',
  expense: 'stat-card--expense',
  cash: 'stat-card--cash',
  warning: 'stat-card--warning',
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }) {
  return (
    <div className={`stat-card ${TONE_CLASS[tone] ?? ''}`.trim()}>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {Icon ? (
          <span className="stat-card__icon">
            <Icon size={17} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="stat-card__value">{value}</p>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </div>
  )
}
