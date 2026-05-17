import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { callClaude } from '../../lib/api';
import { DIAGNOSTIC_SYSTEM } from '../../lib/prompts';
import { parseJSONSafe } from '../../lib/parseJSON';

const LOADING_TIPS = [
  'Tahukah kamu? Testing diri sendiri meningkatkan retensi 50% dibanding membaca ulang.',
  'Spaced repetition bekerja karena otak menguatkan memori saat hampir lupa.',
  'Interleaving (campur topik saat latihan) meningkatkan kemampuan transfer pengetahuan.',
  'Tidur cukup setelah belajar penting - otak mengkonsolidasi memori saat tidur.',
];

export default function DiagnosticStep({ onNext }) {
  const { state, dispatch } = useApp();
  const [questions, setQuestions] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    setAnswers([]);
    setCurrentQ(0);
    setLoading(true);
    setError(null);
    try {
      const response = await callClaude({
        apiKey: state.apiKey,
        system: DIAGNOSTIC_SYSTEM,
        messages: [{ role: 'user', content: 'Generate 8 soal diagnostic SIMAK UI sekarang.' }],
        maxTokens: 4096,
        temperature: 0.7,
      });
      const parsed = parseJSONSafe(response);
      setQuestions(parsed);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Gagal memuat soal. Silakan coba lagi.');
      setLoading(false);
    }
  }

  function handleAnswer(option) {
    const newAnswers = [...answers, { questionIndex: currentQ, selected: option }];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      calculateResults(newAnswers);
    }
  }

  function calculateResults(allAnswers) {
    const subjectCorrect = {
      matematika: 0,
      tpa: 0,
      bahasa_inggris: 0,
      bahasa_indonesia: 0,
    };
    const subjectCount = {
      matematika: 0,
      tpa: 0,
      bahasa_inggris: 0,
      bahasa_indonesia: 0,
    };

    allAnswers.forEach(({ questionIndex, selected }) => {
      const q = questions[questionIndex];
      const subject = q.subject;
      if (subjectCount[subject] !== undefined) {
        subjectCount[subject]++;
        if (selected === q.answer) {
          subjectCorrect[subject]++;
        }
      }
    });

    const diagnosticResults = {};
    for (const subject of Object.keys(subjectCorrect)) {
      const count = subjectCount[subject] || 2;
      diagnosticResults[subject] = subjectCorrect[subject] / count;
    }

    dispatch({ type: 'SET_DIAGNOSTIC', payload: diagnosticResults });

    for (const subject of Object.keys(diagnosticResults)) {
      const accuracy = diagnosticResults[subject];
      const elo = 1200 + (accuracy - 0.5) * 400;
      dispatch({
        type: 'UPDATE_TOPIC_MASTERY',
        payload: {
          key: subject,
          value: { elo, attempts: subjectCount[subject] || 2, lastSeen: new Date().toISOString() },
        },
      });
    }

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
              Menyiapkan soal diagnostic...
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
              onClick={fetchQuestions}
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

  const q = questions[currentQ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div
        className="w-full max-w-lg"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
      >
        {/* Progress */}
        <div className="mb-6 text-center">
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            Soal {currentQ + 1}/{questions.length}
          </span>
        </div>

        {/* Subject badge */}
        <div className="mb-4 text-center">
          <span
            className="text-xs uppercase tracking-wide px-2 py-1 rounded"
            style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}
          >
            {q.subject?.replace('_', ' ')}
          </span>
        </div>

        {/* Question */}
        <div
          className="rounded-lg p-6 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-lg leading-relaxed">{q.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {Object.entries(q.options).map(([letter, text]) => (
            <button
              key={letter}
              onClick={() => handleAnswer(letter)}
              className="w-full text-left px-4 py-3 rounded-lg cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              <span className="font-semibold mr-2" style={{ color: 'var(--gold)' }}>
                {letter}.
              </span>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
