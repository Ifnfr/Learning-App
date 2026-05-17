import { useState } from 'react'

const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'learn', label: 'Learn' },
  { id: 'drill', label: 'Drill' },
  { id: 'review', label: 'Review' },
  { id: 'progress', label: 'Progress' },
]

function App() {
  const [activeModule, setActiveModule] = useState('dashboard')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--gold)',
          }}
        >
          SIMAK Study OS
        </h1>

        {/* Navigation */}
        <nav className="flex gap-1">
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                color: activeModule === mod.id ? 'var(--gold)' : 'var(--text-muted)',
                backgroundColor: activeModule === mod.id ? 'var(--gold-bg)' : 'transparent',
              }}
            >
              {mod.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div
          className="max-w-4xl mx-auto rounded-lg p-8"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--text)' }}
          >
            {MODULES.find((m) => m.id === activeModule)?.label}
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Module &quot;{activeModule}&quot; is under construction.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
