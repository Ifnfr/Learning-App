# SIMAK Study OS — Blueprint Eksekusi v2.1
> Dokumen ini adalah spesifikasi lengkap untuk dieksekusi oleh Claude Opus via Kiro.
> **v2.1 (Mei 2026)** — Tambahan **Daily Seed module** dengan markdown-based question submission, source-aware question routing, dan hybrid variation pipeline.

---

## 0. RINGKASAN PERUBAHAN

### v2.1 → tambahan dari v2.0
- **Daily Seed module** (Modul 9 baru) — user submit soal asli SIMAK via file `.md`
- **Source-aware question routing** — setiap soal punya tag `seed_real` / `variation` / `pure_llm`
- **Hybrid variation pipeline** — 1 variasi auto saat submit, sisanya lazy on-demand
- **Mock Exam locked to seed bank** — gold standard, no LLM-only questions
- **Dual-pass validation** — solver pass cross-check generator pass (anti-hallucination)
- **Trust score per soal** — UI badge transparan ke user

### v2.0 → tambahan dari v1.0

| Area | v1.0 | v2.0 |
|---|---|---|
| Prinsip belajar | 4 (Active Recall, SR, Interleaving, Elaborative) | **8** (+ Pretesting, Generation Effect, Metacognitive Calibration, Desirable Difficulty) |
| Modul | 5 | **8** (+ Diagnostic, Mock Exam, Mistake Notebook) |
| Entry point | Dashboard 4-card | **Today Flow** unified, auto-prioritize |
| SM-2 | Binary (correct/wrong) | **Quality grading 0–5** (Anki-style) |
| Drill | Statis | **Adaptive (ELO-lite)** + confidence calibration |
| Concept Engine | Explain → Quiz | **Pretest → Explain → Feynman → Quiz** |
| Error handling | Dicatat | **Diklasifikasi** (konseptual/komputasi/trap/waktu) |
| Tanggal ujian | Hardcoded | Configurable di onboarding |
| Storage | localStorage saja | localStorage + **IndexedDB** untuk notebook |
| Navigasi | Emoji sidebar | **Lucide-style icon SVG inline**, monoline |
| Loading state | Spinner generik | **Microlearning tips** (riset belajar) |
| Streaming | Opsional | **Wajib** untuk concept explanation |
| Export/Import | Tidak ada | **JSON backup** built-in |
| Focus mode | Tidak ada | **Pomodoro-integrated focus sessions** |

---

## 1. META-INSTRUKSI UNTUK CLAUDE OPUS

Kamu akan membangun **SIMAK Study OS v2.0**, alat belajar intensif untuk persiapan SIMAK UI (4 mata uji: Matematika Dasar, TPA, Bahasa Inggris, Bahasa Indonesia).

### Prinsip Eksekusi

- **Single entry file** `App.jsx` — tapi boleh dibagi menjadi sub-komponen di file yang sama dengan struktur hirarkis yang jelas (gunakan komentar section divider `// ═══ SECTION ═══`).
- State global: `useReducer` + `Context API`. Persistensi: `localStorage` (state ringan) + `IndexedDB` (mistake notebook, drill history >100 entri).
- Anthropic API langsung dari frontend. **Model:** `claude-sonnet-4-5-20250929` (atau env var, fallback ke nilai ini).
- API key dari user (input di onboarding), simpan di localStorage dengan **warning eksplisit** soal risiko.
- **Streaming wajib** untuk concept explanation (gunakan `stream: true` di body request, parse SSE chunk per chunk).
- `max_tokens` dinamis: 1024 (concept), 2048 (Feynman feedback), 4096 (batch drill 20 soal), 8192 (mock exam 60 soal).
- Tailwind via CDN tetap diizinkan, tapi semua design token didefinisi di `:root` CSS variables agar dapat diganti.

### Tanggal Target

Tanggal ujian **TIDAK lagi hardcoded**. Saat onboarding pertama, user input tanggal ujian mereka. Simpan di `localStorage.simak_examDate`. Jika user punya banyak ujian (misal SIMAK D3 + S1), simpan array.

---

## 2. ARSITEKTUR APLIKASI

```
App
├── ThemeProvider (CSS vars + theme switch)
├── AppProvider (Context + reducer)
├── CommandPalette (Cmd+K) — global overlay
├── OnboardingFlow ← jika belum onboarded
│   ├── 1. Welcome
│   ├── 2. API Key + warning
│   ├── 3. Set tanggal ujian
│   ├── 4. Diagnostic Assessment (8 soal cepat)
│   └── 5. Generated study plan preview
└── AppShell (post-onboarding)
    ├── TopBar (search, focus mode toggle, streak indicator)
    ├── Sidebar (collapsible, icon-only mode)
    └── MainContent
        ├── TodayFlow         (Modul 1) ← default route
        ├── ConceptEngine     (Modul 2)
        ├── DrillMode         (Modul 3)
        ├── SpacedReview      (Modul 4)
        ├── MockExam          (Modul 5)
        ├── StudyPlanner      (Modul 6)
        ├── MistakeNotebook   (Modul 7)
        ├── DailySeed         (Modul 8) — submit & manage seed bank (NEW v2.1)
        └── Settings          (Modul 9) — API key, export/import, theme
```

---

## 3. FILOSOFI PEDAGOGIS — 8 PRINSIP

App ini dibangun di atas 8 prinsip belajar yang telah terbukti meta-analisis (Dunlosky et al. 2013, Bjork 2011, Roediger & Karpicke 2006).

| # | Prinsip | Implementasi di App |
|---|---|---|
| 1 | **Active Recall** | Semua interaksi berbasis menjawab/menulis, tak ada "baca pasif" |
| 2 | **Spaced Repetition** | SM-2 dengan quality grading 0–5 |
| 3 | **Interleaving** | Drill Mode mencampur subject/topic |
| 4 | **Elaborative Interrogation** | Penjelasan WHY, diakhiri pertanyaan Socratic |
| 5 | **Pretesting Effect** | Concept Engine tanya **sebelum** jelaskan (forward testing effect, Kornell 2014) |
| 6 | **Generation Effect** | Mode "User-Generated Question" — user buat soal sendiri, Claude review |
| 7 | **Metacognitive Calibration** | Confidence slider (0–100%) sebelum jawab; analisis gap confidence vs accuracy |
| 8 | **Desirable Difficulty** | Adaptive difficulty di Drill Mode + variasi format soal (mencegah konteks-bound learning) |

**Catatan filosofis:** App tidak akan pernah memberikan "easy mode". Kesulitan optimal adalah **75–85% accuracy zone** (Wilson et al. 2019, "85% Rule for Learning").

---

## 4. GLOBAL STATE & DATA MODEL

```javascript
const initialState = {
  // ─── Onboarding & Identity ───
  onboarded: false,
  apiKey: '',
  examDates: [],  // [{ id, name: 'SIMAK UI S1', date: '2025-06-14' }]
  primaryExamId: null,

  // ─── Navigation & UI ───
  activeModule: 'today',
  focusMode: false,
  theme: 'academic-dark',  // | 'academic-light' | 'parchment'
  sidebarCollapsed: false,

  // ─── Progress & Performance ───
  diagnosticResults: null,  // { matematika: 0.45, tpa: 0.30, ... }
  topicMastery: {},  // { 'matematika.logaritma': { elo: 1200, attempts: 8, lastSeen } }
  streak: 0,
  lastStudyDate: null,
  graceDayUsed: false,  // 1x grace per minggu, mencegah "streak anxiety"

  // ─── Spaced Repetition ───
  srQueue: [],
  // item: { id, subject, topic, prompt, answer, nextReview, interval, ease: 2.5,
  //         lapses: 0, qualityHistory: [4,3,5,...] }

  // ─── Drill & Mock Exam ───
  drillHistory: [],  // limited to 100 in localStorage; rest → IndexedDB
  mockExamHistory: [],

  // ─── Mistake Notebook ───
  mistakes: [],  // di IndexedDB; di state hanya count + recent 5
  // mistake: { id, subject, topic, question, options, userAnswer, correctAnswer,
  //            explanation, errorCategory, confidence, timestamp, retryCount, mastered }

  // ─── Confidence Calibration ───
  calibrationLog: [],  // { confidence, correct, timestamp, subject }

  // ─── Focus Sessions ───
  focusSessions: [],  // { startedAt, durationMin, taskType, completed }
  totalFocusMinutes: 0,

  // ─── Daily Seed Bank (NEW v2.1) ───
  // Note: full data di IndexedDB. State hanya menyimpan summary.
  seedStats: {
    totalSeeds: 0,           // jumlah seed_real
    totalVariations: 0,      // jumlah variation tersimpan
    seedsBySubject: { matematika: 0, tpa: 0, bahasa_inggris: 0, bahasa_indonesia: 0 },
    lastSeedDate: null,
    seedStreak: 0,           // streak harian submit (terpisah dari study streak)
    pendingValidation: 0,    // seed yang flagged karena dual-pass mismatch
  },

  // ─── Settings ───
  preferences: {
    pomodoroLength: 25,
    breakLength: 5,
    interleaveDefault: true,
    confidenceSlider: true,
    showStreakAnxiety: false,  // bisa di-disable jika user prefer "quiet mode"
    keyboardShortcuts: true,
    // Seed-related preferences (NEW v2.1)
    autoVariateOnSubmit: true,    // 1 variasi otomatis saat submit
    drillSeedRatio: 0.10,         // 10% drill = seed_real
    drillVariationRatio: 0.60,    // 60% drill = variation
    drillPureLLMRatio: 0.30,      // 30% drill = pure_llm
    showSourceBadge: true,        // tampilkan badge sumber soal di UI
  },
}
```

### Actions Reducer

```
SET_API_KEY, SET_THEME, TOGGLE_SIDEBAR, TOGGLE_FOCUS_MODE,
COMPLETE_ONBOARDING, ADD_EXAM_DATE, REMOVE_EXAM_DATE, SET_PRIMARY_EXAM,
SET_DIAGNOSTIC, UPDATE_TOPIC_MASTERY,
ADD_SR_ITEM, REVIEW_SR_ITEM (payload: { id, quality }),
LOG_DRILL, LOG_MOCK_EXAM,
ADD_MISTAKE, MARK_MISTAKE_MASTERED, RETRY_MISTAKE,
LOG_CONFIDENCE,
START_FOCUS_SESSION, END_FOCUS_SESSION,
UPDATE_PREFERENCES,
INCREMENT_STREAK, USE_GRACE_DAY,

# Daily Seed actions (NEW v2.1)
ADD_SEED, UPDATE_SEED, DELETE_SEED, FLAG_SEED, RESOLVE_SEED_FLAG,
ADD_VARIATION, DELETE_VARIATION,
INCREMENT_SEED_STREAK, REFRESH_SEED_STATS,

IMPORT_DATA, RESET_ALL
```

