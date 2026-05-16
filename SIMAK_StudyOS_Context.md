# SIMAK Study OS — Context File v2.1
> File ini dibaca oleh Claude Opus di Kiro sebagai referensi latar belakang proyek.
> v2.1 (Mei 2026) — disinkronisasi dengan Blueprint v2.1.

---

## Siapa yang Menggunakan App Ini

**User:** Mahasiswa semester 2 jurusan Ekonomi Pembangunan di Indonesia, berlokasi di Kotabumi, Lampung. Sedang mempersiapkan **SIMAK UI** dengan target ujian configurable (default ditanya saat onboarding).

**Profil belajar:**
- Prefer penjelasan konsep sebelum soal — tapi v2.0 menambahkan **pretest** (forward testing effect)
- Familiar dengan tools digital dan React-based apps
- Background kuat di kuantitatif (matematika, statistika, ekonomi)
- Bahasa utama: Bahasa Indonesia, kemampuan Inggris aktif
- Sensitif terhadap streak anxiety — app menyediakan grace day & opsi mute streak

---

## Konteks Ujian SIMAK UI

4 mata uji yang diujikan:

| Mata Uji | Karakteristik Soal |
|---|---|
| **Matematika Dasar** | Aljabar, fungsi, trigonometri, logaritma, statistika, geometri, barisan & deret, peluang. Setara akhir SMA/awal kuliah. |
| **TPA (Tes Potensi Akademik)** | Analogi verbal, silogisme, deret angka, pola matriks, penalaran spasial & analitis. Mengukur logika dan abstraksi. |
| **Bahasa Inggris** | Reading comprehension, grammar, vocabulary in context, error identification, text completion. Setara TOEFL intermediate. |
| **Bahasa Indonesia** | Pemahaman wacana, ejaan & tanda baca, kalimat efektif, sinonim/antonim, penalaran paragraf, kohesi & koherensi. |

**Format ujian:** Pilihan ganda (5 opsi: A–E), penalti varies, berbasis komputer.

---

## Filosofi Pedagogis App — 8 Prinsip

App ini dibangun di atas 8 prinsip belajar berbasis riset (Dunlosky 2013, Bjork 2011, Roediger & Karpicke 2006, Wilson 2019, Kornell 2014):

### 1. Active Recall
Tidak ada "baca pasif". Semua interaksi berbasis menjawab/menulis.

### 2. Spaced Repetition (SM-2 modified)
Quality grading 0–5 (Anki-style) bukan binary. Interval adaptif berdasarkan ease factor per item.

### 3. Interleaving
Drill Mode mencampur subject/topic. Setelah 7 hari pertama, interleave default ON.

### 4. Elaborative Interrogation
Claude tutor menjelaskan APA dan MENGAPA, diakhiri pertanyaan Socratic.

### 5. Pretesting Effect (NEW v2.0)
Concept Engine selalu memulai dengan **1 pretest** sebelum penjelasan. User menebak duluan walau belum yakin. Riset (Kornell, 2014): forward testing effect meningkatkan retensi konsep yang akan datang.

### 6. Generation Effect (NEW v2.0)
**Feynman Loop**: setelah konsep dijelaskan, user diminta menjelaskan ulang dengan kata sendiri. Claude grade pemahaman dengan score + identify gaps.

### 7. Metacognitive Calibration (NEW v2.0)
Confidence slider 0–100% sebelum jawab. Brier score dihitung untuk feedback metakognisi. Tujuan: gap antara confidence dan accuracy menyempit seiring waktu.

### 8. Desirable Difficulty (NEW v2.0)
Adaptive ELO per topic. Drill mode target zona 75–85% accuracy (Wilson "85% Rule"). Variasi format soal: direct calc / applied scenario / trap question.

---

## Sumber Soal & Trust System (NEW v2.1)

App membedakan **3 tipe soal** dengan trust score berbeda — bukan semua soal sama kualitasnya.

| Tipe | Asal | Trust | Penggunaan Utama |
|---|---|---|---|
| `seed_real` | User submit dari soal SIMAK asli (file `.md`) | 1.0 (gold) | **Mock Exam exclusive** |
| `variation` | Claude generate dengan seed sebagai anchor + dual-pass validated | 0.85 | Drill Mode mayoritas |
| `pure_llm` | Claude generate dari topik saja (tanpa anchor) | 0.60 | Pretest, fallback |

