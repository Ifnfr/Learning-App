import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { verifyApiKey } from '../../lib/api';

export default function ApiKeyStep({ onNext }) {
  const { dispatch } = useApp();
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const formatValid = key.startsWith('sk-ant-');
  const showFormatError = key.length > 0 && !formatValid;

  async function handleVerify() {
    if (!formatValid) return;
    setStatus('loading');
    setErrorMsg('');

    const result = await verifyApiKey(key);
    if (result.valid) {
      setStatus('success');
      dispatch({ type: 'SET_API_KEY', payload: key });
      setTimeout(() => onNext(), 800);
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Verifikasi gagal. Periksa kembali API key Anda.');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
      <div
        className="w-full max-w-lg"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--text)' }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Setup API Key
        </h2>
        <p className="mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
          Aplikasi ini membutuhkan API key Anthropic untuk mengakses Claude AI sebagai tutor dan generator soal.
        </p>

        <div className="mb-4">
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              if (status === 'error') setStatus('idle');
            }}
            placeholder="sk-ant-api03-..."
            className="w-full px-4 py-3 rounded-lg outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${showFormatError ? 'var(--rust)' : 'var(--border)'}`,
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
            }}
          />
          {showFormatError && (
            <p className="mt-1 text-sm" style={{ color: 'var(--rust)' }}>
              API key harus dimulai dengan &quot;sk-ant-&quot;
            </p>
          )}
        </div>

        {status === 'success' && (
          <p className="mb-4 text-sm font-medium" style={{ color: 'var(--moss)' }}>
            &#10003; API key valid!
          </p>
        )}
        {status === 'error' && (
          <p className="mb-4 text-sm" style={{ color: 'var(--rust)' }}>
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleVerify}
          disabled={!formatValid || status === 'loading' || status === 'success'}
          className="w-full py-3 px-6 rounded-lg font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          style={{
            background: 'var(--gold)',
            color: 'var(--bg)',
          }}
        >
          {status === 'loading' ? 'Memverifikasi...' : 'Verifikasi'}
        </button>

        {/* Warning box */}
        <div
          className="rounded-lg p-4 mb-4"
          style={{
            border: '1px solid var(--amber)',
            background: 'var(--bg-card)',
          }}
        >
          <div className="flex items-start gap-2">
            <span style={{ color: 'var(--amber)' }}>&#9888;</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              API key disimpan di localStorage browser Anda tanpa enkripsi. Hanya gunakan di device pribadi yang Anda percaya.
            </p>
          </div>
        </div>

        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          Belum punya API key?{' '}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--gold)' }}
            className="underline"
          >
            Dapatkan di sini
          </a>
        </p>
      </div>
    </div>
  );
}
