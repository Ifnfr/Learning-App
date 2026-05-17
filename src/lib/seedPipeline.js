/**
 * Seed submission pipeline for SIMAK Study OS.
 * Handles the full lifecycle: parse -> build -> autoMetadata -> dual-pass validate -> save -> variate.
 */

import { callAI, callValidate } from './api'
import { saveToIDB } from './storage'
import { parseJSONSafe } from './parseJSON'
import { parseSeedMarkdown, validateSeed } from './seedParser'
import {
  SEED_DUAL_PASS_SYSTEM,
  SEED_AUTO_METADATA_SYSTEM,
  SEED_VARIATION_SYSTEM,
} from './prompts'

/**
 * Construct a full seed object from parsed markdown data.
 *
 * @param {object} parsed - Output from parseSeedMarkdown
 * @param {object} [overrides] - Optional field overrides
 * @returns {object} Complete seed object ready for storage
 */
export function buildSeedObject(parsed, overrides = {}) {
  const meta = parsed.metadata || {}
  const subject = meta.subject || overrides.subject || 'unknown'
  const dateStr = meta.date_posted || new Date().toISOString().slice(0, 10)
  const subjectCode = getSubjectCode(subject)
  const id = meta.id || `${dateStr}-${subjectCode}-${String(Date.now()).slice(-4)}`

  return {
    id,
    subject,
    topic: meta.topic || overrides.topic || '',
    difficulty: meta.difficulty || overrides.difficulty || null,
    source: meta.source || overrides.source || '',
    date_posted: dateStr,
    question: parsed.question,
    options: parsed.options,
    answer: parsed.answer,
    explanation: parsed.explanation,
    trap: parsed.trap || null,
    type: 'seed_real',
    trustScore: 1.0,
    verified: false,
    flagCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Get short subject code from full subject name.
 */
function getSubjectCode(subject) {
  const map = {
    matematika: 'mat',
    tpa: 'tpa',
    bahasa_inggris: 'eng',
    bahasa_indonesia: 'ind',
  }
  return map[subject] || subject.slice(0, 3)
}

/**
 * Auto-fill missing metadata (difficulty, topic) using AI.
 *
 * @param {object} seedObj - Seed object (may have null difficulty/topic)
 * @returns {Promise<object>} Updated seed object with difficulty and topic filled
 */
export async function autoMetadata(seedObj) {
  if (seedObj.difficulty && seedObj.topic) {
    return seedObj
  }

  const userContent = [
    `Subject: ${seedObj.subject}`,
    `Question: ${seedObj.question}`,
    `Options: ${JSON.stringify(seedObj.options)}`,
    `Answer: ${seedObj.answer}`,
  ].join('\n')

  try {
    const response = await callAI({
      task: 'metadata',
      system: SEED_AUTO_METADATA_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 256,
      temperature: 0.3,
    })

    const result = parseJSONSafe(response)

    if (!seedObj.difficulty && result.difficulty) {
      seedObj.difficulty = Math.max(800, Math.min(1800, result.difficulty))
    }
    if (!seedObj.topic && result.topic) {
      seedObj.topic = result.topic
    }
  } catch (err) {
    console.warn('[seedPipeline] autoMetadata failed:', err.message)
  }

  return seedObj
}

/**
 * Dual-pass validation: AI solves the question independently, then we compare.
 *
 * @param {object} seedObj - Complete seed object with question, options, answer
 * @returns {Promise<{ verified: boolean, claudeAnswer: string, mismatch: boolean, explanation: string }>}
 */
export async function dualPassValidate(seedObj) {
  const userContent = [
    `Subject: ${seedObj.subject}`,
    `Question: ${seedObj.question}`,
    `Options:`,
    ...Object.entries(seedObj.options).map(([k, v]) => `${k}. ${v}`),
  ].join('\n')

  try {
    // Pass 1: AI solves from scratch (no answer key provided)
    const response = await callAI({
      task: 'dual_pass',
      system: SEED_DUAL_PASS_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 512,
      temperature: 0.2,
    })

    const result = parseJSONSafe(response)
    const claudeAnswer = (result.answer || '').toUpperCase().trim()
    const providedAnswer = seedObj.answer.toUpperCase().trim()

    // Pass 2: Compare AI's answer vs provided key
    const mismatch = claudeAnswer !== providedAnswer
    const verified = !mismatch

    return {
      verified,
      claudeAnswer,
      mismatch,
      explanation: result.explanation || '',
    }
  } catch (err) {
    console.warn('[seedPipeline] dualPassValidate failed:', err.message)
    return {
      verified: false,
      claudeAnswer: '',
      mismatch: false,
      explanation: `Validation error: ${err.message}`,
    }
  }
}

/**
 * Generate a variation of a seed using a specific strategy.
 *
 * Strategies:
 * - numerical_swap: Change numbers/values while keeping same structure
 * - context_swap: Change the context/scenario while keeping same concept
 * - distractor_permute: Rearrange/replace distractors
 * - inverted_prompt: Ask the inverse question
 * - difficulty_ladder: Create easier or harder version
 *
 * @param {object} seedObj - Original seed object
 * @param {string} strategy - One of the 5 strategies
 * @returns {Promise<object>} Variation object with parentSeedId, variationStrategy, validatedBy
 */
export async function generateVariation(seedObj, strategy) {
  const strategies = [
    'numerical_swap',
    'context_swap',
    'distractor_permute',
    'inverted_prompt',
    'difficulty_ladder',
  ]

  if (!strategies.includes(strategy)) {
    throw new Error(`Invalid strategy: ${strategy}. Must be one of: ${strategies.join(', ')}`)
  }

  const strategyDescriptions = {
    numerical_swap: 'Change the numbers/values in the question while keeping the same mathematical structure and concept. The new answer should be different from the original.',
    context_swap: 'Change the real-world context or scenario of the question while keeping the same underlying concept and difficulty level.',
    distractor_permute: 'Keep the question and correct answer the same, but replace 2-3 of the incorrect options (distractors) with new plausible but wrong options.',
    inverted_prompt: 'Create an inverse version of the question. For example, if the original asks "find X given Y", the variation asks "find Y given X".',
    difficulty_ladder: 'Create a version that is one difficulty level higher. Add an extra step, combine with another concept, or increase numerical complexity.',
  }

  const seedMarkdown = formatSeedAsMarkdown(seedObj)
  const userContent = [
    `Strategy: ${strategy}`,
    `Description: ${strategyDescriptions[strategy]}`,
    '',
    `Original seed:`,
    seedMarkdown,
  ].join('\n')

  const response = await callAI({
    task: 'metadata',
    system: SEED_VARIATION_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 1500,
    temperature: 0.7,
  })

  // Parse the variation markdown from AI's response
  const variationParsed = parseSeedMarkdown(response)

  // Build variation object
  const variation = buildSeedObject(variationParsed, {
    id: `${seedObj.id}-var-${strategy.slice(0, 3)}-${Date.now()}`,
    subject: seedObj.subject,
    topic: seedObj.topic,
    type: 'seed_variation',
    parentSeedId: seedObj.id,
    variationStrategy: strategy,
    trustScore: 0.8,
    verified: false,
  })

  // Validate the variation
  try {
    const validation = await dualPassValidate(variation)
    variation.verified = validation.verified
    variation.validatedBy = validation.verified ? 'dual_pass_auto' : 'pending_review'
    if (validation.mismatch) {
      variation.flagCount = 1
      variation.validationNote = `AI answered ${validation.claudeAnswer}, key says ${variation.answer}`
    }
  } catch (err) {
    variation.validatedBy = 'validation_failed'
    console.warn('[seedPipeline] variation validation failed:', err.message)
  }

  return variation
}

/**
 * Format a seed object back into markdown format.
 */
function formatSeedAsMarkdown(seedObj) {
  const lines = [
    '---',
    `subject: ${seedObj.subject}`,
    `topic: ${seedObj.topic || ''}`,
    `difficulty: ${seedObj.difficulty || ''}`,
    '---',
    '',
    '# Soal',
    '',
    seedObj.question,
    '',
    '# Pilihan',
    '',
  ]

  for (const letter of ['A', 'B', 'C', 'D', 'E']) {
    if (seedObj.options[letter]) {
      lines.push(`${letter}. ${seedObj.options[letter]}`)
    }
  }

  lines.push('', '# Kunci', '', seedObj.answer, '', '# Pembahasan', '', seedObj.explanation)

  if (seedObj.trap) {
    lines.push('', '# Trap', '', seedObj.trap)
  }

  return lines.join('\n')
}

/**
 * Quality check wrapper that validates a built seed object.
 *
 * @param {object} seedObj - Built seed object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function qualityCheck(seedObj) {
  // Convert seed object back to parsed format for validation
  const parsed = {
    metadata: {
      subject: seedObj.subject,
      topic: seedObj.topic,
      difficulty: seedObj.difficulty,
      source: seedObj.source,
    },
    question: seedObj.question,
    options: seedObj.options,
    answer: seedObj.answer,
    explanation: seedObj.explanation,
    trap: seedObj.trap,
  }

  return validateSeed(parsed)
}

/**
 * Run the full seed submission pipeline.
 *
 * Flow: parse -> validate -> build -> autoMetadata -> dualPass -> save -> dispatch -> auto-variate
 *
 * @param {string} markdown - Raw seed markdown content
 * @param {function} dispatch - AppContext dispatch function
 * @param {object} [preferences] - User preferences (e.g. autoVariate, defaultStrategy)
 * @returns {Promise<object>} Result with seed, validation, and variation data
 */
export async function runSubmitPipeline(markdown, dispatch, preferences = {}) {
  const result = {
    success: false,
    seed: null,
    validation: null,
    variations: [],
    errors: [],
  }

  // Step 1: Parse
  const parsed = parseSeedMarkdown(markdown)

  // Step 2: Quality check on parsed data
  const qc = validateSeed(parsed)
  if (!qc.valid) {
    result.errors = qc.errors
    return result
  }

  // Step 3: Build seed object
  let seedObj = buildSeedObject(parsed)

  // Step 4: Auto-fill metadata if missing
  seedObj = await autoMetadata(seedObj)

  // Step 5: Dual-pass validation
  let validation = { verified: false, claudeAnswer: '', mismatch: false, explanation: '' }
  validation = await dualPassValidate(seedObj)
  seedObj.verified = validation.verified
  if (validation.mismatch) {
    seedObj.flagCount = (seedObj.flagCount || 0) + 1
  }
  result.validation = validation

  // Step 6: Save to IndexedDB
  try {
    await saveToIDB('seedBank', seedObj)
  } catch (err) {
    console.warn('[seedPipeline] Failed to save seed:', err.message)
  }

  // Step 7: Dispatch actions
  if (dispatch) {
    dispatch({ type: 'ADD_SEED' })
    if (validation.verified) {
      dispatch({ type: 'RESOLVE_SEED_FLAG' })
    }
  }

  result.seed = seedObj
  result.success = true

  // Step 8: Auto-generate variation if preferences allow
  if (preferences.autoVariate !== false) {
    const strategy = preferences.defaultStrategy || 'numerical_swap'
    try {
      const variation = await generateVariation(seedObj, strategy)
      await saveToIDB('variations', variation)
      if (dispatch) {
        dispatch({ type: 'ADD_VARIATION' })
      }
      result.variations.push(variation)
    } catch (err) {
      console.warn('[seedPipeline] Auto-variation failed:', err.message)
    }
  }

  return result
}
