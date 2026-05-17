import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isAuthenticated, logout, getToken } from '../lib/authClient';
import { exportAll, importAll } from '../lib/sync';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TABS = [
  { id: 'akun', label: 'Akun' },
  { id: 'ujian', label: 'Tanggal Ujian' },
  { id: 'preferensi', label: 'Preferensi' },
  { id: 'data', label: 'Data' },
  { id: 'tentang', label: 'Tentang' },
];

const PRINCIPLES = [
  { name: 'Active Recall', desc: 'Mengingat informasi secara aktif memperkuat memori' },
  { name: 'Spaced Repetition', desc: 'Mengulang dengan interval optimal mencegah lupa' },
  { name: 'Interleaving', desc: 'Mencampur topik melatih diskriminasi dan transfer' },
  { name: 'Elaborative Interrogation', desc: 'Bertanya \'mengapa\' memperdalam pemahaman' },
  { name: 'Pretesting Effect', desc: 'Tes sebelum belajar meningkatkan encoding' },
  { name: 'Generation Effect', desc: 'Membuat jawaban sendiri lebih kuat dari membaca' },
  { name: 'Metacognitive Calibration', desc: 'Menilai akurasi keyakinan sendiri' },
  { name: 'Desirable Difficulty', desc: 'Kesulitan yang tepat menguatkan retensi jangka panjang' },
];

export default function Settings() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState('akun');

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '24px', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--gold)' : 'var(--text-dim)',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '14px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'akun' && <TabAkun />}
      {activeTab === 'ujian' && <TabUjian state={state} dispatch={dispatch} />}
      {activeTab === 'preferensi' && <TabPreferensi state={state} dispatch={dispatch} />}
      {activeTab === 'data' && <TabData dispatch={dispatch} />}
      {activeTab === 'tentang' && <TabTentang />}
    </div>
  );
}

// ─── Tab 1: Akun ──────────────────────────────────────────────────────────────