Setiap action mutating menulis ke localStorage/IndexedDB sesuai kategori (lihat §23).

---

## 5. ALGORITMA INTI

### 5.1 Spaced Repetition — Modified SM-2 (Quality 0–5)

```javascript
function calculateNextReview(item, quality) {
  // quality:
  //   0 = blank (lupa total)
  //   1 = wrong, but recognized after seeing answer
  //   2 = wrong, with significant hesitation
  //   3 = correct with major effort
  //   4 = correct with hesitation
  //   5 = perfect, instant recall

  let { interval, ease, lapses } = item;

  if (quality < 3) {
    // Failure: reset interval, decrease ease, increment lapses
    interval = 1;
    ease = Math.max(1.3, ease - 0.20);
    lapses += 1;
  } else {
    // Success: adjust ease based on quality
    ease = Math.max(1.3, ease + (0.10 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    if (interval === 1) interval = 3;
    else if (interval === 3) interval = 7;
    else interval = Math.round(interval * ease);
  }

  // Cap maximum interval at 60 days (sebelum ujian)
  interval = Math.min(interval, 60);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...item,
    interval,
    ease,
    lapses,
    nextReview: nextReview.toISOString(),
    qualityHistory: [...(item.qualityHistory || []), quality].slice(-20),
  };
}
```

### 5.2 Adaptive Difficulty — ELO-lite per Topic

Setiap topik punya rating ELO (default 1200). Setiap soal punya difficulty rating (Claude tag saat generate). Saat user menjawab:

```javascript
function updateElo(topicElo, questionDifficulty, correct) {
  const expected = 1 / (1 + Math.pow(10, (questionDifficulty - topicElo) / 400));
  const k = 32;  // sensitivity
  const score = correct ? 1 : 0;
  return Math.round(topicElo + k * (score - expected));
}
```

Saat generate batch soal, target difficulty = `topicElo + 50` (zona 75–85% accuracy = desirable difficulty).

Claude diinstruksikan: "Generate soal dengan tingkat kesulitan {targetDifficulty} pada skala 800–1800, di mana 1200 = SIMAK UI baseline, 1500 = sulit, 1800 = elite."

### 5.3 Streak dengan Grace Day

```javascript
function updateStreak(state) {
  const today = new Date().toDateString();
  const last = state.lastStudyDate ? new Date(state.lastStudyDate).toDateString() : null;
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (last === today) return state;  // already counted today
  if (last === yesterday) return { ...state, streak: state.streak + 1, lastStudyDate: today };

  // Gap > 1 day
  const daysSinceLast = (new Date() - new Date(state.lastStudyDate)) / 86400000;
  if (daysSinceLast <= 2 && !state.graceDayUsed) {
    return { ...state, streak: state.streak + 1, lastStudyDate: today, graceDayUsed: true };
  }
  return { ...state, streak: 1, lastStudyDate: today, graceDayUsed: false };
}
```

Grace day reset setiap Senin (hilangkan beban "streak anxiety", bukti: Duolingo retention study 2022).

### 5.4 Confidence Calibration Score

Setiap kali user jawab dengan confidence slider, log `{ confidence, correct }`. Brier score dihitung:

```javascript
brier = mean((confidence/100 - correct) ** 2)
```

Brier < 0.15 = well-calibrated. Brier > 0.25 = overconfident atau underconfident (cek sign).

---

## 6. MODUL 1 — TODAY FLOW (Pengganti Dashboard)

**Komponen:** `<TodayFlow />`

**Filosofi:** User membuka app dan tidak perlu memutuskan apa yang harus dilakukan. App memilihkan urutan optimal hari ini.

### Layout

**Hero strip (atas):**
- Heading: `"Hari ke-{N}"` (sejak mulai)
- Subheading muted: `"{daysLeft} hari menuju {namaUjian}"` (warna: gold >21d, amber 7–21d, ember <7d)
- Right-aligned: streak indicator + total focus minutes hari ini

**Mission Queue (3–5 task auto-generated):**
Setiap task adalah card minimalis dengan:
- Type badge: `REVIEW` / `BELAJAR` / `DRILL` / `MOCK` / `REFLECT`
- Subject pill (warna per subject)
- Estimasi waktu (`5 min` / `15 min` / `30 min`)
- Reasoning singkat: misal `"3 konsep jatuh tempo SR hari ini"` atau `"Mata uji terlemah dari diagnostic"`
- Tombol "Mulai" → langsung ke modul yang sesuai dengan params terisi

**Algoritma generate Mission Queue:**
```
1. PRIORITAS 1: SR items due (max 1 task, batch semua due items)
2. PRIORITAS 2: Mistake retry (jika ada mistake belum mastered berusia >2 hari)
3. PRIORITAS 3: Concept baru (subject dengan ELO terendah, topic belum tersentuh)
4. PRIORITAS 4: Drill interleave 10-soal (jika sudah 3+ konsep dipelajari minggu ini)
5. PRIORITAS 5 (sekali seminggu, hari Sabtu): Mock Exam mini (20 soal, 30 menit)
```

**Bawah:**
- 4 sparkline kecil per subject — accuracy 7 hari terakhir
- Heatmap aktivitas 30 hari (ala GitHub contribution graph) — gold tone
- Total: focus minutes + soal dijawab + konsep dikuasai (week-on-week comparison)

**Empty state (hari libur / Done):**
Quote akademik random dari array hardcoded (10 quotes), bukan motivasi klise. Misal:
> *"Belajar adalah perubahan permanen pada perilaku akibat pengalaman."* — B.F. Skinner

---

## 7. MODUL 2 — CONCEPT ENGINE v2

**Komponen:** `<ConceptEngine />`

Flow baru menambahkan **Pretest** dan **Feynman Loop**:

```
Pretest (1 soal "buta") 
    ↓
Concept Explanation (streaming)
    ↓
Feynman Loop (user jelaskan ulang dengan kata sendiri, Claude grade)
    ↓
Practice Question (1 soal)
    ↓
Confidence Check & Reflection
    ↓
Add to SR Queue (otomatis dengan quality grading)
```

### Step 0: Subject & Topic Selection

Sama seperti v1, tapi tambah indikator ELO per topik di sebelah nama (small badge, e.g. "1180 — perlu review"). Topic yang sudah mastery (ELO >1500) di-mute.

### Step 1: PRETEST (NEW)

Sebelum konsep dijelaskan, tampilkan:

> "Sebelum kita mulai — coba jawab dulu, walau belum yakin. Riset menunjukkan menebak duluan meningkatkan retensi 30%."

Panggil Claude generate **1 soal mudah-sedang** tentang topic. User jawab + confidence slider (0–100%). Tidak ada feedback dulu — simpan jawaban.

### Step 2: CONCEPT EXPLANATION (Streaming)

System prompt:
```
Kamu adalah tutor SIMAK UI. Gunakan Elaborative Interrogation: jelaskan APA dan
MENGAPA. Format ringkas:

1. **Definisi** (1 kalimat)
2. **Intuisi** (analogi sehari-hari, max 2 kalimat)
3. **Pola/Rumus Kunci** (jika ada — gunakan format math: $LaTeX$ atau ASCII jelas)
4. **Common Pitfall** (1 kesalahan paling sering)
5. **Worked Example** (1 contoh dengan langkah)
6. **Pertanyaan Socratic** (1 pertanyaan reflektif untuk user)

Bahasa Indonesia, tone senior membantu adik kelas. Maksimal 350 kata.
```

User prompt:
```
Topic: "{topic}", Subject: "{subject}".
{Jika diagnostik tersedia: "User skor diagnostic awal: {score}%"}
{Jika ada lapses: "User sudah lapse {lapses}x di topik ini — fokuskan pada akar miskonsepsi."}
```

**Streaming UI:** teks muncul karakter demi karakter dengan smooth fade-in. Skip button tersedia setelah 2 detik.

### Step 3: FEYNMAN LOOP (NEW)

Setelah konsep selesai, prompt user:
> "Sekarang **kamu** yang jelaskan. Ketik penjelasanmu tentang {topic} dengan kata sendiri. Anggap kamu sedang menjelaskan ke teman yang belum pernah dengar topik ini. Min. 50 kata."

Textarea besar. Tombol "Kirim untuk Review".

Panggil Claude:
```
System: Kamu evaluator pemahaman konsep. User barusan dijelaskan tentang {topic}
oleh tutor. Sekarang user menjelaskan ulang dengan kata sendiri. Tugasmu:

1. Identifikasi maksimal 3 GAP atau KEKELIRUAN konseptual (jangan terlalu pemilih
   soal kata; fokus ke konsep).
2. Berikan SCORE 0-100 untuk pemahaman (0=salah total, 100=pemahaman ahli).
3. Kalimat satu rekomendasi action concrete.

Format JSON STRICT:
{ "score": 0-100, "gaps": ["gap1", "gap2"], "strengths": ["..."], "action": "..." }
```

UI tampilkan score sebagai dial besar, gaps sebagai bullet merah, strengths bullet hijau, action sebagai callout gold.

Jika score < 50: tombol "Pelajari Ulang dari Awal" (loop ke Step 2 dengan instruksi tambahan: "Jelaskan dengan analogi berbeda").
Jika score 50–80: tombol "Coba Lagi Penjelasan" + "Lanjut ke Soal".
Jika score > 80: langsung lanjut ke Step 4.

### Step 4: PRACTICE QUESTION

Sama seperti v1.0 tapi dengan:
- **Confidence slider** sebelum tombol "Jawab"
- Layout pilihan A–E sebagai vertical button list (bukan radio button)

Setelah jawab:
- Reveal pretest (Step 1) result + practice result side-by-side
- Highlight progress: "Pretest salah → Practice benar = 1 konsep dikuasai!"

### Step 5: SM-2 GRADING

Tampilkan 4 tombol Anki-style untuk grade quality (subjective):
- **Lupa** (q=0–1) — interval reset, 1 hari
- **Sulit** (q=2–3) — interval pendek
- **Pas** (q=4) — interval normal
- **Mudah** (q=5) — interval panjang

Dispatch `ADD_SR_ITEM` atau `REVIEW_SR_ITEM` (jika sudah ada).

---

## 8. MODUL 3 — DRILL MODE v2

**Komponen:** `<DrillMode />`

### Setup Screen

