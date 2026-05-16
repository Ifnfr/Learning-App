# SIMAK Study OS — Context File
> File ini dibaca oleh Claude Opus di Kiro sebagai referensi latar belakang proyek.
> Gunakan informasi ini untuk membuat keputusan implementasi yang lebih tepat.

---

## Siapa yang Menggunakan App Ini

**User:** Mahasiswa semester 2 jurusan Ekonomi Pembangunan di Indonesia, berlokasi di Kotabumi, Lampung. Sedang mempersiapkan **SIMAK UI (Seleksi Masuk Universitas Indonesia)** dengan target ujian **14 Juni 2025**.

**Profil belajar:**
- Prefer penjelasan konsep sebelum soal (bukan drill langsung)
- Familiar dengan tools digital dan React-based apps
- Background kuat di kuantitatif (matematika, statistika, ekonomi)
- Bahasa utama: Bahasa Indonesia, kemampuan Inggris aktif

---

## Konteks Ujian SIMAK UI

SIMAK UI adalah ujian seleksi masuk program pascasarjana Universitas Indonesia. 4 mata uji yang diujikan:

| Mata Uji | Karakteristik Soal |
|---|---|
| **Matematika Dasar** | Aljabar, fungsi, trigonometri, logaritma, statistika, geometri, barisan & deret, peluang. Tingkat: setara akhir SMA/awal kuliah. |
| **TPA (Tes Potensi Akademik)** | Analogi verbal, silogisme, deret angka, pola matriks, penalaran spasial & analitis. Mengukur kemampuan logika dan abstraksi. |
| **Bahasa Inggris** | Reading comprehension, grammar, vocabulary in context, error identification, text completion. Setara TOEFL intermediate. |
| **Bahasa Indonesia** | Pemahaman wacana, ejaan & tanda baca, kalimat efektif, sinonim/antonim, penalaran paragraf, kohesi & koherensi. |

**Format ujian:** Pilihan ganda (5 opsi: A–E), tidak ada penalti salah (di sebagian besar jenis), berbasis komputer.

---

## Filosofi Pedagogis App

App ini dibangun di atas 4 prinsip ilmiah belajar yang sudah terbukti:

### 1. Active Recall
Tidak ada "baca materi pasif". Semua konten disampaikan lewat pertanyaan dan respon — bahkan saat belajar konsep baru, user langsung dihadapkan pada contoh soal setelah penjelasan.

### 2. Spaced Repetition (SM-2)
Konsep yang salah dijawab tidak langsung dibuang. Mereka masuk antrian review dengan interval yang meningkat secara eksponensial. Interval awal: 1 hari (salah) atau 3 hari (benar). Setiap berhasil di-review, interval x2.5.

### 3. Interleaving
Di Drill Mode, soal dari berbagai topik dan subject dicampur — bukan diblok per topik. Penelitian menunjukkan ini meningkatkan kemampuan diskriminasi dan transfer knowledge ke ujian nyata.

### 4. Elaborative Interrogation
Claude tidak hanya menjelaskan *apa* jawabannya, tapi *mengapa* itu benar dan *bagaimana* cara berpikir untuk sampai ke sana. Setiap penjelasan diakhiri dengan pertanyaan Socratic.

---

## Batasan Teknis yang Harus Direspek

- **Single-file React** — tidak ada folder `src/components/`. Semua dalam satu `.jsx`.
- **Tidak ada backend** — tidak ada Express, tidak ada database, tidak ada server.
- **localStorage only** — semua persistensi data lewat localStorage dengan prefix `simak_`.
- **API key dari user** — jangan hardcode. User memasukkan sendiri di ApiKeyGate.
- **Model yang digunakan:** `claude-sonnet-4-20250514` untuk semua API call di dalam app.
- **Tidak ada library tambahan** yang tidak tersedia di environment React default Kiro kecuali yang sudah disebutkan di Blueprint (Tailwind sudah tersedia via CDN jika dibutuhkan).

---

## Tone dan Bahasa UI

- Semua teks UI dalam **Bahasa Indonesia**
- Tone: serius tapi tidak kaku — seperti senior yang membantu adik kelas
- Hindari kata-kata motivasi klise ("Ayo semangat!", "Kamu pasti bisa!")
- Gunakan kata yang actionable: "Pelajari", "Latihan", "Review", "Analisis"
- Error messages harus informatif, bukan generik ("API key tidak valid — pastikan dimulai dengan sk-ant-")

---

## Keputusan Desain yang Sudah Final (Jangan Diubah)

1. **Dark academic aesthetic** — bukan dark mode generik. Warm blacks, gold accent, serif fonts. Referensi: jurnal akademik lama, ruang baca perpustakaan tua.
2. **Font:** Playfair Display (heading) + Source Serif 4 (body). Keduanya dari Google Fonts.
3. **Warna aksen tunggal:** Gold (`#c9a84c`) — bukan biru, bukan ungu.
4. **Tidak ada animasi berlebihan** — subtle transitions (200–300ms ease) saja. Fokus adalah belajar, bukan hiburan.
5. **Sidebar selalu visible** di desktop. Collapsible di mobile.

---

## Keputusan yang Boleh Difleksibilisasi oleh Opus

- Cara exact parsing response Claude (boleh adjust prompt format jika ada yang lebih reliable)
- Breakpoint responsive (sesuaikan dengan judgment Opus)
- Urutan field di card/komponen kecil
- Jumlah topik per subject (boleh dikurangi jika terlalu panjang)
- Wording tombol (selama maknanya sama)

---

## Potensi Edge Case yang Perlu Diantisipasi

| Skenario | Penanganan yang Diharapkan |
|---|---|
| API key salah/expired | Error card merah dengan instruksi reset key |
| Claude return JSON tidak valid | Retry 1x, jika gagal tampilkan pesan "Gagal generate soal, coba lagi" |
| srQueue kosong | Tampilkan state empty yang informatif, bukan blank screen |
| Countdown sudah lewat 14 Juni | Tampilkan pesan "Ujian telah berlalu" dengan opsi reset tanggal |
| localStorage penuh | Catch QuotaExceededError, tampilkan warning |
| Offline / no internet | UI tetap berjalan, API call tampilkan "Butuh koneksi internet" |

---

## Referensi File

| File | Isi |
|---|---|
| `SIMAK_StudyOS_Blueprint.md` | Spesifikasi teknis lengkap — struktur, state, algoritma, komponen, API prompts, design system |
| `SIMAK_StudyOS_Context.md` | File ini — latar belakang, filosofi, batasan, tone |

**Baca Blueprint lebih dulu, gunakan Context sebagai referensi saat ada ambiguitas keputusan.**

---

*Context v1.0 — SIMAK Study OS*
*Dibuat untuk Claude Opus 4.7 via Kiro*
