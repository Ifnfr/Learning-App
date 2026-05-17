import { v4 as uuidv4 } from 'uuid';

// ─── Schema whitelist for import validation ─────────────────────────────────

const SCHEMA = {
  user_state: ['id', 'state_json', 'updated_at'],
  seeds: ['id', 'subject', 'topic', 'difficulty', 'question', 'options_json', 'answer', 'explanation', 'trap', 'source', 'date_posted', 'verified', 'flag_count', 'created_at'],
  variations: ['id', 'parent_seed_id', 'strategy', 'subject', 'topic', 'difficulty', 'question', 'options_json', 'answer', 'explanation', 'validated_by', 'flag_count', 'created_at'],
  mistakes: ['id', 'subject', 'topic', 'question', 'options_json', 'user_answer', 'correct_answer', 'explanation', 'error_category', 'confidence', 'retry_count', 'consecutive_correct', 'mastered', 'note', 'created_at'],
  drill_history: ['id', 'mode', 'question_count', 'score', 'accuracy', 'timestamp', 'elo_deltas_json', 'error_breakdown_json', 'questions_json'],
  mock_history: ['id', 'size', 'score', 'total_questions', 'accuracy', 'duration', 'timestamp', 'subject_breakdown_json', 'questions_json', 'distribution_json'],
  sr_items: ['id', 'subject', 'topic', 'prompt', 'answer', 'next_review', 'interval_days', 'ease', 'lapses', 'quality_history_json', 'created_at'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function paginate(db, baseQuery, countQuery, params, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get(...Object.values(params));
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all(...Object.values(params), limit, offset);
  return {
    data,
    pagination: { page, limit, total, totalPages },
  };
}

function parseJsonFields(row, fields) {
  if (!row) return row;
  for (const field of fields) {
    if (row[field] && typeof row[field] === 'string') {
      try {
        row[field] = JSON.parse(row[field]);
      } catch {
        // leave as string if not valid JSON
      }
    }
  }
  return row;
}

function parseJsonFieldsArray(rows, fields) {
  return rows.map((row) => parseJsonFields(row, fields));
}

// ─── user_state ─────────────────────────────────────────────────────────────

export function getState(db) {
  const row = db.prepare('SELECT state_json FROM user_state WHERE id = 1').get();
  if (!row) return {};
  try {
    return JSON.parse(row.state_json);
  } catch {
    return {};
  }
}

export function updateState(db, partialState) {
  const current = getState(db);
  const merged = { ...current, ...partialState };
  const json = JSON.stringify(merged);
  const existing = db.prepare('SELECT id FROM user_state WHERE id = 1').get();
  if (existing) {
    db.prepare("UPDATE user_state SET state_json = ?, updated_at = datetime('now') WHERE id = 1").run(json);
  } else {
    db.prepare("INSERT INTO user_state (id, state_json, updated_at) VALUES (1, ?, datetime('now'))").run(json);
  }
  return merged;
}

// ─── seeds ──────────────────────────────────────────────────────────────────

export function listSeeds(db, { page = 1, limit = 20, subject, topic } = {}) {
  let where = 'WHERE 1=1';
  const params = {};
  if (subject) {
    where += ' AND subject = @subject';
    params.subject = subject;
  }
  if (topic) {
    where += ' AND topic = @topic';
    params.topic = topic;
  }

  const countQuery = `SELECT COUNT(*) as total FROM seeds ${where}`;
  const baseQuery = `SELECT * FROM seeds ${where} ORDER BY created_at DESC`;

  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get(params);
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset });

  return {
    data: parseJsonFieldsArray(data, ['options_json']),
    pagination: { page, limit, total, totalPages },
  };
}