- Mode: **Adaptive** (default) | **Free Choice**
  - Adaptive: pilih subject/interleave, sistem pilih topik berdasarkan ELO
  - Free Choice: pilih topik manual
- Jumlah soal: 10 / 20 / 40
- Timer: Off / 60s / 90s per soal (default 90s, sesuai ritme SIMAK)
- **Confidence mode** toggle: ON menampilkan slider, OFF skip
- **Penalty mode** toggle: simulasi penalti -1/4 (sesuai SIMAK lama)
- **Hint mode** toggle: 1 hint tersedia per drill (untuk mode latihan, OFF untuk simulasi)
- **Source mix** (NEW v2.1):
  - Default: gunakan rasio dari `preferences` (10% seed / 60% variation / 30% pure_llm)
  - Custom: slider untuk override (jika user mau drill khusus seed-only atau variation-only)
  - Indicator: tampilkan estimasi soal seed/variation/pure_llm yang akan dipakai

### Generate Soal (Hybrid v2.1)

```javascript
async function generateDrillBatch(config) {
  const { totalCount, subjects, topics, mix } = config;
  const seedCount = Math.round(totalCount * mix.seedRatio);
  const variationCount = Math.round(totalCount * mix.variationRatio);
  const pureLLMCount = totalCount - seedCount - variationCount;

  const result = [];

  // 1. SEED: Pull from seedBank (matching subject/topic/ELO target)
  const seedPool = await loadFromIDB('seedBank', { subjects, topics });
  result.push(...stratifiedSample(seedPool, seedCount, eloTarget));

  // 2. VARIATION: Pull from variations DB; if shortage, generate on-demand
  const varPool = await loadFromIDB('variations', { subjects, topics });
  let varSelected = stratifiedSample(varPool, variationCount, eloTarget);

  if (varSelected.length < variationCount) {
    // Lazy-generate: ambil seed terdekat, generate variasi
    const shortage = variationCount - varSelected.length;
    const candidateSeeds = stratifiedSample(seedPool, shortage);
    for (const seed of candidateSeeds) {
      const newVar = await generateVariation(seed, randomStrategy());
      if (newVar.validatedBy === 'dual_pass') varSelected.push(newVar);
    }
  }
  result.push(...varSelected);

  // 3. PURE_LLM: Generate batch via Claude (untuk fill remaining)
  if (pureLLMCount > 0) {
    const llmBatch = await callClaude([{
      role: 'user',
      content: buildPureLLMDrillPrompt(subjects, topics, eloTarget, pureLLMCount)
    }], { maxTokens: 4096 });
    result.push(...parseJSON(llmBatch).map(q => ({ ...q, type: 'pure_llm', trustScore: 0.6 })));
  }

  // 4. Shuffle for interleaving (jika mode interleave)
  return config.interleave ? shuffle(result) : result;
}
```

**Fallback behavior:**
- Jika seed bank kosong → silently shift seed ratio ke variation
- Jika variation pool kosong → generate baru on-demand (delay ~2-3s per soal)
- Jika API error saat pure_llm generation → fill dengan variation tambahan jika tersedia

### Pure-LLM Generation Prompt (untuk slot 30%)

```
Kamu pembuat soal SIMAK UI. Output ONLY valid JSON, no markdown wrapper.

Rules:
- Setiap soal harus ada distractor yang plausible (bukan obvious wrong).
- Variasi format: 60% direct calc/recall, 30% applied scenario, 10% trap (terlihat
  benar tapi salah karena detail).
- Tag setiap soal dengan difficulty 800-1800 (1200 = SIMAK baseline).
- Tag dengan errorTrap: "konseptual" | "komputasi" | "perangkap" | "ambiguitas".

Format: array of:
{
  "id": uuid,
  "subject": "matematika",
  "topic": "...",
  "difficulty": 1250,
  "errorTrap": "perangkap",
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
  "answer": "B",
  "explanation": "...",
  "hint": "1-line nudge tanpa beri jawaban"
}
```

User prompt menyertakan ELO target dan list topik yang dipilih.

### Drill Screen

- Top: Progress bar + soal-X-dari-N + timer circular (jika aktif)
- Question card: typography-first, large text (18–20px body)
- **Source badge** (NEW v2.1): pojok kanan atas card menampilkan tipe soal
- Options: 5 button vertical, hover state subtle
- **Confidence slider** sebelum jawab (0–100, gradien dari muted ke gold)
- Hint button (jika hint mode ON, max 1 per drill, beri konfirmasi)
- **Lapor button** (NEW v2.1): icon flag kecil bottom-right untuk report soal aneh
- Tombol Jawab → reveal jawaban + 1 detik animasi check/x

**Inter-question reflection (NEW)** — setelah jawab salah, modal kecil 2 detik:
> "Jawabanmu **{userAns}**, benar **{correctAns}**.  
> Kategori kesalahan: **{errorTrap}**.  
> [Lewati] [Tulis catatan singkat]"

Catatan masuk ke Mistake Notebook.

### Result Screen

- **Skor besar** (X/N) + accuracy %
- **Confidence Calibration**: scatter plot mini (confidence vs correct/wrong) — visual feedback ke metakognisi
- **Time per question**: sparkline, identifikasi outlier "lambat tapi benar" / "cepat tapi salah"
- **Error breakdown**: pie chart per kategori (konseptual/komputasi/perangkap/ambiguitas)
- **ELO update**: tampilkan delta per topic (`Logaritma 1180 → 1230`)
- Aksi:
  - "Tambahkan semua salah ke Mistake Notebook" (auto-suggested ON)
  - "Drill ulang topik terlemah"
  - "Pelajari ulang konsep [terlemah]" → ConceptEngine

---

## 9. MODUL 4 — SPACED REVIEW v2

**Komponen:** `<SpacedReview />`

Layout: **Single column queue**, bukan kanban. Lebih fokus.

**Atas:** Stats strip
- Items due hari ini
- Items overdue (dengan warning amber)
- Brier score (calibration metric)

**Tengah:** Review interface (jika ada due item)
- Card flip animation: front = pertanyaan/cue, back = jawaban
- User klik "Tampilkan Jawaban", lalu pilih quality (0–5) via 4 button
- Auto next ke item berikutnya

**Tab navigasi atas modul:**
- **Hari Ini** (default)
- **Akan Datang** (timeline view dengan tanggal jelas)
- **Mastered** (interval > 30 hari)
- **Leeches** (lapses ≥ 5x — warna merah, aksi suggested: "Re-learn from scratch")

**Empty state:** Ilustrasi minimal + teks: "Tidak ada review hari ini. Stack lagi konsep baru di Concept Engine."

---

## 10. QUESTION SOURCE STRATEGY (NEW v2.1)

App membedakan **3 sumber soal** dengan trust score berbeda. Routing soal ke modul tergantung use case.

### 10.1 Tiga Tipe Soal

| Tipe | Asal | Trust | Penggunaan |
|---|---|---|---|
| **`seed_real`** | Submitted user dari soal SIMAK asli (file `.md`) | **1.0** (gold) | Mock Exam exclusive; sebagian Drill |
| **`variation`** | Generated Claude dengan seed sebagai anchor + dual-pass validated | **0.85** | Drill Mode mayoritas; SR review |
| **`pure_llm`** | Generated Claude dari topik saja (tanpa anchor) | **0.60** | Concept Engine pretest/practice; fallback Drill |

### 10.2 Question Object Schema

```typescript
interface Question {
  id: string;                    // uuid
  type: 'seed_real' | 'variation' | 'pure_llm';
  parentSeedId: string | null;   // hanya untuk variation
  trustScore: number;            // 0.6 | 0.85 | 1.0

  subject: 'matematika' | 'tpa' | 'bahasa_inggris' | 'bahasa_indonesia';
  topic: string;
  difficulty: number;            // ELO 800-1800
  errorTrap: 'konseptual' | 'komputasi' | 'perangkap' | 'ambiguitas';

  question: string;              // boleh include LaTeX $...$ dan $$...$$
  options: { A: string, B: string, C: string, D: string, E: string };
  answer: 'A'|'B'|'C'|'D'|'E';
  explanation: string;
  trap?: string;                 // opsional, common mistake explanation
  hint?: string;                 // opsional, satu baris

  // Metadata source
  source?: string;               // 'SIMAK_UI_2023' | 'TryoutErlangga2024' (untuk seed_real)
  year?: number;
  postedDate?: string;           // ISO, untuk seed_real
  verifiedByUser?: boolean;      // user explicitly confirmed kunci

  // Metadata variation (jika type === 'variation')
  variationStrategy?: 'numerical_swap' | 'context_swap' | 'distractor_permute'
                    | 'inverted_prompt' | 'difficulty_ladder';
  validatedBy?: 'dual_pass' | 'manual' | 'unvalidated';

  // Quality tracking
  flagCount: number;             // user reports "soal aneh"
  flagReasons: string[];         // ['kunci salah', 'soal ambigu', ...]
  successRate: number | null;    // 0-1, akumulasi accuracy historis user
  attemptCount: number;
  lastAttemptDate: string | null;
}
```

### 10.3 Routing per Modul

| Modul | Default Mix | Override |
|---|---|---|
| **Concept Engine pretest** | 100% pure_llm | Tidak ada |
| **Concept Engine practice** | 80% variation, 20% pure_llm | Jika tidak ada seed di topik → 100% pure_llm |
| **Drill Mode** | **10% seed_real + 60% variation + 30% pure_llm** (configurable di Settings) | "Free Choice" mode bisa lock ke salah satu source |
| **SR Review** | Preserve sumber asli saat item ditambahkan | — |
| **Mock Exam** | **100% seed_real** | Jika seed bank < N soal yang dibutuhkan, banner peringatan + opsi: cancel atau "isi dengan high-trust variation" |

**Aturan strict Mock Exam:**
- Mini (20 soal) butuh minimal 20 seed di bank
- Half (60 soal) butuh minimal 60 seed
- Full (120 soal) butuh minimal 120 seed
- Jika kurang, UI menampilkan: "Seed bank kamu masih {N}/{required}. Submit lebih banyak atau pilih ukuran lebih kecil."

### 10.4 UI: Source Badge

Setiap soal yang ditampilkan punya badge kecil di pojok kanan atas:

```
[Asli · TryoutErlangga 2024]   ← seed_real, gold border
[Variasi · dari 2026-05-16]    ← variation, muted gold
[Latihan]                       ← pure_llm, no border
```

Tooltip on hover menampilkan: trust score, success rate, flag count.

User dapat **disable badge** di Settings untuk distraction-free experience, tapi default ON untuk transparency.

### 10.5 "Report Soal" Feedback Loop

