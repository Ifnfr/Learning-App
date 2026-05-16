# SIMAK Study OS — Execution Guide for Non-Coders
> File ini berisi instruksi langkah demi langkah untuk membangun app dari Blueprint v2.1.
> **Target:** Anda hanya perlu copy-paste prompt ke Kiro Autonomous Mode.

---

## Prasyarat (1x saja, sebelum mulai)

### Yang Anda Butuhkan
- Akun GitHub (sudah ada: Ifnfr/Learning-App)
- Akun [Vercel](https://vercel.com) — gratis, daftar pakai GitHub
- Kiro dengan Autonomous Mode
- Anthropic API key (untuk testing app nanti)

### Setup Vercel (5 menit, manual)
1. Buka https://vercel.com → Sign up with GitHub
2. Import repo `Ifnfr/Learning-App`
3. Framework preset: **Vite**
4. Deploy — hasilnya URL `https://learning-app-xxx.vercel.app`
5. Setiap push ke `main` = auto-deploy

Setelah ini, **setiap kali Kiro push kode ke main, app otomatis live**.

---

## Keputusan Teknis (Sudah Final)

| Aspek | Keputusan | Alasan |
|---|---|---|
| Build tool | **Vite** | Cepat, zero-config untuk React |
| File structure | **5 file** (bukan single-file) | Realistis untuk 2000+ baris |
| Deployment | **Vercel** (free tier) | Auto-deploy, HTTPS gratis |
| CORS Anthropic API | `dangerouslyAllowBrowser: true` | Tanpa backend, personal use |
| CSS | **Tailwind CLI** via Vite plugin | Full JIT support |
| LaTeX rendering | **KaTeX** via CDN | Untuk soal matematika |
| File split | `src/App.jsx`, `src/modules/`, `src/lib/storage.js`, `src/lib/prompts.js`, `src/lib/validation.js` | Maintainable |

### Constraint Relaxed dari Blueprint v2.1
- ~~Single-file React~~ → **5+ file** (entry + modules + lib)
- ~~Tailwind via CDN~~ → **Tailwind via Vite plugin** (full JIT)
- ~~No library~~ → **Izinkan:** `@anthropic-ai/sdk`, `katex` (rendering math)

---

## Execution Sessions (Copy-Paste ke Kiro Autonomous)

### Session 0: PROJECT SETUP

**Prompt untuk Kiro Autonomous:**

```
Saya ingin setup project React + Vite di repo GitHub saya (Ifnfr/Learning-App).

Lakukan:
1. Inisialisasi Vite project dengan React template di root repo
2. Install dependencies: @anthropic-ai/sdk, katex
3. Setup Tailwind CSS via Vite plugin (@tailwindcss/vite)
4. Buat file structure:
   src/
   ├── App.jsx          (entry, routing antar modul)
   ├── main.jsx         (ReactDOM render)
   ├── index.css        (Tailwind imports + CSS variables dari Blueprint §15)
   ├── modules/         (folder untuk setiap modul)
   ├── lib/
   │   ├── storage.js   (localStorage + IndexedDB wrapper)
   │   ├── prompts.js   (semua prompt templates)
   │   ├── validation.js (dual-pass, metadata extraction, markdown parser)
   │   ├── algorithms.js (SM-2, ELO, streak, Brier score)
   │   └── api.js       (callClaude wrapper dengan streaming + retry)
   └── components/      (shared UI: Card, Button, Badge, Modal, etc.)
5. Setup CSS variables sesuai Blueprint §15.1 (color tokens) di index.css
6. Pastikan `npm run dev` berjalan tanpa error
7. Commit dan push ke branch `setup-project`

Referensi: baca file SIMAK_StudyOS_Blueprint.md §15 untuk design tokens dan §1 untuk meta-instruksi.
```

---

### Session 1: CORE STATE + STORAGE + SHELL

**Prompt:**

```
Lanjutkan dari project yang sudah di-setup. Implementasikan:

1. Global state dengan useReducer + Context API sesuai Blueprint §4
   - Semua initialState fields
   - Semua reducer actions
   - Persistensi ke localStorage (state ringan) dan IndexedDB (data besar)

2. IndexedDB wrapper (src/lib/storage.js) sesuai Blueprint §23
   - Schema v2 dengan semua stores (mistakes, drillHistory, mockExamHistory, calibrationLog, seedBank, variations, seedFlags)
   - Migration handler onUpgradeNeeded
   - CRUD functions: saveToIDB, loadFromIDB, deleteFromIDB, queryByIndex

3. AppShell layout:
   - Sidebar (expanded desktop, icon-only tablet, bottom tab mobile)
   - TopBar (streak, focus mode toggle)
   - MainContent area dengan routing berdasarkan state.activeModule
   - Navigation antar modul via dispatch SET_MODULE

4. ThemeProvider yang switch CSS variables berdasarkan state.theme

Referensi: Blueprint §2 (arsitektur), §4 (state), §15 (design system), §23 (storage)
Pastikan app menampilkan shell kosong yang bisa navigate antar modul.
Commit ke branch `phase-1-foundation`.
```

---

### Session 2: ONBOARDING + SETTINGS

**Prompt:**

```
Implementasikan OnboardingFlow dan Settings module:

1. OnboardingFlow (5 langkah, sesuai Blueprint §17):
   - Step 1: Welcome screen
   - Step 2: API key input + validasi format sk-ant-* + test call
   - Step 3: Date picker tanggal ujian
   - Step 4: Diagnostic Assessment (8 soal via Claude API)
   - Step 5: Generated study plan preview

2. Settings module (Blueprint §16):
   - Tab Akun: API key edit/validate
   - Tab Preferensi: pomodoro, confidence slider, theme switch
   - Tab Data: Export/Import JSON, Reset

3. API wrapper (src/lib/api.js):
   - callClaude() function dengan:
     - dangerouslyAllowBrowser: true
     - Streaming support (stream: true + SSE parsing)
     - Exponential backoff retry
     - Error categorization (401, 429, network)
   - Model: claude-sonnet-4-5-20250929

4. Theme switching functional (3 mode: academic-dark, academic-light, parchment)

Referensi: Blueprint §14 (Onboarding), §16 (Settings), §19 (Error handling), §22 (API wrapper)
Test: app harus bisa onboard user baru, simpan API key, dan redirect ke TodayFlow.
Commit ke branch `phase-2-onboarding`.
```

---

### Session 3: DAILY SEED + VALIDATION PIPELINE

**Prompt:**

```
Implementasikan DailySeed module dan Validation Pipeline:

1. Markdown Parser (src/lib/validation.js) sesuai Blueprint §11.5:
   - parseSeedMarkdown(rawText) → Question object
   - parseSimpleYAML(yaml) → metadata object
   - Validasi: frontmatter fields, body sections, pilihan A-E, kunci valid

2. Submit Pipeline (Blueprint §11.6):
   - Parse → Auto-metadata (Claude call jika field kosong) → Dual-pass validate → Save IndexedDB → Auto-variate (1 variasi)

3. Dual-Pass Solver (Blueprint §12.3):
   - dualPassValidate(question) → { validated, claudeAnswer, reasoning }
   - Solver prompt TANPA kirim answer key

4. Variation Generator (Blueprint §12.5):
   - generateVariation(parentSeed, strategy) → variation object
   - 5 strategi: numerical_swap, context_swap, distractor_permute, inverted_prompt, difficulty_ladder
   - Validate variation juga via dual-pass

5. DailySeed UI (Blueprint §11.2-11.9):
   - Tab "Submit Baru": textarea + live preview + submit button
   - Tab "Bank Soal": list + filter (subject, difficulty, verified)
   - Tab "Variasi": grouped by parent seed
   - Tab "Statistik": seed count, distribution per subject

Referensi: Blueprint §10 (Source Strategy), §11 (Daily Seed), §12 (Validation Pipeline), §24 (Prompt Templates v2.1)
Test: user bisa paste markdown soal, app parse, validate, simpan ke IndexedDB, generate 1 variasi.
Commit ke branch `phase-3-daily-seed`.
```

---

### Session 4: CONCEPT ENGINE + SPACED REVIEW

**Prompt:**

```
Implementasikan ConceptEngine dan SpacedReview:

1. ConceptEngine (Blueprint §7) — full flow:
   - Step 0: Subject & topic selection dengan ELO indicator
   - Step 1: Pretest (1 soal Claude, confidence slider, no feedback)
   - Step 2: Concept Explanation (STREAMING — teks muncul karakter per karakter)
   - Step 3: Feynman Loop (textarea user → Claude grade → score dial)
   - Step 4: Practice Question (confidence slider, reveal pretest comparison)
   - Step 5: SM-2 grading (4 tombol: Lupa/Sulit/Pas/Mudah)

2. SpacedReview (Blueprint §9):
   - Single column queue
   - Card flip animation (front=question, back=answer)
   - Quality grading 0-5
   - Tab: Hari Ini / Akan Datang / Mastered / Leeches
   - Empty state

3. SM-2 Algorithm (src/lib/algorithms.js) sesuai Blueprint §5.1:
   - calculateNextReview(item, quality)
   - Ease factor adjustment
   - Interval capping 60 days

4. ELO update setelah menjawab (Blueprint §5.2)

Referensi: Blueprint §7, §9, §5.1, §5.2
Test: user bisa pilih topic → pretest → explanation streaming → feynman → practice → add to SR queue → review dari queue.
Commit ke branch `phase-4-concept-review`.
```

---

### Session 5: DRILL MODE

**Prompt:**

```
Implementasikan DrillMode dengan hybrid source mix:

1. Setup Screen (Blueprint §8):
   - Mode: Adaptive / Free Choice
   - Jumlah: 10/20/40
   - Timer: Off/60s/90s
   - Confidence mode toggle
   - Source mix slider (seed/variation/pure_llm ratio)

2. Hybrid Generate Soal (Blueprint §8 "Generate Soal Hybrid v2.1"):
   - Pull seed dari IndexedDB seedBank
   - Pull variation dari IndexedDB variations
   - Generate pure_llm batch via Claude (jika slot tersisa)
   - Fallback behavior jika bank kosong
   - Shuffle untuk interleaving

3. Drill Screen:
   - Progress bar + timer circular
   - Question card dengan source badge
   - Confidence slider
   - Lapor button (flag soal)
   - Inter-question reflection (setelah salah)

4. Result Screen:
   - Skor + accuracy breakdown
   - ELO delta per topic
   - Error breakdown (konseptual/komputasi/perangkap/ambiguitas)
   - Actions: add salah ke Mistake Notebook, drill ulang terlemah

5. Update ELO setelah setiap jawaban

Referensi: Blueprint §8, §10.3 (routing), §5.2 (ELO)
Test: drill 10 soal interleave, source badge muncul, result screen lengkap, ELO update.
Commit ke branch `phase-5-drill`.
```

---

### Session 6: MOCK EXAM + MISTAKE NOTEBOOK + STUDY PLANNER

**Prompt:**

```
Implementasikan 3 modul advanced:

1. MockExam (Blueprint §13):
   - Pre-flight check: block jika seedBank < threshold
   - Setup: Mini/Half/Full, distribusi subject, no-repeat toggle
   - Soal selection algorithm (stratified sample dari seedBank saja)
   - Exam screen: distraction-free, timer, navigation grid, mark-for-review
   - Submit: Analytics Report via Claude (skor, error pattern, prioritas)
   - History: trend line skor antar mock

2. MistakeNotebook (Blueprint §15):
   - Filter bar: subject, error category, status
   - List kartu mistake
   - Retry mode: free recall → reveal → 3x benar = mastered
   - Bulk: drill 10 mistake terbaru

3. StudyPlanner (Blueprint §14):
   - Tab "Plan saya": kalender mingguan
   - Tab "Generate ulang": input form → Claude generate jadwal
   - Render: kartu minggu dengan task per hari
   - "Mulai task ini" → navigate ke modul

Referensi: Blueprint §13, §14, §15
Test: Mock Exam pre-flight block (karena seed < 20), Mistake Notebook filter works, StudyPlanner generate jadwal.
Commit ke branch `phase-6-advanced`.
```

---

### Session 7: TODAY FLOW + POLISH

**Prompt:**

```
Implementasikan TodayFlow dan polish:

1. TodayFlow (Blueprint §6):
   - Hero strip: "Hari ke-N", countdown, streak
   - Mission Queue algorithm (5 prioritas)
   - 4 sparkline per subject (accuracy 7 hari)
   - Heatmap 30 hari (gold tone)
   - Empty state: quote akademik

2. Focus Mode + Pomodoro (Blueprint §19):
   - Timer overlay, sidebar collapse, tab title update
   - Break mode with quote

3. Command Palette Cmd+K (Blueprint §20):
   - Overlay modal, search, actions

4. Microlearning loading states (tips random saat API call)

5. Mobile responsive:
   - Bottom tab bar (4 tab inti) untuk < 640px
   - Sidebar icon-only untuk 640-1023px

6. Accessibility pass:
   - aria-labels, focus-visible, prefers-reduced-motion
   - Contrast check

Referensi: Blueprint §6, §16, §17, §18.7
Test: buka app → TodayFlow tampil mission queue → navigate semua modul → mobile view OK.
Commit ke branch `phase-7-polish`.
```

---

## Setelah Semua Session Selesai

### Testing Manual (Anda sendiri)
1. Buka URL Vercel
2. Onboarding → masukkan API key Anda
3. Submit 1-2 seed dari file contoh `data/seeds/`
4. Coba Concept Engine → Drill Mode → lihat hasil
5. Jika ada bug → buka session Kiro Vibe baru, describe masalah + screenshot

### Maintenance Harian
- Submit soal baru: buat file `.md` di `data/seeds/` mengikuti template, lalu paste ke Daily Seed module di app
- App auto-generate variasi + validate
- Setelah 20+ seed → Mock Exam unlocked

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| "CORS error" saat API call | Pastikan pakai `@anthropic-ai/sdk` dengan `dangerouslyAllowBrowser: true` |
| App blank setelah deploy | Cek Vercel logs, mungkin build error |
| Soal tidak muncul di Drill | Seed bank kosong — submit soal dulu di Daily Seed |
| Mock Exam blocked | Normal — butuh minimal 20 seed di bank |
| "Cannot read property of undefined" | Bug — screenshot + kirim ke Kiro Vibe untuk fix |
| Streaming tidak jalan | Fallback ke non-streaming sudah di-handle di api.js |

---

## Estimasi Waktu Total

| Langkah | Durasi | Siapa |
|---|---|---|
| Setup Vercel | 5 menit | Anda (manual) |
| Session 0: Project setup | ~15 menit Kiro | Kiro Autonomous |
| Session 1-7: Implementasi | ~7 × 20 menit | Kiro Autonomous |
| Testing + bug fix | ~2-3 session | Kiro Vibe (Anda describe, Kiro fix) |
| **Total** | **~3-4 jam Kiro time** | Spread across beberapa hari OK |

---

## Tips Penting

1. **Jangan jalankan semua session sekaligus.** Selesaikan 1 session → test di browser → lanjut session berikutnya.
2. **Setiap session harus commit + push.** Agar Vercel auto-deploy dan Anda bisa test live.
3. **Jika session gagal di tengah**, copy error message → paste ke session baru dengan prefix: "Fix error berikut: [error]"
4. **Blueprint adalah referensi utama.** Setiap prompt merujuk ke section Blueprint yang relevan.
5. **Anda TIDAK perlu baca kode.** Cukup test apakah app berjalan sesuai harapan di browser.

---

*Execution Guide v1.0 — SIMAK Study OS*
*Dibuat untuk user non-coder yang mengeksekusi via Kiro Autonomous.*
