# Daily Seed Bank

Folder ini berisi soal-soal asli SIMAK UI yang user submit harian sebagai **seed bank**.
File seed digunakan oleh app untuk:
1. **Mock Exam** — sumber soal eksklusif (gold standard)
2. **Drill Mode** — sebagai dasar generate variasi
3. **ELO calibration** — anchor untuk distribusi kesulitan

## Cara Submit Soal Baru

1. Copy `_TEMPLATE.md` menjadi file baru dengan nama: `YYYY-MM-DD-{kode}-{nn}.md`
   - Contoh: `2026-05-17-tpa-01.md`, `2026-05-17-mat-02.md`
2. Isi metadata di frontmatter (YAML)
3. Tulis bagian: **Soal**, **Pilihan**, **Kunci**, **Pembahasan**, **Trap** (opsional)
4. Save di folder ini
5. App auto-detect file baru saat dibuka (atau klik "Sync Seeds" di Daily Seed module)

## Aturan Penamaan File

Format: `{date}-{subject_code}-{sequence}.md`

| Subject | Code |
|---|---|
| Matematika Dasar | `mat` |
| TPA | `tpa` |
| Bahasa Inggris | `eng` |
| Bahasa Indonesia | `ind` |

Contoh valid:
- `2026-05-16-mat-01.md` — soal matematika pertama tanggal 16 Mei
- `2026-05-16-tpa-03.md` — soal TPA ketiga tanggal 16 Mei

## Frontmatter Schema

```yaml
id: string              # WAJIB. Unique, biasanya = nama file tanpa .md
subject: enum           # WAJIB. matematika | tpa | bahasa_inggris | bahasa_indonesia
topic: string           # WAJIB. Topik spesifik
source: string          # WAJIB. Sumber soal (buku/tahun/dll)
date_posted: ISO        # WAJIB. Tanggal user submit

difficulty: int         # OPSIONAL. ELO 800-1800. Kosong → app auto-estimate
year: int               # OPSIONAL. Tahun ujian asli
verified: bool          # OPSIONAL. Default false. True jika user yakin kunci benar
notes: string           # OPSIONAL. Catatan bebas
```

## Body Structure

Setiap section dipisah dengan heading H1 (`# `):

- `# Soal` — teks pertanyaan (boleh LaTeX inline `$...$` dan block `$$...$$`)
- `# Pilihan` — list A-E, satu per baris dengan format `A. ...`
- `# Kunci` — satu huruf: A, B, C, D, atau E
- `# Pembahasan` — penjelasan langkah-langkah
- `# Trap` — OPSIONAL. Common mistake / distractor logic

## Tips Submit

- **Tidak ada batas minimum harian.** Submit 0 hari ya tidak apa-apa.
- **Jangan modifikasi soal asli** — paste apa adanya untuk kalibrasi akurat
- **Verified soal** jauh lebih berharga daripada banyak soal unverified
- **Gambar/diagram?** Untuk sekarang, deskripsikan dalam teks (mis. "diagram batang dengan tinggi 5,3,7,2"). OCR support akan ditambahkan di v2.2.

## Privacy

File `.md` di folder ini akan ter-commit ke repo. **Pastikan Anda boleh share soal tersebut** (umumnya try-out books = personal use OK; soal latihan dari les = check ToS).

Untuk soal sensitif/private, gunakan folder `data/seeds-private/` (di-gitignore — akan ditambahkan kemudian).
