import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const classes = ['btn', VARIANTS[variant] ?? VARIANTS.primary, size === 'sm' ? 'btn--sm' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest} disabled={rest.disabled || loading}>
      {loading ? <Loader2 size={16} className="btn__spinner" aria-hidden="true" /> : null}
      {!loading && Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
