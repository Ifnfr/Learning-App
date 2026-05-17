import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';
import { fetchMistakes as syncFetchMistakes, updateMistake as syncUpdateMistake, deleteMistake as syncDeleteMistake } from '../lib/sync';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = {
  matematika: { label: 'Matematika' },
  tpa: { label: 'TPA' },
  bahasa_inggris: { label: 'B. Inggris' },
  bahasa_indonesia: { label: 'B. Indonesia' },
};

const ERROR_CATEGORIES = ['konseptual', 'komputasi', 'perangkap', 'ambiguitas'];

const ERROR_COLORS = {
  konseptual: 'var(--rust)',
  komputasi: 'var(--amber)',
  perangkap: 'var(--moss)',
  ambiguitas: 'var(--gold)',
};

const STATUS_OPTIONS = [
  { id: 'active', label: 'Belum dimasterkan' },
  { id: 'mastered', label: 'Sudah dimasterkan' },
  { id: 'all', label: 'Semua' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MistakeNotebook() {
  const { state, dispatch } = useApp();
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [retryMistake, setRetryMistake] = useState(null);

  // Auto-prune: keep mistakes under 5000
  useEffect(() => {
    if (state.mistakes && state.mistakes.length > 5000) {
      const nonMastered = state.mistakes.filter(m => !m.mastered);
      const mastered = state.mistakes
        .filter(m => m.mastered)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limit = 5000 - nonMastered.length;
      const kept = [...nonMastered, ...mastered.slice(0, Math.max(0, limit))];
      dispatch({ type: 'IMPORT_DATA', payload: { mistakes: kept } });
    }
  }, [state.mistakes?.length]);

  // Load mistakes from backend on mount
  useEffect(() => {
    async function loadFromBackend() {
      try {
        const remote = await syncFetchMistakes();
        if (remote && remote.length > 0) {
          dispatch({ type: 'IMPORT_DATA', payload: { mistakes: remote } });
        }
      } catch (e) { /* use local state */ }
    }
    loadFromBackend();
  }, []);

  // Filtered mistakes
  const filteredMistakes = useMemo(() => {
    if (!state.mistakes) return [];
    return state.mistakes.filter(m => {
      // Subject filter
      if (selectedSubjects.length > 0 && !selectedSubjects.includes(m.subject)) return false;
      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(m.errorCategory)) return false;
      // Status filter
      if (statusFilter === 'active' && m.mastered) return false;
      if (statusFilter === 'mastered' && !m.mastered) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!m.question?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [state.mistakes, selectedSubjects, selectedCategories, statusFilter, searchQuery]);

  function handleDelete(mistakeId) {
    const updated = state.mistakes.filter(m => m.id !== mistakeId);
    dispatch({ type: 'IMPORT_DATA', payload: { mistakes: updated } });
    try { syncDeleteMistake(mistakeId); } catch (e) { /* offline */ }
  }

  function handleDrill10() {
    dispatch({ type: 'SET_MODULE', payload: 'drill' });
  }

  function handleExportPDF() {
    window.print();
  }

  function toggleSubject(subj) {
    setSelectedSubjects(prev =>
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    );
  }

  function toggleCategory(cat) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  if (retryMistake) {
    return (
      <RetryModal
        mistake={retryMistake}
        dispatch={dispatch}
        onClose={() => setRetryMistake(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 print-container">
      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, [data-sidebar], [data-topbar], .no-print {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            max-width: 100% !important;
          }
          .mistake-card {
            break-inside: avoid;
            border: 1px solid #ccc !important;
            margin-bottom: 12px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
          Mistake Notebook
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {state.mistakes?.length || 0} total kesalahan
        </span>
      </div>

      {/* Bulk Actions */}
      <div className="flex gap-2 flex-wrap no-print">
        <button
          onClick={handleDrill10}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
          style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)', border: '1px solid var(--gold-soft)' }}
        >
          Drill 10 mistake terbaru
        </button>
        <button
          onClick={handleExportPDF}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Export to PDF
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        selectedSubjects={selectedSubjects}
        toggleSubject={toggleSubject}
        selectedCategories={selectedCategories}
        toggleCategory={toggleCategory}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Mistake List */}
      {filteredMistakes.length === 0 ? (
        <EmptyState statusFilter={statusFilter} searchQuery={searchQuery} />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMistakes.map(mistake => (
            <MistakeCard
              key={mistake.id}
              mistake={mistake}
              onRetry={() => setRetryMistake(mistake)}
              onMaster={() => {
                dispatch({ type: 'MARK_MISTAKE_MASTERED', payload: mistake.id });
                try { syncUpdateMistake(mistake.id, { mastered: 1 }); } catch (e) {}
              }}
              onDelete={() => handleDelete(mistake.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({
  selectedSubjects, toggleSubject,
  selectedCategories, toggleCategory,
  statusFilter, setStatusFilter,
  searchQuery, setSearchQuery,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg p-4 no-print" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {/* Subject filter */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Subjek</span>
        <div className="flex gap-1.5 flex-wrap">
          <FilterButton
            active={selectedSubjects.length === 0}
            onClick={() => selectedSubjects.length > 0 && toggleSubject('__clear__') || undefined}
            onClear={() => {/* handled below */}}
            label="Semua"
            clearAll={() => selectedSubjects.length > 0 ? toggleSubject('__clear__') : null}
            isAll
            selectedSubjects={selectedSubjects}
            toggleSubject={toggleSubject}
          />
          {Object.entries(SUBJECTS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => toggleSubject(key)}
              className="px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all"
              style={{
                backgroundColor: selectedSubjects.includes(key) ? 'var(--gold-bg)' : 'var(--bg-elevated)',
                color: selectedSubjects.includes(key) ? 'var(--gold)' : 'var(--text-muted)',
                border: selectedSubjects.includes(key) ? '1px solid var(--gold-soft)' : '1px solid var(--border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error category filter */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Kategori Error</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategories([])}
            className="px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all"
            style={{
              backgroundColor: selectedCategories.length === 0 ? 'var(--gold-bg)' : 'var(--bg-elevated)',
              color: selectedCategories.length === 0 ? 'var(--gold)' : 'var(--text-muted)',
              border: selectedCategories.length === 0 ? '1px solid var(--gold-soft)' : '1px solid var(--border)',
            }}
          >
            Semua
          </button>
          {ERROR_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className="px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all capitalize"
              style={{
                backgroundColor: selectedCategories.includes(cat) ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
                color: selectedCategories.includes(cat) ? ERROR_COLORS[cat] : 'var(--text-muted)',
                border: selectedCategories.includes(cat) ? `1px solid ${ERROR_COLORS[cat]}` : '1px solid var(--border)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Status toggle */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status</span>
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setStatusFilter(opt.id)}
              className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: statusFilter === opt.id ? 'var(--bg-card)' : 'transparent',
                color: statusFilter === opt.id ? 'var(--text)' : 'var(--text-muted)',
                border: statusFilter === opt.id ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cari</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari di teks soal..."
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}

// Simplified FilterButton for "Semua" subject button
function FilterButton({ selectedSubjects, toggleSubject }) {
  return (
    <button
      onClick={() => {
        if (selectedSubjects.length > 0) {
          // Clear all selections
          selectedSubjects.forEach(s => toggleSubject(s));
        }
      }}
      className="px-2.5 py-1 rounded-md text-xs cursor-pointer transition-all"
      style={{
        backgroundColor: selectedSubjects.length === 0 ? 'var(--gold-bg)' : 'var(--bg-elevated)',
        color: selectedSubjects.length === 0 ? 'var(--gold)' : 'var(--text-muted)',
        border: selectedSubjects.length === 0 ? '1px solid var(--gold-soft)' : '1px solid var(--border)',
      }}
    >
      Semua
    </button>
  );
}

// ─── Mistake Card ─────────────────────────────────────────────────────────────
function MistakeCard({ mistake, onRetry, onMaster, onDelete }) {
  const formattedDate = useMemo(() => {
    if (!mistake.timestamp) return '-';
    const d = new Date(mistake.timestamp);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [mistake.timestamp]);

  const confidenceDisplay = useMemo(() => {
    const conf = mistake.confidence || 0;
    // High confidence but wrong = red, low confidence but wrong = neutral
    if (conf >= 60) {
      return { text: `Confidence ${conf}% - salah`, color: 'var(--rust)' };
    }
    return { text: `Confidence ${conf}%`, color: 'var(--text-muted)' };
  }, [mistake.confidence]);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3 mistake-card"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Top row: badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          {SUBJECTS[mistake.subject]?.label || mistake.subject}
        </span>
        {mistake.topic && (
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {mistake.topic}
          </span>
        )}
        {mistake.errorCategory && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: ERROR_COLORS[mistake.errorCategory] || 'var(--text-muted)',
              border: `1px solid ${ERROR_COLORS[mistake.errorCategory] || 'var(--border)'}`,
            }}
          >
            {mistake.errorCategory}
          </span>
        )}
        {mistake.mastered && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: 'rgba(76, 140, 76, 0.15)', color: 'var(--moss)' }}
          >
            Dikuasai
          </span>
        )}
      </div>

      {/* Question text - 2 line clamp */}
      <p
        className="text-sm font-medium"
        style={{
          color: 'var(--text)',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.5,
        }}
      >
        {mistake.question}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{formattedDate}</span>
        {mistake.retryCount > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Retry: {mistake.retryCount}x
          </span>
        )}
        <span className="text-xs" style={{ color: confidenceDisplay.color }}>
          {confidenceDisplay.text}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap no-print">
        {!mistake.mastered && (
          <>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)', border: '1px solid var(--gold-soft)' }}
            >
              Coba lagi
            </button>
            <button
              onClick={onMaster}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--moss)', border: '1px solid var(--border)' }}
            >
              Tandai dikuasai
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--rust)', border: '1px solid var(--border)' }}
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

// ─── Retry Modal ──────────────────────────────────────────────────────────────
function RetryModal({ mistake, dispatch, onClose }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(
    mistake.consecutiveCorrect || 0
  );

  function handleSelect(key) {
    if (revealed) return;
    setSelected(key);
  }

  function handleSubmit() {
    if (!selected || revealed) return;
    setRevealed(true);

    // Dispatch retry to increment retryCount
    dispatch({ type: 'RETRY_MISTAKE', payload: mistake.id });

    const isCorrect = selected === mistake.correctAnswer;
    if (isCorrect) {
      const newConsecutive = consecutiveCorrect + 1;
      setConsecutiveCorrect(newConsecutive);

      // Update consecutiveCorrect on the mistake via targeted action
      dispatch({ type: 'UPDATE_MISTAKE', payload: { id: mistake.id, data: { consecutiveCorrect: newConsecutive } } });

      // Auto-mastery after 3 consecutive correct
      if (newConsecutive >= 3) {
        dispatch({ type: 'MARK_MISTAKE_MASTERED', payload: mistake.id });
      }
    } else {
      setConsecutiveCorrect(0);
      // Reset consecutiveCorrect on wrong answer
      dispatch({ type: 'UPDATE_MISTAKE', payload: { id: mistake.id, data: { consecutiveCorrect: 0 } } });
    }
  }

  function handleClose() {
    onClose();
  }

  const isCorrect = revealed && selected === mistake.correctAnswer;
  const autoMastered = revealed && consecutiveCorrect >= 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
              Retry Mode
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {consecutiveCorrect}/3 beruntun benar
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon name="chevron-left" size={18} />
          </button>
        </div>

        {/* Question */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
            {mistake.question}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {mistake.options && Object.entries(mistake.options).map(([key, val]) => {
            let bg = 'var(--bg-elevated)';
            let borderColor = 'var(--border)';
            if (revealed) {
              if (key === mistake.correctAnswer) { bg = 'rgba(76, 140, 76, 0.2)'; borderColor = 'var(--moss)'; }
              else if (key === selected && !isCorrect) { bg = 'rgba(180, 80, 60, 0.2)'; borderColor = 'var(--rust)'; }
            } else if (selected === key) {
              bg = 'var(--gold-soft)'; borderColor = 'var(--gold)';
            }
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className="w-full text-left rounded-lg p-3 cursor-pointer transition-all text-sm"
                style={{ backgroundColor: bg, border: '1px solid ' + borderColor, color: 'var(--text)' }}
              >
                <span className="font-medium">{key}.</span> {val}
                {revealed && key === mistake.correctAnswer && <span style={{ color: 'var(--moss)', marginLeft: '8px' }}>&#10003;</span>}
                {revealed && key === selected && key !== mistake.correctAnswer && <span style={{ color: 'var(--rust)', marginLeft: '8px' }}>&#10007;</span>}
              </button>
            );
          })}
        </div>

        {/* Submit button */}
        {!revealed && (
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="w-full py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: selected ? 'var(--gold)' : 'var(--bg-elevated)',
              color: selected ? 'var(--bg)' : 'var(--text-faint)',
              border: '1px solid ' + (selected ? 'var(--gold)' : 'var(--border)'),
              opacity: selected ? 1 : 0.6,
            }}
          >
            Jawab
          </button>
        )}

        {/* Result */}
        {revealed && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: isCorrect ? 'rgba(76, 140, 76, 0.1)' : 'rgba(180, 80, 60, 0.1)',
                border: `1px solid ${isCorrect ? 'var(--moss)' : 'var(--rust)'}`,
              }}
            >
              <p className="text-sm font-medium" style={{ color: isCorrect ? 'var(--moss)' : 'var(--rust)', margin: 0 }}>
                {isCorrect ? 'Benar!' : 'Salah!'}
                {autoMastered && ' - Otomatis ditandai dikuasai (3x benar beruntun)'}
              </p>
            </div>

            {/* Explanation */}
            {mistake.explanation && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Pembahasan:</p>
                <p className="text-sm" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                  {mistake.explanation}
                </p>
              </div>
            )}

            {/* Close / Try Again */}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ statusFilter, searchQuery }) {
  let message = 'Belum ada kesalahan yang tercatat.';
  if (searchQuery) {
    message = 'Tidak ada kesalahan yang cocok dengan pencarian.';
  } else if (statusFilter === 'mastered') {
    message = 'Belum ada kesalahan yang sudah dikuasai.';
  } else if (statusFilter === 'active') {
    message = 'Semua kesalahan sudah dikuasai! Kerja bagus!';
  }

  return (
    <div
      className="rounded-lg p-8 flex flex-col items-center gap-3 text-center"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <Icon name="notebook" size={32} className="opacity-40" />
      <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
        {message}
      </p>
    </div>
  );
}