Setiap soal punya tombol kecil "Lapor" (icon flag, low-prominence):

Modal report dengan radio options:
- Kunci jawaban salah
- Soal ambigu
- Pilihan jawaban tidak masuk akal
- Topic salah klasifikasi
- Lainnya (free text)

Aksi:
- Increment `flagCount`
- Append to `flagReasons`
- Jika `flagCount >= 3`: auto-disable soal dari rotation, masuk Settings → "Soal Bermasalah" untuk review user
- Jika tipe `variation` di-flag: opsi "Re-generate dengan strategi berbeda"

---

## 11. MODUL 8 — DAILY SEED (NEW v2.1)

**Komponen:** `<DailySeed />`

Modul ini memungkinkan user menyumbang soal asli SIMAK ke seed bank, dan sistem auto-generate variasi.

### 11.1 Filosofi

> "Satu soal asli mengandung pola yang ribuan soal LLM-only tidak bisa replikasi. Setiap submit = anchor kalibrasi untuk seluruh sistem."

User submit soal **kapanpun mereka punya akses** — tidak ada target harian wajib. Streak dihargai tapi tidak dihukum jika absen.

### 11.2 Layout

Tab di atas modul:
- **Submit Baru** (default jika belum submit hari ini)
- **Bank Soal** (browse, edit, delete, flag-resolve)
- **Variasi** (lihat variasi yang sudah di-generate)
- **Statistik** (chart distribusi: per subject, per difficulty, growth over time)

### 11.3 Tab "Submit Baru"

Dua mode input:

**Mode A: Paste Markdown** (default)
- Textarea besar dengan placeholder template
- Live preview di sebelah kanan (split view)
- Validation real-time:
  - YAML frontmatter parsable
  - Required fields ada
  - Body sections lengkap (Soal, Pilihan, Kunci, Pembahasan)
  - Pilihan A-E ada semua
  - Kunci adalah huruf valid
- Tombol: "Submit ke Bank" (disabled jika invalid)

**Mode B: File Upload**
- Drag-drop atau click-to-browse `.md` file
- Support batch upload (multi-select)
- Setiap file melalui pipeline yang sama
- Progress bar untuk batch

### 11.4 Markdown Schema (Spec)

File seed disimpan di repo path `data/seeds/{YYYY-MM-DD}-{subject_code}-{nn}.md`.

**Subject codes:** `mat` (matematika), `tpa`, `eng` (bahasa_inggris), `ind` (bahasa_indonesia).

```markdown
---
# WAJIB
id: 2026-05-16-mat-01
subject: matematika              # matematika | tpa | bahasa_inggris | bahasa_indonesia
topic: Logaritma
source: SIMAK_UI_2023
date_posted: 2026-05-16

# OPSIONAL
difficulty: 1350                 # ELO 800-1800; jika kosong, app auto-estimate via Claude
year: 2023
verified: true                   # true = user yakin kunci benar
notes: Soal trap klasik
---

# Soal

Teks pertanyaan. Boleh LaTeX inline `$x^2$` dan block `$$\\int_0^1 x dx$$`.

# Pilihan

A. opsi pertama
B. opsi kedua
C. opsi ketiga
D. opsi keempat
E. opsi kelima

# Kunci

C

# Pembahasan

Penjelasan langkah demi langkah.

# Trap

(OPSIONAL) Common mistake explanation.
```

### 11.5 Markdown Parser

Implementasikan parser sederhana (no library):

```javascript
function parseSeedMarkdown(rawText) {
  // 1. Extract YAML frontmatter (between --- ... ---)
  const fmMatch = rawText.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) throw new Error('Frontmatter tidak ditemukan');

  const frontmatter = parseSimpleYAML(fmMatch[1]);  // built-in mini parser
  const body = fmMatch[2];

  // 2. Split body by H1 sections
  const sections = {};
  const sectionRegex = /^# (Soal|Pilihan|Kunci|Pembahasan|Trap)\s*\n([\s\S]*?)(?=^# |\Z)/gm;
  let m;
  while ((m = sectionRegex.exec(body)) !== null) {
    sections[m[1]] = m[2].trim();
  }

  // 3. Parse Pilihan ke object {A, B, C, D, E}
  const optionRegex = /^([A-E])\.\s+(.+)$/gm;
  const options = {};
  let om;
  while ((om = optionRegex.exec(sections.Pilihan)) !== null) {
    options[om[1]] = om[2].trim();
  }

  // 4. Validate
  const required = ['Soal', 'Pilihan', 'Kunci', 'Pembahasan'];
  for (const s of required) {
    if (!sections[s]) throw new Error(`Section "${s}" tidak ada`);
  }
  if (!['A','B','C','D','E'].every(k => options[k])) {
    throw new Error('Pilihan A-E tidak lengkap');
  }
  if (!['A','B','C','D','E'].includes(sections.Kunci.trim())) {
    throw new Error('Kunci harus huruf A-E');
  }

  return {
    ...frontmatter,
    type: 'seed_real',
    trustScore: 1.0,
    question: sections.Soal,
    options,
    answer: sections.Kunci.trim(),
    explanation: sections.Pembahasan,
    trap: sections.Trap || null,
  };
}

// Mini YAML parser (cukup untuk frontmatter sederhana)
function parseSimpleYAML(yaml) {
  const result = {};
  const lines = yaml.split('\n').filter(l => !l.startsWith('#') && l.trim());
  for (const line of lines) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      // Coerce types
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d+$/.test(val)) val = parseInt(val);
      else if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
      result[m[1]] = val;
    }
  }
  return result;
}
```

### 11.6 Submit Pipeline

Setelah parse berhasil:

```
1. PARSE          → Question object dengan type='seed_real'
2. AUTO-METADATA  → Jika difficulty/topic tidak diisi, Claude extract via prompt
                    Pattern Extraction (§24)
3. DUAL-PASS      → Claude solve dari nol (tanpa lihat answer key)
                    - Match → save langsung, verified=true
                    - Mismatch → flag, save dengan flagged=true,
                                 user diminta confirm/edit
4. SAVE TO DB     → IndexedDB store 'seedBank'
5. UPDATE STATS   → seedStats.totalSeeds += 1, seedsBySubject++
6. STREAK         → INCREMENT_SEED_STREAK jika hari pertama submit
7. AUTO-VARIATE   → Jika preferences.autoVariateOnSubmit:
                    - Generate 1 variasi (background, non-blocking)
                    - Strategi: random pick dari 5 strategi (lihat §11.8)
                    - Validate variasi via dual-pass juga
                    - Save dengan type='variation', parentSeedId=seedId
```

UI feedback:
- Submit success: toast bawah kanan "Seed disimpan. 1 variasi sedang di-generate..."
- Validation flag: modal "Claude solve berbeda dari kunci. Cek ulang?" dengan diff view

### 11.7 Tab "Bank Soal"

List view dengan filter:
- Subject (multi-select)
- Difficulty range slider
- Verified ON/OFF
- Search by topic/source
- Sort: terbaru / terlama / paling sering muncul di mock

Setiap card seed:
- Truncate question 2 baris
- Subject + topic + difficulty badge
- Source label
- Aksi: View / Edit / Delete / View Variations / Re-validate

**Click "View"** → modal full-detail dengan render LaTeX (gunakan KaTeX inline jika tersedia, fallback monospace).

**Click "Re-validate"** → trigger dual-pass lagi (untuk soal yang user edit manual).

### 11.8 Tab "Variasi"

Tampilan grouped by parentSeed:

```
─── Seed: 2026-05-16-mat-01 [Logaritma · 1350 ELO] ───
   ├─ Variation #1 (numerical_swap)    [Generated  | Validated]
   ├─ Variation #2 (context_swap)      [Generated  | Pending validation]
   └─ + Generate New Variation
```

User dapat:
- Lihat variasi side-by-side dengan seed parent
- Trigger generate variasi baru (manual, max 5 per seed)
- Delete variasi yang aneh
- Pilih strategi variasi specific

**5 Strategi Variasi:**

| Strategi | Cara Kerja | Cocok untuk |
|---|---|---|
| `numerical_swap` | Ganti angka, pertahankan struktur logika | Matematika, deret angka |
| `context_swap` | Ganti tema/konteks, pertahankan struktur soal | TPA verbal, reading comprehension |
| `distractor_permute` | Tukar/ulik distractor, pertahankan stem | Semua subject |
| `inverted_prompt` | Balikkan pertanyaan ("manakah yang BUKAN...") | Vocabulary, classification |
| `difficulty_ladder` | Generate easier (-150 ELO) atau harder (+150 ELO) versi | Calibration assessment |

### 11.9 Tab "Statistik"

Visualisasi:
- **Pie chart**: distribusi seed per subject
- **Histogram**: distribusi difficulty (bucket per 100 ELO)
- **Line chart**: growth seed bank over time (cumulative)
- **Heatmap**: 30 hari terakhir, hari yang submit highlighted gold
- **Scoreboard**:
  - Total seed: N
  - Total variation: M
  - Verified rate: X%
  - Avg flag rate: Y%
  - Topic coverage matrix (tabel 4x topiklist, cell = jumlah seed)

### 11.10 Seed Streak (Terpisah dari Study Streak)

Logika sama dengan study streak (§5.3) tapi terpisah:
- Submit minimal 1 soal hari ini → seedStreak += 1
- Tidak submit → freeze (tidak reset, tidak grow)
- Reset hanya jika gap > 7 hari (lebih lenient daripada study streak karena akses terbatas)

**Tidak ada visual hukuman absen.** Hanya celebration milestone:
- 7 days: "Konsistensi terbentuk"
- 30 days: "Kontributor tetap"
- 100 days: "Anchor utama bank"

### 11.11 Sync File System ↔ App

App berjalan di browser, jadi tidak punya akses file system langsung. Dua mekanisme:

**A. Manual paste/upload** (default) — user paste konten file `.md` ke Submit form atau drag-drop file.

**B. File System Access API** (Chrome/Edge) — opsional:
```javascript
async function pickSeedFolder() {
  const dirHandle = await window.showDirectoryPicker();
  // Iterate .md files, parse each, sync ke IndexedDB
}
```
Jika browser support, tampilkan tombol "Pilih folder seeds" di tab Bank. Auto-sync berkala (or pada button click).

**C. Export to file** — dari app ke disk: tombol "Export seed sebagai .md" → download file dengan nama `{id}.md` → user save manual ke folder repo.

---

## 12. VALIDATION PIPELINE (NEW v2.1)

Pipeline yang berjalan saat soal masuk sistem (baik seed_real, variation, atau pure_llm).

### 12.1 Stages

