import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function ExamDateStep({ onNext }) {
  const { dispatch } = useApp();
  const [examDate, setExamDate] = useState('');
  const [examName, setExamName] = useState('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let daysRemaining = null;
  let dateInPast = false;

  if (examDate) {
    const target = new Date(examDate + 'T00:00:00');
    const diffMs = target - today;
    daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    dateInPast = daysRemaining < 0;
  }

  function handleSubmit() {
    if (!examDate || dateInPast) return;
    const id = crypto.randomUUID();
    const name = examName.trim() || 'SIMAK UI';
    dispatch({ type: 'ADD_EXAM_DATE', payload: { id, name, date: examDate } });
    dispatch({ type: 'SET_PRIMARY_EXAM', payload: id });
    onNext();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div
        className="w-full max-w-lg"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tanggal Ujian
        </h2>
        <p className="mb-8 text-center" style={{ color: 'var(--text-muted)' }}>
          Kapan ujian SIMAK UI kamu? Kami akan menyusun jadwal belajar berdasarkan waktu yang tersisa.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
              Tanggal ujian
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${dateInPast ? 'var(--rust)' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {dateInPast && (
              <p className="mt-1 text-sm" style={{ color: 'var(--rust)' }}>
                Tanggal sudah berlalu. Pilih tanggal di masa depan.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
              Nama ujian (opsional)
            </label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="SIMAK UI"
              className="w-full px-4 py-3 rounded-lg outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>
        </div>

        {daysRemaining !== null && !dateInPast && (
          <div
            className="rounded-lg p-4 mb-6 text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <span className="text-3xl font-bold" style={{ color: 'var(--gold)' }}>
              {daysRemaining}
            </span>
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
              hari lagi
            </span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!examDate || dateInPast}
          className="w-full py-3 px-6 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--gold)',
            color: 'var(--bg)',
          }}
        >
          Lanjut
        </button>
      </div>
    </div>
  );
}
