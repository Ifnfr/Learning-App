# SIMAK Study OS — Blueprint Eksekusi
> Dokumen ini adalah spesifikasi lengkap untuk dieksekusi oleh Claude Opus via Kiro.
> Target: Aplikasi React single-file yang siap dijalankan di browser.

---

## 0. META-INSTRUKSI UNTUK CLAUDE OPUS

Kamu akan membangun sebuah React application bernama **SIMAK Study OS**. Ini adalah alat belajar intensif untuk persiapan ujian SIMAK UI yang mencakup 4 mata uji: Matematika Dasar, TPA (Tes Potensi Akademik), Bahasa Inggris, dan Bahasa Indonesia.

**Prinsip eksekusi:**
- Gunakan satu file `.jsx` saja (single-file React)
- Semua state dikelola dengan `useState` dan `useReducer`
- Persistensi data menggunakan `localStorage`
- Panggil Anthropic API langsung dari frontend (fetch ke `https://api.anthropic.com/v1/messages`)
- Model: `claude-sonnet-4-20250514`, max_tokens: 1024
- **Jangan gunakan** API key hardcoded — baca dari state input yang disediakan user
- Desain: **dark academic aesthetic** — warna dominan `#0f0e0d` (near-black warm), aksen `#c9a84c` (gold), teks `#e8e0d0` (parchment). Font: `'Playfair Display'` untuk heading, `'Source Serif 4'` untuk body (import dari Google Fonts).

---

## 1. STRUKTUR APLIKASI

```
App
├── AppProvider (Context: globalState, dispatch)
├── ApiKeyGate          ← Layar pertama jika API key belum diset
├── Layout
│   ├── Sidebar         ← Navigasi antar modul
│   └── MainContent
│       ├── Dashboard         (Modul 1)
│       ├── ConceptEngine     (Modul 2)
│       ├── DrillMode         (Modul 3)
│       ├── SRTracker         (Modul 4)
│       └── StudyPlanner      (Modul 5)
```

---

## 2. GLOBAL STATE (useReducer)

```javascript
const initialState = {
  apiKey: localStorage.getItem('simak_apikey') || '',
  activeModule: 'dashboard',
  examDate: '2025-06-14',        // hardcoded target
  progress: {
    matematika: 0,               // 0–100
    tpa: 0,
    bahasa_inggris: 0,
    bahasa_indonesia: 0,
  },
  streak: parseInt(localStorage.getItem('simak_streak') || '0'),
  lastStudyDate: localStorage.getItem('simak_lastdate') || null,
  srQueue: JSON.parse(localStorage.getItem('simak_sr') || '[]'),
  // srQueue item: { id, subject, topic, concept, nextReview: Date, interval: 1, failCount: 0 }
  drillHistory: JSON.parse(localStorage.getItem('simak_drill') || '[]'),
  // drillHistory item: { subject, topic, question, userAnswer, correct, timestamp }
}
```

**Actions yang dibutuhkan:**
- `SET_API_KEY`
- `SET_MODULE`
- `UPDATE_PROGRESS` — payload: `{ subject, delta }`
- `ADD_SR_ITEM` — payload: srQueue item
- `UPDATE_SR_ITEM` — payload: `{ id, correct }` → hitung nextReview
- `LOG_DRILL` — payload: drillHistory item
- `INCREMENT_STREAK`

Setiap action yang mengubah data harus memanggil `localStorage.setItem` di dalam reducer.

---

## 3. ALGORITMA SPACED REPETITION

Implementasikan SM-2 sederhana:

```javascript
function calculateNextReview(item, correct) {
  if (correct) {
    const newInterval = item.interval === 1 ? 3 : Math.round(item.interval * 2.5);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);
    return { ...item, interval: newInterval, nextReview: nextReview.toISOString(), failCount: 0 };
  } else {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);
    return { ...item, interval: 1, nextReview: nextReview.toISOString(), failCount: item.failCount + 1 };
  }
}
```

---

## 4. MODUL 1 — DASHBOARD

**Komponen: `<Dashboard />`**

Layout 2 kolom:

**Kolom kiri:**
- Countdown besar ke 14 Juni (hitung hari, jam, menit secara real-time dengan `setInterval`)
- Format: `"28 hari 14 jam 32 menit"`
- Warna berubah: >21 hari = gold, 7–21 hari = amber, <7 hari = red

**Kolom kanan (4 card):**
Masing-masing mata uji menampilkan:
- Nama mata uji
- Progress bar animasi (CSS transition)
- Persentase konsep dikuasai
- Tombol "Mulai Belajar" → navigate ke ConceptEngine dengan subject terisi