```
INGESTION → METADATA EXTRACTION → DUAL-PASS SOLVE → QUALITY CHECK → STORAGE
```

### 12.2 Metadata Extraction

Untuk soal yang missing field (difficulty, topic detail, errorTrap), call Claude dengan prompt:

```
System: Kamu analyst soal ujian SIMAK UI. Diberi 1 soal lengkap dengan kunci.
Output JSON STRICT (tidak ada field lain):
{
  "topic": string,                    // topik spesifik
  "subtopic": string,                 // sub-bagian (e.g., "Logaritma natural")
  "difficulty": int,                  // ELO 800-1800
  "errorTrap": "konseptual" | "komputasi" | "perangkap" | "ambiguitas",
  "concepts": [string],               // 1-3 konsep terlibat
  "estimatedTimeSeconds": int         // estimasi waktu solve siswa rata-rata
}
```

### 12.3 Dual-Pass Solve

Critical untuk anti-hallucination:

```javascript
async function dualPassValidate(question) {
  // Pass 1: Solve from scratch (NO answer key shown)
  const solverPrompt = `
    Solve soal SIMAK UI berikut. Output ONLY JSON:
    { "answer": "A|B|C|D|E", "confidence": 0-100, "reasoning": "..." }

    SOAL: ${question.question}
    PILIHAN:
    A. ${question.options.A}
    B. ${question.options.B}
    C. ${question.options.C}
    D. ${question.options.D}
    E. ${question.options.E}
  `;

  const solverResponse = await callClaude([
    { role: 'user', content: solverPrompt }
  ], { maxTokens: 1024 });

  const claudeAnswer = parseJSON(solverResponse).answer;

  // Pass 2: Compare
  if (claudeAnswer === question.answer) {
    return { validated: true, confidence: 'high' };
  } else {
    return {
      validated: false,
      confidence: 'mismatch',
      claudeAnswer,
      claudeReasoning: parseJSON(solverResponse).reasoning,
      message: `Claude jawab ${claudeAnswer}, kunci ${question.answer}. Cek ulang.`
    };
  }
}
```

### 12.4 Quality Check Heuristics

Selain dual-pass, jalankan checks ringan:

| Check | Threshold | Aksi jika gagal |
|---|---|---|
| Pilihan unik (no duplicate) | A≠B≠C≠D≠E | Reject, tampilkan error |
| Panjang stem soal | 10-1500 chars | Warning, tidak block |
| Panjang opsi reasonable | 1-300 chars/opsi | Warning |
| Bahasa konsisten (Indo/Inggris) | langdetect ratio | Warning saja |
| Difficulty out of range | 800-1800 | Cap ke range |
| LaTeX balanced | `$` count even | Reject, tampilkan error |

### 12.5 Variation Generator

Untuk auto-generate variation:

```javascript
async function generateVariation(parentSeed, strategy) {
  const prompt = buildVariationPrompt(parentSeed, strategy);  // §24

  const raw = await callClaude([
    { role: 'user', content: prompt }
  ], { maxTokens: 2048, system: VARIATION_SYSTEM_PROMPT });

  let variation = parseJSON(raw);
  variation.type = 'variation';
  variation.parentSeedId = parentSeed.id;
  variation.trustScore = 0.85;
  variation.variationStrategy = strategy;

  // Run through validation pipeline
  const dual = await dualPassValidate(variation);
  variation.validatedBy = dual.validated ? 'dual_pass' : 'unvalidated';

  if (!dual.validated) {
    // Don't auto-save unvalidated. Either retry or flag for user review.
    variation.flagCount = 1;
    variation.flagReasons = ['Dual-pass mismatch'];
  }

  return variation;
}
```

### 12.6 Cost Optimization

Validasi 2-pass = 2x token cost. Strategi mitigasi:

- **Cache seed validation**: validasi seed dilakukan sekali saat submit, hasil disimpan
- **Batch variation generation**: kalau user request 3 variasi sekaligus, kirim 1 prompt yang generate 3
- **Lazy variation**: default 1 variasi auto saat submit, sisanya on-demand
- **Skip dual-pass untuk seed_real verified**: jika user tag `verified: true` dan source jelas, dual-pass jadi optional (tapi tetap recommended)
- **Use prompt caching**: system prompt validation di-cache (Anthropic ephemeral cache)

---

## 13. MODUL 5 — MOCK EXAM (Locked to Seed Bank, v2.1)

**Komponen:** `<MockExam />`

Simulasi penuh SIMAK UI: tidak ada hint, tidak ada feedback per soal, timer ketat.
**v2.1 update:** soal eksklusif dari `seed_real` bank — bukan LLM-generated.

### Pre-flight Check (NEW v2.1)

Sebelum setup screen muncul, app cek `seedStats.totalSeeds`:

```
if (seedStats.totalSeeds < 20) {
  Tampilkan blocking screen:
  "Mock Exam butuh minimal 20 soal asli di seed bank.
   Kamu punya {N} soal saat ini.
   [Submit soal di Daily Seed] | [Latihan dengan Drill Mode dulu]"
}
```

### Setup
- Pilih: **Mini (20 soal, 30 min)** | **Half (60 soal, 90 min)** | **Full (120 soal, 180 min)**
- Tampilkan availability: `"✓ Mini siap (60 seed tersedia)"` atau `"✗ Half belum cukup (60/90 seed)"`
- Pilih distribusi subject: **Proporsional SIMAK** (default: ~40% mat, 25% TPA, 20% eng, 15% ind) atau **Custom**
- Toggle: **"Izinkan soal yang pernah muncul di mock sebelumnya"** (default OFF — fresh experience)
- Konfirmasi modal: "Setelah dimulai, tidak bisa di-pause. Pastikan kondisi siap."

### Soal Selection Algorithm

```javascript
function selectMockExamQuestions(seedBank, config) {
  // 1. Filter: hanya seed_real, verified=true atau verifiedByUser=true preferred
  let pool = seedBank.filter(q => q.type === 'seed_real');

  // 2. Exclude soal yang pernah muncul di mock sebelumnya (jika toggle OFF)
  if (!config.allowRepeat) {
    const usedIds = new Set(state.mockExamHistory.flatMap(m => m.questionIds));
    pool = pool.filter(q => !usedIds.has(q.id));
  }

  // 3. Stratified sample per subject sesuai distribusi
  const result = [];
  for (const [subject, ratio] of Object.entries(config.distribution)) {
    const targetCount = Math.round(config.totalCount * ratio);
    const subjectPool = pool.filter(q => q.subject === subject);
    // Shuffle and take
    result.push(...shuffle(subjectPool).slice(0, targetCount));
  }

  // 4. Final shuffle untuk simulate randomized exam order
  return shuffle(result);
}
```

### Exam Screen
- **Distraction-free**: sidebar collapse otomatis, focus mode ON
- Top bar: timer countdown (warna berubah <10% time), "Mark for review" toggle, navigation grid kecil (1–N dengan status: blank/answered/marked)
- Question area: full-width centered, max-width 720px
- Bottom: prev/next + "Submit Exam" (warning jika ada blank)

### Submit & Analysis

Setelah submit, tampilkan **Analytics Report** (mini-essay format):

1. **Skor total** + breakdown per subject
2. **Predicted Score Range** (dengan confidence interval) — Claude diberi historis untuk kalkulasi
3. **Time analysis** — soal terlama, kecepatan rata-rata
4. **Error pattern** — konseptual vs komputasi vs careless
5. **3 prioritas next week** — Claude generate berdasarkan hasil
6. **Tombol "Add all wrong to Mistake Notebook"**

History mock exam disimpan, tampilkan trend line (skor naik/turun antar mock).

---

## 14. MODUL 6 — STUDY PLANNER v2

**Komponen:** `<StudyPlanner />`

### Auto-Generate vs Manual

Tampilan dua tab:

**Tab 1: Plan saya** (default jika sudah ada plan)
- Kalender mingguan dengan task per hari
- Each day: 1–3 mission cards
- Drag-and-drop reorder (jika kompleks, skip; gunakan dropdown reschedule)
- Status: completed/skipped/scheduled
- Adherence rate (mirip Habitica)

**Tab 2: Generate ulang**
- Input form (slider jam, hari tersedia, prioritas subject)
- Otomatis: pakai diagnostic results sebagai prioritas (jangan ulang input manual jika sudah ada)
- Tombol "Generate Jadwal Adaptif"

### Generate Logic (Claude)

System prompt:
```
Kamu strategist persiapan ujian. Buat jadwal adaptif berdasarkan:
- Bloom's taxonomy: Week 1-2 = Remember/Understand (concept-heavy), Week 3 = Apply/Analyze (drill-heavy), Week 4 = Evaluate (mock exams + targeted review).
- Spaced repetition: setiap hari 15-20 min dialokasikan untuk SR review.
- Interleaving: setelah hari ke-7, drill mode harus campur subject.

Output JSON STRICT:
{
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Foundation - Concept Building",
      "days": [
        {
          "date": "ISO-date",
          "totalMinutes": 120,
          "tasks": [
            { "type": "concept" | "drill" | "review" | "mock" | "rest",
              "subject": "matematika",
              "topic": "Logaritma",
              "minutes": 30,
              "rationale": "..." }
          ]
        }
      ]
    }
  ],
  "strategicNotes": ["..."]
}
```

User prompt menyertakan: tanggal exam, jam/hari tersedia, hasil diagnostic, weak topics dari ELO data.

### Render
- Kartu minggu dengan timeline horizontal scrollable di mobile
- Setiap task = small card dengan ikon + waktu + subject badge
- Tombol "Mulai task ini" → langsung ke modul yang sesuai

---

## 15. MODUL 7 — MISTAKE NOTEBOOK (NEW)

**Komponen:** `<MistakeNotebook />`

Repository semua soal yang pernah salah dijawab. Filosofi: **"Ujian adalah ujian melawan kesalahan masa lalu."**

### Layout

- **Filter bar atas:**
  - Subject filter
  - Error category filter
  - Status: "Belum dimasterkan" (default) | "Sudah dimasterkan" | "Semua"
  - Search by keyword

- **List kartu mistake:**
  - Quote pertanyaan (truncate 2 baris)
  - Subject + topic + error category badge
  - Tanggal salah
  - Retry count
  - Confidence saat itu vs reality (misal: "Confidence 85% — salah")
  - Aksi: "Coba lagi" / "Tandai dikuasai" / "Hapus"

### Retry Mode

Tombol "Coba lagi" → modal:
- Tampilkan soal lagi (tanpa pilihan jawaban di awal)
- User ketik jawaban dulu (free recall) atau pilih A-E
- Setelah jawab, reveal explanation
- Jika benar 3x berturut tanpa lihat explanation → auto-mark mastered