export function createSeed(db, seed) {
  const id = seed.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO seeds (id, subject, topic, difficulty, question, options_json, answer, explanation, trap, source, date_posted, verified, flag_count)
    VALUES (@id, @subject, @topic, @difficulty, @question, @options_json, @answer, @explanation, @trap, @source, @date_posted, @verified, @flag_count)
  `);
  stmt.run({
    id,
    subject: seed.subject,
    topic: seed.topic,
    difficulty: seed.difficulty ?? null,
    question: seed.question,
    options_json: typeof seed.options_json === 'string' ? seed.options_json : JSON.stringify(seed.options_json),
    answer: seed.answer,
    explanation: seed.explanation ?? null,
    trap: seed.trap ?? null,
    source: seed.source ?? null,
    date_posted: seed.date_posted ?? null,
    verified: seed.verified ?? 0,
    flag_count: seed.flag_count ?? 0,
  });
  return { id };
}

export function updateSeed(db, id, data) {
  const fields = [];
  const params = { id };
  const allowed = ['subject', 'topic', 'difficulty', 'question', 'options_json', 'answer', 'explanation', 'trap', 'source', 'date_posted', 'verified', 'flag_count'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      let value = data[key];
      if (key === 'options_json' && typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }
  if (fields.length === 0) return null;
  db.prepare(`UPDATE seeds SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return { id };
}

export function deleteSeed(db, id) {
  const result = db.prepare('DELETE FROM seeds WHERE id = ?').run(id);
  return { deleted: result.changes > 0 };
}

// ─── variations ─────────────────────────────────────────────────────────────

export function listVariations(db, { page = 1, limit = 20, parent_seed_id } = {}) {
  let where = 'WHERE 1=1';
  const params = {};
  if (parent_seed_id) {
    where += ' AND parent_seed_id = @parent_seed_id';
    params.parent_seed_id = parent_seed_id;
  }

  const countQuery = `SELECT COUNT(*) as total FROM variations ${where}`;
  const baseQuery = `SELECT * FROM variations ${where} ORDER BY created_at DESC`;

  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get(params);
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset });

  return {
    data: parseJsonFieldsArray(data, ['options_json']),
    pagination: { page, limit, total, totalPages },
  };
}

export function createVariation(db, variation) {
  const id = variation.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO variations (id, parent_seed_id, strategy, subject, topic, difficulty, question, options_json, answer, explanation, validated_by, flag_count)
    VALUES (@id, @parent_seed_id, @strategy, @subject, @topic, @difficulty, @question, @options_json, @answer, @explanation, @validated_by, @flag_count)
  `);
  stmt.run({
    id,
    parent_seed_id: variation.parent_seed_id,
    strategy: variation.strategy ?? null,
    subject: variation.subject,
    topic: variation.topic,
    difficulty: variation.difficulty ?? null,
    question: variation.question,
    options_json: typeof variation.options_json === 'string' ? variation.options_json : JSON.stringify(variation.options_json),
    answer: variation.answer,
    explanation: variation.explanation ?? null,
    validated_by: variation.validated_by ?? null,
    flag_count: variation.flag_count ?? 0,
  });
  return { id };
}

export function deleteVariation(db, id) {
  const result = db.prepare('DELETE FROM variations WHERE id = ?').run(id);
  return { deleted: result.changes > 0 };
}

// ─── mistakes ───────────────────────────────────────────────────────────────

export function listMistakes(db, { page = 1, limit = 20, mastered, subject } = {}) {
  let where = 'WHERE 1=1';
  const params = {};
  if (mastered !== undefined) {
    where += ' AND mastered = @mastered';
    params.mastered = mastered ? 1 : 0;
  }
  if (subject) {
    where += ' AND subject = @subject';
    params.subject = subject;
  }

  const countQuery = `SELECT COUNT(*) as total FROM mistakes ${where}`;
  const baseQuery = `SELECT * FROM mistakes ${where} ORDER BY created_at DESC`;

  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get(params);
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset });

  return {
    data: parseJsonFieldsArray(data, ['options_json']),
    pagination: { page, limit, total, totalPages },
  };
}

export function createMistake(db, mistake) {
  const id = mistake.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO mistakes (id, subject, topic, question, options_json, user_answer, correct_answer, explanation, error_category, confidence, retry_count, consecutive_correct, mastered, note)
    VALUES (@id, @subject, @topic, @question, @options_json, @user_answer, @correct_answer, @explanation, @error_category, @confidence, @retry_count, @consecutive_correct, @mastered, @note)
  `);
  stmt.run({
    id,
    subject: mistake.subject,
    topic: mistake.topic,
    question: mistake.question,
    options_json: mistake.options_json ? (typeof mistake.options_json === 'string' ? mistake.options_json : JSON.stringify(mistake.options_json)) : null,
    user_answer: mistake.user_answer ?? null,
    correct_answer: mistake.correct_answer ?? null,
    explanation: mistake.explanation ?? null,
    error_category: mistake.error_category ?? null,
    confidence: mistake.confidence ?? null,
    retry_count: mistake.retry_count ?? 0,
    consecutive_correct: mistake.consecutive_correct ?? 0,
    mastered: mistake.mastered ?? 0,
    note: mistake.note ?? null,
  });
  return { id };
}

