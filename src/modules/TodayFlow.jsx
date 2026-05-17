import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Icon from '../components/Icon';

// ─── Academic Quotes ──────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'Belajar adalah perubahan permanen pada perilaku akibat pengalaman.', author: 'B.F. Skinner' },
  { text: 'The more you know, the more you realize you don\'t know.', author: 'Aristotle' },
  { text: 'Memory is the residue of thought.', author: 'Daniel Willingham' },
  { text: 'Desirable difficulties enhance long-term retention.', author: 'Robert Bjork' },
  { text: 'Learning is not a spectator sport.', author: 'D. Blocher' },
  { text: 'Forgetting is the friend of learning, when spaced practice is used.', author: 'Hermann Ebbinghaus' },
  { text: 'What I cannot create, I do not understand.', author: 'Richard Feynman' },
  { text: 'Testing is not just assessment; it is a powerful learning event.', author: 'Henry Roediger III' },
  { text: 'Interleaving practice leads to better discrimination and transfer.', author: 'Doug Rohrer' },
  { text: 'Effort during learning strengthens long-term memory.', author: 'Elizabeth Ligon Bjork' },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────
function getToday() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.floor((d2 - d1) / 86400000);
}

function getSubjectColor(subject) {
  const map = {
    matematika: 'var(--subj-mat)',
    tpa: 'var(--subj-tpa)',
    bahasa_inggris: 'var(--subj-eng)',
    bahasa_indonesia: 'var(--subj-ind)',
  };
  return map[subject] || 'var(--gold)';
}

function getSubjectLabel(subject) {
  const map = {
    matematika: 'Matematika',
    tpa: 'TPA',
    bahasa_inggris: 'Bahasa Inggris',
    bahasa_indonesia: 'Bahasa Indonesia',
    mixed: 'Campur',
  };
  return map[subject] || subject;
}

const MODULE_MAP = {
  REVIEW: 'review',
  BELAJAR: 'concept',
  DRILL: 'drill',
  MOCK: 'mock',
  REFLECT: 'notebook',
};

const TYPE_COLORS = {
  REVIEW: 'var(--gold-soft)',
  BELAJAR: 'var(--moss)',
  DRILL: 'var(--amber)',
  MOCK: 'var(--rust)',
  REFLECT: 'var(--ink)',
};

// ─── Mission Generation Algorithm ────────────────────────────────────────────
function generateMissions(state) {
  const missions = [];
  const now = Date.now();
  const today = getToday();

  // P1: SR items due
  const dueItems = (state.srQueue || []).filter(
    (item) => new Date(item.nextReview) <= new Date(today + 'T23:59:59')
  );
  if (dueItems.length > 0) {
    missions.push({
      type: 'REVIEW',
      subject: dueItems[0].subject || 'mixed',
      time: '5 min',
      reasoning: `${dueItems.length} item jatuh tempo review hari ini`,
    });
  }

  // P2: Mistake retry (unmastered, older than 2 days)
  const retryMistakes = (state.mistakes || []).filter(
    (m) => m.mastered === false && (now - new Date(m.timestamp).getTime()) > 2 * 86400000
  );
  if (retryMistakes.length > 0) {
    missions.push({
      type: 'DRILL',
      subject: retryMistakes[0].subject || 'mixed',
      time: '15 min',
      reasoning: `Latih ulang ${retryMistakes.length} kesalahan yang belum dikuasai`,
    });
  }

  // P3: New concept - weakest subject
  const weakestSubject = findWeakestSubject(state);
  if (weakestSubject) {
    missions.push({
      type: 'BELAJAR',
      subject: weakestSubject,
      time: '15 min',
      reasoning: 'Pelajari konsep baru di mata uji terlemahmu',
    });
  }

  // P4: Drill interleave - if 3+ concepts learned this week
  const oneWeekAgo = now - 7 * 86400000;
  const recentConcepts = Object.values(state.topicMastery || {}).filter(
    (entry) => entry.lastSeen && new Date(entry.lastSeen).getTime() > oneWeekAgo
  );
  if (recentConcepts.length >= 3) {
    missions.push({
      type: 'DRILL',
      subject: 'mixed',
      time: '15 min',
      reasoning: `Latihan campur 10 soal untuk ${recentConcepts.length} konsep minggu ini`,
    });
  }

  // P5: Saturday mock
  if (new Date().getDay() === 6) {
    missions.push({
      type: 'MOCK',
      subject: 'mixed',
      time: '30 min',
      reasoning: 'Mini mock exam mingguan - 20 soal simulasi',
    });
  }

  return missions.slice(0, 5);
}