**Bawah (full width):**
- **Today's Mission**: Tampilkan 3 item dari srQueue yang `nextReview <= today`
- **Streak**: `🔥 {streak} hari berturut-turut`
- **Overall Readiness Score**: rata-rata dari 4 progress × 100, tampilkan sebagai angka besar + label (0–40: "Perlu Kerja Keras", 41–70: "Progres Baik", 71–90: "Hampir Siap", 91–100: "Siap Tempur")

---

## 5. MODUL 2 — CONCEPT ENGINE

**Komponen: `<ConceptEngine />`**

Ini adalah modul utama. Flow:

### Step 1: Subject & Topic Selection
Dropdown 1: Pilih mata uji
```javascript
const subjects = {
  matematika: ['Aljabar', 'Fungsi & Grafik', 'Trigonometri', 'Logaritma & Eksponen', 'Statistika', 'Geometri', 'Barisan & Deret', 'Peluang'],
  tpa: ['Analogi Verbal', 'Silogisme', 'Deret Angka', 'Matriks Pola', 'Penalaran Spasial', 'Penalaran Analitis', 'Logika Proposisi'],
  bahasa_inggris: ['Reading Comprehension', 'Grammar (Tenses)', 'Vocabulary in Context', 'Error Identification', 'Text Completion', 'Structure & Written Expression'],
  bahasa_indonesia: ['Pemahaman Wacana', 'Ejaan & Tanda Baca', 'Kalimat Efektif', 'Sinonim & Antonim', 'Penalaran Paragraf', 'Kohesi & Koherensi']
}
```

Dropdown 2: Pilih topik (tergantung subject)

Tombol: **"Pelajari Konsep"**

### Step 2: Concept Explanation (Claude API Call)

Ketika tombol ditekan, panggil Claude API dengan system prompt berikut:

```
System: Kamu adalah tutor ahli persiapan SIMAK UI. Tugasmu menjelaskan konsep ujian dengan metode Elaborative Interrogation — tidak hanya APA tapi MENGAPA. Selalu gunakan: (1) definisi ringkas, (2) analogi sehari-hari yang relevan untuk mahasiswa Indonesia, (3) rumus atau pola kunci jika ada, (4) 1 contoh soal setara SIMAK dengan pembahasan langkah-demi-langkah. Format respons dalam bagian yang jelas. Gunakan bahasa Indonesia yang lugas. Akhiri dengan pertanyaan Socratic: "Coba pikirkan: [pertanyaan yang menguji pemahaman]".
```

```
User: Jelaskan topik "{topic}" dalam mata uji "{subject}" untuk persiapan SIMAK UI.
```

Tampilkan respons Claude dengan **streaming** (jika bisa) atau loading spinner.

Setelah respons muncul, tampilkan dua tombol:
- **"Sudah Paham, Lanjut ke Latihan Soal"** → trigger Step 3
- **"Minta Penjelasan Ulang dengan Cara Berbeda"** → call API lagi dengan tambahan "Jelaskan ulang dengan analogi yang berbeda dan lebih sederhana."

### Step 3: Practice Question (Claude API Call)

```
System: [sama seperti di atas]
User: Berikan 1 soal latihan tingkat SIMAK UI tentang "{topic}" mata uji "{subject}". Format:
SOAL: [teks soal]
A) [pilihan]
B) [pilihan]
C) [pilihan]
D) [pilihan]
E) [pilihan]
JAWABAN: [huruf]
PEMBAHASAN: [penjelasan mengapa jawaban itu benar, langkah demi langkah]

Pisahkan soal, pilihan, dan pembahasan dengan delimiter yang jelas. Sembunyikan JAWABAN dan PEMBAHASAN dulu — hanya tampilkan setelah user menjawab.
```

Parse respons untuk memisahkan: soal, pilihan A–E, jawaban benar, pembahasan.

Tampilkan soal + 5 pilihan sebagai radio button. Tombol **"Jawab"**.

Setelah user menjawab:
- Jika benar: animasi ✓ hijau, tampilkan pembahasan, tombol "Tandai Dikuasai" 
- Jika salah: animasi ✗ merah, tampilkan pembahasan, tombol "Masukkan ke Review List"

**"Tandai Dikuasai"** → dispatch `UPDATE_PROGRESS` (delta +2) + dispatch `ADD_SR_ITEM` dengan interval awal 3 hari

**"Masukkan ke Review List"** → dispatch `ADD_SR_ITEM` dengan interval awal 1 hari + dispatch `UPDATE_PROGRESS` (delta +0.5)

---

