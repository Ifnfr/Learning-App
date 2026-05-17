/**
 * Core learning algorithms: SM-2 spaced repetition, ELO rating,
 * streak tracking, and calibration scoring.
 */

/**
 * SM-2 Algorithm: Calculate the next review date based on performance.
 * @param {object} card - Card with fields: easeFactor, interval, repetitions
 * @param {number} quality - Response quality (0-5 scale)
 * @returns {object} Updated card with new interval, easeFactor, repetitions, nextReview
 */
export function calculateNextReview(card, quality) {
  let { easeFactor = 2.5, interval = 0, repetitions = 0 } = card

  if (quality < 3) {
    // Reset on failure
    repetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: new Date().toISOString(),
  }
}

/**
 * ELO rating update for student skill estimation.
 * Compares student rating vs. problem difficulty rating.
 * @param {number} studentRating - Current student ELO rating
 * @param {number} problemRating - Problem difficulty rating
 * @param {boolean} correct - Whether the student answered correctly
 * @param {number} kFactor - K-factor for update magnitude (default: 32)
 * @returns {number} Updated student rating
 */
export function updateElo(studentRating, problemRating, correct, kFactor = 32) {
  const expected = 1 / (1 + Math.pow(10, (problemRating - studentRating) / 400))
  const actual = correct ? 1 : 0
  return Math.round(studentRating + kFactor * (actual - expected))
}

/**
 * Update streak counter based on daily activity.
 * @param {object} streakData - { current, longest, lastActiveDate }
 * @returns {object} Updated streak data
 */
export function updateStreak(streakData) {
  const today = new Date().toISOString().split('T')[0]
  const { current = 0, longest = 0, lastActiveDate = null } = streakData

  if (lastActiveDate === today) {
    // Already active today, no change
    return streakData
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newCurrent
  if (lastActiveDate === yesterdayStr) {
    newCurrent = current + 1
  } else {
    newCurrent = 1
  }

  return {
    current: newCurrent,
    longest: Math.max(longest, newCurrent),
    lastActiveDate: today,
  }
}

/**
 * Brier score for calibration measurement.
 * Measures how well a student's confidence matches their actual performance.
 * Lower is better (0 = perfect calibration).
 * @param {number} confidence - Stated confidence (0-1)
 * @param {boolean} correct - Whether the answer was correct
 * @returns {number} Brier score for this prediction
 */
export function brierScore(confidence, correct) {
  const outcome = correct ? 1 : 0
  return Math.pow(confidence - outcome, 2)
}

/**
 * Convert ELO rating to a human-readable skill label.
 * @param {number} elo - ELO rating value
 * @returns {string} Skill level label
 */
export function eloToLabel(elo) {
  if (elo < 800) return 'Beginner'
  if (elo < 1000) return 'Developing'
  if (elo < 1200) return 'Competent'
  if (elo < 1400) return 'Proficient'
  if (elo < 1600) return 'Advanced'
  return 'Expert'
}

/**
 * Assess calibration quality based on accumulated Brier scores.
 * @param {number} averageBrier - Average Brier score across predictions
 * @returns {string} Calibration quality label
 */
export function calibrationLabel(averageBrier) {
  if (averageBrier < 0.1) return 'Excellent'
  if (averageBrier < 0.2) return 'Good'
  if (averageBrier < 0.3) return 'Fair'
  if (averageBrier < 0.4) return 'Needs Improvement'
  return 'Poor'
}
