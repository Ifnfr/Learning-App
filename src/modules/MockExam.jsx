import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { queryByIndex } from '../lib/storage';

const SIZES = [
  { key: 'mini', label: 'Mini', questions: 20, minutes: 30 },
  { key: 'half', label: 'Half', questions: 60, minutes: 90 },
  { key: 'full', label: 'Full', questions: 120, minutes: 180 },
];

const DEFAULT_DIST = { matematika: 40, tpa: 25, bahasa_inggris: 20, bahasa_indonesia: 15 };
const SUBJECT_LABELS = { matematika: 'Matematika', tpa: 'TPA', bahasa_inggris: 'Bahasa Inggris', bahasa_indonesia: 'Bahasa Indonesia' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MockExam() {
  const { state, dispatch } = useApp();
  const [screen, setScreen] = useState('preflight');
  const [config, setConfig] = useState({ size: null, distribution: { ...DEFAULT_DIST }, customMode: false, allowRepeats: false });
  const [showConfirm, setShowConfirm] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [marked, setMarked] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [questionTimes, setQuestionTimes] = useState([]);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [showSubmitWarn, setShowSubmitWarn] = useState(false);
  const [result, setResult] = useState(null);
  const [mistakesAdded, setMistakesAdded] = useState(false);
  const [error, setError] = useState(null);
  const focusApplied = useRef(false);
  const sidebarToggled = useRef(false);
  const focusModeToggled = useRef(false);

  const totalSeeds = state.seedStats.totalSeeds;

  useEffect(() => {
    if (totalSeeds >= 20 && screen === 'preflight') setScreen('setup');
  }, [totalSeeds]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.6 }}>&#9888;</div>
        <h2 style={{ color: 'var(--rust)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Terjadi Kesalahan</h2>
        <p style={{ color: 'var(--text)', opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.95rem', maxWidth: '400px' }}>{error}</p>
        <button onClick={() => { setError(null); setScreen('setup'); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Kembali ke Setup</button>
      </div>
    );
  }

  if (screen === 'preflight' && totalSeeds < 20) {
    return <PreflightScreen totalSeeds={totalSeeds} dispatch={dispatch} />;
  }
  if (screen === 'setup') {
    return <SetupScreen config={config} setConfig={setConfig} totalSeeds={totalSeeds} showConfirm={showConfirm} setShowConfirm={setShowConfirm} onStart={startExam} />;
  }
  if (screen === 'exam') {
    return <ExamScreen questions={questions} answers={answers} setAnswers={setAnswers} marked={marked} setMarked={setMarked} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} timeLeft={timeLeft} totalTime={totalTime} questionStartTime={questionStartTime} setQuestionStartTime={setQuestionStartTime} questionTimes={questionTimes} setQuestionTimes={setQuestionTimes} showSubmitWarn={showSubmitWarn} setShowSubmitWarn={setShowSubmitWarn} onSubmit={submitExam} />;
  }
  if (screen === 'result' && result) {
    return <ResultScreen result={result} state={state} dispatch={dispatch} mistakesAdded={mistakesAdded} setMistakesAdded={setMistakesAdded} onReset={resetExam} />;
  }
  return null;

  async function startExam() {
    setShowConfirm(false);
    setError(null);
    const sizeObj = SIZES.find(s => s.key === config.size);
    if (!sizeObj) return;
    const totalQ = sizeObj.questions;
    const dist = config.distribution;
    let loaded;
    try {
      loaded = [];
      for (const [subj, pct] of Object.entries(dist)) {
        const count = Math.round((pct / 100) * totalQ);
        if (count <= 0) continue;
        const all = await queryByIndex('seedBank', 'subject', subj);
        let pool = all;
        if (!config.allowRepeats && state.mockExamHistory.length > 0) {
          const usedIds = new Set();
          state.mockExamHistory.forEach(h => { if (h.questions) h.questions.forEach(q => usedIds.add(q.questionId)); });
          pool = pool.filter(q => !usedIds.has(q.id));
        }
        const shuffled = shuffle(pool);
        loaded.push(...shuffled.slice(0, count));
      }
    } catch (err) {
      setError('Gagal memuat soal dari database: ' + (err.message || 'Unknown error'));
      return;
    }
    const final = shuffle(loaded);
    if (final.length < sizeObj.questions) {
      setError(`Hanya tersedia ${final.length} soal dari ${sizeObj.questions} yang dibutuhkan. Coba aktifkan "Izinkan soal yang pernah muncul" atau tambah lebih banyak seed.`);
      return;
    }
    setQuestions(final);
    setAnswers(new Array(final.length).fill(null));
    setMarked(new Array(final.length).fill(false));
    setQuestionTimes(new Array(final.length).fill(0));
    setCurrentIndex(0);
    const totalSec = sizeObj.minutes * 60;
    setTotalTime(totalSec);
    setTimeLeft(totalSec);
    setQuestionStartTime(Date.now());
    // Only toggle sidebar if not already collapsed
    if (!state.sidebarCollapsed) {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
      sidebarToggled.current = true;
    } else {
      sidebarToggled.current = false;
    }
    // Only toggle focus mode if not already active
    if (!state.focusMode) {
      dispatch({ type: 'TOGGLE_FOCUS_MODE' });
      focusModeToggled.current = true;
    } else {
      focusModeToggled.current = false;
    }
    focusApplied.current = true;
    setScreen('exam');
  }

  function submitExam() {
    if (focusApplied.current) {
      if (sidebarToggled.current) {
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      }
      if (focusModeToggled.current) {
        dispatch({ type: 'TOGGLE_FOCUS_MODE' });
      }
      focusApplied.current = false;
      sidebarToggled.current = false;
      focusModeToggled.current = false;
    }
    const sizeObj = SIZES.find(s => s.key === config.size);
    const score = answers.filter((a, i) => a === questions[i]?.answer).length;
    const totalQ = questions.length;
    const accuracy = totalQ > 0 ? score / totalQ : 0;
    const timeUsed = totalTime - timeLeft;
    const subjectBreakdown = {};
    Object.keys(SUBJECT_LABELS).forEach(s => { subjectBreakdown[s] = { correct: 0, total: 0 }; });
    questions.forEach((q, i) => {
      if (subjectBreakdown[q.subject]) {
        subjectBreakdown[q.subject].total++;
        if (answers[i] === q.answer) subjectBreakdown[q.subject].correct++;
      }
    });
    const slowestIdx = questionTimes.indexOf(Math.max(...questionTimes));
    const avgTime = questionTimes.length > 0 ? questionTimes.reduce((a, b) => a + b, 0) / questionTimes.length : 0;
    const questionsData = questions.map((q, i) => ({ questionId: q.id, subject: q.subject, userAnswer: answers[i], correctAnswer: q.answer, timeSpent: questionTimes[i] || 0, marked: marked[i] }));
    const res = { id: 'mock-' + Date.now(), timestamp: new Date().toISOString(), size: config.size, duration: timeUsed, totalQuestions: totalQ, score, accuracy, subjectBreakdown, timePerQuestion: questionTimes, questions: questionsData, distribution: config.distribution, slowestIdx, avgTime };
    dispatch({ type: 'LOG_MOCK_EXAM', payload: res });
    setResult(res);
    setScreen('result');
  }

  function resetExam() {
    setScreen('setup');
    setConfig({ size: null, distribution: { ...DEFAULT_DIST }, customMode: false, allowRepeats: false });
    setQuestions([]);
    setAnswers([]);
    setMarked([]);
    setCurrentIndex(0);
    setTimeLeft(0);
    setTotalTime(0);
    setQuestionTimes([]);
    setResult(null);
    setMistakesAdded(false);
    setError(null);
  }
}

function PreflightScreen({ totalSeeds, dispatch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.6 }}>&#128218;</div>
      <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', marginBottom: '1rem' }}>Minimum 20 soal di Seed Bank diperlukan untuk Mock Exam</h2>
      <p style={{ color: 'var(--text)', opacity: 0.7, marginBottom: '2rem', fontSize: '1.1rem' }}>Saat ini: {totalSeeds} / 20 soal</p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => dispatch({ type: 'SET_MODULE', payload: 'seed' })} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--gold)', background: 'var(--gold)', color: '#000', fontWeight: 600, cursor: 'pointer' }}>Pergi ke Daily Seed</button>
        <button onClick={() => dispatch({ type: 'SET_MODULE', payload: 'drill' })} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Latih di Drill Mode</button>
      </div>
    </div>
  );
}