### Bulk Actions

- "Drill 10 mistake terbaru" → load ke Drill Mode
- "Export mistake to PDF" (gunakan window.print() dengan CSS print stylesheet)

### Storage
Data mistakes disimpan di **IndexedDB** (database name: `simak_mistakes`, store: `mistakes`). Maksimum 5000 entri sebelum auto-prune yang mastered terlama.

---

## 16. MODUL 9 — SETTINGS

**Komponen:** `<Settings />`

Tab struktur:

**Akun & API**
- API key (masked, edit, validate)
- Validasi: tes call ke Claude API (1 token request) untuk konfirmasi key works
- Warning eksplisit: "API key disimpan di localStorage browser. Tidak terenkripsi. Hanya gunakan di device pribadi."

**Tanggal Ujian**
- List ujian + tanggal
- Tambah/edit/hapus
- Set primary

**Preferensi**
- Pomodoro length (slider 15–60 min)
- Break length (slider 3–15 min)
- Confidence slider default ON/OFF
- Show streak indicator ON/OFF (untuk yang sensitif streak anxiety)
- Theme switch: Academic Dark / Academic Light / Parchment (3 mode)
- Keyboard shortcut on/off

**Data**
- **Export JSON**: download semua state (tanpa API key) sebagai file `simak-backup-{date}.json`
- **Import JSON**: upload file backup, validate, replace state
- **Reset diagnostic**: re-run diagnostic test
- **Reset ALL** (dengan double confirm modal)

**Tentang**
- Versi app
- Daftar 8 prinsip belajar dengan link riset (footer credit ringkas)

---

## 17. ONBOARDING FLOW (NEW)

5 langkah, tidak skippable:

### Langkah 1 — Welcome
- Hero: nama app + tagline
- Body teks 2 paragraf: filosofi belajar (Active Recall + SR), apa yang akan dialami user
- Tombol "Mulai"

### Langkah 2 — API Key Setup
- Input password type
- Link external: "Bagaimana cara dapat API key?" → opens anthropic.com/api
- Validasi format (`sk-ant-`...) inline
- Test call button → "Verifikasi"
- Warning kotak: penyimpanan + privasi

### Langkah 3 — Tanggal Ujian
- Date picker
- Nama ujian (optional, default "SIMAK UI")
- Preview countdown muncul real-time

### Langkah 4 — Diagnostic Assessment

**Filosofi:** sebelum belajar, ukur dulu. Sebelum drill, kalibrasi.

8 soal cepat (2 per subject), masing-masing menengah-sulit. Tidak ada timer (mengurangi anxiety, baseline jujur).

Generate via Claude:
```
System: Generate 8 soal pilihan ganda diagnostic untuk SIMAK UI. 2 soal per
subject (matematika, tpa, bahasa_inggris, bahasa_indonesia). Difficulty: 1300
(menengah-sulit). Variasi topik. Output JSON same as drill format.
```

Selama menjawab: **TIDAK** ada feedback. Hanya progress (1/8, 2/8...).

Setelah selesai, **dispatch SET_DIAGNOSTIC** dengan accuracy per subject. Hasil ini digunakan untuk:
- ELO awal per subject (1200 + (accuracy - 0.5) × 400)
- Prioritas Mission Queue
- Initial study plan generation

### Langkah 5 — Generated Study Plan Preview

Otomatis call StudyPlanner generation berdasarkan diagnostic + tanggal ujian. Tampilkan minggu pertama saja sebagai preview. Tombol "Mulai belajar" → dispatch `COMPLETE_ONBOARDING`.

---

## 18. DESIGN SYSTEM v2

### 15.1 Color Tokens

```css
:root {
  /* Backgrounds — warm dark palette, less saturated than v1 */
  --bg: #0d0c0b;             /* lebih pekat dari v1, "deep paper inverted" */
  --bg-elevated: #181614;
  --bg-card: #1f1c19;
  --bg-hover: #26221e;

  /* Borders */
  --border: #2a2622;
  --border-strong: #3d3833;

  /* Text */
  --text: #ece4d4;           /* parchment */
  --text-muted: #a89e8e;
  --text-faint: #6c655b;

  /* Accent — gold (single accent rule) */
  --gold: #c9a84c;
  --gold-soft: #8a6f2e;
  --gold-bg: rgba(201, 168, 76, 0.08);

  /* Semantic */
  --ink: #1c2541;            /* deep navy untuk subject "Bahasa Indonesia" */
  --moss: #4a7c59;           /* success */
  --rust: #8b3a3a;           /* error */
  --amber: #b87333;          /* warning */

  /* Subject colors (muted, harmonized) */
  --subj-mat: #6688a8;
  --subj-tpa: #8b6f9b;
  --subj-eng: #5a8e8e;
  --subj-ind: #b8956a;
}

[data-theme="academic-light"] {
  --bg: #f5efe3;
  --bg-elevated: #ebe3d3;
  --bg-card: #ffffff;
  --text: #1a1715;
  --text-muted: #5c554c;
  /* ... etc */
}

[data-theme="parchment"] {
  --bg: #e8dec5;
  --bg-card: #f0e7d0;
  --text: #2b2419;
  /* sepia tone */
}
```

### 15.2 Typography Scale

```css
--font-display: 'Playfair Display', Georgia, serif;
--font-body: 'Source Serif 4', Georgia, serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;

/* Modular scale 1.333 (perfect fourth) */
--text-xs: 0.75rem;     /* 12px - meta */
--text-sm: 0.875rem;    /* 14px - secondary */
--text-base: 1rem;      /* 16px - body */
--text-lg: 1.125rem;    /* 18px - lead body */
--text-xl: 1.5rem;      /* 24px - h3 */
--text-2xl: 2rem;       /* 32px - h2 */
--text-3xl: 2.625rem;   /* 42px - h1 */
--text-4xl: 4rem;       /* 64px - hero countdown */

/* Line height */
--leading-tight: 1.2;
--leading-normal: 1.6;  /* untuk reading body */
```

**Aturan tipografi:**
- Hero/h1 selalu Playfair Display, weight 600
- Body Source Serif 4 weight 400, line-height 1.6, max-width 65ch (optimal reading)
- Numerik (skor, countdown) gunakan tabular-nums (`font-variant-numeric: tabular-nums`)
- Italics (Source Serif 4 italic) digunakan **hanya** untuk quotes dan emphasis ganda

### 15.3 Icon System

Replace SEMUA emoji. Gunakan inline SVG monoline (Lucide-style), 1.5px stroke, single color (`currentColor`):

```jsx
// Contoh: di dalam komponen
const Icon = ({ name, size = 20 }) => {
  const icons = {
    today: <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM3 9h18M8 3v4M16 3v4" />,
    concept: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
    drill: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    review: <path d="M21 12a9 9 0 11-3.9-7.4M21 4v6h-6" />,
    mock: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    plan: <path d="M9 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-4M9 11V5a3 3 0 016 0v6" />,
    notebook: <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />,
    settings: <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
         strokeLinejoin="round">{icons[name]}</svg>
  );
};
```

### 15.4 Komponen UI

```
<Card>           padding: 24, radius: 12, bg: bg-card, border: border (1px)
                 hover: bg-hover (subtle 150ms ease-out)

<Button>         primary:   bg gold, text bg-primary, weight 600
                 secondary: border-strong, text, transparent
                 ghost:     text-muted, transparent, hover bg-hover
                 destructive: border rust, text rust
                 height: 36px (sm) / 40px (md) / 48px (lg)
                 radius: 8px
                 transition: all 150ms ease-out

<Input>          bg: bg-elevated, border, padding: 10/14, radius: 6
                 focus: border gold, no box-shadow ring
                 monospace untuk API key

<Badge>          subject:   bg `var(--subj-{name})` 15% opacity, text full
                 status:    moss/amber/rust + 15% bg
                 size: 11px text, padding 4/8, radius 4

<ProgressBar>    height: 4px (slim), track bg-elevated, fill gold
                 transition width 400ms ease-out
                 NO % label di dalam, label terpisah di luar

<Tabs>           underline style (no boxes)
                 active: gold underline 2px, text full
                 inactive: text-muted, hover text

<Modal>          overlay rgba(0,0,0,0.7) + backdrop-filter blur(4px)
                 content max-width 560px, radius 16, padding 32
                 close on Esc / outside click

<Tooltip>        delay 500ms, bg-elevated, border, text-sm, no arrow
                 muncul above by default

<Skeleton>       bg-elevated dengan shimmer animation 1.5s linear
```

### 15.5 Animation Guidelines

**Hanya 4 animasi diizinkan:**
1. **Fade-in/out** (200ms ease-out) — untuk modal, tooltip, mistake reveal
2. **Slide-up** (250ms ease-out) — untuk question transition
3. **Width transition** (400ms ease-out) — untuk progress bar
4. **Subtle pulse** — untuk timer < 10s (1s ease-in-out infinite)

**Tidak ada:** spring, bounce, parallax, page transition besar. Spirit: "Every motion teaches something."

### 15.6 Layout & Spacing

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px
- Sidebar lebar: 240px expanded, 64px collapsed (icon-only)
- Main content padding: 32px desktop, 16px mobile
- Max content width per section: 960px
- Reading content max-width: 720px (untuk concept explanation)

### 15.7 Responsive

- Desktop ≥ 1024px: full sidebar
- Tablet 640–1023px: sidebar collapse to icon-only by default
- Mobile < 640px: sidebar → bottom tab bar (4 tab inti: Today, Concept, Drill, Review). Modul lainnya (Mock, Plan, Notebook, Settings) di TopBar overflow menu.

---

## 19. FOCUS MODE & POMODORO

**Komponen:** `<FocusSession />` (overlay)

Tombol di TopBar: **"Mulai Focus"** atau Cmd/Ctrl+F.

Saat aktif:
- Sidebar collapse otomatis
- Notifikasi/badge dimute
- Timer Pomodoro start (default 25 min focus / 5 min break)
- Subtle gold border progress bar di top of screen
- Browser tab title: `🎯 23:42 — SIMAK Focus`
- Setelah focus selesai: chime (Web Audio API beep singkat, 600Hz, 200ms)
- Break mode: full-screen quote akademik + countdown break
- Dispatch `START_FOCUS_SESSION` / `END_FOCUS_SESSION`, log durasi

**Settings:** durasi configurable, ada opsi 50/10 (atau custom).

---

## 20. COMMAND PALETTE (Cmd+K)

**Komponen:** `<CommandPalette />`