export function updateMistake(db, id, data) {
  const fields = [];
  const params = { id };
  const allowed = ['subject', 'topic', 'question', 'options_json', 'user_answer', 'correct_answer', 'explanation', 'error_category', 'confidence', 'retry_count', 'consecutive_correct', 'mastered', 'note'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      let value = data[key];
      if (key === 'options_json' && typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }
  if (fields.length === 0) return null;
  db.prepare(`UPDATE mistakes SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return { id };
}

export function deleteMistake(db, id) {
  const result = db.prepare('DELETE FROM mistakes WHERE id = ?').run(id);
  return { deleted: result.changes > 0 };
}

// ─── drill_history ──────────────────────────────────────────────────────────

export function listDrills(db, { page = 1, limit = 20 } = {}) {
  const countQuery = 'SELECT COUNT(*) as total FROM drill_history';
  const baseQuery = 'SELECT * FROM drill_history ORDER BY timestamp DESC';

  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get();
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all(limit, offset);

  return {
    data: parseJsonFieldsArray(data, ['elo_deltas_json', 'error_breakdown_json', 'questions_json']),
    pagination: { page, limit, total, totalPages },
  };
}

export function createDrill(db, drill) {
  const id = drill.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO drill_history (id, mode, question_count, score, accuracy, timestamp, elo_deltas_json, error_breakdown_json, questions_json)
    VALUES (@id, @mode, @question_count, @score, @accuracy, @timestamp, @elo_deltas_json, @error_breakdown_json, @questions_json)
  `);
  stmt.run({
    id,
    mode: drill.mode ?? null,
    question_count: drill.question_count ?? null,
    score: drill.score ?? null,
    accuracy: drill.accuracy ?? null,
    timestamp: drill.timestamp || new Date().toISOString(),
    elo_deltas_json: drill.elo_deltas_json ? (typeof drill.elo_deltas_json === 'string' ? drill.elo_deltas_json : JSON.stringify(drill.elo_deltas_json)) : null,
    error_breakdown_json: drill.error_breakdown_json ? (typeof drill.error_breakdown_json === 'string' ? drill.error_breakdown_json : JSON.stringify(drill.error_breakdown_json)) : null,
    questions_json: drill.questions_json ? (typeof drill.questions_json === 'string' ? drill.questions_json : JSON.stringify(drill.questions_json)) : null,
  });
  return { id };
}

// ─── mock_history ───────────────────────────────────────────────────────────

export function listMocks(db, { page = 1, limit = 20 } = {}) {
  const countQuery = 'SELECT COUNT(*) as total FROM mock_history';
  const baseQuery = 'SELECT * FROM mock_history ORDER BY timestamp DESC';

  const offset = (page - 1) * limit;
  const totalRow = db.prepare(countQuery).get();
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / limit);
  const data = db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).all(limit, offset);

  return {
    data: parseJsonFieldsArray(data, ['subject_breakdown_json', 'questions_json', 'distribution_json']),
    pagination: { page, limit, total, totalPages },
  };
}