function SetupScreen({ config, setConfig, totalSeeds, showConfirm, setShowConfirm, onStart }) {
  function updateDist(key, val) {
    const newDist = { ...config.distribution, [key]: val };
    setConfig({ ...config, distribution: newDist });
  }

  const distSum = Object.values(config.distribution).reduce((a, b) => a + b, 0);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.5rem' }}>
      <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>Mock Exam Setup</h2>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Ukuran Ujian</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {SIZES.map(s => {
            const available = totalSeeds >= s.questions;
            const selected = config.size === s.key;
            return (
              <button key={s.key} disabled={!available} onClick={() => setConfig({ ...config, size: s.key })} style={{ padding: '1rem', borderRadius: '0.75rem', border: selected ? '2px solid var(--gold)' : '1px solid var(--border)', background: selected ? 'var(--bg-card)' : 'transparent', opacity: available ? 1 : 0.4, cursor: available ? 'pointer' : 'not-allowed', textAlign: 'center' }}>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>{s.label}</div>
                <div style={{ color: 'var(--text)', opacity: 0.7, fontSize: '0.85rem' }}>{s.questions} soal, {s.minutes} menit</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: available ? 'var(--moss)' : 'var(--rust)' }}>{available ? 'Tersedia' : 'Seed kurang'}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Distribusi Subjek</h3>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setConfig({ ...config, customMode: false, distribution: { matematika: 40, tpa: 25, bahasa_inggris: 20, bahasa_indonesia: 15 } })} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: !config.customMode ? '2px solid var(--gold)' : '1px solid var(--border)', background: !config.customMode ? 'var(--bg-card)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}>Proporsional SIMAK</button>
          <button onClick={() => setConfig({ ...config, customMode: true })} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: config.customMode ? '2px solid var(--gold)' : '1px solid var(--border)', background: config.customMode ? 'var(--bg-card)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}>Custom</button>
        </div>
        {!config.customMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text)', opacity: 0.8 }}>
            <span>Matematika: 40%</span><span>TPA: 25%</span><span>B. Inggris: 20%</span><span>B. Indonesia: 15%</span>
          </div>
        )}
        {config.customMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(config.distribution).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: 'var(--text)', fontSize: '0.85rem', width: '120px' }}>{SUBJECT_LABELS[key]}</span>
                <input type="range" min="0" max="100" value={val} onChange={e => updateDist(key, Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ color: 'var(--text)', fontSize: '0.85rem', width: '40px' }}>{val}%</span>
              </div>
            ))}
            {distSum !== 100 && <p style={{ color: 'var(--rust)', fontSize: '0.8rem' }}>Total harus 100% (saat ini: {distSum}%)</p>}
          </div>
        )}
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)', fontSize: '0.9rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={config.allowRepeats} onChange={e => setConfig({ ...config, allowRepeats: e.target.checked })} />
          Izinkan soal yang pernah muncul di mock sebelumnya
        </label>
      </div>
      <button disabled={!config.size || (config.customMode && distSum !== 100)} onClick={() => setShowConfirm(true)} style={{ width: '100%', padding: '0.875rem', borderRadius: '0.5rem', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: '1rem', cursor: config.size ? 'pointer' : 'not-allowed', opacity: config.size ? 1 : 0.5 }}>Mulai Exam</button>
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text)', marginBottom: '1.5rem', fontSize: '1rem' }}>Setelah dimulai, tidak bisa di-pause. Pastikan kamu siap.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={onStart} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--gold)', color: '#000', fontWeight: 600, cursor: 'pointer' }}>Mulai</button>
              <button onClick={() => setShowConfirm(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamScreen({ questions, answers, setAnswers, marked, setMarked, currentIndex, setCurrentIndex, timeLeft, totalTime, questionStartTime, setQuestionStartTime, questionTimes, setQuestionTimes, showSubmitWarn, setShowSubmitWarn, onSubmit }) {
  const timerRef = useRef(null);
  const [time, setTime] = useState(timeLeft);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const remaining = timeLeft - elapsed;
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setTime(0);
        onSubmit();
      } else {
        setTime(remaining);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const isLowTime = time < totalTime * 0.1;
  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(time % 60).padStart(2, '0');
  const q = questions[currentIndex];
  const options = q?.options || [];

  function selectAnswer(opt) {
    const now = Date.now();
    const spent = questionStartTime ? (now - questionStartTime) / 1000 : 0;
    const newTimes = [...questionTimes];
    newTimes[currentIndex] = (newTimes[currentIndex] || 0) + spent;
    setQuestionTimes(newTimes);
    const newAnswers = [...answers];
    newAnswers[currentIndex] = opt;
    setAnswers(newAnswers);
    setQuestionStartTime(Date.now());
  }

  function goTo(idx) {
    const now = Date.now();
    const spent = questionStartTime ? (now - questionStartTime) / 1000 : 0;
    const newTimes = [...questionTimes];
    newTimes[currentIndex] = (newTimes[currentIndex] || 0) + spent;
    setQuestionTimes(newTimes);
    setCurrentIndex(idx);
    setQuestionStartTime(Date.now());
  }

  function toggleMark() {
    const newMarked = [...marked];
    newMarked[currentIndex] = !newMarked[currentIndex];
    setMarked(newMarked);
  }

  function handleSubmit() {
    const blanks = answers.filter(a => a === null).length;
    if (blanks > 0) {
      setShowSubmitWarn(true);
    } else {
      onSubmit();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'monospace', color: isLowTime ? 'var(--rust)' : 'var(--text)' }}>{mm}:{ss}</span>
        <button onClick={toggleMark} style={{ padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--amber)', background: marked[currentIndex] ? 'var(--amber)' : 'transparent', color: marked[currentIndex] ? '#000' : 'var(--amber)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>Tandai Review</button>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', flex: 1, padding: '0.25rem 0' }}>
          {questions.map((_, i) => {
            let bg = 'var(--border)';
            if (marked[i]) bg = 'var(--amber)';
            else if (answers[i] !== null) bg = 'var(--moss)';
            return <button key={i} onClick={() => goTo(i)} style={{ minWidth: '28px', height: '28px', borderRadius: '4px', border: i === currentIndex ? '2px solid var(--gold)' : 'none', background: bg, color: '#000', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{i + 1}</button>;
          })}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '720px', width: '100%' }}>
          <p style={{ color: 'var(--text)', opacity: 0.6, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Soal {currentIndex + 1} / {questions.length}</p>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>{q?.question || ''}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {options.map((opt, oi) => {
              const label = String.fromCharCode(65 + oi);
              const selected = answers[currentIndex] === label;
              return (
                <button key={oi} onClick={() => selectAnswer(label)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: selected ? 'var(--gold-soft, rgba(255,215,0,0.15))' : 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem' }}>
                  <span style={{ fontWeight: 700, opacity: 0.7 }}>{label}.</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
        <button disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.4 : 1 }}>Sebelumnya</button>
        <button onClick={handleSubmit} style={{ padding: '0.5rem 1.25rem', borderRadius: '0.375rem', border: 'none', background: 'var(--rust)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Submit Exam</button>
        <button disabled={currentIndex >= questions.length - 1} onClick={() => goTo(currentIndex + 1)} style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: currentIndex >= questions.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex >= questions.length - 1 ? 0.4 : 1 }}>Selanjutnya</button>
      </div>
      {showSubmitWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text)', marginBottom: '1.5rem' }}>Ada {answers.filter(a => a === null).length} soal belum dijawab. Yakin submit?</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={onSubmit} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: 'var(--rust)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Lanjut</button>
              <button onClick={() => setShowSubmitWarn(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Kembali</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultScreen({ result, state, dispatch, mistakesAdded, setMistakesAdded, onReset }) {
  const { score, totalQuestions, accuracy, subjectBreakdown, timePerQuestion, duration, slowestIdx, avgTime, questions: questionsData } = result;

  function addMistakes() {
    if (mistakesAdded) return;
    questionsData.forEach((qd, index) => {
      if (qd.userAnswer !== qd.correctAnswer) {
        dispatch({
          type: 'ADD_MISTAKE',
          payload: {
            id: 'mistake-' + Date.now() + '-' + index,
            subject: qd.subject,
            topic: 'mock-exam',
            question: qd.questionId,
            options: [],
            userAnswer: qd.userAnswer,
            correctAnswer: qd.correctAnswer,
            explanation: '',
            errorCategory: 'mock-exam',
            confidence: 0,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            mastered: false,
            note: null,
          },
        });
      }
    });
    setMistakesAdded(true);
  }

  const wrongCount = questionsData.filter(q => q.userAnswer !== q.correctAnswer).length;
  const errorBySubject = {};
  questionsData.forEach(q => {
    if (q.userAnswer !== q.correctAnswer) {
      errorBySubject[q.subject] = (errorBySubject[q.subject] || 0) + 1;
    }
  });

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--text)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Hasil Mock Exam</h2>
        <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--gold)' }}>{score} / {totalQuestions}</div>
        <p style={{ color: 'var(--text)', opacity: 0.7 }}>Akurasi: {(accuracy * 100).toFixed(1)}%</p>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Breakdown per Subjek</h3>
        {Object.entries(subjectBreakdown).map(([subj, data]) => {
          if (data.total === 0) return null;
          const pct = data.total > 0 ? (data.correct / data.total) * 100 : 0;
          return (
            <div key={subj} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>{SUBJECT_LABELS[subj] || subj}</span>
                <span>{data.correct}/{data.total}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'var(--border)' }}>
                <div style={{ height: '100%', borderRadius: '4px', background: 'var(--moss)', width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Analisis Waktu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text)' }}>
          <span>Waktu digunakan:</span><span>{Math.floor(duration / 60)}m {duration % 60}s</span>
          <span>Soal terlambat:</span><span>#{slowestIdx + 1} ({(timePerQuestion[slowestIdx] || 0).toFixed(1)}s)</span>
          <span>Rata-rata/soal:</span><span>{avgTime.toFixed(1)}s</span>
        </div>
      </div>
      <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Pola Error ({wrongCount} salah)</h3>
        {Object.entries(errorBySubject).map(([subj, count]) => (
          <div key={subj} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text)', fontSize: '0.85rem', padding: '0.25rem 0' }}>
            <span>{SUBJECT_LABELS[subj] || subj}</span>
            <span style={{ color: 'var(--rust)' }}>{count} salah</span>
          </div>
        ))}
      </div>
      {wrongCount > 0 && (
        <button onClick={addMistakes} disabled={mistakesAdded} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--amber)', background: mistakesAdded ? 'transparent' : 'var(--amber)', color: mistakesAdded ? 'var(--text)' : '#000', fontWeight: 600, cursor: mistakesAdded ? 'default' : 'pointer', marginBottom: '1rem', opacity: mistakesAdded ? 0.6 : 1 }}>{mistakesAdded ? 'Sudah ditambahkan ke Mistake Notebook' : 'Tambah semua salah ke Mistake Notebook'}</button>
      )}
      {state.mockExamHistory.length > 1 && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <h3 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Riwayat Skor</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text)' }}>
            {state.mockExamHistory.slice(0, 10).map((h, i) => (
              <span key={h.id || i} style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: 'var(--border)' }}>{h.score}/{h.totalQuestions}</span>
            ))}
          </div>
        </div>
      )}
      <button onClick={onReset} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Kembali ke Menu</button>
    </div>
  );
}