function findWeakestSubject(state) {
  const subjects = ['matematika', 'tpa', 'bahasa_inggris', 'bahasa_indonesia'];

  // Try topicMastery first
  const masteryBySubject = {};
  for (const [key, val] of Object.entries(state.topicMastery || {})) {
    const subj = key.split('.')[0];
    if (!masteryBySubject[subj]) masteryBySubject[subj] = [];
    masteryBySubject[subj].push(val.elo || 1000);
  }

  if (Object.keys(masteryBySubject).length >= 2) {
    let weakest = null;
    let lowestAvg = Infinity;
    for (const subj of subjects) {
      const elos = masteryBySubject[subj];
      if (!elos || elos.length === 0) return subj; // no data = weakest
      const avg = elos.reduce((a, b) => a + b, 0) / elos.length;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakest = subj;
      }
    }
    return weakest;
  }

  // Fall back to diagnosticResults
  if (state.diagnosticResults) {
    let weakest = null;
    let lowestScore = Infinity;
    for (const subj of subjects) {
      const score = state.diagnosticResults[subj];
      if (score !== undefined && score < lowestScore) {
        lowestScore = score;
        weakest = subj;
      }
    }
    return weakest;
  }

  return subjects[0];
}

function generateStarterMissions(state) {
  const weakest = findWeakestSubject(state);
  return [
    {
      type: 'BELAJAR',
      subject: weakest,
      time: '15 min',
      reasoning: `Pelajari konsep pertamamu di ${getSubjectLabel(weakest)}`,
    },
    {
      type: 'DRILL',
      subject: weakest,
      time: '15 min',
      reasoning: 'Coba drill pertamamu',
    },
  ];
}

function isFreshUser(state) {
  return (
    (state.srQueue || []).length === 0 &&
    (state.drillHistory || []).length === 0 &&
    Object.keys(state.topicMastery || {}).length < 2
  );
}

// ─── Sparkline Component ─────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  const width = 120;
  const height = 40;
  const padding = 4;

  if (!data || data.length === 0) {
    // flat line at 0
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline
          points={`${padding},${height - padding} ${width - padding},${height - padding}`}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.4"
        />
      </svg>
    );
  }

  const maxVal = Math.max(...data, 0.01);
  const stepX = (width - 2 * padding) / Math.max(data.length - 1, 1);
  const points = data
    .map((val, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((val / maxVal) * (height - 2 * padding));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Activity Heatmap Component ──────────────────────────────────────────────
function ActivityHeatmap({ drillHistory, focusSessions }) {
  const cells = useMemo(() => {
    const today = new Date();
    const result = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const drillCount = (drillHistory || []).filter(
        (d) => d.timestamp && d.timestamp.startsWith(dateStr)
      ).length;
      const focusCount = (focusSessions || []).filter(
        (s) => s.startedAt && s.startedAt.startsWith(dateStr)
      ).length;

      const total = drillCount + focusCount;
      result.push({ dateStr, total });
    }
    return result;
  }, [drillHistory, focusSessions]);

  function getCellColor(count) {
    if (count === 0) return 'var(--bg-hover)';
    if (count <= 2) return 'rgba(201, 168, 76, 0.3)';
    if (count <= 5) return 'rgba(201, 168, 76, 0.6)';
    return 'rgba(201, 168, 76, 1)';
  }

  return (
    <div className="flex flex-wrap gap-1" style={{ maxWidth: '240px' }}>
      {cells.map((cell) => (
        <div
          key={cell.dateStr}
          title={`${cell.dateStr}: ${cell.total} activities`}
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            backgroundColor: getCellColor(cell.total),
          }}
        />
      ))}
    </div>
  );
}

