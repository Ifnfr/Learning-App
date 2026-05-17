/**
 * Claude API wrapper for SIMAK Study OS.
 * Supports non-streaming, streaming (SSE), and API key verification.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

function getHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call Claude API (non-streaming) with exponential backoff retry for 429 errors.
 *
 * @param {object} options
 * @param {string} options.apiKey - Anthropic API key
 * @param {string} options.system - System prompt defining Claude's behavior
 * @param {Array} options.messages - Array of { role, content } message objects
 * @param {string} [options.model] - Model to use (default: claude-sonnet-4-5-20250929)
 * @param {number} [options.maxTokens] - Maximum response tokens (default: 1024)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.7)
 * @returns {Promise<string>} Claude's response text
 */
export async function callClaude({
  apiKey,
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  const retryDelays = [1000, 2000, 4000]
  let lastError = null

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      }),
    })

    if (response.status === 429 && attempt < retryDelays.length) {
      await sleep(retryDelays[attempt])
      continue
    }

    if (!response.ok) {
      const errorBody = await response.text()
      lastError = new Error(`Claude API error (${response.status}): ${errorBody}`)
      if (response.status === 429) {
        throw lastError
      }
      throw lastError
    }

    const data = await response.json()

    if (data.content && data.content.length > 0) {
      return data.content[0].text
    }

    throw new Error('Unexpected API response format: no content returned')
  }

  throw lastError
}

/**
 * Call Claude API with streaming via SSE.
 * Parses the event stream for content_block_delta events with text_delta type.
 *
 * @param {object} options
 * @param {string} options.apiKey - Anthropic API key
 * @param {string} options.system - System prompt defining Claude's behavior
 * @param {Array} options.messages - Array of { role, content } message objects
 * @param {string} [options.model] - Model to use (default: claude-sonnet-4-5-20250929)
 * @param {number} [options.maxTokens] - Maximum response tokens (default: 1024)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.7)
 * @param {function} options.onChunk - Callback invoked with each text delta string
 * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the fetch
 * @returns {Promise<string>} Full accumulated response text
 */
export async function callClaudeStream({
  apiKey,
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 1024,
  temperature = 0.7,
  onChunk,
  signal,
}) {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  const retryDelays = [1000, 2000, 4000]
  let lastError = null

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
        stream: true,
      }),
      signal,
    })

    if (response.status === 429 && attempt < retryDelays.length) {
      await sleep(retryDelays[attempt])
      continue
    }

    if (!response.ok) {
      const errorBody = await response.text()
      lastError = new Error(`Claude API error (${response.status}): ${errorBody}`)
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
            if (
              event.type === 'content_block_delta' &&
              event.delta &&
              event.delta.type === 'text_delta'
            ) {
              const text = event.delta.text
              accumulated += text
              if (onChunk) {
                onChunk(text)
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
 * Verify that an API key is valid by making a minimal API call.
 *
 * @param {string} apiKey - Anthropic API key to verify
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function verifyApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }

  try {
    await callClaude({
      apiKey,
      system: 'Reply with OK',
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 10,
    })
    return { valid: true, error: null }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}
