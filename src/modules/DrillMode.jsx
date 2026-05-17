import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { callClaude } from '../lib/api';
import { parseJSONSafe } from '../lib/parseJSON';
import { updateElo, brierScore } from '../lib/algorithms';
import { DRILL_SIMAK_BATCH_SYSTEM } from '../lib/prompts';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = {
  matematika: { label: 'Matematika', color: 'var(--subj-mat)', topics: ['Logaritma', 'Trigonometri', 'Limit', 'Turunan', 'Integral', 'Matriks', 'Vektor', 'Probabilitas', 'Statistika', 'Barisan & Deret'] },
  tpa: { label: 'TPA', color: 'var(--subj-tpa)', topics: ['Silogisme', 'Analogi', 'Deret Angka', 'Penalaran Logis', 'Penalaran Analitis', 'Aritmetika', 'Pengetahuan Umum'] },
  bahasa_inggris: { label: 'Bahasa Inggris', color: 'var(--subj-eng)', topics: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Error Recognition', 'Sentence Completion'] },
  bahasa_indonesia: { label: 'Bahasa Indonesia', color: 'var(--subj-ind)', topics: ['Pemahaman Bacaan', 'EYD/PUEBI', 'Kalimat Efektif', 'Paragraf', 'Makna Kata', 'Kesalahan Kalimat'] },
};

const ERROR_TRAP_COLORS = {
  konseptual: 'var(--rust)',
  komputasi: 'var(--amber)',
  perangkap: 'var(--subj-tpa)',
  ambiguitas: 'var(--subj-eng)',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DrillMode() {
  const { state, dispatch } = useApp();
  const [screen, setScreen] = useState('setup');
  const [config, setConfig] = useState({
    mode: 'adaptive',
    subject: null,
    topics: [],
    questionCount: 10,
    timer: 90,
    confidence: state.preferences?.confidenceSlider !== false,
    penalty: false,
    hint: false,
  });
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionData, setReflectionData] = useState(null);
  const [eloDeltas, setEloDeltas] = useState({});
  const [drillStartTime, setDrillStartTime] = useState(null);

  function handleStartDrill(generatedQuestions) {
    setQuestions(generatedQuestions);
    setAnswers([]);
    setCurrentIndex(0);
    setHintUsed(false);
    setEloDeltas({});
    setDrillStartTime(Date.now());
    setScreen('drilling');
  }

  function handleAnswerSubmit(answerData) {
    const q = questions[currentIndex];
    const isCorrect = answerData.selected === q.answer;
    const topicKey = q.subject + '.' + q.topic;
    const currentMastery = state.topicMastery[topicKey];
    const currentElo = currentMastery?.elo || 1000;
    const newElo = updateElo(currentElo, q.difficulty || 1200, isCorrect);

    dispatch({
      type: 'UPDATE_TOPIC_MASTERY',
      payload: {
        key: topicKey,
        value: {
          elo: newElo,
          attempts: (currentMastery?.attempts || 0) + 1,
          lastSeen: new Date().toISOString(),
        },
      },
    });

    if (config.confidence) {
      dispatch({
        type: 'LOG_CONFIDENCE',
        payload: {
          confidence: answerData.confidence / 100,
          correct: isCorrect,
          timestamp: new Date().toISOString(),
          subject: q.subject,
        },
      });
    }

    setEloDeltas(prev => ({
      ...prev,
      [topicKey]: {
        before: prev[topicKey]?.before ?? currentElo,
        after: newElo,
      },
    }));

    const fullAnswer = {
      ...answerData,
      correct: isCorrect,
      questionId: q.id,
      topic: q.topic,
      subject: q.subject,
      errorTrap: q.errorTrap,
      timeSpent: answerData.timeSpent || 0,
    };

    const newAnswers = [...answers, fullAnswer];
    setAnswers(newAnswers);

    if (!isCorrect) {
      setReflectionData({ question: q, answer: fullAnswer });
      setShowReflection(true);
    } else {
      advanceQuestion(newAnswers);
    }
  }

  function advanceQuestion(currentAnswers) {
    const nextAnswers = currentAnswers || answers;
    if (currentIndex + 1 >= questions.length) {
      finishDrill(nextAnswers);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function finishDrill(finalAnswers) {
    const drillAnswers = finalAnswers || answers;
    const score = drillAnswers.filter(a => a.correct).length;
    const accuracy = drillAnswers.length > 0 ? score / drillAnswers.length : 0;
    const timePerQuestion = drillAnswers.map(a => a.timeSpent || 0);
    const errorBreakdown = {};
    drillAnswers.filter(a => !a.correct).forEach(a => {
      const cat = a.errorTrap || 'unknown';
      errorBreakdown[cat] = (errorBreakdown[cat] || 0) + 1;
    });

    dispatch({
      type: 'LOG_DRILL',
      payload: {
        id: 'drill-' + Date.now(),
        timestamp: new Date().toISOString(),
        mode: config.mode,
        questionCount: questions.length,
        score,
        accuracy,
        timePerQuestion,
        eloDeltas,
        errorBreakdown,
        questions: drillAnswers,
      },
    });

    setScreen('result');
  }

  function handleReflectionClose() {
    setShowReflection(false);
    setReflectionData(null);
    advanceQuestion(answers);
  }

  function resetDrill() {
    setScreen('setup');
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setHintUsed(false);
    setShowReflection(false);
    setReflectionData(null);
    setEloDeltas({});
    setError(null);
  }

  if (screen === 'setup') {
    return (
      <SetupScreen
        config={config}
        setConfig={setConfig}
        state={state}
        onStart={handleStartDrill}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
      />
    );
  }

  if (screen === 'drilling') {
    return (
      <>
        <DrillScreen
          question={questions[currentIndex]}
          currentIndex={currentIndex}
          total={questions.length}
          config={config}
          hintUsed={hintUsed}
          setHintUsed={setHintUsed}
          onSubmit={handleAnswerSubmit}
          drillStartTime={drillStartTime}
        />
        {showReflection && reflectionData && (
          <ReflectionModal
            question={reflectionData.question}
            answer={reflectionData.answer}
            dispatch={dispatch}
            config={config}
            onClose={handleReflectionClose}
          />
        )}
      </>
    );
  }

  if (screen === 'result') {
    return (
      <ResultScreen
        questions={questions}
        answers={answers}
        config={config}
        eloDeltas={eloDeltas}
        dispatch={dispatch}
        state={state}
        onReset={resetDrill}
      />
    );
  }

  return null;
}


// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ config, setConfig, state, onStart, loading, setLoading, error, setError }) {
  const allTopics = config.subject && config.subject !== 'interleave'
    ? SUBJECTS[config.subject].topics
    : [];

  function getWeakestTopics() {
    const topics = [];
    if (config.subject === 'interleave' || !config.subject) {
      Object.entries(SUBJECTS).forEach(([subj, data]) => {
        data.topics.forEach(topic => {
          const key = subj + '.' + topic;
          const elo = state.topicMastery[key]?.elo || 1000;
          topics.push({ subject: subj, topic, elo });
        });
      });
    } else {
      SUBJECTS[config.subject].topics.forEach(topic => {
        const key = config.subject + '.' + topic;
        const elo = state.topicMastery[key]?.elo || 1000;
        topics.push({ subject: config.subject, topic, elo });
      });
    }
    topics.sort((a, b) => a.elo - b.elo);
    return topics.slice(0, Math.min(5, topics.length));
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      let targetTopics;
      if (config.mode === 'adaptive') {
        targetTopics = getWeakestTopics();
      } else {
        targetTopics = config.topics.map(topic => {
          const key = config.subject + '.' + topic;
          const elo = state.topicMastery[key]?.elo || 1000;
          return { subject: config.subject, topic, elo };
        });
        if (targetTopics.length === 0) {
          throw new Error('Pilih minimal 1 topik');
        }
      }

      const topicList = targetTopics.map(t =>
        '- ' + t.subject + ' / ' + t.topic + ' (target difficulty: ' + (t.elo + 50) + ')'
      ).join('\n');

      const userPrompt = 'Buat ' + config.questionCount + ' soal dengan spesifikasi:\n\nSubject & Topics:\n' + topicList + '\n\nDistribusi topik merata. Sesuaikan difficulty per topik sesuai target di atas.';

      const raw = await callClaude({
        apiKey: state.apiKey,
        system: DRILL_SIMAK_BATCH_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 4096,
        temperature: 0.7,
      });

      const parsed = parseJSONSafe(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Response bukan array soal yang valid');
      }

      const validated = parsed.map((q, i) => ({
        id: q.id || 'drill-' + (i + 1).toString().padStart(3, '0'),
        subject: q.subject || targetTopics[i % targetTopics.length].subject,
        topic: q.topic || targetTopics[i % targetTopics.length].topic,
        difficulty: q.difficulty || 1200,
        errorTrap: q.errorTrap || 'konseptual',
        question: q.question || '',
        options: q.options || {},
        answer: q.answer || 'A',
        explanation: q.explanation || '',
        hint: q.hint || '',
        type: 'pure_llm',
        trustScore: 0.6,
      }));

      onStart(validated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleTopic(topic) {
    setConfig(prev => {
      const topics = prev.topics.includes(topic)
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic];
      return { ...prev, topics };
    });
  }

  if (loading) {
    return <LoadingSpinner message="Memuat soal..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={handleStart} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
        Drill Mode
      </h2>

      {/* Mode selector */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)', margin: 0 }}>Mode</p>
        <div className="flex gap-2">
          {['adaptive', 'free'].map(mode => (
            <button
              key={mode}
              onClick={() => setConfig(prev => ({ ...prev, mode, topics: [] }))}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all"
              style={{
                backgroundColor: config.mode === mode ? 'var(--gold)' : 'var(--bg-elevated)',
                color: config.mode === mode ? 'var(--bg)' : 'var(--text)',
                border: config.mode === mode ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {mode === 'adaptive' ? 'Adaptive' : 'Free Choice'}
            </button>
          ))}
        </div>
      </div>

      {/* Subject selector */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)', margin: 0 }}>Subject</p>
        <div className="grid grid-cols-2 gap-2">
          {config.mode === 'adaptive' && (
            <button
              onClick={() => setConfig(prev => ({ ...prev, subject: 'interleave', topics: [] }))}
              className="rounded-lg p-3 text-sm text-left cursor-pointer transition-all"
              style={{
                backgroundColor: config.subject === 'interleave' ? 'var(--gold-soft)' : 'var(--bg-elevated)',
                border: config.subject === 'interleave' ? '1px solid var(--gold)' : '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              Campur (Interleave)
            </button>
          )}
          {Object.entries(SUBJECTS).map(([key, subj]) => (
            <button
              key={key}
              onClick={() => setConfig(prev => ({ ...prev, subject: key, topics: [] }))}
              className="rounded-lg p-3 text-sm text-left cursor-pointer transition-all"
              style={{
                backgroundColor: config.subject === key ? subj.color : 'var(--bg-elevated)',
                border: '1px solid ' + (config.subject === key ? subj.color : 'var(--border)'),
                color: config.subject === key ? '#fff' : 'var(--text)',
              }}
            >
              {subj.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic picker (Free Choice only) */}
      {config.mode === 'free' && config.subject && config.subject !== 'interleave' && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Topik ({config.topics.length} dipilih)
          </p>
          <div className="flex flex-wrap gap-2">
            {allTopics.map(topic => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                style={{
                  backgroundColor: config.topics.includes(topic) ? 'var(--gold-soft)' : 'var(--bg-elevated)',
                  border: config.topics.includes(topic) ? '1px solid var(--gold)' : '1px solid var(--border)',
                  color: config.topics.includes(topic) ? 'var(--gold)' : 'var(--text)',
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question count */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)', margin: 0 }}>Jumlah Soal</p>
        <div className="flex gap-2">
          {[10, 20, 40].map(n => (
            <button
              key={n}
              onClick={() => setConfig(prev => ({ ...prev, questionCount: n }))}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all"
              style={{
                backgroundColor: config.questionCount === n ? 'var(--gold)' : 'var(--bg-elevated)',
                color: config.questionCount === n ? 'var(--bg)' : 'var(--text)',
                border: config.questionCount === n ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)', margin: 0 }}>Timer per Soal</p>
        <div className="flex gap-2">
          {[{ val: 0, label: 'Off' }, { val: 60, label: '60s' }, { val: 90, label: '90s' }].map(opt => (
            <button
              key={opt.val}
              onClick={() => setConfig(prev => ({ ...prev, timer: opt.val }))}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all"
              style={{
                backgroundColor: config.timer === opt.val ? 'var(--gold)' : 'var(--bg-elevated)',
                color: config.timer === opt.val ? 'var(--bg)' : 'var(--text)',
                border: config.timer === opt.val ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <ToggleRow label="Confidence Slider" checked={config.confidence} onChange={v => setConfig(prev => ({ ...prev, confidence: v }))} />
        <ToggleRow label="Penalty Mode (-1/4)" checked={config.penalty} onChange={v => setConfig(prev => ({ ...prev, penalty: v }))} />
        <ToggleRow label="Hint (1x per drill)" checked={config.hint} onChange={v => setConfig(prev => ({ ...prev, hint: v }))} />
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!config.subject && config.mode === 'free'}
        className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-all"
        style={{
          backgroundColor: 'var(--gold)',
          color: 'var(--bg)',
          border: 'none',
          opacity: (!config.subject && config.mode === 'free') ? 0.5 : 1,
        }}
      >
        Mulai Drill
      </button>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text)' }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full cursor-pointer transition-all relative"
        style={{
          backgroundColor: checked ? 'var(--gold)' : 'var(--border)',
          border: 'none',
        }}
      >
        <span
          className="absolute top-0.5 rounded-full transition-all"
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#fff',
            left: checked ? '20px' : '2px',
          }}
        />
      </button>
    </div>
  );
}


// ─── Drill Screen ─────────────────────────────────────────────────────────────
function DrillScreen({ question, currentIndex, total, config, hintUsed, setHintUsed, onSubmit, drillStartTime }) {
  const [selected, setSelected] = useState(null);
  const [confidence, setConfidence] = useState(50);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [questionStart] = useState(Date.now());
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    setSelected(null);
    setConfidence(50);
    setRevealed(false);
    setShowHint(false);
    setTimerExpired(false);
  }, [currentIndex]);

  function handleSubmit() {
    if (revealed) return;
    setRevealed(true);
    const timeSpent = Math.round((Date.now() - questionStart) / 1000);
    onSubmit({ selected, confidence, timeSpent });
  }

  function handleTimerExpire() {
    if (revealed) return;
    setTimerExpired(true);
    setRevealed(true);
    const timeSpent = config.timer;
    onSubmit({ selected: selected || null, confidence, timeSpent });
  }

  function handleHint() {
    if (hintUsed) return;
    setHintUsed(true);
    setShowHint(true);
  }

  const isCorrect = revealed && selected === question.answer;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <ProgressBar current={currentIndex + 1} total={total} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Soal {currentIndex + 1} dari {total}
        </span>
        {config.timer > 0 && !revealed && (
          <CircularTimer
            duration={config.timer}
            onExpire={handleTimerExpire}
            key={currentIndex}
          />
        )}
      </div>

      {/* Question card */}
      <div className="rounded-lg p-5 relative" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <span
          className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' }}
        >
          Latihan
        </span>
        <p className="text-base font-medium pr-16" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
          {question.question}
        </p>
      </div>

      {/* Hint */}
      {config.hint && !hintUsed && !showHint && !revealed && (
        <button
          onClick={handleHint}
          className="self-start px-3 py-1.5 rounded-lg text-xs cursor-pointer"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Tampilkan Hint
        </button>
      )}
      {showHint && question.hint && (
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-soft)' }}>
          <p className="text-xs" style={{ color: 'var(--text)', margin: 0 }}>Hint: {question.hint}</p>
        </div>
      )}

      {/* Options */}
      <div className="flex flex-col gap-2">
        {Object.entries(question.options).map(([key, val]) => {
          let bg = 'var(--bg-elevated)';
          let borderColor = 'var(--border)';
          if (revealed) {
            if (key === question.answer) { bg = 'rgba(76, 140, 76, 0.2)'; borderColor = 'var(--moss)'; }
            else if (key === selected && !isCorrect) { bg = 'rgba(180, 80, 60, 0.2)'; borderColor = 'var(--rust)'; }
          } else if (selected === key) {
            bg = 'var(--gold-soft)'; borderColor = 'var(--gold)';
          }
          return (
            <button
              key={key}
              onClick={() => !revealed && setSelected(key)}
              className="w-full text-left rounded-lg p-3 cursor-pointer transition-all text-sm"
              style={{ backgroundColor: bg, border: '1px solid ' + borderColor, color: 'var(--text)' }}
            >
              <span className="font-medium">{key}.</span> {val}
              {revealed && key === question.answer && <span style={{ color: 'var(--moss)', marginLeft: '8px' }}>✓</span>}
              {revealed && key === selected && !isCorrect && key !== question.answer && <span style={{ color: 'var(--rust)', marginLeft: '8px' }}>✗</span>}
            </button>
          );
        })}
      </div>

      {/* Confidence slider */}
      {config.confidence && !revealed && (
        <ConfidenceSlider value={confidence} onChange={setConfidence} />
      )}

      {/* Submit button */}
      {!revealed && (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-all"
          style={{
            backgroundColor: selected ? 'var(--gold)' : 'var(--bg-hover)',
            color: selected ? 'var(--bg)' : 'var(--text-faint)',
            border: 'none',
            opacity: selected ? 1 : 0.6,
          }}
        >
          Jawab
        </button>
      )}

      {/* Revealed explanation */}
      {revealed && question.explanation && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Penjelasan:</p>
          <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>{question.explanation}</p>
        </div>
      )}
    </div>
  );
}


// ─── Circular Timer ───────────────────────────────────────────────────────────
function CircularTimer({ duration, onExpire }) {
  const [remaining, setRemaining] = useState(duration);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(duration);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [duration]);

  const pct = remaining / duration;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = pct < 0.25 ? 'var(--rust)' : 'var(--gold)';

  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={radius} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="text-xs font-mono font-medium" style={{ color, minWidth: '28px' }}>
        {remaining}s
      </span>
    </div>
  );
}

// ─── Confidence Slider ────────────────────────────────────────────────────────
function ConfidenceSlider({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Confidence: {value}%
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--gold)' }}
      />
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-faint)' }}>
        <span>Menebak</span>
        <span>Yakin</span>
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total }) {
  const pct = (current / total) * 100;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: '6px', backgroundColor: 'var(--border)' }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: pct + '%', backgroundColor: 'var(--gold)' }}
      />
    </div>
  );
}

// ─── Reflection Modal ─────────────────────────────────────────────────────────
function ReflectionModal({ question, answer, dispatch, config, onClose }) {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  function handleAddMistake() {
    dispatch({
      type: 'ADD_MISTAKE',
      payload: {
        id: 'mistake-' + Date.now(),
        subject: question.subject,
        topic: question.topic,
        question: question.question,
        options: question.options,
        userAnswer: answer.selected,
        correctAnswer: question.answer,
        explanation: question.explanation,
        errorCategory: question.errorTrap,
        confidence: answer.confidence,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        mastered: false,
        note: note || null,
      },
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="rounded-lg p-5 mx-4 max-w-md w-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--text)', margin: 0 }}>
          Jawabanmu <strong style={{ color: 'var(--rust)' }}>{answer.selected}</strong>, benar{' '}
          <strong style={{ color: 'var(--moss)' }}>{question.answer}</strong>.
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', margin: 0 }}>
          Kategori kesalahan: <span style={{ color: ERROR_TRAP_COLORS[question.errorTrap] || 'var(--text)' }}>{question.errorTrap}</span>
        </p>

        {showNote && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Catatan singkat..."
            className="w-full rounded-lg p-3 text-sm mb-3 resize-none"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              minHeight: '60px',
            }}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Lewati
          </button>
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
            >
              Tulis catatan singkat
            </button>
          ) : (
            <button
              onClick={handleAddMistake}
              className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
            >
              Simpan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Result Screen ────────────────────────────────────────────────────────────
function ResultScreen({ questions, answers, config, eloDeltas, dispatch, state, onReset }) {
  const [mistakesAdded, setMistakesAdded] = useState(false);

  const score = answers.filter(a => a.correct).length;
  const total = answers.length;
  const accuracy = total > 0 ? ((score / total) * 100).toFixed(1) : 0;

  // Penalty score
  const wrongCount = total - score;
  const penaltyScore = config.penalty ? (score - wrongCount * 0.25).toFixed(2) : null;

  // Time data
  const times = answers.map(a => a.timeSpent || 0);
  const avgTime = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 0;

  // Error breakdown
  const errorBreakdown = {};
  answers.filter(a => !a.correct).forEach(a => {
    const cat = a.errorTrap || 'unknown';
    errorBreakdown[cat] = (errorBreakdown[cat] || 0) + 1;
  });

  // Weakest topic
  const topicAccuracy = {};
  answers.forEach(a => {
    const key = a.subject + '.' + a.topic;
    if (!topicAccuracy[key]) topicAccuracy[key] = { correct: 0, total: 0, topic: a.topic, subject: a.subject };
    topicAccuracy[key].total++;
    if (a.correct) topicAccuracy[key].correct++;
  });
  const weakest = Object.values(topicAccuracy).sort((a, b) => (a.correct / a.total) - (b.correct / b.total))[0];

  function handleAddAllMistakes() {
    answers.filter(a => !a.correct).forEach(a => {
      const q = questions.find(q => q.id === a.questionId);
      if (!q) return;
      dispatch({
        type: 'ADD_MISTAKE',
        payload: {
          id: 'mistake-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          subject: q.subject,
          topic: q.topic,
          question: q.question,
          options: q.options,
          userAnswer: a.selected,
          correctAnswer: q.answer,
          explanation: q.explanation,
          errorCategory: q.errorTrap,
          confidence: a.confidence,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          mastered: false,
        },
      });
    });
    setMistakesAdded(true);
  }

  function handleDrillWeakest() {
    onReset();
  }

  function handleGoToConcept() {
    dispatch({ type: 'SET_MODULE', payload: 'concept' });
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>Hasil Drill</h2>

      {/* Score */}
      <div className="rounded-lg p-5 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-4xl font-bold" style={{ color: 'var(--gold)', margin: 0 }}>{score}/{total}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Akurasi: {accuracy}%</p>
        {penaltyScore !== null && (
          <p className="text-xs mt-1" style={{ color: 'var(--amber)', margin: 0 }}>Skor dengan penalty: {penaltyScore}</p>
        )}
      </div>

      {/* Confidence Calibration Scatter */}
      {config.confidence && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', margin: 0 }}>Confidence Calibration</p>
          <svg viewBox="0 0 200 100" width="100%" height="120" style={{ overflow: 'visible' }}>
            {/* Axes */}
            <line x1="20" y1="10" x2="20" y2="90" stroke="var(--border)" strokeWidth="1" />
            <line x1="20" y1="90" x2="190" y2="90" stroke="var(--border)" strokeWidth="1" />
            {/* Diagonal reference */}
            <line x1="20" y1="90" x2="190" y2="10" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4" />
            {/* Labels */}
            <text x="105" y="99" textAnchor="middle" fontSize="6" fill="var(--text-muted)">Confidence</text>
            {/* Dots */}
            {answers.map((a, i) => {
              const x = 20 + (a.confidence / 100) * 170;
              const y = a.correct ? 20 + Math.random() * 20 : 60 + Math.random() * 20;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={a.correct ? 'var(--moss)' : 'var(--rust)'}
                  opacity="0.8"
                />
              );
            })}
          </svg>
          <div className="flex gap-4 mt-1">
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--moss)' }}>● Benar</span>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--rust)' }}>● Salah</span>
          </div>
        </div>
      )}

      {/* Time Sparkline */}
      {times.length > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', margin: 0 }}>Waktu per Soal</p>
          <svg viewBox={"0 0 " + (times.length * 20 + 20) + " 60"} width="100%" height="60">
            {times.map((t, i) => {
              const maxT = Math.max(...times, 1);
              const h = (t / maxT) * 45;
              const isOutlier = t > avgTime * 1.5;
              return (
                <rect
                  key={i}
                  x={10 + i * 20}
                  y={50 - h}
                  width="14"
                  height={h}
                  rx="2"
                  fill={isOutlier ? 'var(--amber)' : 'var(--gold)'}
                  opacity="0.8"
                />
              );
            })}
          </svg>
          <p className="text-xs" style={{ color: 'var(--text-faint)', margin: 0 }}>Rata-rata: {avgTime.toFixed(1)}s</p>
        </div>
      )}

      {/* Error Breakdown Pie */}
      {Object.keys(errorBreakdown).length > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', margin: 0 }}>Error Breakdown</p>
          <div className="flex items-center gap-4">
            <ErrorPieChart breakdown={errorBreakdown} />
            <div className="flex flex-col gap-1">
              {Object.entries(errorBreakdown).map(([cat, count]) => (
                <span key={cat} className="text-xs flex items-center gap-1" style={{ color: ERROR_TRAP_COLORS[cat] || 'var(--text)' }}>
                  ● {cat}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ELO Deltas */}
      {Object.keys(eloDeltas).length > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', margin: 0 }}>ELO Updates</p>
          <div className="flex flex-col gap-1">
            {Object.entries(eloDeltas).map(([key, delta]) => {
              const diff = delta.after - delta.before;
              const topic = key.split('.')[1] || key;
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text)' }}>{topic}</span>
                  <span style={{ color: diff >= 0 ? 'var(--moss)' : 'var(--rust)' }}>
                    {delta.before} → {delta.after} ({diff >= 0 ? '+' : ''}{diff})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {wrongCount > 0 && !mistakesAdded && (
          <button
            onClick={handleAddAllMistakes}
            className="w-full py-2.5 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--rust)', color: '#fff', border: 'none' }}
          >
            Tambahkan semua salah ke Mistake Notebook ({wrongCount})
          </button>
        )}
        {mistakesAdded && (
          <p className="text-xs text-center" style={{ color: 'var(--moss)', margin: 0 }}>✓ Ditambahkan ke Mistake Notebook</p>
        )}
        {weakest && (
          <button
            onClick={handleDrillWeakest}
            className="w-full py-2.5 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Drill ulang topik terlemah: {weakest.topic}
          </button>
        )}
        <button
          onClick={handleGoToConcept}
          className="w-full py-2.5 rounded-lg text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Pelajari ulang konsep{weakest ? ' ' + weakest.topic : ''}
        </button>
        <button
          onClick={onReset}
          className="w-full py-2.5 rounded-lg text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
        >
          Kembali ke Setup
        </button>
      </div>
    </div>
  );
}


// ─── Error Pie Chart ──────────────────────────────────────────────────────────
function ErrorPieChart({ breakdown }) {
  const entries = Object.entries(breakdown);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (total === 0) return null;

  const colors = {
    konseptual: '#b4503c',
    komputasi: '#c9922e',
    perangkap: '#5a8a6e',
    ambiguitas: '#4a7a9b',
    unknown: '#888',
  };

  let cumulative = 0;
  const slices = entries.map(([cat, count]) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += count;
    const endAngle = (cumulative / total) * 360;
    return { cat, count, startAngle, endAngle, color: colors[cat] || colors.unknown };
  });

  function polarToCartesian(cx, cy, r, angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    if (endAngle - startAngle >= 360) {
      return 'M ' + cx + ' ' + (cy - r) + ' A ' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy + r) + ' A ' + r + ' ' + r + ' 0 1 1 ' + cx + ' ' + (cy - r) + ' Z';
    }
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return 'M ' + cx + ' ' + cy + ' L ' + start.x + ' ' + start.y + ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 0 ' + end.x + ' ' + end.y + ' Z';
  }

  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {slices.map((s, i) => (
        <path key={i} d={describeArc(40, 40, 35, s.startAngle, s.endAngle)} fill={s.color} />
      ))}
    </svg>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────
function LoadingSpinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className="rounded-full"
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--gold)',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{message || 'Memuat...'}</p>
      <style>{}</style>
    </div>
  );
}

function ErrorDisplay({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-sm text-center" style={{ color: 'var(--rust)' }}>
        Error: {message}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
        style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
      >
        Coba Lagi
      </button>
    </div>
  );
}
