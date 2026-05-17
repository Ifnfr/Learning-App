/**
 * Validation utilities for seed content parsing and verification.
 * Handles markdown seed files, YAML-like frontmatter, and dual-pass validation.
 */

/**
 * Parse a seed markdown file into structured data.
 * Extracts frontmatter metadata and content sections.
 * @param {string} markdown - Raw markdown content of a seed file
 * @returns {object} Parsed seed with metadata and content sections
 */
export function parseSeedMarkdown(markdown) {
  const lines = markdown.split('\n')
  const result = {
    metadata: {},
    sections: [],
    raw: markdown,
  }

  let inFrontmatter = false
  let frontmatterLines = []
  let contentLines = []

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontmatter && frontmatterLines.length === 0) {
        inFrontmatter = true
        continue
      } else if (inFrontmatter) {
        inFrontmatter = false
        continue
      }
    }

    if (inFrontmatter) {
      frontmatterLines.push(line)
    } else {
      contentLines.push(line)
    }
  }

  result.metadata = parseSimpleYAML(frontmatterLines.join('\n'))
  result.sections = parseSections(contentLines.join('\n'))

  return result
}

/**
 * Parse simple YAML-like key: value pairs (single level, no nesting).
 * @param {string} yaml - YAML-like string content
 * @returns {object} Parsed key-value pairs
 */
export function parseSimpleYAML(yaml) {
  const result = {}
  const lines = yaml.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()

      // Handle arrays (simple comma-separated in brackets)
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((v) => v.trim())
      }

      result[key] = value
    }
  }

  return result
}

/**
 * Dual-pass validation: first structural, then semantic.
 * Pass 1: Check required fields, format conformance
 * Pass 2: Check content quality, cross-references
 * @param {object} seed - Parsed seed object
 * @returns {object} Validation result with pass/fail and issues array
 */
export function dualPassValidate(seed) {
  const issues = []

  // Pass 1: Structural validation
  const requiredFields = ['subject', 'topic', 'level']
  for (const field of requiredFields) {
    if (!seed.metadata[field]) {
      issues.push({ pass: 1, severity: 'error', message: `Missing required field: ${field}` })
    }
  }

  if (!seed.sections || seed.sections.length === 0) {
    issues.push({ pass: 1, severity: 'error', message: 'No content sections found' })
  }

  // Pass 2: Semantic validation
  if (seed.sections && seed.sections.length > 0) {
    for (const section of seed.sections) {
      if (section.content && section.content.length < 20) {
        issues.push({ pass: 2, severity: 'warning', message: `Section "${section.title}" has very short content` })
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  }
}

/**
 * Generate a variation of a problem/question for spaced repetition.
 * Changes surface details while preserving the underlying concept.
 * @param {object} original - Original problem object
 * @returns {object} Variation with modified surface details
 */
export function generateVariation(original) {
  // Placeholder - will be enhanced with Claude API calls
  return {
    ...original,
    id: `${original.id}-var-${Date.now()}`,
    isVariation: true,
    sourceId: original.id,
  }
}

// --- Internal helpers ---

function parseSections(content) {
  const sections = []
  const lines = content.split('\n')
  let currentSection = null

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: '',
      }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}