function TabAkun() {
  const [aiStatus, setAiStatus] = useState(null);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    async function fetchAiStatus() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ai/status`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        setAiStatus(data.providers);
      } catch {
        setAiError(true);
      }
    }
    fetchAiStatus();
  }, []);

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Login status */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isAuthenticated() ? '#4ade80' : '#ef4444', display: 'inline-block' }} />
          <span style={{ color: 'var(--text)' }}>Status: {isAuthenticated() ? 'Logged in' : 'Not logged in'}</span>
        </div>
        <button onClick={handleLogout} style={goldBtnStyle}>Logout</button>
      </div>

      {/* AI Provider Status */}
      <div style={cardStyle}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600' }}>AI Provider Status</h3>
        {aiError ? (
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>Tidak dapat memuat status AI</p>
        ) : aiStatus ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(aiStatus).map(([name, configured]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: configured ? '#4ade80' : '#6b7280', display: 'inline-block' }} />
                <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-dim)', margin: 0 }}>Memuat...</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Tanggal Ujian ─────────────────────────────────────────────────────

function TabUjian({ state, dispatch }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !date) return;
    dispatch({ type: 'ADD_EXAM_DATE', payload: { id: Date.now().toString(), name: name.trim(), date } });
    setName('');
    setDate('');
  };

  const handleRemove = (id) => {
    if (window.confirm('Hapus ujian ini?')) {
      dispatch({ type: 'REMOVE_EXAM_DATE', payload: id });
    }
  };

  const handleSetPrimary = (id) => {
    dispatch({ type: 'SET_PRIMARY_EXAM', payload: id });
  };

  const getDaysRemaining = (dateStr) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    const diff = Math.ceil((target - now) / 86400000);
    return diff;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {(state.examDates || []).map(exam => {
        const days = getDaysRemaining(exam.date);
        const isPrimary = state.primaryExamId === exam.id;
        return (
          <div key={exam.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text)', fontWeight: '500' }}>{exam.name}</span>
                {isPrimary && <span style={{ fontSize: '11px', background: 'var(--gold-soft)', color: 'var(--gold)', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600' }}>Primary</span>}
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{formatDate(exam.date)} - {days >= 0 ? `${days} hari lagi` : 'Sudah lewat'}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isPrimary && (
                <button onClick={() => handleSetPrimary(exam.id)} style={smallBtnStyle}>Set as Primary</button>
              )}
              <button onClick={() => handleRemove(exam.id)} style={{ ...smallBtnStyle, color: 'var(--rust)' }}>Hapus</button>
            </div>
          </div>
        );
      })}

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ ...cardStyle, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
          <label style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Nama Ujian</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: UTBK 2025" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" style={goldBtnStyle}>Tambah Ujian</button>
      </form>
    </div>
  );
}

// ─── Tab 3: Preferensi ────────────────────────────────────────────────────────

function TabPreferensi({ state, dispatch }) {
  const prefs = state.preferences || {};

  const handlePref = (updates) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: updates });
  };

  const handleTheme = (theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const handleDrillRatio = (field, rawValue) => {
    const newVal = parseInt(rawValue, 10) / 100;
    const current = {
      drillSeedRatio: prefs.drillSeedRatio || 0.10,
      drillVariationRatio: prefs.drillVariationRatio || 0.60,
      drillPureLLMRatio: prefs.drillPureLLMRatio || 0.30,
    };
    current[field] = newVal;

    // Normalize the other two proportionally so all sum to 1.0
    const otherFields = Object.keys(current).filter(k => k !== field);
    const remaining = 1.0 - newVal;
    const otherSum = otherFields.reduce((s, k) => s + current[k], 0);

    if (otherSum > 0) {
      otherFields.forEach(k => { current[k] = (current[k] / otherSum) * remaining; });
    } else {
      otherFields.forEach(k => { current[k] = remaining / otherFields.length; });
    }

    handlePref(current);
  };

  const themes = [
    { value: 'academic-dark', label: 'Academic Dark' },
    { value: 'academic-light', label: 'Academic Light' },
    { value: 'parchment', label: 'Parchment' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pomodoro Length */}
      <div style={cardStyle}>
        <PrefRow label={`Pomodoro Length: ${prefs.pomodoroLength || 25} menit`}>
          <input type="range" min="15" max="60" value={prefs.pomodoroLength || 25} onChange={e => handlePref({ pomodoroLength: parseInt(e.target.value, 10) })} style={rangeStyle} />
        </PrefRow>

        <PrefRow label={`Break Length: ${prefs.breakLength || 5} menit`}>
          <input type="range" min="3" max="15" value={prefs.breakLength || 5} onChange={e => handlePref({ breakLength: parseInt(e.target.value, 10) })} style={rangeStyle} />
        </PrefRow>
      </div>

      {/* Toggles */}
      <div style={cardStyle}>
        <ToggleRow label="Confidence Slider" checked={prefs.confidenceSlider !== false} onChange={v => handlePref({ confidenceSlider: v })} />
        <ToggleRow label="Show Streak Indicator" checked={!prefs.showStreakAnxiety} onChange={v => handlePref({ showStreakAnxiety: !v })} />
        <ToggleRow label="Keyboard Shortcuts" checked={prefs.keyboardShortcuts !== false} onChange={v => handlePref({ keyboardShortcuts: v })} />
        <ToggleRow label="Auto-Variate on Submit" checked={prefs.autoVariateOnSubmit !== false} onChange={v => handlePref({ autoVariateOnSubmit: v })} />
        <ToggleRow label="Source Badge" checked={prefs.showSourceBadge !== false} onChange={v => handlePref({ showSourceBadge: v })} />
      </div>

      {/* Theme */}
      <div style={cardStyle}>
        <h4 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '14px' }}>Theme</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {themes.map(t => (
            <button
              key={t.value}
              onClick={() => handleTheme(t.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: state.theme === t.value ? '2px solid var(--gold)' : '1px solid var(--border)',
                background: state.theme === t.value ? 'var(--gold-soft)' : 'transparent',
                color: state.theme === t.value ? 'var(--gold)' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: state.theme === t.value ? '600' : '400',
                fontSize: '13px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drill Source Mix */}
      <div style={cardStyle}>
        <h4 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '14px' }}>Drill Source Mix</h4>
        <PrefRow label={`Seed: ${Math.round((prefs.drillSeedRatio || 0.10) * 100)}%`}>
          <input type="range" min="0" max="100" value={Math.round((prefs.drillSeedRatio || 0.10) * 100)} onChange={e => handleDrillRatio('drillSeedRatio', e.target.value)} style={rangeStyle} />
        </PrefRow>
        <PrefRow label={`Variation: ${Math.round((prefs.drillVariationRatio || 0.60) * 100)}%`}>
          <input type="range" min="0" max="100" value={Math.round((prefs.drillVariationRatio || 0.60) * 100)} onChange={e => handleDrillRatio('drillVariationRatio', e.target.value)} style={rangeStyle} />
        </PrefRow>
        <PrefRow label={`Pure LLM: ${Math.round((prefs.drillPureLLMRatio || 0.30) * 100)}%`}>
          <input type="range" min="0" max="100" value={Math.round((prefs.drillPureLLMRatio || 0.30) * 100)} onChange={e => handleDrillRatio('drillPureLLMRatio', e.target.value)} style={rangeStyle} />
        </PrefRow>
      </div>
    </div>
  );
}

function PrefRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', gap: '16px' }}>
      <span style={{ color: 'var(--text)', fontSize: '14px', minWidth: '160px' }}>{label}</span>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ color: 'var(--text)', fontSize: '14px' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--gold)', width: '18px', height: '18px', cursor: 'pointer' }} />
    </div>
  );
}

// ─── Tab 4: Data ──────────────────────────────────────────────────────────────

function TabData({ dispatch }) {
  const [importMsg, setImportMsg] = useState('');
  const [resetText, setResetText] = useState('');

  const handleExport = async () => {
    try {
      const data = await exportAll();
      if (!data) { setImportMsg('Export gagal'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `simak-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportMsg('Export berhasil!');
    } catch {
      setImportMsg('Export gagal');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const validKeys = ['user_state', 'seeds', 'variations', 'mistakes', 'drill_history', 'mock_history', 'sr_items'];
        const hasValid = validKeys.some(k => k in parsed);
        if (!hasValid) {
          setImportMsg('File tidak valid: tidak mengandung data yang dikenali');
          return;
        }
        const result = await importAll(parsed);
        if (result) {
          setImportMsg('Import berhasil!');
        } else {
          setImportMsg('Import gagal');
        }
      } catch {
        setImportMsg('File tidak valid: format JSON error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDiagnostic = () => {
    if (window.confirm('Reset hasil diagnostik? Kamu harus mengulang diagnostic test.')) {
      dispatch({ type: 'SET_DIAGNOSTIC', payload: null });
      setImportMsg('Diagnostic berhasil direset');
    }
  };

  const handleResetAll = () => {
    if (window.confirm('PERINGATAN: Semua data akan dihapus. Lanjutkan?')) {
      dispatch({ type: 'RESET_ALL' });
      setImportMsg('Semua data berhasil direset');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Export */}
      <div style={cardStyle}>
        <h4 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '14px' }}>Export Data</h4>
        <button onClick={handleExport} style={goldBtnStyle}>Export JSON</button>
      </div>

      {/* Import */}
      <div style={cardStyle}>
        <h4 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '14px' }}>Import Data</h4>
        <input type="file" accept=".json" onChange={handleImport} style={{ color: 'var(--text)', fontSize: '13px' }} />
      </div>

      {/* Status message */}
      {importMsg && (
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: 0 }}>{importMsg}</p>
      )}

      {/* Reset Diagnostic */}
      <div style={cardStyle}>
        <h4 style={{ color: 'var(--text)', margin: '0 0 8px 0', fontSize: '14px' }}>Reset Diagnostic</h4>
        <button onClick={handleResetDiagnostic} style={{ ...goldBtnStyle, borderColor: 'var(--amber)', color: 'var(--amber)' }}>Reset Diagnostic</button>
      </div>

      {/* Reset ALL */}
      <div style={{ ...cardStyle, borderColor: 'var(--rust)' }}>
        <h4 style={{ color: 'var(--rust)', margin: '0 0 8px 0', fontSize: '14px' }}>Reset Semua Data</h4>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: '0 0 12px 0' }}>Ketik "RESET" untuk mengaktifkan tombol reset. Semua data akan dihapus permanen.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="text" value={resetText} onChange={e => setResetText(e.target.value)} placeholder='Ketik "RESET"' style={inputStyle} />
          <button onClick={handleResetAll} disabled={resetText !== 'RESET'} style={{ ...goldBtnStyle, borderColor: 'var(--rust)', color: 'var(--rust)', opacity: resetText !== 'RESET' ? 0.4 : 1, cursor: resetText !== 'RESET' ? 'not-allowed' : 'pointer' }}>Reset ALL</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Tentang ───────────────────────────────────────────────────────────

function TabTentang() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={cardStyle}>
        <h2 style={{ color: 'var(--gold)', margin: '0 0 16px 0', fontSize: '20px' }}>SIMAK Study OS v2.1</h2>
        <h4 style={{ color: 'var(--text)', margin: '0 0 12px 0', fontSize: '14px' }}>Prinsip Pembelajaran</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PRINCIPLES.map((p, i) => (
            <div key={i}>
              <span style={{ color: 'var(--text)', fontWeight: '600', fontSize: '13px' }}>{i + 1}. {p.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}> - {p.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: '13px', margin: 0 }}>
        Dibangun dengan prinsip cognitive science untuk persiapan ujian yang efektif.
      </p>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '16px',
};

const goldBtnStyle = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: '1px solid var(--gold)',
  background: 'transparent',
  color: 'var(--gold)',
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '13px',
};

const smallBtnStyle = {
  padding: '4px 10px',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '12px',
};

const inputStyle = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
};

const rangeStyle = {
  accentColor: 'var(--gold)',
  width: '120px',
  cursor: 'pointer',
};
