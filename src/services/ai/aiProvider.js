/**
 * Klien SMART ADVISOR ke backend proxy AI.
 *
 * Aplikasi TIDAK PERNAH menyimpan API key penyedia AI. Semua permintaan
 * dikirim ke proxy HTTPS milik penerbit aplikasi, yang menyimpan kunci di
 * server dan meneruskan permintaan ke penyedia terpilih.
 *
 * Kontrak proxy (lihat docs/ARSITEKTUR.md bagian 7):
 *   POST {proxyUrl}/advisor
 *   { provider: 'openai'|'gemini'|'compatible', model: string, messages: [{role, content}] }
 *   -> 200 { answer: string, model?: string, usage?: object }
 *   -> 4xx/5xx { message?: string }
 */

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'],
    hint: 'Model cepat dan hemat untuk analisis usaha harian.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash'],
    hint: 'Alternatif dengan kuota gratis yang cukup besar.',
  },
  {
    id: 'compatible',
    label: 'Kompatibel OpenAI',
    models: ['default'],
    hint: 'Penyedia lain yang mengikuti format chat completions di proxy Anda.',
  },
]

export const DEFAULT_AI_SETTINGS = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  proxyUrl: '',
}

export const ENV_PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || '').trim().replace(/\/+$/, '')

export const REQUEST_TIMEOUT_MS = 45_000

export function normalizeProxyUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '')
}

/** Alamat proxy efektif: pengaturan aplikasi lebih dulu, lalu variabel build. */
export function resolveProxyUrl(settings) {
  const fromSettings = normalizeProxyUrl(settings?.proxyUrl)
  return fromSettings || ENV_PROXY_URL
}

export function providerLabel(providerId) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId ?? '-'
}

export function isProxyConfigured(settings) {
  return Boolean(resolveProxyUrl(settings))
}

function proxyError(message, code = 'proxy_error') {
  const error = new Error(message)
  error.code = code
  return error
}

/**
 * Meminta jawaban advisor melalui proxy.
 * @returns {Promise<{answer:string, model:string, usage:object|null}>}
 */
export async function requestAdvisorReply({ messages, provider, model, proxyUrl, signal }) {
  const baseUrl = normalizeProxyUrl(proxyUrl)
  if (!baseUrl) {
    throw proxyError(
      'Layanan AI belum terhubung. Isi alamat proxy AI di panel Koneksi AI, atau gunakan analisis lokal.',
      'proxy_missing',
    )
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller)

  try {
    const response = await fetch(`${baseUrl}/advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        messages,
        app: 'umkm-smart',
        promptVersion: 1,
      }),
      signal: controller.signal,
    })

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const serverMessage = typeof payload?.message === 'string' ? payload.message.trim() : ''
      if (response.status === 401 || response.status === 403) {
        throw proxyError(
          serverMessage ||
            'Proxy AI menolak permintaan. Periksa kunci API dan izin aplikasi di server proxy.',
          'proxy_unauthorized',
        )
      }
      if (response.status === 429) {
        throw proxyError(
          serverMessage ||
            'Batas pemakaian layanan AI tercapai. Coba lagi beberapa saat atau gunakan analisis lokal.',
          'proxy_rate_limited',
        )
      }
      throw proxyError(
        serverMessage || `Layanan AI menolak permintaan (HTTP ${response.status}).`,
        'proxy_failed',
      )
    }

    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : ''
    if (!answer) {
      throw proxyError('Layanan AI mengembalikan jawaban kosong. Coba lagi.', 'proxy_empty')
    }

    return {
      answer: answer.slice(0, 12_000),
      model: typeof payload?.model === 'string' && payload.model ? payload.model : model,
      usage: payload?.usage && typeof payload.usage === 'object' ? payload.usage : null,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw proxyError(
        'Permintaan ke layanan AI melebihi batas waktu. Periksa koneksi lalu coba lagi.',
        'proxy_timeout',
      )
    }
    if (error?.code) throw error
    throw proxyError(
      `Tidak dapat menghubungi layanan AI di ${baseUrl}. Periksa koneksi internet dan alamat proxy.`,
      'proxy_unreachable',
    )
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
