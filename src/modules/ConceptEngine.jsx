import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { callClaude, callClaudeStream } from '../lib/api';
import { parseJSONSafe } from '../lib/parseJSON';
import { calculateNextReview, updateElo } from '../lib/algorithms';
import {
  CONCEPT_PRETEST_SYSTEM,
  CONCEPT_EXPLANATION_SYSTEM,
  FEYNMAN_EVALUATION_SYSTEM,
  CONCEPT_PRACTICE_SYSTEM,
} from '../lib/prompts';

const SUBJECTS = {
  matematika: { label: 'Matematika', color: 'var(--subj-mat)', topics: ['Logaritma', 'Trigonometri', 'Limit', 'Turunan', 'Integral', 'Matriks', 'Vektor', 'Probabilitas', 'Statistika', 'Barisan & Deret'] },
  tpa: { label: 'TPA', color: 'var(--subj-tpa)', topics: ['Silogisme', 'Analogi', 'Deret Angka', 'Penalaran Logis', 'Penalaran Analitis', 'Aritmetika', 'Pengetahuan Umum'] },
  bahasa_inggris: { label: 'Bahasa Inggris', color: 'var(--subj-eng)', topics: ['Reading Comprehension', 'Grammar', 'Vocabulary', 'Error Recognition', 'Sentence Completion'] },
  bahasa_indonesia: { label: 'Bahasa Indonesia', color: 'var(--subj-ind)', topics: ['Pemahaman Bacaan', 'EYD/PUEBI', 'Kalimat Efektif', 'Paragraf', 'Makna Kata', 'Kesalahan Kalimat'] },
};

function getEloLabel(elo) {
  if (elo >= 1500) return `${elo} - dikuasai`;
  if (elo >= 1200) return `${elo} - berkembang`;
  return `${elo} - perlu review`;
}

const INITIAL_FLOW_STATE = {
  step: 'select',
  selectedSubject: null,
  selectedTopic: null,
  loading: false,
  error: null,
  pretestData: null,
  pretestAnswer: null,
  pretestConfidence: 50,
  explainText: '',
  showSkip: false,
  streamDone: false,
  feynmanText: '',
  feynmanResult: null,
  explainAttempt: 0,
  practiceData: null,
  practiceAnswer: null,
  practiceConfidence: 50,
  practiceRevealed: false,
  saved: false,
};