// ─── Mission Card Component ──────────────────────────────────────────────────
function MissionCard({ mission, dispatch }) {
  const handleStart = () => {
    const moduleId = MODULE_MAP[mission.type] || 'today';
    dispatch({ type: 'SET_MODULE', payload: moduleId });
  };

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {/* Type badge */}
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{
            backgroundColor: TYPE_COLORS[mission.type] || 'var(--bg-hover)',
            color: 'var(--text)',
          }}
        >
          {mission.type}
        </span>

        {/* Subject pill */}
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: getSubjectColor(mission.subject),
            color: '#fff',
            opacity: 0.9,
          }}
        >
          {getSubjectLabel(mission.subject)}
        </span>

        {/* Time estimate */}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-faint)' }}>
          {mission.time}
        </span>
      </div>

      {/* Reasoning */}
      <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
        {mission.reasoning}
      </p>

      {/* Start button */}
      <button
        onClick={handleStart}
        className="self-start mt-1 px-4 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors"
        style={{
          backgroundColor: 'var(--gold)',
          color: 'var(--bg)',
          border: 'none',
        }}
      >
        Mulai
      </button>
    </div>
  );
}

// ─── Empty State Component ───────────────────────────────────────────────────
function EmptyState() {
  const quote = useMemo(() => {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }, []);

  return (
    <div
      className="rounded-lg p-8 text-center flex flex-col items-center gap-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '2px',
          backgroundColor: 'var(--gold)',
          borderRadius: '1px',
        }}
      />
      <p
        className="text-base max-w-md"
        style={{
          color: 'var(--text)',
          fontStyle: 'italic',
          fontFamily: 'var(--font-display)',
          lineHeight: 'var(--leading-normal)',
          margin: 0,
        }}
      >
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-sm" style={{ color: 'var(--text-muted)', margin: 0 }}>
        &mdash; {quote.author}
      </p>
      <p className="text-sm mt-2" style={{ color: 'var(--text-faint)', margin: 0 }}>
        Semua misi hari ini selesai. Istirahat juga bagian dari belajar.
      </p>
    </div>
  );
}

