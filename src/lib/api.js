/**
 * API client for SIMAK Study OS.
 * Communicates with the backend proxy for AI operations.
 */

import { getToken, handleAuthExpired } from './authClient'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function getAuthHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call AI via backend proxy (non-streaming) with exponential backoff retry for 429 errors.
 *
 * @param {object} options
 * @param {string} options.task - Task type for provider routing (e.g. 'pretest', 'explanation')
 * @param {string} options.system - System prompt
 * @param {Array} options.messages - Array of { role, content } message objects
 * @param {number} [options.maxTokens] - Maximum response tokens (default: 1024)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.7)
 * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the fetch
 * @returns {Promise<string>} AI response text
 */
export async function callAI({
  task,
  system,
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  signal,
}) {
  const retryDelays = [1000, 2000, 4000]
  let lastError = null

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        task,
        system,
        messages,
        maxTokens,
        temperature,
      }),
      signal,
    })

    if (response.status === 429 && attempt < retryDelays.length) {
      await sleep(retryDelays[attempt])
      continue
    }

    if (response.status === 401) {
      handleAuthExpired()
      const err = new Error('Sesi telah berakhir. Silakan login ulang.')
      err.code = 'UNAUTHORIZED'
      throw err
    }

    if (!response.ok) {
      const errorBody = await response.text()
      lastError = new Error(`API error (${response.status}): ${errorBody}`)
      if (response.status === 429) {
        throw lastError
      }
      throw lastError
    }

    const data = await response.json()
    return data.text
  }

  throw lastError
}

/**
 * Call AI via backend proxy with streaming (SSE).
 *
 * @param {object} options
 * @param {string} options.task - Task type for provider routing
 * @param {string} options.system - System prompt
 * @param {Array} options.messages - Array of { role, content } message objects
 * @param {number} [options.maxTokens] - Maximum response tokens (default: 1024)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.7)
 * @param {function} options.onChunk - Callback invoked with each text chunk
 * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the fetch
 * @returns {Promise<string>} Full accumulated response text
 */
export async function callAIStream({
  task,
  system,
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  onChunk,
  signal,
}) {
  const retryDelays = [1000, 2000, 4000]
  let lastError = null

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(`${BACKEND_URL}/api/ai/stream`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        task,
        system,
        messages,
        maxTokens,
        temperature,
      }),
      signal,
    })

    if (response.status === 429 && attempt < retryDelays.length) {
      await sleep(retryDelays[attempt])
      continue
    }

    if (response.status === 401) {
      handleAuthExpired()
      const err = new Error('Sesi telah berakhir. Silakan login ulang.')
      err.code = 'UNAUTHORIZED'
      throw err
    }

    if (!response.ok) {
      const errorBody = await response.text()
      lastError = new Error(`API error (${response.status}): ${errorBody}`)
      if (response.status === 429) {
        throw lastError
      }
      throw lastError
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6)
          if (jsonStr.trim() === '[DONE]') continue

          try {
            const event = JSON.parse(jsonStr)
            if (event.text) {
              accumulated += event.text
              if (onChunk) {
                onChunk(event.text)
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    return accumulated
  }

  throw lastError
}

/**
 * Call AI validation endpoint for dual-pass question validation.
 *
 * @param {object} options
 * @param {string} options.question - The question text
 * @param {object} options.options - Answer options object
 * @param {AbortSignal} [options.signal] - Optional AbortSignal
 * @returns {Promise<{answer: string, confidence: number, reasoning: string}>}
 */
export async function callValidate({ question, options, signal }) {
  const response = await fetch(`${BACKEND_URL}/api/ai/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ question, options }),
    signal,
  })

  if (response.status === 401) {
    handleAuthExpired()
    const err = new Error('Sesi telah berakhir. Silakan login ulang.')
    err.code = 'UNAUTHORIZED'
    throw err
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Validation API error (${response.status}): ${errorBody}`)
  }

  return await response.json()
}