Overlay modal dengan input search di tengah. Aksi yang bisa dipanggil:

```
- Go to Today / Concept / Drill / Review / Mock / Plan / Notebook / Settings
- Start Focus Session
- Start Quick Drill (10 questions, interleave)
- Review Due Items
- New Concept: {subject}
- Toggle Theme
- Export Backup
- Reset Streak Anxiety (mute streak indicator 24h)
```

Hotkey global. Implementasi: useEffect dengan `keydown` listener, support Cmd/Ctrl+K.

---

## 21. UTILITY FUNCTIONS

```javascript
// Tanggal
function getDaysRemaining(targetDateISO) { /* same as v1 */ }
function isDueToday(nextReviewISO) { /* same as v1 */ }
function formatRelative(date) { /* "2 hari lalu", "kemarin", "hari ini" */ }

// SR
function calculateNextReview(item, quality) { /* §5.1 */ }

// ELO
function updateElo(topicElo, qDiff, correct) { /* §5.2 */ }
function eloToLabel(elo) {
  if (elo < 1100) return 'Pemula';
  if (elo < 1300) return 'Berkembang';
  if (elo < 1500) return 'Mantap';
  if (elo < 1700) return 'Mahir';
  return 'Ahli';
}

// Calibration
function brierScore(log) { /* §5.4 */ }
function calibrationLabel(brier) {
  if (brier < 0.10) return 'Sangat Terkalibrasi';
  if (brier < 0.20) return 'Terkalibrasi';
  if (brier < 0.30) return 'Cukup Terkalibrasi';
  return 'Perlu Latihan Kalibrasi';
}

// Streak
function updateStreak(state) { /* §5.3 */ }

// Storage
async function saveToIDB(store, data) { /* IndexedDB wrapper */ }
async function loadFromIDB(store, query) { /* ... */ }

// API call wrapper
async function callClaude(messages, options = {}) {
  // options: { stream, maxTokens, system, retryCount }
  // Implements: exponential backoff, error categorization, prompt caching headers
}

// Parse helpers
function parseQuestionJSON(raw) {
  // Strip markdown wrapper if any, parse, validate schema, return null on fail
}

// IDs
function generateId() { return crypto.randomUUID(); }
```

---

## 22. ERROR HANDLING & RESILIENCE

| Skenario | Penanganan |
|---|---|
| API key invalid (401) | Disable AI features, banner persistent: "API key tidak valid", link ke Settings |
| Rate limit (429) | Exponential backoff 1s → 2s → 4s. After 3 fails: "API rate limit. Tunggu 1 menit." |
| Network error | Retry 1x. Jika gagal: "Tidak ada koneksi. Akan otomatis retry." Auto-retry saat online |
| JSON parse fail | Retry once with reminder prompt. Jika fail: tampilkan raw response + "Lapor sebagai bug" |
| Quota exceeded (localStorage) | Auto-prune oldest drill history, notify user, suggest IndexedDB migrate |
| IndexedDB unsupported | Graceful degrade: mistake notebook tetap jalan via localStorage, batas 100 items |
| Claude tidak streaming | Fallback ke non-streaming dengan loader |
| User offline | UI fully usable except API calls. Show offline banner. Queue drills/reviews jika ingin |
| Diagnostic tidak selesai | Save partial progress, resume on next open |
| Tanggal ujian sudah lewat | Banner persistent "Ujian telah berlalu — atur tanggal baru di Settings" |

**Microlearning loading state:**
Tampilkan tip random saat loading API call:
```
- "Tahukah kamu? Riset Roediger & Karpicke (2006) menunjukkan testing meningkatkan retensi 50% dibanding membaca ulang."
- "Confidence calibration adalah skill terpisah dari accuracy. Kamu bisa benar tapi tidak yakin, atau salah tapi terlalu yakin."
- "Interleaving terasa lebih sulit, tapi meningkatkan transfer ke konteks baru — termasuk soal ujian asli."
- ...
```

20 tips di array hardcoded, dipilih random.

---

## 23. STORAGE STRATEGY

| Data | Lokasi | Alasan |
|---|---|---|
| API key | localStorage | Single small string |
| Preferences | localStorage | <1KB |
| `examDates`, `streak`, `topicMastery` | localStorage | Frequently read, small |
| `srQueue` | localStorage | <100 items typical |
| `seedStats` (summary) | localStorage | Frequently read di TodayFlow |
| `drillHistory` (last 100) | localStorage | Recent, sering diakses |
| `drillHistory` (older) | IndexedDB | Bisa ribuan |
| `mistakes` | IndexedDB | Bisa ribuan, sering query/filter |
| `mockExamHistory` | IndexedDB | Berisi snapshot lengkap |
| `calibrationLog` | IndexedDB | Time-series data |
| **`seedBank`** (NEW v2.1) | IndexedDB | Soal asli, foundational data |
| **`variations`** (NEW v2.1) | IndexedDB | Soal turunan, bisa ribuan |
| **`seedFlags`** (NEW v2.1) | IndexedDB | Validation issues, audit trail |

IndexedDB schema:
```javascript
const DB_NAME = 'simak_studyos';
const DB_VERSION = 2;  // bumped from 1 for v2.1 schema additions

const STORES = {
  // ─── v2.0 stores ───
  mistakes: {
    keyPath: 'id',
    indexes: ['subject', 'topic', 'mastered', 'timestamp']
  },
  drillHistory: {
    keyPath: 'id',
    indexes: ['subject', 'timestamp']
  },
  mockExamHistory: {
    keyPath: 'id',
    indexes: ['timestamp']
  },
  calibrationLog: {
    keyPath: 'id',
    indexes: ['timestamp', 'subject']
  },

  // ─── v2.1 stores (NEW) ───
  seedBank: {
    keyPath: 'id',
    indexes: [
      'subject',           // filter per subject
      'topic',             // filter per topic
      'difficulty',        // ELO range query
      'date_posted',       // sort terbaru
      'verified',          // filter verified only
      'flagCount',         // priority queue untuk review
      ['subject', 'topic'] // composite untuk drill selection
    ]
  },
  variations: {
    keyPath: 'id',
    indexes: [
      'parentSeedId',      // grouped by seed
      'subject',
      'topic',
      'difficulty',
      'variationStrategy', // analytics per strategi
      'validatedBy',       // filter dual_pass only
      'flagCount'
    ]
  },
  seedFlags: {
    keyPath: 'id',
    indexes: [
      'questionId',        // either seed or variation
      'reason',            // 'kunci_salah' | 'soal_ambigu' | ...
      'timestamp',
      'resolved'           // boolean
    ]
  },
};
```

### Migration Strategy v2.0 → v2.1

```javascript
function onUpgradeNeeded(event) {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  // v2.1 additions
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains('seedBank')) {
      const store = db.createObjectStore('seedBank', { keyPath: 'id' });
      store.createIndex('subject', 'subject');
      store.createIndex('topic', 'topic');
      store.createIndex('difficulty', 'difficulty');
      store.createIndex('date_posted', 'date_posted');
      store.createIndex('verified', 'verified');
      store.createIndex('flagCount', 'flagCount');
      store.createIndex('subject_topic', ['subject', 'topic']);
    }
    if (!db.objectStoreNames.contains('variations')) {
      const store = db.createObjectStore('variations', { keyPath: 'id' });
      store.createIndex('parentSeedId', 'parentSeedId');
      store.createIndex('subject', 'subject');
      store.createIndex('topic', 'topic');
      store.createIndex('difficulty', 'difficulty');
      store.createIndex('variationStrategy', 'variationStrategy');
      store.createIndex('validatedBy', 'validatedBy');
      store.createIndex('flagCount', 'flagCount');
    }
    if (!db.objectStoreNames.contains('seedFlags')) {
      const store = db.createObjectStore('seedFlags', { keyPath: 'id' });
      store.createIndex('questionId', 'questionId');
      store.createIndex('reason', 'reason');
      store.createIndex('timestamp', 'timestamp');
      store.createIndex('resolved', 'resolved');
    }
  }
}
```

### Capacity Planning

| Store | Estimated avg size/entry | Target capacity | Storage |
|---|---|---|---|
| `seedBank` | ~2KB | 500 entries (1MB) | OK |
| `variations` | ~2KB | 5000 entries (10MB) | Auto-prune oldest unvalidated jika >10MB |
| `mistakes` | ~3KB (with notes) | 5000 entries (15MB) | Auto-prune mastered terlama |
| `drillHistory` | ~1KB | 10000 entries (10MB) | Rolling window 10000 |
| `mockExamHistory` | ~50KB (full snapshot) | 50 mocks (2.5MB) | Keep all, kompresi explanation field jika >limit |

**Export JSON v2.1:** include `seedBank`, `variations`, `seedFlags` di export. **API key tetap excluded.**
**Import JSON:** validate schema versi, transform jika dari v2.0.

---

## 24. PROMPT TEMPLATES (Append untuk Claude)

Semua prompt menggunakan **prompt caching** Anthropic untuk system prompt yang panjang. Header:
```
"anthropic-version": "2023-06-01"
"anthropic-beta": "prompt-caching-2024-07-31"
```

Tandai system prompt dengan `cache_control: { type: 'ephemeral' }`.

### Template Concept Explanation
(Lihat §7 Step 2)

### Template Feynman Evaluation
(Lihat §7 Step 3)

### Template Practice Question Single
```
System: Generate 1 soal SIMAK UI untuk topik {topic}. Difficulty target: {elo}.
Output JSON only:
{
  "question": "...", "options": {...}, "answer": "...",
  "explanation": "...", "errorTrap": "...", "difficulty": int
}
```

### Template Drill Batch
(Lihat §8)

### Template Diagnostic
(Lihat §17 Langkah 4)

### Template Mock Exam
Sama seperti drill batch tapi N besar, distribusi merata 4 subject, no hint, full mix difficulty.
**v2.1: Mock Exam tidak lagi pakai LLM generation.** Soal di-pull langsung dari `seedBank` (lihat §13).

### Template Study Plan Generation
(Lihat §14)

### Template Mock Exam Analysis
```
System: Kamu analyst persiapan ujian. Diberi hasil mock exam, generate analisis
ringkas:
1. Pola kesalahan utama (max 3 tema)
2. Predicted score range untuk SIMAK asli (lower, upper)
3. 3 prioritas next 7 days
4. 1 strategic insight (misal: "kamu cepat di matematika tapi careless 12% — slow down 5 detik per soal")

Output JSON.
```

---

### Template Pattern Extraction (NEW v2.1)

Dipakai saat user submit seed yang missing metadata fields.

