import { History, Plus, Save, Send, ShieldCheck, Sparkles, Trash2, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { addAuditLog } from '../../database/repositories/auditLogRepo'
import { buildAdvisorContext } from '../../services/ai/advisorContext'
import {
  AI_PROVIDERS,
  providerLabel,
  requestAdvisorReply,
  resolveProxyUrl,
} from '../../services/ai/aiProvider'
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getAdvisorSettings,
  listConversations,
  listMessages,
  saveAdvisorSettings,
} from '../../services/ai/advisorRepo'
import { buildLocalAdvice } from '../../services/ai/localAdvisor'
import { buildAdvisorMessages } from '../../services/ai/prompt'
import { formatDateTime } from '../../utils/dates'
import { advisorQuestionSchema, advisorSettingsSchema, toFieldErrors } from '../../utils/validation'
import AdvisorConsentDialog from './AdvisorConsentDialog'

const SUGGESTIONS = [
  'Bagaimana kondisi laba usaha bulan ini dan apa yang perlu diperbaiki?',
  'Produk mana yang perlu segera ditambah stoknya?',
  'Biaya apa yang paling membebani usaha saya?',
]

export default function AdvisorChat({ data, range, conversationId, onConversationChange }) {
  const toast = useToast()

  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(null)
  const [sending, setSending] = useState(false)
  const [showSummaryText, setShowSummaryText] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const conversations = useLiveQuery(() => listConversations(30), [])
  const messages = useLiveQuery(() => listMessages(conversationId), [conversationId])
  const settings = useLiveQuery(getAdvisorSettings, [])

  const [form, setForm] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (!settings) return
    setForm((current) => current ?? { ...settings })
  }, [settings])

  const context = useMemo(
    () => (data ? buildAdvisorContext(data, range, question) : null),
    [data, range, question],
  )

  const proxyReady = Boolean(resolveProxyUrl(settings))
  const activeConversation = useMemo(
    () => (conversations ?? []).find((item) => item.id === conversationId) ?? null,
    [conversations, conversationId],
  )
  const provider = AI_PROVIDERS.find((item) => item.id === form?.provider) ?? AI_PROVIDERS[0]

  function handleReview() {
    const parsed = advisorQuestionSchema.safeParse({ question })
    if (!parsed.success) {
      toast.push(parsed.error.issues[0]?.message ?? 'Pertanyaan belum lengkap.', { tone: 'error' })
      return
    }
    if (!data) {
      toast.push('Data usaha masih dimuat. Coba lagi sebentar.', { tone: 'error' })
      return
    }

    setPending({
      question: parsed.data.question,
      context: buildAdvisorContext(data, range, parsed.data.question),
    })
  }

  async function handleConfirm() {
    if (!pending) return
    setSending(true)
    try {
      const external = Boolean(resolveProxyUrl(settings))
      let answer = ''
      let mode = 'local'
      let usedModel = ''

      if (external) {
        const reply = await requestAdvisorReply({
          messages: buildAdvisorMessages({
            question: pending.question,
            contextText: pending.context.text,
            history: (messages ?? []).map(({ role, content }) => ({ role, content })),
          }),
          provider: settings.provider,
          model: settings.model,
          proxyUrl: resolveProxyUrl(settings),
        })
        answer = reply.answer
        usedModel = reply.model
        mode = 'proxy'
      } else {
        answer = buildLocalAdvice(pending.context)
      }

      let targetId = conversationId
      if (!targetId) {
        const conversation = await createConversation(pending.question)
        targetId = conversation.id
        onConversationChange(conversation.id)
      }

      await appendMessage({
        conversationId: targetId,
        role: 'user',
        content: pending.question,
        meta: {
          focus: pending.context.focus.label,
          periodLabel: pending.context.periodLabel,
          mode,
        },
      })

      await appendMessage({
        conversationId: targetId,
        role: 'assistant',
        content: answer,
        meta: {
          mode,
          provider: mode === 'proxy' ? settings.provider : 'local',
          model: mode === 'proxy' ? usedModel || settings.model : 'analisis aplikasi',
          focus: pending.context.focus.id,
        },
      })

      await addAuditLog({
        action: mode === 'proxy' ? 'advisor_send' : 'advisor_local_analysis',
        entity: 'advisor',
        entityId: targetId,
        description:
          mode === 'proxy'
            ? `Mengirim ringkasan usaha yang disetujui ke ${providerLabel(settings.provider)}`
            : 'Membuat analisis lokal SMART ADVISOR tanpa mengirim data',
        metadata: {
          mode,
          provider: mode === 'proxy' ? settings.provider : 'local',
          model: mode === 'proxy' ? usedModel || settings.model : 'analisis aplikasi',
          focus: pending.context.focus.id,
          period: pending.context.periodLabel,
          summaryCharacters: pending.context.text.length,
        },
      })

      toast.push(
        mode === 'proxy'
          ? 'Ringkasan terkirim dan jawaban diterima.'
          : 'Analisis lokal dibuat. Tidak ada data yang dikirim.',
      )
      setQuestion('')
      setPending(null)
      setShowSummaryText(false)
    } catch (error) {
      toast.push(error?.message ?? 'Permintaan ke layanan AI gagal.', { tone: 'error' })
    } finally {
      setSending(false)
    }
  }

  async function handleSaveSettings() {
    if (!form) return
    const parsed = advisorSettingsSchema.safeParse(form)
    if (!parsed.success) {
      setFormErrors(toFieldErrors(parsed.error))
      toast.push(parsed.error.issues[0]?.message ?? 'Pengaturan AI belum valid.', { tone: 'error' })
      return
    }

    setSavingSettings(true)
    setFormErrors({})
    try {
      await saveAdvisorSettings(parsed.data)
      toast.push('Pengaturan koneksi AI disimpan.')
    } catch (error) {
      toast.push(error?.message ?? 'Pengaturan AI gagal disimpan.', { tone: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleDeleteConversation() {
    if (!deleteTarget) return
    try {
      await deleteConversation(deleteTarget.id)
      if (conversationId === deleteTarget.id) onConversationChange(null)
      setDeleteTarget(null)
      toast.push('Percakapan dihapus dari perangkat ini.')
    } catch (error) {
      toast.push(error?.message ?? 'Percakapan gagal dihapus.', { tone: 'error' })
    }
  }

  function updateForm(patch) {
    setForm((current) => ({ ...(current ?? {}), ...patch }))
  }

  function changeProvider(providerId) {
    const next = AI_PROVIDERS.find((item) => item.id === providerId) ?? AI_PROVIDERS[0]
    updateForm({ provider: next.id, model: next.models[0] })
  }

  function startNew() {
    onConversationChange(null)
    setQuestion('')
    setPending(null)
    setShowSummaryText(false)
  }

  return (
    <>
      <div className="grid grid--sidebar">
        <div className="stack">
          <Card>
            <CardHeader
              title={activeConversation?.title ?? 'Konsultasi baru'}
              subtitle={
                activeConversation
                  ? `${formatDateTime(activeConversation.updatedAt)} · ${activeConversation.messageCount ?? 0} pesan`
                  : 'Tanyakan kondisi usaha; ringkasan angka disusun dari data lokal'
              }
              icon={Sparkles}
              action={
                <Button variant="secondary" size="sm" icon={Plus} onClick={startNew}>
                  Percakapan baru
                </Button>
              }
            />
            <CardBody>
              <div className="advisor-chat" aria-live="polite">
                {(messages ?? []).length === 0 ? (
                  <div className="advisor-empty">
                    <span className="advisor-empty__icon" aria-hidden="true">
                      <Sparkles size={20} />
                    </span>
                    <h4>Belum ada percakapan</h4>
                    <p>
                      Advisor membaca ringkasan laba, biaya, stok, harga, dan kas yang dihitung aplikasi.
                      Anda selalu melihat isi ringkasan sebelum apa pun dikirim.
                    </p>
                    <div className="advisor-suggestions">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="advisor-suggestions__item"
                          onClick={() => setQuestion(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  (messages ?? []).map((message) => (
                    <article
                      key={message.id}
                      className={`advisor-message advisor-message--${message.role}`}
                    >
                      <div className="advisor-message__meta">
                        <strong>{message.role === 'user' ? 'Anda' : 'SMART ADVISOR'}</strong>
                        {message.role === 'assistant' && message.meta?.mode === 'proxy' ? (
                          <Badge tone="green">
                            {providerLabel(message.meta.provider)} · {message.meta.model}
                          </Badge>
                        ) : null}
                        {message.role === 'assistant' && message.meta?.mode === 'local' ? (
                          <Badge tone="amber">Analisis lokal · tanpa AI</Badge>
                        ) : null}
                        <span className="muted">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="advisor-message__body">{message.content}</p>
                    </article>
                  ))
                )}
              </div>

              <div className="advisor-composer">
                <label className="field__label" htmlFor="advisorQuestion">
                  Pertanyaan Anda
                </label>
                <textarea
                  id="advisorQuestion"
                  className="textarea"
                  rows={3}
                  maxLength={500}
                  value={question}
                  placeholder="Contoh: Mengapa laba bulan ini turun, dan apa yang sebaiknya saya perbaiki lebih dulu?"
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <div className="advisor-composer__footer">
                  <p className="form-note">
                    {question.length}/500 karakter · Ringkasan selalu ditinjau sebelum dikirim.
                  </p>
                  <Button icon={Send} onClick={handleReview} disabled={!data || sending}>
                    Tinjau & kirim
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader
              title="Ringkasan yang akan dikirim"
              subtitle={context ? `${context.text.length} karakter, dihitung dari data lokal` : 'Memuat data...'}
              icon={ShieldCheck}
            />
            <CardBody>
              {context ? (
                <>
                  <dl className="info-list">
                    {context.fields.map((field) => (
                      <div key={field.label}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="form-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSummaryText((value) => !value)}
                    >
                      {showSummaryText ? 'Sembunyikan teks lengkap' : 'Lihat teks lengkap'}
                    </Button>
                  </div>
                  {showSummaryText ? <pre className="advisor-preview">{context.text}</pre> : null}
                </>
              ) : (
                <p className="muted">Memuat ringkasan...</p>
              )}
              <p className="form-note" style={{ marginTop: 10 }}>
                Tidak disertakan: nama dan kontak pelanggan/pemasok, alamat usaha, token lisensi, serta
                isi database.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Koneksi AI"
              subtitle="Kunci API hanya disimpan di server proxy"
              icon={Wifi}
              action={
                <Badge tone={proxyReady ? 'green' : 'amber'}>
                  {proxyReady ? 'Proxy aktif' : 'Analisis lokal'}
                </Badge>
              }
            />
            <CardBody>
              {form ? (
                <div className="stack stack--tight">
                  <Field label="Penyedia" htmlFor="advisorProvider">
                    <select
                      id="advisorProvider"
                      className="select"
                      value={form.provider}
                      onChange={(event) => changeProvider(event.target.value)}
                    >
                      {AI_PROVIDERS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Model" htmlFor="advisorModel" hint={provider.hint}>
                    {provider.id === 'compatible' ? (
                      <input
                        id="advisorModel"
                        className="input"
                        value={form.model}
                        maxLength={80}
                        placeholder="nama-model-di-proxy"
                        onChange={(event) => updateForm({ model: event.target.value })}
                      />
                    ) : (
                      <select
                        id="advisorModel"
                        className="select"
                        value={provider.models.includes(form.model) ? form.model : provider.models[0]}
                        onChange={(event) => updateForm({ model: event.target.value })}
                      >
                        {provider.models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>

                  <Field
                    label="Alamat proxy AI"
                    htmlFor="advisorProxyUrl"
                    hint="HTTPS di produksi. Kosongkan untuk memakai analisis lokal."
                    error={formErrors.proxyUrl}
                  >
                    <input
                      id="advisorProxyUrl"
                      className="input"
                      value={form.proxyUrl ?? ''}
                      maxLength={300}
                      placeholder="https://ai.contoh.id"
                      onChange={(event) => updateForm({ proxyUrl: event.target.value })}
                    />
                  </Field>

                  <Button
                    variant="secondary"
                    icon={Save}
                    loading={savingSettings}
                    onClick={handleSaveSettings}
                  >
                    Simpan pengaturan
                  </Button>

                  <p className="form-note">
                    Tanpa proxy, advisor tetap menyusun analisis dari angka yang sama dan tidak membuat
                    permintaan jaringan. API key penyedia tidak boleh dimasukkan di sini.
                  </p>
                </div>
              ) : (
                <p className="muted">Memuat pengaturan...</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Riwayat konsultasi"
              subtitle={`${conversations?.length ?? 0} percakapan di perangkat ini`}
              icon={History}
            />
            <CardBody>
              {(conversations ?? []).length === 0 ? (
                <p className="muted">Belum ada riwayat konsultasi.</p>
              ) : (
                <ul className="advisor-history">
                  {(conversations ?? []).map((conversation) => (
                    <li
                      key={conversation.id}
                      className={`advisor-history__item ${
                        conversationId === conversation.id ? 'advisor-history__item--active' : ''
                      }`.trim()}
                    >
                      <button
                        type="button"
                        className="advisor-history__open"
                        onClick={() => {
                          onConversationChange(conversation.id)
                          setQuestion('')
                        }}
                      >
                        <strong>{conversation.title}</strong>
                        <small>
                          {formatDateTime(conversation.updatedAt)} · {conversation.messageCount ?? 0} pesan
                        </small>
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--sm"
                        aria-label={`Hapus percakapan ${conversation.title}`}
                        title="Hapus percakapan"
                        onClick={() => setDeleteTarget(conversation)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <AdvisorConsentDialog
        open={Boolean(pending)}
        context={pending?.context ?? null}
        question={pending?.question ?? ''}
        external={proxyReady}
        provider={providerLabel(settings?.provider)}
        model={settings?.model ?? ''}
        loading={sending}
        onCancel={() => {
          if (!sending) setPending(null)
        }}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus percakapan ini?"
        description={
          deleteTarget
            ? `Percakapan "${deleteTarget.title}" beserta seluruh pesannya akan dihapus dari perangkat ini. Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        confirmLabel="Hapus percakapan"
        onConfirm={handleDeleteConversation}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
