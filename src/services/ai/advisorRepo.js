import { db } from '../../database/db'
import { DEFAULT_AI_SETTINGS } from './aiProvider'

/**
 * Penyimpanan lokal SMART ADVISOR: percakapan, pesan, dan pengaturan koneksi.
 * Tidak ada data advisor yang dikirim ke server selain ringkasan yang sudah
 * disetujui pengguna pada setiap permintaan.
 */

const PROVIDER_KEY = 'advisor.provider'
const MODEL_KEY = 'advisor.model'
const PROXY_KEY = 'advisor.proxyUrl'

const SETTING_KEYS = [PROVIDER_KEY, MODEL_KEY, PROXY_KEY]

export async function getAdvisorSettings() {
  const rows = await db.settings.bulkGet(SETTING_KEYS)
  const values = Object.fromEntries(
    rows.filter(Boolean).map((row) => [row.key, row.value]),
  )

  return {
    provider: values[PROVIDER_KEY] || DEFAULT_AI_SETTINGS.provider,
    model: values[MODEL_KEY] || DEFAULT_AI_SETTINGS.model,
    proxyUrl: values[PROXY_KEY] || '',
  }
}

export async function saveAdvisorSettings(settings) {
  const now = new Date().toISOString()
  const rows = [
    { key: PROVIDER_KEY, value: settings.provider, updatedAt: now },
    { key: MODEL_KEY, value: settings.model, updatedAt: now },
    { key: PROXY_KEY, value: settings.proxyUrl ?? '', updatedAt: now },
  ]

  await db.settings.bulkPut(rows)
  return getAdvisorSettings()
}

export async function listConversations(limit = 30) {
  return db.advisor_conversations.orderBy('updatedAt').reverse().limit(limit).toArray()
}

export async function getConversation(conversationId) {
  return db.advisor_conversations.get(conversationId)
}

export async function createConversation(question = '') {
  const now = new Date().toISOString()
  const title = String(question).trim().slice(0, 70) || 'Konsultasi baru'
  const record = {
    id: crypto.randomUUID(),
    title,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  await db.advisor_conversations.add(record)
  return record
}

export async function listMessages(conversationId) {
  if (!conversationId) return []
  const rows = await db.advisor_messages.where('conversationId').equals(conversationId).toArray()
  return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

export async function appendMessage({ conversationId, role, content, meta = null }) {
  const now = new Date().toISOString()
  const record = {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    meta,
    createdAt: now,
  }

  await db.transaction('rw', db.advisor_messages, db.advisor_conversations, async (tx) => {
    await tx.table('advisor_messages').add(record)
    const conversation = await tx.table('advisor_conversations').get(conversationId)
    if (conversation) {
      await tx.table('advisor_conversations').update(conversationId, {
        updatedAt: now,
        messageCount: Number(conversation.messageCount ?? 0) + 1,
      })
    }
  })

  return record
}

export async function deleteConversation(conversationId) {
  if (!conversationId) return
  await db.transaction('rw', db.advisor_messages, db.advisor_conversations, async (tx) => {
    await tx.table('advisor_messages').where('conversationId').equals(conversationId).delete()
    await tx.table('advisor_conversations').delete(conversationId)
  })
}
