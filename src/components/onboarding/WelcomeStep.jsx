export default function WelcomeStep({ onNext }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div
        className="w-full max-w-lg text-center"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <h1
          className="text-4xl md:text-5xl font-bold mb-3"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}
        >
          SIMAK Study OS
        </h1>
        <p
          className="text-lg mb-10"
          style={{ color: 'var(--text-muted)' }}
        >
          Sistem Belajar Cerdas untuk SIMAK UI
        </p>

        <div
          className="rounded-lg p-6 mb-8 text-left space-y-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        >
          <p>
            Aplikasi ini menggunakan <strong>Active Recall</strong> (menguji diri sendiri lebih efektif daripada membaca ulang) dan{' '}
            <strong>Spaced Repetition</strong> (mengulang di interval optimal). Riset membuktikan kombinasi ini meningkatkan retensi memori lebih dari 50%.
          </p>
          <p>
            Yang akan kamu alami: assessment diagnostik untuk menemukan kekuatan dan kelemahan, jadwal belajar personal yang adaptif, latihan soal yang menyesuaikan level, dan tracking progress real-time.
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3 px-6 rounded-lg text-lg font-semibold cursor-pointer transition-opacity hover:opacity-90"
          style={{
            background: 'var(--gold)',
            color: 'var(--bg)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Mulai
        </button>
      </div>
    </div>
  );
}