## 6. MODUL 3 — DRILL MODE

**Komponen: `<DrillMode />`**

### Setup Screen
- Pilih subject (atau "Semua — Mode Interleaving")
- Pilih jumlah soal: 5, 10, 20
- Toggle: Mode Timer (30 detik/soal) ON/OFF
- Tombol "Mulai Drill"

### Drill Screen

State lokal:
```javascript
const [questions, setQuestions] = useState([])  // generated by Claude
const [currentIdx, setCurrentIdx] = useState(0)
const [answers, setAnswers] = useState([])
const [timeLeft, setTimeLeft] = useState(30)
const [phase, setPhase] = useState('loading' | 'question' | 'result')
```

**Generate soal:** Panggil Claude API sekali untuk generate semua soal sekaligus:

```
System: Kamu adalah pembuat soal SIMAK UI profesional. Return ONLY valid JSON. No markdown, no explanation.
User: Generate {n} soal pilihan ganda tingkat SIMAK UI untuk mata uji {subject}.
Format JSON yang harus dikembalikan (array of objects):
[
  {
    "id": 1,
    "subject": "matematika",
    "topic": "Logaritma",
    "question": "teks soal",
    "options": {"A": "...", "B": "...", "C": "...", "D": "...", "E": "..."},
    "answer": "B",
    "explanation": "penjelasan singkat"
  }
]
Jika mode interleaving, campur semua 4 mata uji secara merata.
```

Parse JSON response. Tampilkan satu per satu.

**Progress bar** di atas: soal ke-X dari N

**Timer** (jika aktif): countdown circular dengan CSS animation, merah saat <10 detik. Auto-submit jika habis.

### Result Screen

Setelah semua soal selesai:
- Skor: X/N benar
- Accuracy per subject (jika interleaving)
- **Error Analysis**: list soal yang salah dengan topiknya
- Tombol "Masukkan Semua yang Salah ke Review List" → batch dispatch `ADD_SR_ITEM`
- Tombol "Drill Ulang Topik Terlemah" → kembali ke setup dengan subject/topik terlemah otomatis terisi

Dispatch `LOG_DRILL` untuk setiap soal.

---

## 7. MODUL 4 — SPACED REPETITION TRACKER

**Komponen: `<SRTracker />`**

Layout 3 kolom (Kanban-style):

**Kolom "Review Hari Ini":**
Items dari srQueue di mana `nextReview <= today`. 
Untuk setiap item: tampilkan subject badge, topic name, tombol "Review Sekarang".

"Review Sekarang" → trigger mini-quiz: Panggil Claude untuk generate 1 soal tentang topik tersebut (sama seperti Modul 2 Step 3), lalu tergantung jawaban, dispatch `UPDATE_SR_ITEM`.

**Kolom "Akan Datang":**
Items dengan nextReview > today, diurutkan. Tampilkan tanggal review.

**Kolom "Dikuasai":**
Items dengan interval >= 14 hari (dianggap long-term memory).

**Stats di bawah:**
- Total item di queue
- Rata-rata interval
- Item dengan failCount >= 3 (flagged sebagai "Perlu Perhatian Khusus" — warna merah)

---

## 8. MODUL 5 — STUDY PLANNER

**Komponen: `<StudyPlanner />`**

### Input Section
- Slider: jam belajar per hari (1–8 jam)
- Checkbox: hari mana saja bisa belajar (Senin–Minggu)
- Pilih prioritas: subject mana yang paling lemah (drag-to-rank atau dropdown rank 1–4)
- Tombol: "Generate Jadwal"

### Output: Jadwal Mingguan (Claude-generated)

```
System: Kamu adalah perencana belajar strategis untuk persiapan ujian akademik. Buat jadwal yang mengikuti prinsip: minggu 1–2 dominasi konsep, minggu 3–4 dominasi drill dan simulasi. Sertakan waktu review spaced repetition setiap hari.
User: Buat jadwal belajar 4 minggu menuju 14 Juni untuk SIMAK UI.
Detail:
- Jam belajar/hari: {jam}
- Hari tersedia: {hari}
- Urutan prioritas subject (terlemah ke terkuat): {prioritas}
- 4 mata uji: Matematika Dasar, TPA, Bahasa Inggris, Bahasa Indonesia
Format output: tabel mingguan (Minggu 1, 2, 3, 4), dengan breakdown harian yang jelas. Berikan juga strategi khusus untuk masing-masing mata uji.
```

Tampilkan output Claude dalam card yang well-formatted. Tombol "Simpan ke Clipboard".

---

## 9. SIDEBAR (Navigasi)

