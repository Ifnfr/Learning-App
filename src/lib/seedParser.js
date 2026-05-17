/**
 * Seed markdown parser and validator for SIMAK Study OS.
 * Parses the seed markdown format (YAML frontmatter + H1 sections)
 * into structured objects and validates quality heuristics.
 */

/**
 * Parse a simple YAML string into a key-value object.
 * Supports types: bool (true/false), int (numeric), string (with or without quotes).
 * Handles multi-line values with | pipe indicator.
 *
 * @param {string} yamlStr - Raw YAML content (without --- delimiters)
 * @returns {object} Parsed key-value pairs
 */
export function parseSimpleYAML(yamlStr) {
  const result = {}
  const lines = yamlStr.split('\n')
  let currentKey = null
  let multiLineValue = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // If we're collecting multi-line value
    if (multiLineValue !== null) {
      // Multi-line continues while indented (at least 2 spaces)
      if (line.match(/^\s{2,}/) || (line.trim() !== '' && currentKey && !line.includes(':'))) {
        multiLineValue += (multiLineValue ? '\n' : '') + line.trimStart()
        continue
      } else {
        // End of multi-line
        result[currentKey] = multiLineValue.trim()
        multiLineValue = null
        currentKey = null
      }
    }

    // Skip empty lines and comments
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Parse key: value
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()

    // Strip inline comments (but not inside strings)
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const commentIdx = value.indexOf('#')
      if (commentIdx > 0) {
        value = value.slice(0, commentIdx).trim()
      }
    }

    // Check for multi-line pipe indicator
    if (value === '|') {
      currentKey = key
      multiLineValue = ''
      continue
    }

    // Parse value type
    result[key] = parseYAMLValue(value)
    currentKey = key
  }

  // Handle trailing multi-line value
  if (multiLineValue !== null && currentKey) {
    result[currentKey] = multiLineValue.trim()
  }

  return result
}

/**
 * Parse a single YAML value into its appropriate JS type.
 */
function parseYAMLValue(value) {
  if (value === '' || value === 'null' || value === '~') return null
  if (value === 'true') return true
  if (value === 'false') return false

  // Strip quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  // Try integer/float
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)

  return value
}

/**
 * Extract frontmatter content between --- delimiters.
 *
 * @param {string} markdown - Full markdown string
 * @returns {{ frontmatter: string, body: string }} Frontmatter YAML and remaining body
 */
export function extractFrontmatter(markdown) {
  const lines = markdown.split('\n')
  let firstDelim = -1
  let secondDelim = -1

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (firstDelim === -1) {
        firstDelim = i
      } else {
        secondDelim = i
        break
      }
    }
  }

  if (firstDelim === -1 || secondDelim === -1) {
    return { frontmatter: '', body: markdown }
  }

  const frontmatter = lines.slice(firstDelim + 1, secondDelim).join('\n')
  const body = lines.slice(secondDelim + 1).join('\n')

  return { frontmatter, body }
}

/**
 * Parse a full seed markdown file into a structured object.
 *
 * @param {string} markdown - Full seed markdown content
 * @returns {object} Structured seed: { metadata, question, options, answer, explanation, trap }
 */