**Filosofi:** Soal LLM-only "SIMAK-flavored" tidak benar-benar setara SIMAK asli. Kalibrasi distribusi kesulitan, gaya distractor, dan pola trap **harus** anchored ke soal real. Karena itu user diundang submit soal asli secara berkala (kapanpun ada akses) sebagai foundation calibration.

### Daily Seed Workflow

User membuat file `.md` dengan format YAML frontmatter + H1 sections:
```
data/seeds/{YYYY-MM-DD}-{subject_code}-{nn}.md
```

App memparse, ekstrak metadata via Claude (jika incomplete), lalu **dual-pass validate** — Claude solve dari nol tanpa lihat kunci. Jika match → save sebagai `seed_real`. Jika mismatch → flag, user konfirmasi.

**Auto-variation:** 1 variasi otomatis di-generate saat submit (5 strategi tersedia: numerical_swap, context_swap, distractor_permute, inverted_prompt, difficulty_ladder). Sisanya lazy on-demand saat Drill Mode butuh.

### Mock Exam Lock

Mock Exam **tidak menerima soal LLM-generated** — eksklusif dari seed bank. Pre-flight check:
- Mini (20 soal) butuh ≥ 20 seed
- Half (60 soal) butuh ≥ 60 seed
- Full (120 soal) butuh ≥ 120 seed

Jika kurang, banner blocking + opsi: submit lebih banyak / pilih ukuran lebih kecil / latihan dengan Drill Mode dulu.

### UI Transparency

Setiap soal punya **source badge** kecil (toggle-able):
- `[Asli · TryoutErlangga 2024]` — gold border
- `[Variasi · dari 2026-05-16]` — muted gold
- `[Latihan]` — no border

Tooltip: trust score, success rate, flag count.

### Constraint User: Akses Terbatas

User mungkin tidak bisa submit setiap hari karena keterbatasan akses ke soal asli. **Tidak ada paksaan harian.** Seed streak punya gap-tolerance 7 hari (lebih lenient dari study streak). Submit puluhan sekaligus saat ada akses ✓ tidak submit beberapa hari ✓ — sama-sama OK.

---

## Modul-Modul App

| Modul | Fungsi |
|---|---|
| **TodayFlow** | Entry point. Auto-generate Mission Queue 3–5 task hari ini berdasarkan priorities |
| **ConceptEngine** | Pretest → Explain (streaming) → Feynman → Practice → SR grading |
| **DrillMode** | Adaptive batch 10/20/40 soal, ELO-based difficulty, **hybrid source mix** (10% seed / 60% variation / 30% pure_llm) |
| **SpacedReview** | Queue review SM-2 dengan quality grade 0–5 |
| **MockExam** | Simulasi penuh 20/60/120 soal, **eksklusif dari seed bank**, no feedback during, full analytics after |
| **StudyPlanner** | Plan adaptif 4 minggu, drag-reschedule, adherence tracking |
| **MistakeNotebook** | Repository semua kesalahan, filter, retry, mark-mastered. IndexedDB. |
| **DailySeed** (NEW v2.1) | Submit soal asli SIMAK via markdown file, auto-generate variasi, manage bank |
| **Settings** | API key, theme (3 mode), preferences, export/import JSON |

---

## Batasan Teknis yang Harus Direspek

- **Single entry file** (`App.jsx`). Boleh dibagi internal sub-komponen, satu file.
- **Tidak ada backend** — tidak ada Express, server, database server.
- **Persistensi:**
  - localStorage (state ringan, frequently accessed)
  - **IndexedDB** (mistake notebook, drill history >100, calibration log, **seedBank, variations, seedFlags v2.1**)
- **API key dari user** di onboarding. Disimpan di localStorage dengan **explicit privacy warning**.
- **Model:** `claude-sonnet-4-5-20250929` (atau env var, fallback ke nilai ini).
- **Streaming wajib** untuk concept explanation (SSE parsing).
- **Prompt caching** Anthropic dipakai untuk system prompts panjang.
- **Tailwind via CDN** diizinkan, tapi semua design token didefinisi di CSS variables.
- **Tidak ada library UI tambahan** (no Radix, no shadcn, no MUI). Komponen native + Tailwind utility.