```
[SIMAK OS]          ← logo/wordmark
━━━━━━━━━━━━━━━
📊  Dashboard
🧠  Concept Engine
⚡  Drill Mode
🔄  SR Tracker
📅  Study Planner
━━━━━━━━━━━━━━━
🔑  API Key
```

Active state: highlighted dengan border-left gold.

Sidebar collapsible di mobile (hamburger).

---

## 10. API KEY GATE

Layar pertama yang muncul jika `state.apiKey === ''`:

```
[Logo SIMAK OS]
"Masukkan Anthropic API Key untuk mengaktifkan fitur AI"
[input type="password"]
[Tombol "Aktifkan"]
```

Setelah diinput → dispatch `SET_API_KEY` → simpan ke localStorage → tampilkan Dashboard.

Di sidebar ada opsi reset API key.

---

## 11. DESIGN SYSTEM

```css
/* Google Fonts — tambahkan di <head> atau @import */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,400&display=swap');

:root {
  --bg-primary: #0f0e0d;
  --bg-secondary: #1a1917;
  --bg-card: #232220;
  --accent-gold: #c9a84c;
  --accent-gold-dim: #8a6f2e;
  --text-primary: #e8e0d0;
  --text-secondary: #9e9488;
  --text-muted: #5c564e;
  --success: #4a7c59;
  --error: #8b3a3a;
  --warning: #b87333;
  --border: #2e2c29;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Source Serif 4', Georgia, serif;
  --radius: 8px;
  --radius-lg: 16px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
}
```

**Komponen UI yang harus konsisten:**
- `<Card>`: bg `var(--bg-card)`, border `var(--border)`, radius `var(--radius-lg)`, padding 24px
- `<Button primary>`: bg `var(--accent-gold)`, color `var(--bg-primary)`, font-weight 600
- `<Button secondary>`: border `var(--border)`, color `var(--text-primary)`, bg transparent
- `<Badge subject>`: subject warna berbeda — matematika=blue, tpa=purple, inggris=teal, indonesia=amber
- `<ProgressBar>`: track bg `var(--border)`, fill `var(--accent-gold)`, height 6px, border-radius penuh
- Loading state: animated dots atau skeleton shimmer dengan `var(--bg-secondary)` sebagai base

---

## 12. UTILITY FUNCTIONS

```javascript
// Hitung hari tersisa ke tanggal target
function getDaysRemaining(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target - now;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  };
}

// Cek apakah SR item jatuh tempo hari ini
function isDueToday(nextReview) {
  const today = new Date();
  const reviewDate = new Date(nextReview);
  return reviewDate <= today;
}

// Generate unique ID untuk SR items
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Parse soal dari Claude response (untuk Concept Engine)
function parseQuestion(claudeResponse) {
  // Extract: question text, options A-E, correct answer, explanation
  // Claude diinstruksikan untuk menggunakan format yang parseable
  // Return: { question, options, answer, explanation }
}

// Hitung overall readiness score
function getReadinessScore(progress) {
  const vals = Object.values(progress);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
```

---

## 13. ERROR HANDLING

Untuk setiap API call:
- Tampilkan loading state (spinner + teks "Sedang diproses...")
- Jika error (network/API key salah): tampilkan error card merah dengan pesan yang jelas
- Jika JSON parse gagal (untuk drill mode): retry sekali, jika masih gagal tampilkan fallback soal hardcoded

---

## 14. URUTAN IMPLEMENTASI YANG DISARANKAN

1. Setup context + reducer + localStorage sync
2. ApiKeyGate + Layout + Sidebar
3. Dashboard (tanpa API call)
4. ConceptEngine (ada 2 API calls)
5. DrillMode (ada 1 API call + parsing JSON)
6. SRTracker (reuse komponen dari ConceptEngine)
7. StudyPlanner (ada 1 API call)
8. Polish: animasi, responsiveness, edge cases

---

## 15. CATATAN PENTING

- **Tidak ada backend** — semua berjalan di browser
- API key disimpan di localStorage (bukan ideal untuk produksi, tapi cukup untuk personal use)
- Soal yang di-generate Claude tidak di-cache — setiap sesi drill akan generate soal baru (ini fitur, bukan bug)
- Streak dihitung: jika `lastStudyDate === kemarin`, streak +1; jika > kemarin, reset ke 1
- App harus fully functional tanpa koneksi internet KECUALI untuk API calls (semua UI, state, dan data lokal tetap bisa diakses offline)

---

*Blueprint v1.0 — SIMAK Study OS*
*Dibuat untuk eksekusi via Claude Opus 4.7 + Kiro*
