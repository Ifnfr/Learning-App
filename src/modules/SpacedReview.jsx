import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { calculateNextReview, brierScore } from '../lib/algorithms';

const LEECH_THRESHOLD = 5;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SpacedReview() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState('today');

  const today = new Date().toISOString().split('T')[0];

  const dueItems = useMemo(() => {
    return state.srQueue.filter(item => {
      if (!item.nextReview) return true;
      return item.nextReview.split('T')[0] <= today;
    });
  }, [state.srQueue, today]);

  const overdueItems = useMemo(() => {
    return state.srQueue.filter(item => {
      if (!item.nextReview) return false;
      return item.nextReview.split('T')[0] < today;
    });
  }, [state.srQueue, today]);

  const averageBrier = useMemo(() => {
    if (!state.calibrationLog || state.calibrationLog.length === 0) return null;
    const total = state.calibrationLog.reduce((sum, entry) => {
      return sum + brierScore(entry.confidence, entry.correct);
    }, 0);
    return total / state.calibrationLog.length;
  }, [state.calibrationLog]);

  const tabs = [
    { id: 'today', label: 'Hari Ini' },
    { id: 'upcoming', label: 'Akan Datang' },
    { id: 'mastered', label: 'Mastered' },
    { id: 'leeches', label: 'Leeches' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
        Spaced Review
      </h2>

      {/* Stats Strip */}
      <StatsStrip
        dueCount={dueItems.length}
        overdueCount={overdueItems.length}
        brierAvg={averageBrier}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'today' && (
        <TodayTab dueItems={dueItems} dispatch={dispatch} />
      )}
      {activeTab === 'upcoming' && (
        <UpcomingTab srQueue={state.srQueue} today={today} />
      )}
      {activeTab === 'mastered' && (
        <MasteredTab srQueue={state.srQueue} />
      )}
      {activeTab === 'leeches' && (
        <LeechesTab srQueue={state.srQueue} dispatch={dispatch} />
      )}
    </div>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────
function StatsStrip({ dueCount, overdueCount, brierAvg }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-2xl font-bold" style={{ color: 'var(--gold)', margin: 0 }}>{dueCount}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Due Today</p>
      </div>
      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-2xl font-bold" style={{ color: 'var(--amber)', margin: 0 }}>{overdueCount}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Overdue</p>
      </div>
      <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-2xl font-bold" style={{ color: 'var(--moss)', margin: 0 }}>
          {brierAvg !== null ? brierAvg.toFixed(2) : 'N/A'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>Brier Score</p>
      </div>
    </div>
  );
}

// ─── Today Tab (Review Interface) ─────────────────────────────────────────────
function TodayTab({ dueItems, dispatch }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  if (dueItems.length === 0 || completed) {
    return <EmptyState />;
  }

  const item = dueItems[currentIndex];
  if (!item) {
    return <EmptyState />;
  }

  function handleFlip() {
    setFlipped(true);
  }

  function handleGrade(quality) {
    const result = calculateNextReview(item, quality);
    const lapses = quality < 3 ? (item.lapses || 0) + 1 : (item.lapses || 0);

    dispatch({
      type: 'REVIEW_SR_ITEM',
      payload: {
        ...result,
        id: item.id,
        lapses,
      },
    });

    // Advance to next item
    setFlipped(false);
    if (currentIndex + 1 >= dueItems.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {currentIndex + 1} / {dueItems.length}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {item.subject} - {item.topic}
        </span>
      </div>

      {/* Flip Card */}
      <div
        className="relative rounded-lg"
        style={{ perspective: '1000px', minHeight: '200px' }}
      >
        <div
          className="relative w-full rounded-lg transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '200px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-lg p-6 flex items-center justify-center"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              backfaceVisibility: 'hidden',
            }}
          >
            <p className="text-base font-medium text-center" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
              {item.prompt}
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-lg p-6 flex items-center justify-center"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--gold)',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <p className="text-base text-center" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
              {item.answer}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!flipped ? (
        <button
          onClick={handleFlip}
          className="w-full py-3 rounded-lg text-sm font-medium cursor-pointer transition-all"
          style={{
            backgroundColor: 'var(--gold)',
            color: 'var(--bg)',
            border: 'none',
          }}
        >
          Tampilkan Jawaban
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Seberapa mudah kamu ingat?
          </p>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleGrade(0)}
              className="py-3 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: 'rgba(180, 80, 60, 0.15)',
                color: 'var(--rust)',
                border: '1px solid var(--rust)',
              }}
            >
              Lupa
            </button>
            <button
              onClick={() => handleGrade(2)}
              className="py-3 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: 'rgba(200, 150, 50, 0.15)',
                color: 'var(--amber)',
                border: '1px solid var(--amber)',
              }}
            >
              Sulit
            </button>
            <button
              onClick={() => handleGrade(3)}
              className="py-3 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              Pas
            </button>
            <button
              onClick={() => handleGrade(5)}
              className="py-3 rounded-lg text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: 'rgba(76, 140, 76, 0.15)',
                color: 'var(--moss)',
                border: '1px solid var(--moss)',
              }}
            >
              Mudah
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>
      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
        Tidak ada review hari ini. Stack lagi konsep baru di Concept Engine.
      </p>
    </div>
  );
}