export function parseSeedMarkdown(markdown) {
  const { frontmatter, body } = extractFrontmatter(markdown)
  const metadata = parseSimpleYAML(frontmatter)

  // Split body by H1 sections
  const sections = {}
  const sectionRegex = /^# (.+)$/gm
  const matches = []
  let match

  while ((match = sectionRegex.exec(body)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index, headerLength: match[0].length })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].headerLength
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length
    const content = body.slice(start, end).trim()
    sections[matches[i].title.toLowerCase()] = content
  }

  // Parse options from Pilihan section
  const options = {}
  const pilihanContent = sections['pilihan'] || ''
  const optionLetters = ['A', 'B', 'C', 'D', 'E']

  for (let i = 0; i < optionLetters.length; i++) {
    const letter = optionLetters[i]
    // Build a regex that captures from "X. " until the next option letter line or end of section
    const nextLetters = optionLetters.slice(i + 1)
    let pattern
    if (nextLetters.length > 0) {
      // Capture everything from "X. " until a line starting with the next option letter
      pattern = new RegExp(`^${letter}\\.\\s*([\\s\\S]*?)(?=^[${nextLetters.join('')}]\\.\\s)`, 'm')
    } else {
      // Last option: capture everything from "X. " to end
      pattern = new RegExp(`^${letter}\\.\\s*([\\s\\S]*)$`, 'm')
    }
    const optMatch = pilihanContent.match(pattern)
    if (optMatch) {
      options[letter] = optMatch[1].trim()
    }
  }

  // Extract answer from Kunci section (first letter A-E found)
  const kunciContent = sections['kunci'] || ''
  const answerMatch = kunciContent.match(/[A-E]/)
  const answer = answerMatch ? answerMatch[0] : ''

  return {
    metadata,
    question: sections['soal'] || '',
    options,
    answer,
    explanation: sections['pembahasan'] || '',
    trap: sections['trap'] || null,
  }
}

/**
 * Validate a parsed seed object for quality.
 *
 * @param {object} parsed - Output from parseSeedMarkdown
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSeed(parsed) {
  const errors = []

  // Required sections
  if (!parsed.question || parsed.question.trim() === '') {
    errors.push('Missing required section: Soal (question)')
  }
  if (!parsed.options || Object.keys(parsed.options).length === 0) {
    errors.push('Missing required section: Pilihan (options)')
  }
  if (!parsed.answer) {
    errors.push('Missing required section: Kunci (answer)')
  }
  if (!parsed.explanation || parsed.explanation.trim() === '') {
    errors.push('Missing required section: Pembahasan (explanation)')
  }

  // Options A-E all present with content
  const optionLetters = ['A', 'B', 'C', 'D', 'E']
  for (const letter of optionLetters) {
    if (!parsed.options || !parsed.options[letter] || parsed.options[letter].trim() === '') {
      errors.push(`Option ${letter} is missing or empty`)
    }
  }

  // Answer is valid letter A-E
  if (parsed.answer && !optionLetters.includes(parsed.answer)) {
    errors.push(`Answer "${parsed.answer}" is not a valid option (A-E)`)
  }

  // Question length 10-1500 chars
  if (parsed.question) {
    const qLen = parsed.question.trim().length
    if (qLen < 10) {
      errors.push(`Question too short (${qLen} chars, minimum 10)`)
    }
    if (qLen > 1500) {
      errors.push(`Question too long (${qLen} chars, maximum 1500)`)
    }
  }

  // Each option length 1-300 chars
  if (parsed.options) {
    for (const letter of optionLetters) {
      if (parsed.options[letter]) {
        const optLen = parsed.options[letter].trim().length
        if (optLen < 1) {
          errors.push(`Option ${letter} is empty`)
        }
        if (optLen > 300) {
          errors.push(`Option ${letter} too long (${optLen} chars, maximum 300)`)
        }
      }
    }
  }

  // Difficulty (if present in metadata) capped 800-1800
  if (parsed.metadata && parsed.metadata.difficulty != null) {
    const diff = parsed.metadata.difficulty
    if (typeof diff === 'number' && (diff < 800 || diff > 1800)) {
      errors.push(`Difficulty ${diff} out of range (must be 800-1800)`)
    }
  }

  // LaTeX balanced (count of $ chars is even)
  const fullText = [
    parsed.question || '',
    ...Object.values(parsed.options || {}),
    parsed.explanation || '',
    parsed.trap || '',
  ].join(' ')
  const dollarCount = (fullText.match(/\$/g) || []).length
  if (dollarCount % 2 !== 0) {
    errors.push(`Unbalanced LaTeX: found ${dollarCount} $ signs (should be even)`)
  }

  // No duplicate options
  if (parsed.options) {
    const values = Object.values(parsed.options).map(v => v.trim().toLowerCase())
    const unique = new Set(values)
    if (unique.size < values.length) {
      errors.push('Duplicate options detected')
    }
  }

  return { valid: errors.length === 0, errors }
}
