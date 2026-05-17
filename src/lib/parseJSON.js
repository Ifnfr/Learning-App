/**
 * Resilient JSON parser for LLM responses.
 * Handles markdown fences, preamble text, and trailing content.
 */

/**
 * Parse JSON from an LLM response string that may contain markdown fences
 * or extra text around the actual JSON content.
 *
 * @param {string} text - Raw LLM response text
 * @returns {any} Parsed JSON value
 * @throws {SyntaxError} If no valid JSON can be extracted
 */
export function parseJSONSafe(text) {
  // Try raw parse first (fast path)
  try {
    return JSON.parse(text)
  } catch {
    // Continue to extraction logic
  }

  // Strip markdown code fences if present
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  const fenceMatch = text.match(fencePattern)
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // Continue to bracket extraction
    }
  }

  // Extract the first JSON array [...] or object {...} from the text
  const firstBracket = findOuterJSON(text, '[', ']')
  if (firstBracket !== null) {
    try {
      return JSON.parse(firstBracket)
    } catch {
      // Continue
    }
  }

  const firstBrace = findOuterJSON(text, '{', '}')
  if (firstBrace !== null) {
    try {
      return JSON.parse(firstBrace)
    } catch {
      // Continue
    }
  }

  // Nothing worked, throw with the original error
  throw new SyntaxError(`Failed to extract valid JSON from response: ${text.slice(0, 200)}`)
}

/**
 * Find the outermost balanced JSON structure starting with `open` and ending with `close`.
 *
 * @param {string} text - Input text
 * @param {string} open - Opening character ('[' or '{')
 * @param {string} close - Closing character (']' or '}')
 * @returns {string|null} The extracted substring or null
 */
function findOuterJSON(text, open, close) {
  const start = text.indexOf(open)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}