---

## Tone dan Bahasa UI

- Semua teks UI dalam **Bahasa Indonesia**
- Tone: serius tapi tidak kaku — seperti senior membantu adik kelas
- **Hindari** kata motivasi klise ("Ayo semangat!", "Kamu pasti bisa!", "Hebat!")
- Gunakan kata actionable: "Pelajari", "Latihan", "Review", "Analisis", "Refleksikan"
- Error messages informatif: "API key tidak valid — pastikan dimulai dengan `sk-ant-`" bukan "Error occurred"
- **Loading state = microlearning**: tampilkan tip riset belajar, bukan spinner generik
- Empty state = quote akademik dari array kurated, bukan placeholder

---

## Keputusan Desain yang Sudah Final

1. **Dark academic aesthetic** sebagai default — warm blacks, gold accent, serif fonts. Referensi: jurnal lama, perpustakaan tua. **3 theme tersedia**: Academic Dark (default), Academic Light, Parchment (sepia).
2. **Font:** Playfair Display (heading) + Source Serif 4 (body) + JetBrains Mono (code/API key) dari Google Fonts.
3. **Aksen tunggal:** Gold (`#c9a84c`). Subject colors muted secondary.
4. **Animasi minimal:** hanya 4 jenis (fade, slide, width transition, subtle pulse). Respect `prefers-reduced-motion`.
5. **Sidebar:** expanded di desktop, icon-only di tablet, **bottom tab bar** di mobile (4 tab inti).
6. **Icon system:** SVG monoline (Lucide-style) inline. **Tidak ada emoji** di UI navigasi/aksi.
7. **Tipografi:** modular scale 1.333. Reading content max-width 720px (65ch).

---

## Keputusan yang Boleh Difleksibilisasi

- Cara exact parsing response Claude (boleh adjust prompt format jika ada yang lebih reliable)
- Breakpoint responsive (sesuaikan dengan judgment)
- Urutan field di card/komponen kecil
- Daftar topik per subject (boleh dikurangi/disesuaikan)
- Wording tombol (selama makna sama)
- Implementasi visualisasi sparkline/heatmap (boleh canvas, SVG, atau library kecil seperti Tailwind utility)
- Detail UI Command Palette (selama Cmd+K trigger ada)

---

## Edge Cases & Error Handling

| Skenario | Penanganan |
|---|---|
| API key salah/expired | Disable AI features, banner persistent dengan link ke Settings |
| Rate limit (429) | Exponential backoff 1s→2s→4s, max 3 retries, lalu user-facing message |
| JSON parse fail | Retry once, lalu raw response display + report bug option |
| srQueue kosong | Empty state informatif, suggest action |
| Tanggal ujian lewat | Banner persistent, prompt update di Settings |
| localStorage quota | Auto-prune oldest, migrate ke IndexedDB |
| IndexedDB tidak tersedia | Graceful degrade: notebook batas 100 items di localStorage |
| Offline | UI fully usable except API features. Banner offline indicator |
| Mistake notebook >5000 entri | Auto-prune mastered terlama dengan notice |
| Diagnostic incomplete | Save partial, resume on next open |
| Streak gap >2 hari | Reset, kecuali grace day belum dipakai |
| **Seed bank < threshold untuk Mock Exam** (v2.1) | Pre-flight banner block + opsi alternatif |
| **Markdown parse error** (v2.1) | Tampilkan error spesifik (line number jika bisa), preserve user input untuk retry |
| **Dual-pass mismatch saat submit seed** (v2.1) | Modal diff view: kunci user vs Claude, user pilih confirm / edit / cancel |
| **Variation generation gagal validasi** (v2.1) | Retry 1x dengan instruksi tambahan, lalu save sebagai unvalidated dengan flagCount=1 |
| **Seed file duplicate ID** (v2.1) | Warning, opsi: replace existing / generate new ID / cancel |

---

## Privacy & Keamanan

