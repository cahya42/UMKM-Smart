import { FlaskConical, MessagesSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../../components/ui/PageHeader'
import PeriodFilter from '../dashboard/PeriodFilter'
import AdvisorChat from './AdvisorChat'
import DecisionSimulator from './DecisionSimulator'
import { loadAdvisorData } from '../../services/ai/advisorContext'
import { getPeriodRange, toDateKey } from '../../utils/dates'

const TODAY = toDateKey()
const MONTH_START = getPeriodRange('month').startDate

const TABS = [
  { id: 'chat', label: 'Konsultasi', icon: MessagesSquare },
  { id: 'simulasi', label: 'Simulasi keputusan', icon: FlaskConical },
]

export default function AdvisorPage() {
  const [tab, setTab] = useState('chat')
  const [conversationId, setConversationId] = useState(null)
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ start: MONTH_START, end: TODAY })

  const data = useLiveQuery(loadAdvisorData, [])
  const range = useMemo(() => getPeriodRange(period, custom), [period, custom])

  return (
    <>
      <PageHeader
        title="SMART ADVISOR"
        description="Analisis usaha dari ringkasan yang dihitung aplikasi. Anda melihat dan menyetujui setiap ringkasan sebelum dikirim; angka tidak dihitung oleh AI."
        actions={
          <div className="segmented" role="group" aria-label="Pilih mode advisor">
            {TABS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`segmented__button ${tab === item.id ? 'segmented__button--active' : ''}`.trim()}
                  aria-pressed={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={14} aria-hidden="true" /> {item.label}
                </button>
              )
            })}
          </div>
        }
      />

      <PeriodFilter
        period={period}
        onPeriodChange={setPeriod}
        custom={custom}
        onCustomChange={setCustom}
      />

      {!data ? (
        <div className="stack">
          <div className="skeleton skeleton--stat" />
          <div className="skeleton skeleton--stat" />
        </div>
      ) : tab === 'chat' ? (
        <AdvisorChat
          data={data}
          range={range}
          conversationId={conversationId}
          onConversationChange={setConversationId}
        />
      ) : (
        <DecisionSimulator data={data} range={range} />
      )}
    </>
  )
}
