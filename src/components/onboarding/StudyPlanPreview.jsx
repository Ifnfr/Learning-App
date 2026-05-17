import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { callClaude } from '../../lib/api';
import { STUDY_PLAN_SYSTEM } from '../../lib/prompts';

const LOADING_TIPS = [
  'AI sedang menyusun rencana belajar yang dipersonalisasi untukmu.',
  'Jadwal belajar adaptif menyesuaikan dengan kekuatan dan kelemahanmu.',
  'Consistency beats intensity - belajar rutin lebih efektif dari marathon.',
  'Rencana ini akan berevolusi seiring perkembangan kemampuanmu.',
];

const TYPE_COLORS = {
  concept: { bg: 'var(--gold-bg)', text: 'var(--gold)' },
  drill: { bg: 'var(--bg-elevated)', text: 'var(--moss)' },
  review: { bg: 'var(--bg-elevated)', text: 'var(--amber)' },
};

export default function StudyPlanPreview({ onNext }) {
  const { state, dispatch } = useApp();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);

  useEffect(() => {
    fetchPlan();
  }, []);

  async function fetchPlan() {
    setLoading(true);
    setError(null);
    try {
      const response = await callClaude({
        apiKey: state.apiKey,
        system: STUDY_PLAN_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Hasil diagnostic: ${JSON.stringify(state.diagnosticResults)}. Tanggal ujian: ${state.examDates[0]?.date}. Nama ujian: ${state.examDates[0]?.name}. Buat jadwal belajar minggu pertama.`,
          },
        ],
        maxTokens: 2048,
        temperature: 0.7,
      });
      const parsed = JSON.parse(response);
      setPlan(parsed);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Gagal membuat rencana belajar. Silakan coba lagi.');
      setLoading(false);
    }
  }

  function handleStart() {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    onNext();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
        <div
          className="w-full max-w-lg text-center"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
        >
          <div
            className="rounded-lg p-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="mb-6">
              <div
                className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }}
              />
            </div>
            <p className="text-lg font-medium mb-4" style={{ color: 'var(--text)' }}>
              Menyusun rencana belajar...
            </p>
            <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
              {tip}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
        <div
          className="w-full max-w-lg text-center"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
        >
          <div
            className="rounded-lg p-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-lg mb-4" style={{ color: 'var(--rust)' }}>
              {error}
            </p>
            <button
              onClick={fetchPlan}
              className="py-2 px-6 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-90"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const week1 = plan?.weeks?.[0];

  return (
    <div className="flex flex-col items-center min-h-full px-6 py-12 overflow-y-auto">
      <div
        className="w-full max-w-lg"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Rencana Belajar Minggu Pertama
        </h2>
        {week1?.theme && (
          <p className="text-center mb-6" style={{ color: 'var(--text-muted)' }}>
            {week1.theme}
          </p>
        )}

        {/* Days */}
        <div className="space-y-4 mb-8">
          {week1?.days?.map((day) => (
            <div
              key={day.day}
              className="rounded-lg p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Hari {day.day}</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {day.totalMinutes} menit
                </span>
              </div>
              <div className="space-y-2">
                {day.tasks?.map((task, i) => {
                  const typeStyle = TYPE_COLORS[task.type] || TYPE_COLORS.concept;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-2 rounded"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <span
                        className="text-xs px-2 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ background: typeStyle.bg, color: typeStyle.text }}
                      >
                        {task.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {task.subject?.replace('_', ' ')}
                          {task.topic ? ` - ${task.topic}` : ''}
                        </p>
                        {task.rationale && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {task.rationale}
                          </p>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>
                        {task.minutes}m
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Strategic notes */}
        {plan?.strategicNotes?.length > 0 && (
          <div
            className="rounded-lg p-4 mb-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-semibold mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Catatan Strategi
            </h3>
            <ul className="space-y-1 text-sm">
              {plan.strategicNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span style={{ color: 'var(--gold)' }}>&#8226;</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleStart}
          className="w-full py-3 px-6 rounded-lg text-lg font-semibold cursor-pointer transition-opacity hover:opacity-90"
          style={{ background: 'var(--gold)', color: 'var(--bg)' }}
        >
          Mulai Belajar
        </button>
      </div>
    </div>
  );
}