```
System (cache_control: ephemeral):
Kamu analyst soal SIMAK UI. Tugasmu meng-ekstrak metadata dari soal yang
diberikan. Output ONLY valid JSON, tidak ada teks lain.

User:
Analisis soal SIMAK UI berikut dan ekstrak metadata:

SOAL: {question}
PILIHAN:
A. {A}
B. {B}
C. {C}
D. {D}
E. {E}
KUNCI: {answer}
PEMBAHASAN: {explanation}

Subject yang sudah diketahui: {subject}
Topic yang user input (boleh override jika tidak akurat): {topic}

Output JSON STRICT (no markdown wrapper):
{
  "topic": "topik spesifik (boleh refine dari input user)",
  "subtopic": "sub-bagian topik",
  "difficulty": 800-1800,
  "errorTrap": "konseptual" | "komputasi" | "perangkap" | "ambiguitas",
  "concepts": ["konsep 1", "konsep 2"],
  "estimatedTimeSeconds": 30-300,
  "patternSignature": "ringkasan struktur soal dalam 1 kalimat"
}
```

`patternSignature` digunakan sebagai anchor untuk variation generation — Claude akan diminta meniru pola ini dengan ganti angka/konteks.

---

### Template Solver Validator (Dual-Pass) (NEW v2.1)

Digunakan untuk validasi seed dan variation. **PENTING**: jangan kirim `answer` atau `explanation` ke prompt ini — Claude harus solve from scratch.

```
System (cache_control: ephemeral):
Kamu mahasiswa terbaik yang sedang ujian SIMAK UI. Solve soal dengan cermat.
Output ONLY valid JSON, tidak ada teks lain.

User:
Solve soal berikut. Pilih SATU jawaban yang paling tepat dari A-E.

SUBJECT: {subject}
TOPIC: {topic}
SOAL:
{question}

PILIHAN:
A. {A}
B. {B}
C. {C}
D. {D}
E. {E}

Output JSON STRICT:
{
  "answer": "A" | "B" | "C" | "D" | "E",
  "confidence": 0-100,
  "reasoning": "langkah singkat menuju jawaban (max 100 kata)",
  "rejectedDistractors": {
    "A": "alasan A salah (jika A bukan jawaban)",
    ...
  }
}
```

Setelah respons:
1. Parse `answer`
2. Compare dengan `question.answer` yang asli
3. Match → `validatedBy = 'dual_pass'`, simpan
4. Mismatch → flag, simpan dengan `flagCount = 1`, tampilkan ke user untuk konfirmasi

---

### Template Variation Generator (NEW v2.1)

Digunakan untuk generate variasi dari seed parent. Strategi yang dipilih ditentukan oleh `variationStrategy` parameter.

**System prompt** (shared untuk semua strategi):
```
System (cache_control: ephemeral):
Kamu pembuat soal SIMAK UI yang ahli meniru POLA dan KESULITAN dari soal acuan.
Tugasmu generate 1 soal VARIASI yang strukturnya sama dengan soal acuan,
dengan modifikasi sesuai strategi yang diminta.

Aturan:
- Pertahankan tingkat kesulitan (±100 ELO dari acuan, kecuali strategy=difficulty_ladder)
- Pertahankan jumlah langkah penyelesaian
- Pertahankan jenis errorTrap
- Pilihan harus 5 (A-E), distractor plausible
- Bahasa Indonesia
- Output ONLY valid JSON
```

**User prompt per strategy:**

```
SEED ACUAN:
- Topic: {topic}
- Difficulty: {difficulty}
- Pattern: {patternSignature}
- Soal: {seed.question}
- Pilihan: A. {A} ... E. {E}
- Kunci: {seed.answer}
- Pembahasan: {seed.explanation}

STRATEGY: {strategy}

INSTRUKSI per strategy:
[numerical_swap]:    Ganti SEMUA angka dengan angka baru yang sebanding.
                     Pertahankan struktur kalimat dan logika persis.

[context_swap]:      Ganti tema/konteks (misal: dari "petani" ke "pedagang").
                     Pertahankan struktur logika dan jumlah variabel.

[distractor_permute]: Pertahankan stem dan kunci, tapi ULIK ulang 4 distractor
                     supaya jadi lebih menjebak. Distractor harus represent
                     common student mistakes.

[inverted_prompt]:   Balikkan pertanyaan. Misal "manakah yang BENAR" jadi
                     "manakah yang TIDAK benar". Sesuaikan kunci.

[difficulty_ladder]: Generate versi {direction} dari seed (direction = "easier"
                     -150 ELO, atau "harder" +150 ELO). Sesuaikan kompleksitas
                     komputasi atau langkah.

Output JSON STRICT:
{
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
  "answer": "A|B|C|D|E",
  "explanation": "pembahasan langkah demi langkah",
  "trap": "common mistake (jika ada)",
  "difficulty": 800-1800,
  "errorTrap": "konseptual|komputasi|perangkap|ambiguitas",
  "modifiedFrom": "ringkasan apa yang diubah dari seed"
}
```

**Setelah generation:**
- Wajib lewat Solver Validator (dual-pass)
- Save dengan `parentSeedId`, `variationStrategy`, `validatedBy`
- Jika dual-pass mismatch:
  - Retry 1x dengan instruksi tambahan: "Variasi sebelumnya gagal validasi. Pastikan kunci jawaban benar dan tidak ambigu."
  - Jika masih mismatch → save dengan `validatedBy = 'unvalidated'`, `flagCount = 1`

---

## 25. URUTAN IMPLEMENTASI

**Phase 1 — Foundation (Day 1)**
1. Setup file structure, Context+reducer
2. CSS tokens & global styles
3. Storage layer (localStorage + IndexedDB wrapper, **schema v2.1**)
4. AppShell + Sidebar + TopBar

**Phase 2 — Onboarding & Core State (Day 2)**
5. OnboardingFlow (welcome, API key, date, diagnostic, plan preview)
6. Settings module
7. Theme switching

**Phase 3 — Foundation Data Layer (Day 3) — NEW v2.1**
8. **DailySeed module** (markdown parser, submit form, bank browse)
9. **Validation pipeline** (metadata extraction, dual-pass solver)
10. **Variation generator** (5 strategies, lazy generation)
11. Seed several example questions to bootstrap testing

**Phase 4 — Learning Modules (Day 4–5)**
12. ConceptEngine (pretest → explain → feynman → practice)
13. SpacedReview (with quality grading)
14. DrillMode (with confidence + ELO + **hybrid source mix**)

**Phase 5 — Advanced (Day 6)**
15. MockExam (**locked to seedBank** with pre-flight check)
16. MistakeNotebook
17. StudyPlanner

**Phase 6 — Polish (Day 7)**
18. TodayFlow with mission queue logic (include "Submit seed" task)
19. Command palette
20. Focus session
21. Microlearning loading states
22. Error handling refinement
23. Mobile responsive QA
24. Source badge & flag UI polish

---

## 26. QUALITY CHECKLIST

Sebelum dianggap selesai, verifikasi:

**Core (v2.0):**
- [ ] Tidak ada emoji di UI selain di body content user-generated (notebook notes)
- [ ] Semua API call punya loading state, error state, retry
- [ ] Tab key navigation works untuk semua input/button
- [ ] Cmd+K command palette berfungsi
- [ ] Streak tidak memberikan anxiety eksesif (grace day berfungsi)
- [ ] Diagnostic results mempengaruhi ELO awal
- [ ] SR quality grading 0–5 berpengaruh ke interval
- [ ] Confidence calibration log menghasilkan Brier score yang masuk akal
- [ ] Mistake notebook bisa filter, retry, mark-mastered
- [ ] Mock exam tidak bisa di-pause
- [ ] Focus mode benar-benar fokus (sidebar+notif suppressed)
- [ ] Export-import data round-trip sukses
- [ ] Theme switch (3 mode) tidak break layout
- [ ] Mobile bottom tab bar berfungsi
- [ ] Tanggal ujian configurable dan multiple

**Daily Seed (v2.1):**
- [ ] Markdown parser handle: valid file, missing field, malformed YAML, missing section
- [ ] LaTeX (`$...$` dan `$$...$$`) render correct di question/options/explanation
- [ ] Dual-pass validator panggil Claude **tanpa** kirim answer key
- [ ] Mismatch dual-pass tampilkan diff view ke user untuk konfirmasi
- [ ] Variation generator menghasilkan 5 strategi berbeda dengan output valid
- [ ] Variation auto-generate saat submit jika `autoVariateOnSubmit: true`
- [ ] Mock Exam pre-flight: tampil banner jika seed bank < threshold
- [ ] Mock Exam stratified sampling: distribusi proporsional terjaga
- [ ] Mock Exam tidak repeat soal jika `allowRepeat: false`
- [ ] Drill Mode default mix: 10/60/30 (seed/variation/pure_llm)
- [ ] Drill Mode fallback: jika seed/variation kosong, shift ratio gracefully
- [ ] Source badge tampil di setiap soal (toggle-able di Settings)
- [ ] Lapor button: increment flagCount, simpan reason, auto-disable jika flagCount ≥ 3
- [ ] Seed streak terpisah dari study streak, lebih lenient (gap > 7 days = reset)
- [ ] IndexedDB schema v2 migration dari v1 berjalan tanpa data loss
- [ ] Export JSON v2.1 include seedBank, variations, seedFlags

---

## 27. CATATAN PENTING

- **Tetap tidak ada backend.** Semua di browser.
- API key disimpan di localStorage dengan **explicit warning** di Onboarding & Settings.
- Soal pure_llm di-CACHE di IndexedDB (per topic + difficulty bucket) — hemat token.
- **Seed bank adalah aset paling berharga.** Backup rutin via Export JSON.
- Streak: grace day reset Senin 00:00 WIB. Seed streak gap-tolerance 7 hari.
- App harus fully usable offline kecuali API-dependent features — termasuk review mistakes, browse seed bank, lihat plan, browse notebook.
- **Aksesibilitas:** semua interactive element punya `aria-label`, contrast ratio ≥ 4.5:1, focus-visible jelas, prefers-reduced-motion respected.
- **Hak cipta soal:** seed bank yang user submit dianggap personal use. Export JSON yang dishare dengan orang lain harus disclaimer "untuk study group personal, bukan distribusi publik."
- **Kalibrasi sistem:** sistem ELO terkalibrasi via seed_real verified. Semakin banyak seed → ELO estimasi semakin akurat → adaptive difficulty Drill Mode semakin presisi.

---

*Blueprint v2.1 — SIMAK Study OS*
*Update Mei 2026. Dirancang untuk dieksekusi Claude Sonnet 4.5+ via Kiro.*
