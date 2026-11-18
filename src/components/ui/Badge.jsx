const TONE_CLASS = {
  green: 'badge--green',
  amber: 'badge--amber',
  red: 'badge--red',
  blue: 'badge--blue',
  gray: 'badge--gray',
}

export default function Badge({ tone = 'gray', children }) {
  return <span className={`badge ${TONE_CLASS[tone] ?? TONE_CLASS.gray}`}>{children}</span>
}
