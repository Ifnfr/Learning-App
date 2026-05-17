import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'concept', label: 'Concept Engine', icon: 'concept' },
  { id: 'drill', label: 'Drill Mode', icon: 'drill' },
  { id: 'review', label: 'Spaced Review', icon: 'review' },
  { id: 'mock', label: 'Mock Exam', icon: 'mock' },
  { id: 'planner', label: 'Study Planner', icon: 'plan' },
  { id: 'notebook', label: 'Mistake Notebook', icon: 'notebook' },
  { id: 'seed', label: 'Daily Seed', icon: 'seed' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MOBILE_TABS = ['today', 'concept', 'drill', 'review'];

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  // Close "More" menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(event) {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [moreOpen]);

  const handleNav = (moduleId) => {
    dispatch({ type: 'SET_MODULE', payload: moduleId });
    setMoreOpen(false);
  };

  const isCollapsed = state.sidebarCollapsed;

  // Desktop / Tablet sidebar
  const desktopSidebar = (
    <aside
      className="hidden sm:flex flex-col fixed left-0 top-[56px] bottom-0 z-40 transition-all duration-200"
      style={{
        width: isCollapsed ? '64px' : '240px',
        backgroundColor: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = state.activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="flex items-center w-full px-4 py-2.5 gap-3 transition-colors text-left"
              style={{
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                backgroundColor: active ? 'var(--gold-bg)' : 'transparent',
                borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
              }}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={20} />
              {!isCollapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );

  // Mobile bottom tab bar
  const mobileTabBar = (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        height: '56px',
      }}
    >
      {MOBILE_TABS.map((id) => {
        const item = NAV_ITEMS.find((n) => n.id === id);
        const active = state.activeModule === id;
        return (
          <button
            key={id}
            onClick={() => handleNav(id)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
            style={{ color: active ? 'var(--gold)' : 'var(--text-muted)' }}
          >
            <Icon name={item.icon} size={20} />
            <span className="text-[10px]">{item.label.split(' ')[0]}</span>
          </button>
        );
      })}
      {/* More button */}
      <div ref={moreRef} className="relative flex-1 h-full">
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="flex flex-col items-center justify-center w-full h-full gap-0.5"
          style={{ color: moreOpen ? 'var(--gold)' : 'var(--text-muted)' }}
        >
          <Icon name="menu" size={20} />
          <span className="text-[10px]">More</span>
        </button>
        {moreOpen && (
          <div
            className="absolute bottom-full right-0 mb-2 rounded-lg shadow-lg py-2 min-w-[160px]"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            {NAV_ITEMS.filter((n) => !MOBILE_TABS.includes(n.id)).map((item) => {
              const active = state.activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className="flex items-center w-full px-4 py-2 gap-3"
                  style={{
                    color: active ? 'var(--gold)' : 'var(--text-muted)',
                    backgroundColor: active ? 'var(--gold-bg)' : 'transparent',
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {desktopSidebar}
      {mobileTabBar}
    </>
  );
}
