import { FlaskConical, Info } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { buildProfitSummary } from '../../utils/finance'
import { formatPercent, formatRupiah, percentage, toRupiah } from '../../utils/money'

/**
 * Simulasi keputusan dihitung sepenuhnya di aplikasi dari angka periode
 * terpilih. Tidak ada data yang dikirim ke layanan AI pada halaman ini.
 */

const CHANGES = [
  { key: 'price', label: 'Harga jual', hint: 'Berlaku untuk seluruh produk' },
  { key: 'volume', label: 'Jumlah terjual', hint: 'Mempengaruhi omzet dan HPP' },
  { key: 'cost', label: 'HPP per unit', hint: 'Harga bahan atau biaya produksi' },
  { key: 'expense', label: 'Biaya operasional', hint: 'Sewa, gaji, listrik, promosi' },
]

export default function DecisionSimulator({ data, range }) {
  const [changes, setChanges] = useState({ price: 0, volume: 0, cost: 0, expense: 0 })

  const baseline = useMemo(() => {
    if (!data) return null
    const sales = data.sales.filter((sale) => sale.date >= range.startDate && sale.date <= range.endDate)
    const expenses = data.expenses.filter(
      (expense) => expense.date >= range.startDate && expense.date <= range.endDate,
    )
    return buildProfitSummary(sales, data.saleItems, expenses)
  }, [data, range])

  const projected = useMemo(() => {
    if (!baseline) return null
    const factor = (value) => 1 + Number(value || 0) / 100
    const omzet = toRupiah(baseline.omzet * factor(changes.price) * factor(changes.volume))
    const hpp = toRupiah(baseline.hpp * factor(changes.cost) * factor(changes.volume))
    const expenses = toRupiah(baseline.operatingExpenses * factor(changes.expense))
    const grossProfit = omzet - hpp
    return {
      omzet,
      hpp,
      expenses,
      grossProfit,
      netProfit: grossProfit - expenses,
      margin: percentage(grossProfit, omzet),
    }
  }, [baseline, changes])

  const rows = baseline
    ? [
        { label: 'Omzet', base: formatRupiah(baseline.omzet), next: formatRupiah(projected.omzet) },
        { label: 'HPP', base: formatRupiah(baseline.hpp), next: formatRupiah(projected.hpp) },
        {
          label: 'Laba kotor',
          base: formatRupiah(baseline.grossProfit),
          next: formatRupiah(projected.grossProfit),
        },
        {
          label: 'Biaya operasional',
          base: formatRupiah(baseline.operatingExpenses),
          next: formatRupiah(projected.expenses),
        },
        {
          label: 'Estimasi laba bersih',
          base: formatRupiah(baseline.netProfit),
          next: formatRupiah(projected.netProfit),
        },
        {
          label: 'Margin laba kotor',
          base: formatPercent(baseline.margin),
          next: formatPercent(projected.margin),
        },
      ]
    : []

  const profitDelta = baseline ? projected.netProfit - baseline.netProfit : 0

  function updateChange(key, rawValue) {
    const value = Number(rawValue)
    setChanges((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  }

  return (
    <div className="grid grid--sidebar">
      <div className="stack">
        <Card>
          <CardHeader
            title="Simulasi keputusan"
            subtitle={`Periode acuan: ${range.label}`}
            icon={FlaskConical}
          />
          <CardBody>
            <div className="alert alert--info">
              <Info size={17} />
              <div>
                <strong>Dihitung di perangkat, tanpa AI</strong>
                <p>
                  Simulasi mengubah angka periode terpilih secara merata. Gunakan angka negatif untuk
                  penurunan, misalnya -10 untuk harga turun 10%. Hasilnya perkiraan, bukan jaminan.
                </p>
              </div>
            </div>

            <div className="sim-grid">
              {CHANGES.map((change) => (
                <Field key={change.key} label={change.label} htmlFor={`sim-${change.key}`} hint={change.hint}>
                  <div className="sim-input">
                    <input
                      id={`sim-${change.key}`}
                      type="number"
                      className="input"
                      step="1"
                      min="-100"
                      max="1000"
                      value={changes[change.key]}
                      onChange={(event) => updateChange(change.key, event.target.value)}
                    />
                    <span aria-hidden="true">%</span>
                  </div>
                </Field>
              ))}
            </div>

            {baseline?.transactions === 0 ? (
              <div className="alert alert--warning" style={{ marginTop: 14 }}>
                <Info size={17} />
                <div>
                  <strong>Belum ada penjualan pada periode ini</strong>
                  <p>
                    Simulasi membutuhkan omzet dan HPP sebagai acuan. Pilih periode lain atau catat
                    penjualan terlebih dahulu.
                  </p>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Perbandingan" subtitle="Angka periode saat ini vs simulasi" />
          <CardBody>
            <div className="table-wrap">
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>Uraian</th>
                    <th>Saat ini</th>
                    <th>Simulasi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="num">{row.base}</td>
                      <td className="num">{row.next}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-note">
              Perubahan estimasi laba bersih:{' '}
              <strong>{profitDelta >= 0 ? '+' : ''}{formatRupiah(profitDelta)}</strong> dibanding periode
              acuan.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="stack">
        <Card>
          <CardHeader title="Cara membaca simulasi" icon={Info} />
          <CardBody>
            <ul className="sim-notes">
              <li>Perubahan harga dan jumlah terjual dihitung terpisah, lalu dikalikan.</li>
              <li>Perubahan HPP mengikuti jumlah terjual; biaya operasional tidak.</li>
              <li>Angka acuan memakai laba rugi periode terpilih, bukan rata-rata tahunan.</li>
              <li>Simulasi tidak memperhitungkan reaksi pelanggan, pajak, atau perubahan pasar.</li>
              <li>Gunakan hasilnya sebagai bahan pertimbangan, bukan target pasti.</li>
            </ul>
            <p className="form-note">
              Tidak ada data yang dikirim ke layanan luar saat memakai simulasi ini.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