- API key di localStorage **TIDAK terenkripsi**. Warning explicit di Onboarding & Settings.
- "Hanya gunakan di device pribadi" — disclaimer di Onboarding step 2.
- Reset all: double-confirm modal dengan typing "RESET" untuk konfirmasi.
- Export JSON **TIDAK menyertakan** API key (privacy).
- Tidak ada telemetri / analytics / tracking pihak ketiga.

---

## Aksesibilitas

- Semua interactive element punya `aria-label` jelas
- Contrast ratio ≥ 4.5:1 untuk teks normal, ≥ 3:1 untuk UI elements
- Focus-visible style jelas (gold ring 2px) untuk keyboard navigation
- Tab order logical
- `prefers-reduced-motion: reduce` → disable semua animasi
- Skip-to-content link
- Form labels eksplisit, bukan placeholder-only
- Modal trap focus + Esc to close
- Status announcements (`aria-live`) untuk timer dan loading

---

## Referensi File

| File | Isi |
|---|---|
| `SIMAK_StudyOS_Blueprint.md` | Spesifikasi teknis lengkap — modul, state, algoritma, design system, prompts |
| `SIMAK_StudyOS_Context.md` | File ini — latar belakang, filosofi 8 prinsip, batasan, tone, edge cases |

**Baca Blueprint lebih dulu, gunakan Context sebagai referensi saat ada ambiguitas keputusan.**

---

## Changelog

### v2.1 (Mei 2026) — Daily Seed & Source-Aware Routing
- **Modul baru: DailySeed** — user submit soal asli SIMAK via file `.md` dengan YAML frontmatter
- **3 tipe soal dengan trust score**: `seed_real` (1.0), `variation` (0.85), `pure_llm` (0.6)
- **Markdown parser** sederhana untuk format seed (no library)
- **Validation Pipeline 3-tahap**: Metadata Extraction → Dual-Pass Solver (Claude solve tanpa lihat kunci) → Quality Check
- **Variation Generator** dengan 5 strategi: numerical_swap, context_swap, distractor_permute, inverted_prompt, difficulty_ladder
- **Hybrid generation di Drill Mode**: default mix 10% seed + 60% variation + 30% pure_llm (configurable)
- **Mock Exam locked to seedBank** — pre-flight check, stratified sampling per subject, no-repeat option
- **Source badge UI** transparan di setiap soal + tooltip detail
- **"Lapor soal" feedback loop** — auto-disable jika flagCount ≥ 3
- **Seed streak terpisah** dari study streak, gap-tolerance 7 hari (lebih lenient)
- **IndexedDB schema v2** — 3 store baru (seedBank, variations, seedFlags) + migration handler
- **3 prompt template baru**: Pattern Extraction, Solver Validator, Variation Generator
- **Auto-variate on submit** — 1 variasi background generated saat submit seed
- **File System Access API** opsional untuk Chrome/Edge sync folder seeds
- Konflik nomor modul fix: Settings dipindah ke Modul 9, DailySeed jadi Modul 8

### v2.0 (Mei 2026) — Foundational Rebuild
- Tambah 4 prinsip belajar: Pretesting, Generation Effect, Metacognitive Calibration, Desirable Difficulty
- Tambah 3 modul: MockExam, MistakeNotebook, dan TodayFlow (replace Dashboard)
- Tambah Onboarding flow 5-step dengan diagnostic assessment
- SM-2 upgrade: quality grading 0–5 (dari binary)
- Drill Mode: adaptive ELO, confidence calibration, error categorization
- Concept Engine: tambah Pretest + Feynman Loop
- Tanggal ujian configurable (tidak lagi hardcoded)
- Storage: tambah IndexedDB untuk data besar
- UI: 3 theme (dark/light/parchment), icon SVG (no emoji), microlearning loading
- Tambah: Focus Mode + Pomodoro, Command Palette (Cmd+K), Export/Import JSON
- Streak grace day, mute option (anti streak-anxiety)
- Aksesibilitas: WCAG AA, prefers-reduced-motion, full keyboard nav

### v1.0
- 5 modul dasar, 4 prinsip belajar, SM-2 binary, hardcoded tanggal

---

*Context v2.1 — SIMAK Study OS*