// ─── Upcoming Tab ─────────────────────────────────────────────────────────────
function UpcomingTab({ srQueue, today }) {
  const grouped = useMemo(() => {
    const futureItems = srQueue.filter(item => {
      if (!item.nextReview) return false;
      return item.nextReview.split('T')[0] > today;
    });

    const groups = {};
    futureItems.forEach(item => {
      const date = item.nextReview.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [srQueue, today]);

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
          Belum ada item terjadwal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(([date, items]) => (
        <div key={date} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold" style={{ color: 'var(--text-muted)', margin: 0 }}>
            {formatDate(date)}
          </h3>
          {items.map(item => (
            <div
              key={item.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>{item.prompt}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', margin: 0 }}>
                {item.subject} - {item.topic}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Mastered Tab ─────────────────────────────────────────────────────────────
function MasteredTab({ srQueue }) {
  const masteredItems = useMemo(() => {
    return srQueue.filter(item => (item.interval || 0) > 30);
  }, [srQueue]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>
          <span className="font-bold" style={{ color: 'var(--moss)' }}>{masteredItems.length}</span> item mastered (interval &gt; 30 hari)
        </p>
      </div>

      {masteredItems.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Belum ada item yang mastered. Terus review!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {masteredItems.map(item => (
            <div
              key={item.id}
              className="rounded-lg p-3"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>{item.prompt}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ color: 'var(--moss)' }}>
                  Interval: {item.interval} hari
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.subject} - {item.topic}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Leeches Tab ──────────────────────────────────────────────────────────────
function LeechesTab({ srQueue, dispatch }) {
  const leechItems = useMemo(() => {
    return srQueue.filter(item => (item.lapses || 0) >= LEECH_THRESHOLD);
  }, [srQueue]);

  function handleRelearn() {
    dispatch({ type: 'SET_MODULE', payload: 'concept' });
  }

  if (leechItems.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
          Tidak ada leeches. Bagus!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--rust)', margin: 0 }}>
        {leechItems.length} item dengan lapses tinggi (&ge; {LEECH_THRESHOLD})
      </p>
      {leechItems.map(item => (
        <div
          key={item.id}
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--rust)' }}
        >
          <p className="text-sm" style={{ color: 'var(--rust)', margin: 0 }}>{item.prompt}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Lapses: {item.lapses} | {item.subject} - {item.topic}
            </span>
            <button
              onClick={handleRelearn}
              className="px-3 py-1 rounded-md text-xs cursor-pointer transition-all"
              style={{
                backgroundColor: 'rgba(180, 80, 60, 0.15)',
                color: 'var(--rust)',
                border: '1px solid var(--rust)',
              }}
            >
              Re-learn from scratch
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
