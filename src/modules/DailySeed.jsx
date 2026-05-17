import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { parseSeedMarkdown, validateSeed } from '../lib/seedParser';
import { runSubmitPipeline, buildSeedObject, dualPassValidate, generateVariation } from '../lib/seedPipeline';
import { openDB, saveToIDB, deleteFromIDB } from '../lib/storage';
import Icon from '../components/Icon';

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: 'matematika', label: 'Matematika', color: 'var(--gold)' },
  { id: 'tpa', label: 'TPA', color: 'var(--moss)' },
  { id: 'bahasa_inggris', label: 'B. Inggris', color: 'var(--rust)' },
  { id: 'bahasa_indonesia', label: 'B. Indonesia', color: 'var(--amber)' },
];

const STRATEGIES = [
  { id: 'numerical_swap', label: 'Numerical Swap', desc: 'Ubah angka, struktur sama' },
  { id: 'context_swap', label: 'Context Swap', desc: 'Ubah konteks, konsep sama' },
  { id: 'distractor_permute', label: 'Distractor Permute', desc: 'Ganti pengecoh' },
  { id: 'inverted_prompt', label: 'Inverted Prompt', desc: 'Balik arah pertanyaan' },
  { id: 'difficulty_ladder', label: 'Difficulty Ladder', desc: 'Naikkan level kesulitan' },
];

const TEMPLATE_PLACEHOLDER = `---
id: 2026-05-16-mat-01
subject: matematika
topic: Logaritma
source: SIMAK_UI_2023
date_posted: 2026-05-16
difficulty: 1350
---

# Soal

Nilai dari $\\log_2 8 + \\log_3 27 - \\log_5 125$ adalah ...

# Pilihan

A. 0
B. 1
C. 2
D. 3
E. 4

# Kunci

D

# Pembahasan

Penjelasan langkah demi langkah...

# Trap

Jebakan umum yang sering terjadi...`;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailySeed() {
  const { state, dispatch } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const defaultTab = state.seedStats.lastSeedDate !== today ? 'submit' : 'bank';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabs = [
    { id: 'submit', label: 'Submit Baru' },
    { id: 'bank', label: 'Bank Soal' },
    { id: 'variasi', label: 'Variasi' },
    { id: 'stats', label: 'Statistik' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)', margin: 0 }}>
        Daily Seed
      </h2>

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
      {activeTab === 'submit' && <SubmitTab state={state} dispatch={dispatch} />}
      {activeTab === 'bank' && <BankTab state={state} dispatch={dispatch} setActiveTab={setActiveTab} />}
      {activeTab === 'variasi' && <VariasiTab state={state} dispatch={dispatch} />}
      {activeTab === 'stats' && <StatsTab state={state} />}
    </div>
  );
}

