import { useApp } from '../context/AppContext';
import Icon from './Icon';

const THEME_CYCLE = ['academic-dark', 'academic-light', 'parchment'];

export default function TopBar() {
  const { state, dispatch } = useApp();

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(state.theme);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    dispatch({ type: 'SET_THEME', payload: THEME_CYCLE[nextIndex] });
  };

  const toggleFocus = () => {
    dispatch({ type: 'TOGGLE_FOCUS_MODE' });
  };

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[56px]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Sidebar toggle - desktop only */}
        <button
          onClick={toggleSidebar}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle sidebar"
        >
          <Icon name={state.sidebarCollapsed ? 'chevron-right' : 'chevron-left'} size={20} />
        </button>

        <h1
          className="text-lg font-bold tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--gold)',
          }}
        >
          SIMAK Study OS
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Streak indicator */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded"
          style={{ color: 'var(--amber)' }}
          title={`${state.streak} day streak`}
        >
          <Icon name="streak" size={18} />
          <span className="text-sm font-medium">{state.streak}</span>
        </div>

        {/* Focus mode toggle */}
        <button
          onClick={toggleFocus}
          className="flex items-center justify-center w-8 h-8 rounded transition-colors"
          style={{
            color: state.focusMode ? 'var(--gold)' : 'var(--text-muted)',
            backgroundColor: state.focusMode ? 'var(--gold-bg)' : 'transparent',
          }}
          title={state.focusMode ? 'Exit focus mode' : 'Enter focus mode'}
        >
          <Icon name="focus" size={18} />
        </button>

        {/* Theme cycle */}
        <button
          onClick={cycleTheme}
          className="flex items-center justify-center w-8 h-8 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Change theme"
        >
          <Icon name={state.theme === 'academic-dark' ? 'moon' : 'sun'} size={18} />
        </button>
      </div>
    </header>
  );
}
