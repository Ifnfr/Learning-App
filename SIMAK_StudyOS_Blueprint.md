# SIMAK Study OS — Blueprint Eksekusi v2.0
> Dokumen ini adalah spesifikasi lengkap untuk dieksekusi oleh Claude Opus via Kiro.
> **v2.0 (Mei 2026)** — Revisi besar atas v1.0 dengan fokus pada metode belajar berbasis riset, UI minimalis-tegas, dan efisiensi proses.

---

## 0. RINGKASAN PERUBAHAN DARI v1.0

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
        └── Settings          (Modul 8) — API key, export/import, theme
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

  // ─── Settings ───
  preferences: {
    pomodoroLength: 25,
    breakLength: 5,
    interleaveDefault: true,
    confidenceSlider: true,
    showStreakAnxiety: false,  // bisa di-disable jika user prefer "quiet mode"
    keyboardShortcuts: true,
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
IMPORT_DATA, RESET_ALL
```

Setiap action mutating menulis ke localStorage/IndexedDB sesuai kategori (lihat §10).

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

### Generate Soal

System prompt:
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
- Options: 5 button vertical, hover state subtle
- **Confidence slider** sebelum jawab (0–100, gradien dari muted ke gold)
- Hint button (jika hint mode ON, max 1 per drill, beri konfirmasi)
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

## 10. MODUL 5 — MOCK EXAM (NEW)

**Komponen:** `<MockExam />`

Simulasi penuh SIMAK UI: tidak ada hint, tidak ada feedback per soal, timer ketat.

### Setup
- Pilih: **Mini (20 soal, 30 min)** | **Half (60 soal, 90 min)** | **Full (120 soal, 180 min)**
- Konfirmasi modal: "Setelah dimulai, tidak bisa di-pause. Pastikan kondisi siap."

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

## 11. MODUL 6 — STUDY PLANNER v2

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

## 12. MODUL 7 — MISTAKE NOTEBOOK (NEW)

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

## 13. MODUL 8 — SETTINGS

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

## 14. ONBOARDING FLOW (NEW)

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

## 15. DESIGN SYSTEM v2

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

## 16. FOCUS MODE & POMODORO

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

## 17. COMMAND PALETTE (Cmd+K)

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

## 18. UTILITY FUNCTIONS

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

## 19. ERROR HANDLING & RESILIENCE

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

## 20. STORAGE STRATEGY

| Data | Lokasi | Alasan |
|---|---|---|
| API key | localStorage | Single small string |
| Preferences | localStorage | <1KB |
| `examDates`, `streak`, `topicMastery` | localStorage | Frequently read, small |
| `srQueue` | localStorage | <100 items typical |
| `drillHistory` (last 100) | localStorage | Recent, sering diakses |
| `drillHistory` (older) | IndexedDB | Bisa ribuan |
| `mistakes` | IndexedDB | Bisa ribuan, sering query/filter |
| `mockExamHistory` | IndexedDB | Berisi snapshot lengkap |
| `calibrationLog` | IndexedDB | Time-series data |

IndexedDB schema:
```javascript
const DB_NAME = 'simak_studyos';
const DB_VERSION = 1;
const STORES = {
  mistakes: { keyPath: 'id', indexes: ['subject', 'topic', 'mastered', 'timestamp'] },
  drillHistory: { keyPath: 'id', indexes: ['subject', 'timestamp'] },
  mockExamHistory: { keyPath: 'id', indexes: ['timestamp'] },
  calibrationLog: { keyPath: 'id', indexes: ['timestamp', 'subject'] },
};
```

**Export JSON:** dump semua state + IndexedDB data → file (max 10MB realistic).
**Import JSON:** validate schema, replace IndexedDB stores + dispatch `IMPORT_DATA` ke state.

---

## 21. PROMPT TEMPLATES (Append untuk Claude)

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
(Lihat §14 Langkah 4)

### Template Mock Exam
Sama seperti drill batch tapi N besar, distribusi merata 4 subject, no hint, full mix difficulty.

### Template Study Plan Generation
(Lihat §11)

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

## 22. URUTAN IMPLEMENTASI

**Phase 1 — Foundation (Day 1)**
1. Setup file structure, Context+reducer
2. CSS tokens & global styles
3. Storage layer (localStorage + IndexedDB wrapper)
4. AppShell + Sidebar + TopBar

**Phase 2 — Onboarding & Core State (Day 2)**
5. OnboardingFlow (welcome, API key, date, diagnostic, plan preview)
6. Settings module
7. Theme switching

**Phase 3 — Learning Modules (Day 3–4)**
8. ConceptEngine (pretest → explain → feynman → practice)
9. SpacedReview (with quality grading)
10. DrillMode (with confidence + ELO)

**Phase 4 — Advanced (Day 5)**
11. MockExam
12. MistakeNotebook
13. StudyPlanner

**Phase 5 — Polish (Day 6)**
14. TodayFlow with mission queue logic
15. Command palette
16. Focus session
17. Microlearning loading states
18. Error handling refinement
19. Mobile responsive QA

---

## 23. QUALITY CHECKLIST

Sebelum dianggap selesai, verifikasi:

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

---

## 24. CATATAN PENTING

- **Tetap tidak ada backend.** Semua di browser.
- API key disimpan di localStorage dengan **explicit warning** di Onboarding & Settings.
- Soal yang di-generate Claude **DI-CACHE** di IndexedDB (per topic + difficulty bucket) — hemat token, dan bisa di-reuse untuk SR review tanpa API call.
- Streak: grace day reset Senin 00:00 WIB.
- App harus fully usable offline kecuali API-dependent features — termasuk review mistakes, lihat plan, browse notebook.
- **Aksesibilitas:** semua interactive element punya `aria-label`, contrast ratio ≥ 4.5:1, focus-visible jelas, prefers-reduced-motion respected.

---

*Blueprint v2.0 — SIMAK Study OS*
*Update Mei 2026. Dirancang untuk dieksekusi Claude Sonnet 4.5+ via Kiro.*