export default function ConceptEngine() {
  const { state, dispatch } = useApp();

  const [step, setStep] = useState(INITIAL_FLOW_STATE.step);
  const [selectedSubject, setSelectedSubject] = useState(INITIAL_FLOW_STATE.selectedSubject);
  const [selectedTopic, setSelectedTopic] = useState(INITIAL_FLOW_STATE.selectedTopic);
  const [loading, setLoading] = useState(INITIAL_FLOW_STATE.loading);
  const [error, setError] = useState(INITIAL_FLOW_STATE.error);

  // Pretest state
  const [pretestData, setPretestData] = useState(INITIAL_FLOW_STATE.pretestData);
  const [pretestAnswer, setPretestAnswer] = useState(INITIAL_FLOW_STATE.pretestAnswer);
  const [pretestConfidence, setPretestConfidence] = useState(INITIAL_FLOW_STATE.pretestConfidence);

  // Explain state
  const [explainText, setExplainText] = useState(INITIAL_FLOW_STATE.explainText);
  const [showSkip, setShowSkip] = useState(INITIAL_FLOW_STATE.showSkip);
  const [streamDone, setStreamDone] = useState(INITIAL_FLOW_STATE.streamDone);
  const abortRef = useRef(false);

  // Feynman state
  const [feynmanText, setFeynmanText] = useState(INITIAL_FLOW_STATE.feynmanText);
  const [feynmanResult, setFeynmanResult] = useState(INITIAL_FLOW_STATE.feynmanResult);
  const [explainAttempt, setExplainAttempt] = useState(INITIAL_FLOW_STATE.explainAttempt);

  // Practice state
  const [practiceData, setPracticeData] = useState(INITIAL_FLOW_STATE.practiceData);
  const [practiceAnswer, setPracticeAnswer] = useState(INITIAL_FLOW_STATE.practiceAnswer);
  const [practiceConfidence, setPracticeConfidence] = useState(INITIAL_FLOW_STATE.practiceConfidence);
  const [practiceRevealed, setPracticeRevealed] = useState(INITIAL_FLOW_STATE.practiceRevealed);

  // Grading state
  const [saved, setSaved] = useState(INITIAL_FLOW_STATE.saved);

  function resetState() {
    setStep(INITIAL_FLOW_STATE.step);
    setSelectedSubject(INITIAL_FLOW_STATE.selectedSubject);
    setSelectedTopic(INITIAL_FLOW_STATE.selectedTopic);
    setPretestData(INITIAL_FLOW_STATE.pretestData);
    setPretestAnswer(INITIAL_FLOW_STATE.pretestAnswer);
    setPretestConfidence(INITIAL_FLOW_STATE.pretestConfidence);
    setExplainText(INITIAL_FLOW_STATE.explainText);
    setShowSkip(INITIAL_FLOW_STATE.showSkip);
    setStreamDone(INITIAL_FLOW_STATE.streamDone);
    setFeynmanText(INITIAL_FLOW_STATE.feynmanText);
    setFeynmanResult(INITIAL_FLOW_STATE.feynmanResult);
    setExplainAttempt(INITIAL_FLOW_STATE.explainAttempt);
    setPracticeData(INITIAL_FLOW_STATE.practiceData);
    setPracticeAnswer(INITIAL_FLOW_STATE.practiceAnswer);
    setPracticeConfidence(INITIAL_FLOW_STATE.practiceConfidence);
    setPracticeRevealed(INITIAL_FLOW_STATE.practiceRevealed);
    setSaved(INITIAL_FLOW_STATE.saved);
    setError(INITIAL_FLOW_STATE.error);
  }

  // --- Step 0: Select ---
  if (step === 'select') {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
          Pilih Konsep untuk Dipelajari
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(SUBJECTS).map(([key, subj]) => (
            <button
              key={key}
              onClick={() => setSelectedSubject(selectedSubject === key ? null : key)}
              className="rounded-lg p-4 text-left cursor-pointer transition-all"
              style={{
                backgroundColor: selectedSubject === key ? subj.color : 'var(--bg-card)',
                border: `1px solid ${selectedSubject === key ? subj.color : 'var(--border)'}`,
                color: selectedSubject === key ? '#fff' : 'var(--text)',
                opacity: selectedSubject && selectedSubject !== key ? 0.6 : 1,
              }}
            >
              <p className="font-medium text-sm" style={{ margin: 0 }}>{subj.label}</p>
              <p className="text-xs mt-1" style={{ margin: 0, opacity: 0.7 }}>
                {subj.topics.length} topik
              </p>
            </button>
          ))}
        </div>

        {selectedSubject && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-muted)', margin: 0 }}>
              Topik {SUBJECTS[selectedSubject].label}
            </h3>
            {SUBJECTS[selectedSubject].topics.map((topic) => {
              const key = `${selectedSubject}.${topic}`;
              const mastery = state.topicMastery[key];
              const elo = mastery?.elo || 1000;
              const muted = elo > 1500;
              return (
                <button
                  key={topic}
                  onClick={() => {
                    setSelectedTopic(topic);
                    setStep('pretest');
                  }}
                  className="rounded-lg p-3 flex items-center justify-between cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    opacity: muted ? 0.5 : 1,
                  }}
                >
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{topic}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {getEloLabel(elo)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- Step 1: Pretest ---
  if (step === 'pretest') {
    return (
      <PretestStep
        subject={selectedSubject}
        topic={selectedTopic}
        apiKey={state.apiKey}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        pretestData={pretestData}
        setPretestData={setPretestData}
        pretestAnswer={pretestAnswer}
        setPretestAnswer={setPretestAnswer}
        pretestConfidence={pretestConfidence}
        setPretestConfidence={setPretestConfidence}
        onNext={() => setStep('explain')}
      />
    );
  }

  // --- Step 2: Explain ---
  if (step === 'explain') {
    return (
      <ExplainStep
        subject={selectedSubject}
        topic={selectedTopic}
        apiKey={state.apiKey}
        explainText={explainText}
        setExplainText={setExplainText}
        showSkip={showSkip}
        setShowSkip={setShowSkip}
        streamDone={streamDone}
        setStreamDone={setStreamDone}
        abortRef={abortRef}
        explainAttempt={explainAttempt}
        onNext={() => setStep('feynman')}
      />
    );
  }

  // --- Step 3: Feynman ---
  if (step === 'feynman') {
    return (
      <FeynmanStep
        subject={selectedSubject}
        topic={selectedTopic}
        apiKey={state.apiKey}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        feynmanText={feynmanText}
        setFeynmanText={setFeynmanText}
        feynmanResult={feynmanResult}
        setFeynmanResult={setFeynmanResult}
        onRetryExplain={() => {
          setExplainText('');
          setShowSkip(false);
          setStreamDone(false);
          setExplainAttempt((a) => a + 1);
          setStep('explain');
        }}
        onRetryFeynman={() => {
          setFeynmanText('');
          setFeynmanResult(null);
        }}
        onNext={() => setStep('practice')}
      />
    );
  }

  // --- Step 4: Practice ---
  if (step === 'practice') {
    return (
      <PracticeStep
        subject={selectedSubject}
        topic={selectedTopic}
        apiKey={state.apiKey}
        state={state}
        dispatch={dispatch}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        practiceData={practiceData}
        setPracticeData={setPracticeData}
        practiceAnswer={practiceAnswer}
        setPracticeAnswer={setPracticeAnswer}
        practiceConfidence={practiceConfidence}
        setPracticeConfidence={setPracticeConfidence}
        practiceRevealed={practiceRevealed}
        setPracticeRevealed={setPracticeRevealed}
        pretestData={pretestData}
        pretestAnswer={pretestAnswer}
        pretestConfidence={pretestConfidence}
        onNext={() => setStep('grading')}
      />
    );
  }

  // --- Step 5: Grading ---
  if (step === 'grading') {
    return (
      <GradingStep
        subject={selectedSubject}
        topic={selectedTopic}
        state={state}
        dispatch={dispatch}
        saved={saved}
        setSaved={setSaved}
        onDone={() => {
          resetState();
        }}
      />
    );
  }

  return null;
}

// ─── Pretest Step ─────────────────────────────────────────────────────────────
function PretestStep({
  subject, topic, apiKey, loading, setLoading, error, setError,
  pretestData, setPretestData, pretestAnswer, setPretestAnswer,
  pretestConfidence, setPretestConfidence, onNext,
}) {
  const fetched = useRef(false);

  useEffect(() => {
    if (!pretestData && !fetched.current) {
      fetched.current = true;
      fetchPretest();
    }
  }, []);

  async function fetchPretest() {
    setLoading(true);
    setError(null);
    try {
      const raw = await callClaude({
        apiKey,
        system: CONCEPT_PRETEST_SYSTEM,
        messages: [{ role: 'user', content: `Topic: "${topic}", Subject: "${subject}".` }],
        maxTokens: 1024,
      });
      const parsed = parseJSONSafe(raw);
      if (!parsed || !parsed.question || !parsed.options || !parsed.answer) {
        throw new Error('Invalid pretest response: missing required fields (question, options, answer)');
      }
      setPretestData(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(option) {
    setPretestAnswer(option);
  }

  function handleContinue() { onNext(); }

  if (loading) {
    return <LoadingSpinner message="Memuat soal pretest..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={() => { fetched.current = false; fetchPretest(); }} />;
  }

  if (!pretestData) return null;

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-lg p-4"
        style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-soft)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>
          Sebelum kita mulai - coba jawab dulu, walau belum yakin. Riset menunjukkan menebak duluan meningkatkan retensi 30%.
        </p>
      </div>

      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
          {pretestData.question}
        </p>

        <div className="flex flex-col gap-2">
          {Object.entries(pretestData.options).map(([key, val]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="w-full text-left rounded-lg p-3 cursor-pointer transition-all text-sm"
              style={{
                backgroundColor: pretestAnswer === key ? 'var(--gold-soft)' : 'var(--bg-elevated)',
                border: `1px solid ${pretestAnswer === key ? 'var(--gold)' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            >
              <span className="font-medium">{key}.</span> {val}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Confidence: {pretestConfidence}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={pretestConfidence}
          onChange={(e) => setPretestConfidence(Number(e.target.value))}
          className="w-full"
          style={{
            accentColor: 'var(--gold)',
          }}
        />
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-faint)' }}>
          <span>Menebak</span>
          <span>Yakin</span>
        </div>
      </div>

      {pretestAnswer && (
        <button
          onClick={handleContinue}
          className="self-start px-6 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
        >
          Lanjut
        </button>
      )}
    </div>
  );
}

// ─── Explain Step (Streaming) ─────────────────────────────────────────────────
function ExplainStep({
  subject, topic, apiKey, explainText, setExplainText,
  showSkip, setShowSkip, streamDone, setStreamDone, abortRef, explainAttempt, onNext,
}) {
  const started = useRef(false);
  const abortControllerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      abortRef.current = false;
      startStream();
    }
    const timer = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  async function startStream() {
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const extraInstruction = explainAttempt > 0
        ? ' Gunakan analogi yang berbeda dari sebelumnya.'
        : '';
      await callClaudeStream({
        apiKey,
        system: CONCEPT_EXPLANATION_SYSTEM,
        messages: [{ role: 'user', content: `Topic: "${topic}", Subject: "${subject}".${extraInstruction}` }],
        maxTokens: 1024,
        temperature: 0.7,
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!abortRef.current) {
            setExplainText((prev) => prev + chunk);
          }
        },
      });
      if (!abortRef.current) {
        setStreamDone(true);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (!abortRef.current) {
        setError(err.message);
      }
    }
  }

  function handleSkip() {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStreamDone(true);
    onNext();
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={() => { started.current = false; startStream(); }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-muted)', margin: 0 }}>
        Penjelasan: {topic}
      </h3>
      <div
        className="rounded-lg p-5 text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          minHeight: '200px',
        }}
      >
        {explainText || <span style={{ color: 'var(--text-faint)' }}>Memuat penjelasan...</span>}
      </div>

      <div className="flex gap-3">
        {showSkip && !streamDone && (
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Lewati
          </button>
        )}
        {streamDone && (
          <button
            onClick={onNext}
            className="px-6 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
          >
            Lanjut
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Feynman Step ─────────────────────────────────────────────────────────────
function FeynmanStep({
  subject, topic, apiKey, loading, setLoading, error, setError,
  feynmanText, setFeynmanText, feynmanResult, setFeynmanResult,
  onRetryExplain, onRetryFeynman, onNext,
}) {
  const [autoProceeding, setAutoProceeding] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (feynmanResult && feynmanResult.score > 80 && !autoProceeding) {
      setAutoProceeding(true);
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          onNext();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [feynmanResult]);

  const wordCount = feynmanText.trim().split(/\s+/).filter(Boolean).length;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const raw = await callClaude({
        apiKey,
        system: FEYNMAN_EVALUATION_SYSTEM,
        messages: [{
          role: 'user',
          content: `Topik yang harus dijelaskan: "${topic}" (${subject})\n\nPenjelasan user:\n${feynmanText}`,
        }],
        maxTokens: 1024,
      });
      const parsed = parseJSONSafe(raw);
      if (!parsed || typeof parsed.score !== 'number' || !Array.isArray(parsed.gaps) || !Array.isArray(parsed.strengths)) {
        throw new Error('Invalid Feynman evaluation response: missing required fields (score, gaps, strengths)');
      }
      setFeynmanResult(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Mengevaluasi penjelasanmu..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={handleSubmit} />;
  }

  if (feynmanResult) {
    const { score, gaps, strengths, action } = feynmanResult;
    const scoreColor = score < 50 ? 'var(--rust)' : score <= 80 ? 'var(--amber)' : 'var(--moss)';

    return (
      <div className="flex flex-col gap-5">
        {/* Score */}
        <div className="text-center">
          <p className="text-4xl font-bold" style={{ color: scoreColor, margin: 0 }}>
            {score}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Skor Pemahaman
          </p>
        </div>

        {/* Gaps */}
        {gaps && gaps.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium" style={{ color: 'var(--rust)', margin: 0 }}>Gaps:</p>
            {gaps.map((g, i) => (
              <p key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text)', margin: 0 }}>
                <span style={{ color: 'var(--rust)' }}>&#9679;</span> {g}
              </p>
            ))}
          </div>
        )}

        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium" style={{ color: 'var(--moss)', margin: 0 }}>Strengths:</p>
            {strengths.map((s, i) => (
              <p key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text)', margin: 0 }}>
                <span style={{ color: 'var(--moss)' }}>&#9679;</span> {s}
              </p>
            ))}
          </div>
        )}

        {/* Action callout */}
        {action && (
          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-soft)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>{action}</p>
          </div>
        )}

        {/* Conditional buttons */}
        <div className="flex gap-3 flex-wrap">
          {score < 50 && (
            <button
              onClick={onRetryExplain}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer"
              style={{ backgroundColor: 'var(--rust)', color: '#fff', border: 'none' }}
            >
              Pelajari Ulang dari Awal
            </button>
          )}
          {score >= 50 && score <= 80 && (
            <>
              <button
                onClick={onRetryFeynman}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                Coba Lagi Penjelasan
              </button>
              <button
                onClick={onNext}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
              >
                Lanjut ke Soal
              </button>
            </>
          )}
          {score > 80 && (
            <p className="text-sm" style={{ color: 'var(--moss)', margin: 0 }}>
              Luar biasa! Lanjut ke soal latihan...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Input form
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>
        Sekarang kamu yang jelaskan. Ketik penjelasanmu tentang <strong>{topic}</strong> dengan kata sendiri. Min. 50 kata.
      </p>
      <textarea
        value={feynmanText}
        onChange={(e) => setFeynmanText(e.target.value)}
        placeholder="Tulis penjelasanmu di sini..."
        className="w-full rounded-lg p-4 text-sm resize-y"
        style={{
          minHeight: '150px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: wordCount >= 50 ? 'var(--moss)' : 'var(--text-faint)' }}>
          {wordCount} / 50 kata
        </span>
        <button
          onClick={handleSubmit}
          disabled={wordCount < 50}
          className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
          style={{
            backgroundColor: wordCount >= 50 ? 'var(--gold)' : 'var(--bg-hover)',
            color: wordCount >= 50 ? 'var(--bg)' : 'var(--text-faint)',
            border: 'none',
            opacity: wordCount >= 50 ? 1 : 0.6,
          }}
        >
          Kirim untuk Review
        </button>
      </div>
    </div>
  );
}

// ─── Practice Step ────────────────────────────────────────────────────────────
function PracticeStep({
  subject, topic, apiKey, state, dispatch, loading, setLoading, error, setError,
  practiceData, setPracticeData, practiceAnswer, setPracticeAnswer,
  practiceConfidence, setPracticeConfidence, practiceRevealed, setPracticeRevealed,
  pretestData, pretestAnswer, pretestConfidence, onNext,
}) {
  const fetched = useRef(false);

  useEffect(() => {
    if (!practiceData && !fetched.current) {
      fetched.current = true;
      fetchPractice();
    }
  }, []);

  async function fetchPractice() {
    setLoading(true);
    setError(null);
    try {
      const raw = await callClaude({
        apiKey,
        system: CONCEPT_PRACTICE_SYSTEM,
        messages: [{ role: 'user', content: `Topic: "${topic}", Subject: "${subject}".` }],
        maxTokens: 1024,
      });
      const parsed = parseJSONSafe(raw);
      if (!parsed || !parsed.question || !parsed.options || !parsed.answer) {
        throw new Error('Invalid practice response: missing required fields (question, options, answer)');
      }
      setPracticeData(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(option) {
    if (practiceRevealed) return;
    setPracticeAnswer(option);
  }

  function handleReveal() {
    setPracticeRevealed(true);
    const isCorrect = practiceAnswer === practiceData.answer;
    const pretestCorrect = pretestAnswer === pretestData?.answer;
    const topicKey = `${subject}.${topic}`;
    const currentMastery = state.topicMastery[topicKey];
    const currentElo = currentMastery?.elo || 1000;
    const questionDifficulty = practiceData.difficulty || 1300;
    const newElo = updateElo(currentElo, questionDifficulty, isCorrect);

    // Log pretest confidence as a calibration data point
    if (pretestData && pretestAnswer != null) {
      dispatch({
        type: 'LOG_CONFIDENCE',
        payload: {
          confidence: pretestConfidence / 100,
          correct: pretestCorrect,
          timestamp: new Date().toISOString(),
          subject,
        },
      });
    }

    dispatch({
      type: 'LOG_CONFIDENCE',
      payload: {
        confidence: practiceConfidence / 100,
        correct: isCorrect,
        timestamp: new Date().toISOString(),
        subject,
      },
    });

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
  }

  if (loading) {
    return <LoadingSpinner message="Memuat soal latihan..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={() => { fetched.current = false; fetchPractice(); }} />;
  }

  if (!practiceData) return null;

  const practiceCorrect = practiceAnswer === practiceData.answer;
  const pretestCorrect = pretestAnswer === pretestData?.answer;

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-muted)', margin: 0 }}>
        Soal Latihan: {topic}
      </h3>

      <div
        className="rounded-lg p-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
          {practiceData.question}
        </p>

        <div className="flex flex-col gap-2">
          {Object.entries(practiceData.options).map(([key, val]) => {
            let bg = 'var(--bg-elevated)';
            let borderColor = 'var(--border)';
            if (practiceRevealed) {
              if (key === practiceData.answer) { bg = 'rgba(76, 140, 76, 0.2)'; borderColor = 'var(--moss)'; }
              else if (key === practiceAnswer && !practiceCorrect) { bg = 'rgba(180, 80, 60, 0.2)'; borderColor = 'var(--rust)'; }
            } else if (practiceAnswer === key) {
              bg = 'var(--gold-soft)'; borderColor = 'var(--gold)';
            }
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className="w-full text-left rounded-lg p-3 cursor-pointer transition-all text-sm"
                style={{ backgroundColor: bg, border: `1px solid ${borderColor}`, color: 'var(--text)' }}
              >
                <span className="font-medium">{key}.</span> {val}
              </button>
            );
          })}
        </div>
      </div>

      {!practiceRevealed && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Confidence: {practiceConfidence}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={practiceConfidence}
              onChange={(e) => setPracticeConfidence(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--gold)' }}
            />
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-faint)' }}>
              <span>Menebak</span>
              <span>Yakin</span>
            </div>
          </div>
          {practiceAnswer && (
            <button
              onClick={handleReveal}
              className="self-start px-6 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
            >
              Cek Jawaban
            </button>
          )}
        </>
      )}

      {practiceRevealed && (
        <div className="flex flex-col gap-4">
          {/* Comparison card */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Pretest</p>
              <p className="text-lg font-bold" style={{ color: pretestCorrect ? 'var(--moss)' : 'var(--rust)', margin: 0 }}>
                {pretestCorrect ? 'Benar' : 'Salah'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-faint)', margin: 0 }}>
                Confidence: {pretestConfidence}%
              </p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Practice</p>
              <p className="text-lg font-bold" style={{ color: practiceCorrect ? 'var(--moss)' : 'var(--rust)', margin: 0 }}>
                {practiceCorrect ? 'Benar' : 'Salah'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-faint)', margin: 0 }}>
                Confidence: {practiceConfidence}%
              </p>
            </div>
          </div>

          {/* Growth message */}
          {!pretestCorrect && practiceCorrect && (
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-soft)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--gold)', margin: 0 }}>
                Pretest salah &#8594; Practice benar = 1 konsep dikuasai!
              </p>
            </div>
          )}

          <button
            onClick={onNext}
            className="self-start px-6 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
          >
            Lanjut
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Grading Step ─────────────────────────────────────────────────────────────
function GradingStep({ subject, topic, state, dispatch, saved, setSaved, onDone }) {
  const [localSaved, setLocalSaved] = useState(false);

  function handleGrade(quality) {
    const topicKey = `${subject}.${topic}`;
    const existingItem = (state.srQueue || []).find(
      (item) => item.topic === topic && item.subject === subject
    );

    if (existingItem) {
      const updated = calculateNextReview(existingItem, quality);
      dispatch({ type: 'REVIEW_SR_ITEM', payload: { id: existingItem.id, ...updated } });
    } else {
      const newItem = calculateNextReview({ easeFactor: 2.5, interval: 0, repetitions: 0 }, quality);
      dispatch({
        type: 'ADD_SR_ITEM',
        payload: {
          id: `sr-${subject}-${topic}-${Date.now()}`,
          subject,
          topic,
          prompt: `Review konsep: ${topic}`,
          answer: '',
          ...newItem,
        },
      });
    }

    setLocalSaved(true);
    setSaved(true);
    setTimeout(() => onDone(), 1500);
  }

  if (localSaved) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-lg font-medium" style={{ color: 'var(--gold)' }}>Tersimpan!</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Kembali ke pilihan topik...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 items-center py-8">
      <p className="text-sm text-center" style={{ color: 'var(--text)', margin: 0 }}>
        Bagaimana perasaanmu tentang konsep <strong>{topic}</strong>?
      </p>

      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={() => handleGrade(1)}
          className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--rust)', color: '#fff', border: 'none' }}
        >
          Lupa
        </button>
        <button
          onClick={() => handleGrade(3)}
          className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--amber)', color: '#fff', border: 'none' }}
        >
          Sulit
        </button>
        <button
          onClick={() => handleGrade(4)}
          className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--moss)', color: '#fff', border: 'none' }}
        >
          Pas
        </button>
        <button
          onClick={() => handleGrade(5)}
          className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--gold)', color: 'var(--bg)', border: 'none' }}
        >
          Mudah
        </button>
      </div>
    </div>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
