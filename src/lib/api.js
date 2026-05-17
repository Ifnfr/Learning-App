/**
 * Claude API wrapper for SIMAK Study OS.
 * Uses the Anthropic SDK to make API calls with proper error handling.
 */

/**
 * Call Claude API with the given system prompt and messages.
 * Uses the API key from environment variables (VITE_ANTHROPIC_API_KEY).
 *
 * @param {object} options
 * @param {string} options.system - System prompt defining Claude's behavior
 * @param {Array} options.messages - Array of { role, content } message objects
 * @param {string} [options.model] - Model to use (default: claude-sonnet-4-20250514)
 * @param {number} [options.maxTokens] - Maximum response tokens (default: 1024)
 * @param {number} [options.temperature] - Sampling temperature (default: 0.7)
 * @returns {Promise<string>} Claude's response text
 */
export async function callClaude({
  system,
  messages,
  model = 'claude-sonnet-4-20250514',
  maxTokens = 1024,
  temperature = 0.7,
}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'Missing VITE_ANTHROPIC_API_KEY environment variable. ' +
      'Set it in your .env file or Vercel environment settings.'
    )
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API error (${response.status}): ${errorBody}`)
  }

  const data = await response.json()

  if (data.content && data.content.length > 0) {
    return data.content[0].text
  }

  throw new Error('Unexpected API response format: no content returned')
}