// ─── Bottom Stats Section ────────────────────────────────────────────────────
function BottomStats({ state }) {
  const subjects = ['matematika', 'tpa', 'bahasa_inggris', 'bahasa_indonesia'];
  const today = new Date();

  const { drillHistory, focusSessions, totalFocusMinutes: totalFocusMin, topicMastery } = state;

  // Compute sparkline data: accuracy per day for last 7 days, per subject
  const sparklineData = useMemo(() => {
    const result = {};
    for (const subj of subjects) {
      const dailyAccuracy = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const entries = (drillHistory || []).filter(
          (d) => d.subject === subj && d.timestamp && d.timestamp.startsWith(dateStr)
        );
        if (entries.length > 0) {
          const totalCorrect = entries.reduce((sum, e) => sum + (e.correct || 0), 0);
          const totalQ = entries.reduce((sum, e) => sum + (e.total || 1), 0);
          dailyAccuracy.push(totalQ > 0 ? totalCorrect / totalQ : 0);
        } else {
          dailyAccuracy.push(0);
        }
      }
      result[subj] = dailyAccuracy;
    }
    return result;
  }, [drillHistory]);

  // Totals
  const totalFocusMinutes = totalFocusMin || 0;
  const questionsAnswered = (drillHistory || []).length;
  const conceptsMastered = Object.values(topicMastery || {}).filter(
    (t) => t.elo >= 1400
  ).length;

  // Week-on-week comparison
  const weekStats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;

    const thisWeekDrills = (drillHistory || []).filter(
      (d) => d.timestamp && new Date(d.timestamp).getTime() > oneWeekAgo
    ).length;
    const lastWeekDrills = (drillHistory || []).filter(
      (d) => {
        const t = d.timestamp && new Date(d.timestamp).getTime();
        return t > twoWeeksAgo && t <= oneWeekAgo;
      }
    ).length;

    const thisWeekFocus = (focusSessions || [])
      .filter((s) => s.startedAt && new Date(s.startedAt).getTime() > oneWeekAgo && s.completed)
      .reduce((sum, s) => sum + (s.durationMin || 0), 0);
    const lastWeekFocus = (focusSessions || [])
      .filter((s) => {
        const t = s.startedAt && new Date(s.startedAt).getTime();
        return t > twoWeeksAgo && t <= oneWeekAgo && s.completed;
      })
      .reduce((sum, s) => sum + (s.durationMin || 0), 0);

    return {
      drillDelta: thisWeekDrills - lastWeekDrills,
      focusDelta: thisWeekFocus - lastWeekFocus,
    };
  }, [drillHistory, focusSessions]);

  return (
    <div className="flex flex-col gap-6 mt-8">
      {/* Sparklines */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
          Akurasi 7 Hari Terakhir
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {subjects.map((subj) => (
            <div key={subj} className="flex flex-col items-center gap-1">
              <Sparkline data={sparklineData[subj]} color={getSubjectColor(subj)} />
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {getSubjectLabel(subj)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Heatmap */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
          Aktivitas 30 Hari
        </h3>
        <ActivityHeatmap
          drillHistory={drillHistory}
          focusSessions={focusSessions}
        />
      </div>

      {/* Totals Row */}
      <div
        className="grid grid-cols-3 gap-4 rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
            {totalFocusMinutes}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Menit fokus
          </p>
          <DeltaArrow delta={weekStats.focusDelta} />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
            {questionsAnswered}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Soal dijawab
          </p>
          <DeltaArrow delta={weekStats.drillDelta} />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
            {conceptsMastered}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
            Konsep dikuasai
          </p>
        </div>
      </div>
    </div>
  );
}

function DeltaArrow({ delta }) {
  if (delta === 0) return null;
  const isUp = delta > 0;
  return (
    <span
      className="text-xs font-medium"
      style={{ color: isUp ? 'var(--moss)' : 'var(--rust)' }}
    >
      {isUp ? '\u2191' : '\u2193'} {Math.abs(delta)}
    </span>
  );
}

// ─── Hero Strip Component ────────────────────────────────────────────────────
function HeroStrip({ state }) {
  const today = getToday();

  // Compute day count (days since onboarding)
  let dayCount = 1;
  if (state.onboardedAt) {
    dayCount = daysBetween(state.onboardedAt, today) + 1;
  } else {
    dayCount = Math.max(state.streak, 1);
  }

  // Compute days left until exam
  let daysLeft = null;
  let examName = '';
  if (state.examDates && state.examDates.length > 0) {
    const primary = state.primaryExamId
      ? state.examDates.find((e) => e.id === state.primaryExamId)
      : state.examDates[0];
    const exam = primary || state.examDates[0];
    examName = exam.name || 'Ujian';
    daysLeft = daysBetween(today, exam.date);
    if (daysLeft < 0) daysLeft = 0;
  }

  // Color for countdown
  let countdownColor = 'var(--gold)';
  if (daysLeft !== null) {
    if (daysLeft < 7) countdownColor = 'var(--rust)';
    else if (daysLeft <= 21) countdownColor = 'var(--amber)';
  }

  // Today's focus minutes
  const todayFocusMin = (state.focusSessions || [])
    .filter((s) => s.startedAt && s.startedAt.startsWith(today) && s.completed)
    .reduce((sum, s) => sum + (s.durationMin || 0), 0);

  return (
    <div
      className="flex items-center justify-between rounded-lg p-4 sm:p-6"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Left: heading + subheading */}
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Hari ke-{dayCount}
        </h1>
        {daysLeft !== null && (
          <p className="text-sm mt-1" style={{ color: countdownColor, margin: 0, marginTop: '4px' }}>
            {daysLeft} hari menuju {examName}
          </p>
        )}
      </div>

      {/* Right: streak + focus */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1" style={{ color: 'var(--gold)' }}>
          <Icon name="streak" size={18} />
          <span className="text-sm font-semibold">{state.streak}</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <Icon name="focus" size={18} />
          <span className="text-sm font-semibold">{todayFocusMin}m</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main TodayFlow Component ────────────────────────────────────────────────
export default function TodayFlow() {
  const { state, dispatch } = useApp();

  const { srQueue, mistakes, topicMastery, drillHistory, diagnosticResults } = state;
  const missions = useMemo(() => {
    if (isFreshUser(state)) {
      return generateStarterMissions(state);
    }
    return generateMissions(state);
  }, [srQueue, mistakes, topicMastery, drillHistory, diagnosticResults]);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Strip */}
      <HeroStrip state={state} />

      {/* Mission Queue */}
      {missions.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2
            className="text-sm font-medium"
            style={{ color: 'var(--text-muted)', margin: 0 }}
          >
            Misi Hari Ini
          </h2>
          {missions.map((mission, index) => (
            <MissionCard key={index} mission={mission} dispatch={dispatch} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Bottom Stats */}
      <BottomStats state={state} />
    </div>
  );
}
