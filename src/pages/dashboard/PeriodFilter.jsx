import { PERIOD_OPTIONS } from '../../utils/dates'

/**
 * Filter periode: hari ini, minggu ini, bulan ini, tahun ini, atau rentang khusus.
 */
export default function PeriodFilter({ period, onPeriodChange, custom, onCustomChange }) {
  return (
    <div className="filter-bar">
      <div className="segmented" role="group" aria-label="Pilih periode">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segmented__button ${period === option.value ? 'segmented__button--active' : ''}`.trim()}
            aria-pressed={period === option.value}
            onClick={() => onPeriodChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === 'custom' ? (
        <div className="filter-bar__dates">
          <label>
            Dari
            <input
              type="date"
              className="input input--sm"
              value={custom.start}
              max={custom.end || undefined}
              onChange={(event) => onCustomChange({ ...custom, start: event.target.value })}
            />
          </label>
          <label>
            Sampai
            <input
              type="date"
              className="input input--sm"
              value={custom.end}
              min={custom.start || undefined}
              onChange={(event) => onCustomChange({ ...custom, end: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