// ─── Submit Tab ───────────────────────────────────────────────────────────────
function SubmitTab({ state, dispatch }) {
  const [mode, setMode] = useState('paste');
  const [markdown, setMarkdown] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState(null);
  const fileInputRef = useRef(null);

  const parsed = useMemo(() => {
    if (!markdown.trim()) return null;
    try { return parseSeedMarkdown(markdown); } catch { return null; }
  }, [markdown]);

  const validation = useMemo(() => {
    if (!parsed) return { valid: false, errors: [] };
    return validateSeed(parsed);
  }, [parsed]);

  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit() {
    if (!validation.valid) return;
    setLoading(true);
    setResult(null);
    try {
      const pipelineResult = await runSubmitPipeline(
        markdown,
        state.apiKey,
        dispatch,
        { autoVariate: state.preferences.autoVariateOnSubmit }
      );
      if (pipelineResult.success) {
        dispatch({ type: 'ADD_SEED' });
        if (state.seedStats.lastSeedDate !== today) {
          const gap = state.seedStats.lastSeedDate
            ? Math.floor((new Date(today) - new Date(state.seedStats.lastSeedDate)) / 86400000)
            : 0;
          if (gap > 7) {
            dispatch({ type: 'REFRESH_SEED_STATS', payload: { seedStreak: 1, lastSeedDate: today } });
          } else {
            dispatch({ type: 'INCREMENT_SEED_STREAK' });
          }
        }
        if (pipelineResult.validation && pipelineResult.validation.mismatch) {
          setMismatchData(pipelineResult);
          setShowMismatchModal(true);
        }
        setResult(pipelineResult);
        setMarkdown('');
      } else {
        setResult(pipelineResult);
      }
    } catch (err) {
      setResult({ success: false, errors: [err.message] });
    }
    setLoading(false);
  }

  function handleFileDrop(e) {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer?.files || []).filter(f => f.name.endsWith('.md'));
    processFiles(droppedFiles);
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    processFiles(selected);
  }

  async function processFiles(fileList) {
    const newFiles = fileList.map(f => ({ file: f, name: f.name, status: 'pending' }));
    setFiles(prev => [...prev, ...newFiles]);
    for (let i = 0; i < newFiles.length; i++) {
      const text = await newFiles[i].file.text();
      setFiles(prev => prev.map((f, idx) =>
        f.name === newFiles[i].name ? { ...f, status: 'processing' } : f
      ));
      try {
        const res = await runSubmitPipeline(text, state.apiKey, dispatch, { autoVariate: state.preferences.autoVariateOnSubmit });
        if (res.success) {
          dispatch({ type: 'ADD_SEED' });
          if (state.seedStats.lastSeedDate !== today) {
            dispatch({ type: 'INCREMENT_SEED_STREAK' });
          }
        }
        setFiles(prev => prev.map(f =>
          f.name === newFiles[i].name ? { ...f, status: res.success ? 'success' : 'error' } : f
        ));
      } catch {
        setFiles(prev => prev.map(f =>
          f.name === newFiles[i].name ? { ...f, status: 'error' } : f
        ));
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('paste')}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
          style={{
            backgroundColor: mode === 'paste' ? 'var(--gold-bg)' : 'var(--bg-elevated)',
            color: mode === 'paste' ? 'var(--gold)' : 'var(--text-muted)',
            border: '1px solid ' + (mode === 'paste' ? 'var(--gold)' : 'var(--border)'),
          }}
        >
          Paste Markdown
        </button>
        <button
          onClick={() => setMode('upload')}
          className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
          style={{
            backgroundColor: mode === 'upload' ? 'var(--gold-bg)' : 'var(--bg-elevated)',
            color: mode === 'upload' ? 'var(--gold)' : 'var(--text-muted)',
            border: '1px solid ' + (mode === 'upload' ? 'var(--gold)' : 'var(--border)'),
          }}
        >
          File Upload
        </button>
      </div>

      {mode === 'paste' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Textarea */}
          <div className="flex flex-col gap-2">
            <textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              placeholder={TEMPLATE_PLACEHOLDER}
              className="w-full rounded-lg p-3 text-xs font-mono resize-y"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                minHeight: '320px',
              }}
            />
            {/* Validation Errors */}
            {markdown.trim() && validation.errors.length > 0 && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--rust)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--rust)' }}>Validation Errors:</p>
                <ul className="text-xs space-y-0.5" style={{ color: 'var(--rust)' }}>
                  {validation.errors.map((err, i) => <li key={i}>- {err}</li>)}
                </ul>
              </div>
            )}
            {markdown.trim() && validation.valid && (
              <p className="text-xs" style={{ color: 'var(--moss)' }}>Valid - siap submit</p>
            )}
          </div>

          {/* Live Preview */}
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Preview</p>
            {parsed ? (
              <div className="text-xs space-y-2" style={{ color: 'var(--text)' }}>
                {parsed.metadata && (
                  <div className="flex flex-wrap gap-1">
                    {parsed.metadata.subject && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)' }}>{parsed.metadata.subject}</span>}
                    {parsed.metadata.topic && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{parsed.metadata.topic}</span>}
                    {parsed.metadata.difficulty && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>ELO {parsed.metadata.difficulty}</span>}
                  </div>
                )}
                <div>
                  <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Soal:</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{parsed.question}</p>
                </div>
                {parsed.options && Object.keys(parsed.options).length > 0 && (
                  <div>
                    <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Pilihan:</p>
                    {Object.entries(parsed.options).map(([k, v]) => (
                      <p key={k} style={{ color: k === parsed.answer ? 'var(--moss)' : 'var(--text)' }}>
                        {k}. {v} {k === parsed.answer && '(kunci)'}
                      </p>
                    ))}
                  </div>
                )}
                {parsed.explanation && (
                  <div>
                    <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Pembahasan:</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{parsed.explanation}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Paste markdown di kiri untuk melihat preview...</p>
            )}
          </div>
        </div>
      )}

      {mode === 'upload' && (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-8 text-center cursor-pointer transition-all"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '2px dashed var(--border)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Drag & drop file .md di sini, atau klik untuk browse
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              Mendukung multiple files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {files.length > 0 && (
            <div className="flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <span style={{ color: f.status === 'success' ? 'var(--moss)' : f.status === 'error' ? 'var(--rust)' : 'var(--text-muted)' }}>
                    {f.status === 'success' ? '\u2713' : f.status === 'error' ? '\u2717' : f.status === 'processing' ? '\u25cb' : '\u2022'}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{f.name}</span>
                  <span className="ml-auto" style={{ color: 'var(--text-faint)' }}>{f.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      {mode === 'paste' && (
        <button
          onClick={handleSubmit}
          disabled={!validation.valid || loading}
          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all self-start"
          style={{
            backgroundColor: validation.valid && !loading ? 'var(--gold)' : 'var(--bg-elevated)',
            color: validation.valid && !loading ? '#1a1a1a' : 'var(--text-faint)',
            opacity: loading ? 0.7 : 1,
            border: 'none',
          }}
        >
          {loading ? 'Memproses...' : 'Submit Seed'}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid ' + (result.success ? 'var(--moss)' : 'var(--rust)') }}>
          <p className="text-xs font-medium" style={{ color: result.success ? 'var(--moss)' : 'var(--rust)' }}>
            {result.success ? 'Seed berhasil disimpan!' : 'Gagal menyimpan seed'}
          </p>
          {result.errors && result.errors.length > 0 && (
            <ul className="text-xs mt-1" style={{ color: 'var(--rust)' }}>
              {result.errors.map((e, i) => <li key={i}>- {e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Mismatch Modal */}
      {showMismatchModal && mismatchData && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--rust)' }}>Dual-Pass Mismatch</h3>
            <p className="text-xs mb-2" style={{ color: 'var(--text)' }}>
              Kunci jawaban Anda: <strong>{mismatchData.seed?.answer}</strong>
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text)' }}>
              Jawaban Claude: <strong>{mismatchData.validation?.claudeAnswer}</strong>
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{mismatchData.validation?.explanation}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMismatchModal(false)}
                className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                Tetap Simpan
              </button>
              <button
                onClick={() => setShowMismatchModal(false)}
                className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
                style={{ backgroundColor: 'var(--gold)', color: '#1a1a1a', border: 'none' }}
              >
                OK, Saya Cek Ulang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bank Tab ─────────────────────────────────────────────────────────────────
function BankTab({ state, dispatch, setActiveTab }) {
  const [seeds, setSeeds] = useState([]);
  const [filterSubjects, setFilterSubjects] = useState([]);
  const [diffMin, setDiffMin] = useState(800);
  const [diffMax, setDiffMax] = useState(1800);
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('terbaru');
  const [viewSeed, setViewSeed] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [revalidating, setRevalidating] = useState(null);

  useEffect(() => {
    loadSeeds();
  }, []);

  async function loadSeeds() {
    try {
      const db = await openDB();
      const tx = db.transaction('seedBank', 'readonly');
      const store = tx.objectStore('seedBank');
      const request = store.getAll();
      request.onsuccess = () => setSeeds(request.result || []);
    } catch (err) {
      console.warn('[DailySeed] loadSeeds failed:', err.message);
    }
  }

  const filtered = useMemo(() => {
    let result = [...seeds];
    if (filterSubjects.length > 0) {
      result = result.filter(s => filterSubjects.includes(s.subject));
    }
    result = result.filter(s => {
      const d = s.difficulty || 1000;
      return d >= diffMin && d <= diffMax;
    });
    if (verifiedFilter === 'verified') result = result.filter(s => s.verified);
    if (verifiedFilter === 'unverified') result = result.filter(s => !s.verified);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(s =>
        (s.question || '').toLowerCase().includes(q) ||
        (s.topic || '').toLowerCase().includes(q) ||
        (s.source || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'terbaru') result.sort((a, b) => (b.date_posted || '').localeCompare(a.date_posted || ''));
    if (sortBy === 'terlama') result.sort((a, b) => (a.date_posted || '').localeCompare(b.date_posted || ''));
    if (sortBy === 'populer') result.sort((a, b) => (b.flagCount || 0) - (a.flagCount || 0));
    return result;
  }, [seeds, filterSubjects, diffMin, diffMax, verifiedFilter, searchText, sortBy]);

  function toggleSubject(id) {
    setFilterSubjects(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function handleDelete(id) {
    try {
      await deleteFromIDB('seedBank', id);
      dispatch({ type: 'DELETE_SEED' });
      setSeeds(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      console.warn('[DailySeed] delete failed:', err.message);
    }
  }

  async function handleRevalidate(seed) {
    if (!state.apiKey) return;
    setRevalidating(seed.id);
    try {
      const result = await dualPassValidate(seed, state.apiKey);
      const updated = { ...seed, verified: result.verified };
      if (result.mismatch) updated.flagCount = (updated.flagCount || 0) + 1;
      await saveToIDB('seedBank', updated);
      setSeeds(prev => prev.map(s => s.id === seed.id ? updated : s));
    } catch (err) {
      console.warn('[DailySeed] revalidate failed:', err.message);
    }
    setRevalidating(null);
  }

  function handleExportMd(seed) {
    const lines = [
      '---', `id: ${seed.id}`, `subject: ${seed.subject}`, `topic: ${seed.topic || ''}`,
      `difficulty: ${seed.difficulty || ''}`, `source: ${seed.source || ''}`,
      `date_posted: ${seed.date_posted || ''}`, '---', '', '# Soal', '', seed.question, '', '# Pilihan', '',
    ];
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      if (seed.options[letter]) lines.push(`${letter}. ${seed.options[letter]}`);
    }
    lines.push('', '# Kunci', '', seed.answer, '', '# Pembahasan', '', seed.explanation || '');
    if (seed.trap) lines.push('', '# Trap', '', seed.trap);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${seed.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePickFolder() {
    if (!window.showDirectoryPicker) return;
    try {
      await window.showDirectoryPicker();
    } catch {}
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {SUBJECTS.map(subj => (
          <button
            key={subj.id}
            onClick={() => toggleSubject(subj.id)}
            className="px-2 py-1 rounded-md text-xs cursor-pointer"
            style={{
              backgroundColor: filterSubjects.includes(subj.id) ? subj.color : 'var(--bg-elevated)',
              color: filterSubjects.includes(subj.id) ? '#1a1a1a' : 'var(--text-muted)',
              border: '1px solid ' + (filterSubjects.includes(subj.id) ? subj.color : 'var(--border)'),
            }}
          >
            {subj.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Difficulty Range */}
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>ELO</span>
          <input type="number" min={800} max={1800} step={100} value={diffMin} onChange={e => setDiffMin(Number(e.target.value))}
            className="w-16 px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <span>-</span>
          <input type="number" min={800} max={1800} step={100} value={diffMax} onChange={e => setDiffMax(Number(e.target.value))}
            className="w-16 px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        {/* Verified Toggle */}
        <select
          value={verifiedFilter}
          onChange={e => setVerifiedFilter(e.target.value)}
          className="px-2 py-1 rounded-md text-xs cursor-pointer"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <option value="all">Semua</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-2 py-1 rounded-md text-xs cursor-pointer"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <option value="terbaru">Terbaru</option>
          <option value="terlama">Terlama</option>
          <option value="populer">Populer</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Cari soal..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="px-2 py-1 rounded-md text-xs flex-1 min-w-[120px]"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* Optional: Folder picker + count */}
      <div className="flex items-center gap-2">
        {window.showDirectoryPicker && (
          <button onClick={handlePickFolder} className="px-2 py-1 rounded-md text-xs cursor-pointer"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Pilih folder seeds
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{filtered.length} seed ditemukan</span>
      </div>

      {/* Seed Cards */}
      <div className="flex flex-col gap-2">
        {filtered.map(seed => (
          <div key={seed.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{
                  color: 'var(--text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {seed.question}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)' }}>{seed.subject}</span>
                  {seed.topic && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{seed.topic}</span>}
                  {seed.difficulty && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{seed.difficulty}</span>}
                  {seed.verified && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--moss)', color: '#1a1a1a' }}>verified</span>}
                  {seed.source && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-faint)' }}>{seed.source}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setViewSeed(seed)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>View</button>
                <button onClick={() => handleExportMd(seed)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Export</button>
                <button onClick={() => handleRevalidate(seed)} disabled={revalidating === seed.id} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', opacity: revalidating === seed.id ? 0.5 : 1 }}>
                  {revalidating === seed.id ? '...' : 'Re-val'}
                </button>
                <button onClick={() => setConfirmDelete(seed.id)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--rust)', border: '1px solid var(--border)' }}>Del</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-faint)' }}>Belum ada seed. Submit seed pertamamu!</p>
        )}
      </div>

      {/* View Modal */}
      {viewSeed && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{viewSeed.id}</h3>
              <button onClick={() => setViewSeed(null)} className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>Tutup</button>
            </div>
            <div className="text-xs space-y-3" style={{ color: 'var(--text)' }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{viewSeed.question}</p>
              <div>
                {Object.entries(viewSeed.options || {}).map(([k, v]) => (
                  <p key={k} style={{ color: k === viewSeed.answer ? 'var(--moss)' : 'var(--text)' }}>{k}. {v}</p>
                ))}
              </div>
              <p><strong>Kunci:</strong> {viewSeed.answer}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}><strong>Pembahasan:</strong> {viewSeed.explanation}</p>
              {viewSeed.trap && <p style={{ whiteSpace: 'pre-wrap' }}><strong>Trap:</strong> {viewSeed.trap}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full mx-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>Yakin hapus seed ini?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-md text-xs cursor-pointer" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}>Batal</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-3 py-1.5 rounded-md text-xs cursor-pointer" style={{ backgroundColor: 'var(--rust)', color: '#fff', border: 'none' }}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variasi Tab ──────────────────────────────────────────────────────────────
function VariasiTab({ state, dispatch }) {
  const [variations, setVariations] = useState([]);
  const [seeds, setSeeds] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [showStrategyPicker, setShowStrategyPicker] = useState(null);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const db = await openDB();
      const txVar = db.transaction('variations', 'readonly');
      const varReq = txVar.objectStore('variations').getAll();
      varReq.onsuccess = () => setVariations(varReq.result || []);

      const txSeed = db.transaction('seedBank', 'readonly');
      const seedReq = txSeed.objectStore('seedBank').getAll();
      seedReq.onsuccess = () => setSeeds(seedReq.result || []);
    } catch (err) {
      console.warn('[DailySeed] loadVariations failed:', err.message);
    }
  }

  const grouped = useMemo(() => {
    const map = {};
    for (const v of variations) {
      const pid = v.parentSeedId || 'unknown';
      if (!map[pid]) map[pid] = [];
      map[pid].push(v);
    }
    return map;
  }, [variations]);

  function toggleGroup(pid) {
    setExpandedGroups(prev => ({ ...prev, [pid]: !prev[pid] }));
  }

  function getSeedQuestion(pid) {
    const seed = seeds.find(s => s.id === pid);
    return seed ? seed.question : pid;
  }

  async function handleGenerate(seedId, strategy) {
    const seed = seeds.find(s => s.id === seedId);
    if (!seed || !state.apiKey) return;
    setGenerating(seedId);
    setShowStrategyPicker(null);
    try {
      const variation = await generateVariation(seed, strategy, state.apiKey);
      await saveToIDB('variations', variation);
      dispatch({ type: 'ADD_VARIATION' });
      setVariations(prev => [...prev, variation]);
    } catch (err) {
      console.warn('[DailySeed] generateVariation failed:', err.message);
    }
    setGenerating(null);
  }

  async function handleDeleteVariation(id) {
    try {
      await deleteFromIDB('variations', id);
      dispatch({ type: 'DELETE_VARIATION' });
      setVariations(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      console.warn('[DailySeed] deleteVariation failed:', err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.keys(grouped).length === 0 && seeds.length === 0 && (
        <p className="text-xs text-center py-8" style={{ color: 'var(--text-faint)' }}>Belum ada variasi. Submit seed terlebih dahulu.</p>
      )}

      {/* Show seeds that have variations or all seeds for generation */}
      {seeds.map(seed => {
        const seedVariations = grouped[seed.id] || [];
        const variationCount = seedVariations.length;
        const isExpanded = expandedGroups[seed.id];

        return (
          <div key={seed.id} className="rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {/* Seed Header */}
            <button
              onClick={() => toggleGroup(seed.id)}
              className="w-full p-3 text-left cursor-pointer flex items-center gap-2"
              style={{ backgroundColor: 'transparent', border: 'none' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
              <span className="text-xs flex-1" style={{
                color: 'var(--text)',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {seed.question}
              </span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>{variationCount}/5 variasi</span>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {/* Variation cards */}
                {seedVariations.map(v => (
                  <div key={v.id} className="flex items-start gap-2 p-2 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)' }}>{v.variationStrategy}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{
                          backgroundColor: v.verified ? 'var(--moss)' : 'var(--bg-elevated)',
                          color: v.verified ? '#1a1a1a' : 'var(--text-faint)',
                          border: v.verified ? 'none' : '1px solid var(--border)',
                        }}>
                          {v.verified ? 'verified' : 'unvalidated'}
                        </span>
                      </div>
                      <p className="text-xs" style={{
                        color: 'var(--text)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {v.question}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteVariation(v.id)}
                      className="px-2 py-1 rounded text-xs cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--rust)', border: '1px solid var(--border)' }}
                    >
                      Del
                    </button>
                  </div>
                ))}

                {/* Generate button */}
                {variationCount < 5 && (
                  <div>
                    {showStrategyPicker === seed.id ? (
                      <div className="flex flex-wrap gap-1">
                        {STRATEGIES.map(s => (
                          <button
                            key={s.id}
                            onClick={() => handleGenerate(seed.id, s.id)}
                            className="px-2 py-1 rounded-md text-xs cursor-pointer"
                            title={s.desc}
                            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          >
                            {s.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowStrategyPicker(null)}
                          className="px-2 py-1 rounded-md text-xs cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowStrategyPicker(seed.id)}
                        disabled={generating === seed.id}
                        className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
                        style={{
                          backgroundColor: 'var(--gold-bg)',
                          color: 'var(--gold)',
                          border: '1px solid var(--gold)',
                          opacity: generating === seed.id ? 0.5 : 1,
                        }}
                      >
                        {generating === seed.id ? 'Generating...' : '+ Generate Variation'}
                      </button>
                    )}
                  </div>
                )}
                {variationCount >= 5 && (
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Maks 5 variasi tercapai</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {seeds.length > 0 && Object.keys(grouped).length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-faint)' }}>Expand seed di atas untuk generate variasi</p>
      )}
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ state }) {
  const [seeds, setSeeds] = useState([]);
  const [variations, setVariations] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const db = await openDB();
      const txSeed = db.transaction('seedBank', 'readonly');
      const seedReq = txSeed.objectStore('seedBank').getAll();
      seedReq.onsuccess = () => setSeeds(seedReq.result || []);

      const txVar = db.transaction('variations', 'readonly');
      const varReq = txVar.objectStore('variations').getAll();
      varReq.onsuccess = () => setVariations(varReq.result || []);
    } catch (err) {
      console.warn('[DailySeed] loadStats failed:', err.message);
    }
  }

  const subjectCounts = useMemo(() => {
    const counts = {};
    for (const s of seeds) {
      counts[s.subject] = (counts[s.subject] || 0) + 1;
    }
    return counts;
  }, [seeds]);

  const difficultyBuckets = useMemo(() => {
    const buckets = {};
    for (let i = 800; i <= 1700; i += 100) {
      buckets[i] = 0;
    }
    for (const s of seeds) {
      const d = s.difficulty || 1000;
      const bucket = Math.floor(d / 100) * 100;
      const key = Math.max(800, Math.min(1700, bucket));
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return buckets;
  }, [seeds]);

  const growthData = useMemo(() => {
    const byDate = {};
    for (const s of seeds) {
      const d = s.date_posted || s.createdAt?.split('T')[0] || '2024-01-01';
      byDate[d] = (byDate[d] || 0) + 1;
    }
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return sorted.map(([date, count]) => {
      cumulative += count;
      return { date, cumulative };
    });
  }, [seeds]);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = seeds.filter(s => (s.date_posted || s.createdAt?.split('T')[0]) === dateStr).length;
      days.push({ date: dateStr, count });
    }
    return days;
  }, [seeds]);

  const verifiedRate = seeds.length > 0
    ? Math.round((seeds.filter(s => s.verified).length / seeds.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="Total Seeds" value={state.seedStats.totalSeeds} />
        <ScoreCard label="Total Variasi" value={state.seedStats.totalVariations} />
        <ScoreCard label="Verified Rate" value={`${verifiedRate}%`} />
        <ScoreCard label="Seed Streak" value={state.seedStats.seedStreak} />
      </div>

      {/* Pie Chart - Subject Distribution */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Distribusi Subjek</p>
        <div className="flex items-center gap-4">
          <PieChart data={subjectCounts} />
          <div className="flex flex-col gap-1">
            {SUBJECTS.map(subj => (
              <div key={subj.id} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: subj.color }} />
                <span style={{ color: 'var(--text)' }}>{subj.label}: {subjectCounts[subj.id] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Histogram - Difficulty Distribution */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Distribusi Difficulty (ELO)</p>
        <DifficultyHistogram buckets={difficultyBuckets} />
      </div>

      {/* Line Chart - Growth */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Pertumbuhan Bank Soal</p>
        <GrowthLineChart data={growthData} />
      </div>

      {/* Heatmap - 30 Day Activity */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Aktivitas 30 Hari Terakhir</p>
        <ActivityHeatmap data={heatmapData} />
      </div>
    </div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <p className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

// ─── SVG Charts ───────────────────────────────────────────────────────────────
function PieChart({ data }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return (
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="20" />
      </svg>
    );
  }

  const colors = { matematika: 'var(--gold)', tpa: 'var(--moss)', bahasa_inggris: 'var(--rust)', bahasa_indonesia: 'var(--amber)' };
  let cumAngle = -90;
  const segments = [];

  for (const [subject, count] of entries) {
    const angle = (count / total) * 360;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    if (entries.length === 1) {
      segments.push(
        <circle key={subject} cx="50" cy="50" r="40" fill={colors[subject] || 'var(--gold)'} />
      );
    } else {
      segments.push(
        <path
          key={subject}
          d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`}
          fill={colors[subject] || 'var(--gold)'}
        />
      );
    }
    cumAngle = endAngle;
  }

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {segments}
    </svg>
  );
}

function DifficultyHistogram({ buckets }) {
  const entries = Object.entries(buckets);
  const maxCount = Math.max(1, ...entries.map(([, v]) => v));
  const barWidth = 240 / entries.length;

  return (
    <svg width="280" height="120" viewBox="0 0 280 120">
      {entries.map(([bucket, count], i) => {
        const height = (count / maxCount) * 80;
        return (
          <g key={bucket}>
            <rect
              x={20 + i * barWidth + 2}
              y={90 - height}
              width={barWidth - 4}
              height={height}
              fill="var(--gold)"
              rx="2"
            />
            <text
              x={20 + i * barWidth + barWidth / 2}
              y={105}
              textAnchor="middle"
              fontSize="7"
              fill="var(--text-faint)"
            >
              {bucket}
            </text>
            {count > 0 && (
              <text
                x={20 + i * barWidth + barWidth / 2}
                y={86 - height}
                textAnchor="middle"
                fontSize="7"
                fill="var(--text-muted)"
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
      <line x1="20" y1="90" x2="260" y2="90" stroke="var(--border)" strokeWidth="0.5" />
    </svg>
  );
}

function GrowthLineChart({ data }) {
  if (data.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Belum ada data</p>;
  }

  const maxVal = Math.max(1, ...data.map(d => d.cumulative));
  const width = 280;
  const height = 100;
  const padding = 20;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * chartW;
    const y = padding + chartH - (d.cumulative / maxVal) * chartH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = padding + (i / Math.max(1, data.length - 1)) * chartW;
        const y = padding + chartH - (d.cumulative / maxVal) * chartH;
        return <circle key={i} cx={x} cy={y} r="2" fill="var(--gold)" />;
      })}
      <line x1={padding} y1={padding + chartH} x2={padding + chartW} y2={padding + chartH} stroke="var(--border)" strokeWidth="0.5" />
    </svg>
  );
}

function ActivityHeatmap({ data }) {
  const maxCount = Math.max(1, ...data.map(d => d.count));

  function getColor(count) {
    if (count === 0) return 'var(--bg-elevated)';
    const intensity = count / maxCount;
    if (intensity <= 0.25) return 'var(--gold-bg)';
    if (intensity <= 0.5) return 'var(--gold-soft)';
    if (intensity <= 0.75) return 'var(--gold)';
    return 'var(--gold)';
  }

  return (
    <div className="flex flex-wrap gap-1">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.count} seed`}
          className="rounded-sm"
          style={{
            width: '14px',
            height: '14px',
            backgroundColor: getColor(d.count),
            border: d.count > 0 ? 'none' : '1px solid var(--border)',
          }}
        />
      ))}
    </div>
  );
}
