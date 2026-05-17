export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const versionRow = db.prepare('SELECT version FROM schema_version WHERE id = 1').get();
  const currentVersion = versionRow ? versionRow.version : 0;

  if (!versionRow) {
    db.prepare('INSERT INTO schema_version (id, version) VALUES (1, 0)').run();
  }

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        state_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS seeds (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty INTEGER,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT,
        trap TEXT,
        source TEXT,
        date_posted TEXT,
        verified INTEGER DEFAULT 0,
        flag_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS variations (
        id TEXT PRIMARY KEY,
        parent_seed_id TEXT NOT NULL,
        strategy TEXT,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty INTEGER,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT,
        validated_by TEXT,
        flag_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_seed_id) REFERENCES seeds(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mistakes (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        question TEXT NOT NULL,
        options_json TEXT,
        user_answer TEXT,
        correct_answer TEXT,
        explanation TEXT,
        error_category TEXT,
        confidence REAL,
        retry_count INTEGER DEFAULT 0,
        consecutive_correct INTEGER DEFAULT 0,
        mastered INTEGER DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS drill_history (
        id TEXT PRIMARY KEY,
        mode TEXT,
        question_count INTEGER,
        score INTEGER,
        accuracy REAL,
        timestamp TEXT NOT NULL,
        elo_deltas_json TEXT,
        error_breakdown_json TEXT,
        questions_json TEXT
      );

      CREATE TABLE IF NOT EXISTS mock_history (
        id TEXT PRIMARY KEY,
        size TEXT,
        score INTEGER,
        total_questions INTEGER,
        accuracy REAL,
        duration INTEGER,
        timestamp TEXT NOT NULL,
        subject_breakdown_json TEXT,
        questions_json TEXT,
        distribution_json TEXT
      );

      CREATE TABLE IF NOT EXISTS sr_items (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        prompt TEXT,
        answer TEXT,
        next_review TEXT,
        interval_days INTEGER DEFAULT 0,
        ease REAL DEFAULT 2.5,
        lapses INTEGER DEFAULT 0,
        quality_history_json TEXT
      );
    `);

    db.prepare('UPDATE schema_version SET version = 1, updated_at = datetime(\'now\') WHERE id = 1').run();
  }
}