export function createMock(db, mock) {
  const id = mock.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO mock_history (id, size, score, total_questions, accuracy, duration, timestamp, subject_breakdown_json, questions_json, distribution_json)
    VALUES (@id, @size, @score, @total_questions, @accuracy, @duration, @timestamp, @subject_breakdown_json, @questions_json, @distribution_json)
  `);
  stmt.run({
    id,
    size: mock.size ?? null,
    score: mock.score ?? null,
    total_questions: mock.total_questions ?? null,
    accuracy: mock.accuracy ?? null,
    duration: mock.duration ?? null,
    timestamp: mock.timestamp || new Date().toISOString(),
    subject_breakdown_json: mock.subject_breakdown_json ? (typeof mock.subject_breakdown_json === 'string' ? mock.subject_breakdown_json : JSON.stringify(mock.subject_breakdown_json)) : null,
    questions_json: mock.questions_json ? (typeof mock.questions_json === 'string' ? mock.questions_json : JSON.stringify(mock.questions_json)) : null,
    distribution_json: mock.distribution_json ? (typeof mock.distribution_json === 'string' ? mock.distribution_json : JSON.stringify(mock.distribution_json)) : null,
  });
  return { id };
}

// ─── sr_items ───────────────────────────────────────────────────────────────

export function listSRItems(db, { page = 1, limit = 5000 } = {}) {
  const offset = (page - 1) * limit;
  const safeLimit = Math.min(limit, 5000);
  const data = db.prepare('SELECT * FROM sr_items ORDER BY next_review ASC LIMIT ? OFFSET ?').all(safeLimit, offset);
  const totalRow = db.prepare('SELECT COUNT(*) as total FROM sr_items').get();
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / safeLimit);
  return {
    data: parseJsonFieldsArray(data, ['quality_history_json']),
    pagination: { page, limit: safeLimit, total, totalPages },
  };
}

export function createSRItem(db, item) {
  const id = item.id || uuidv4();
  const stmt = db.prepare(`
    INSERT INTO sr_items (id, subject, topic, prompt, answer, next_review, interval_days, ease, lapses, quality_history_json)
    VALUES (@id, @subject, @topic, @prompt, @answer, @next_review, @interval_days, @ease, @lapses, @quality_history_json)
  `);
  stmt.run({
    id,
    subject: item.subject,
    topic: item.topic,
    prompt: item.prompt ?? null,
    answer: item.answer ?? null,
    next_review: item.next_review ?? null,
    interval_days: item.interval_days ?? 0,
    ease: item.ease ?? 2.5,
    lapses: item.lapses ?? 0,
    quality_history_json: item.quality_history_json ? (typeof item.quality_history_json === 'string' ? item.quality_history_json : JSON.stringify(item.quality_history_json)) : null,
  });
  return { id };
}

export function updateSRItem(db, id, data) {
  const fields = [];
  const params = { id };
  const allowed = ['subject', 'topic', 'prompt', 'answer', 'next_review', 'interval_days', 'ease', 'lapses', 'quality_history_json'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      let value = data[key];
      if (key === 'quality_history_json' && typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }
  if (fields.length === 0) return null;
  db.prepare(`UPDATE sr_items SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return { id };
}

export function deleteSRItem(db, id) {
  const result = db.prepare('DELETE FROM sr_items WHERE id = ?').run(id);
  return { deleted: result.changes > 0 };
}

// ─── export/import ──────────────────────────────────────────────────────────

export function exportAll(db) {
  const tables = ['user_state', 'seeds', 'variations', 'mistakes', 'drill_history', 'mock_history', 'sr_items'];
  const result = {};
  for (const table of tables) {
    result[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  return result;
}

export function importAll(db, data) {
  const tables = ['user_state', 'seeds', 'variations', 'mistakes', 'drill_history', 'mock_history', 'sr_items'];

  // Pre-check: validate that all provided table entries are valid arrays before deleting anything
  for (const table of tables) {
    if (data[table] !== undefined && !Array.isArray(data[table])) {
      throw new Error(`Table "${table}" must be an array, got ${typeof data[table]}`);
    }
  }

  const importTransaction = db.transaction((importData) => {
    // Clear all tables in reverse order (respect FK constraints)
    db.prepare('DELETE FROM variations').run();
    db.prepare('DELETE FROM sr_items').run();
    db.prepare('DELETE FROM mock_history').run();
    db.prepare('DELETE FROM drill_history').run();
    db.prepare('DELETE FROM mistakes').run();
    db.prepare('DELETE FROM seeds').run();
    db.prepare('DELETE FROM user_state').run();

    for (const table of tables) {
      if (!importData[table] || !Array.isArray(importData[table])) continue;
      const allowedColumns = SCHEMA[table];
      if (!allowedColumns) continue;

      for (const row of importData[table]) {
        // Filter to only allowed columns
        const columns = Object.keys(row).filter((c) => allowedColumns.includes(c));
        if (columns.length === 0) continue;
        const placeholders = columns.map((c) => `@${c}`).join(', ');
        const filteredRow = {};
        for (const c of columns) {
          filteredRow[c] = row[c];
        }
        db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(filteredRow);
      }
    }
  });

  importTransaction(data);
  return { success: true };
}
