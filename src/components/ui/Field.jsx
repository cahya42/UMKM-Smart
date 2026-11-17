/**
 * Field membungkus label, petunjuk, dan pesan error agar formulir konsisten.
 * Elemen input/select/textarea tetap memakai kelas CSS (input, select, textarea).
 */
export function Field({ label, htmlFor, error, hint, required = false, children, className = '' }) {
  return (
    <div className={`field ${className}`.trim()}>
      {label ? (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  )
}

export default Field
