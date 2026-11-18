import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import HppCalculator from './HppCalculator'
import HppHistory from './HppHistory'

const TABS = [
  { value: 'kalkulator', label: 'Kalkulator HPP' },
  { value: 'riwayat', label: 'Riwayat HPP' },
]

export default function HppPage() {
  const [tab, setTab] = useState('kalkulator')

  return (
    <>
      <PageHeader
        title="Kalkulator HPP"
        description="Hitung harga pokok penjualan per unit dari komponen biaya, lalu simulasikan harga jual dan margin. Hasil perhitungan tersimpan sebagai riwayat dan dapat langsung diterapkan ke produk."
      />

      <div className="segmented" role="tablist" aria-label="Bagian kalkulator HPP" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`segmented__button ${tab === item.value ? 'segmented__button--active' : ''}`.trim()}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'kalkulator' ? <HppCalculator /> : <HppHistory />}
    </>
  )
}
