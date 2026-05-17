import { useApp } from '../context/AppContext';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import TodayFlow from '../modules/TodayFlow';
import ConceptEngine from '../modules/ConceptEngine';
import DrillMode from '../modules/DrillMode';
import SpacedReview from '../modules/SpacedReview';
import MockExam from '../modules/MockExam';
import DailySeed from '../modules/DailySeed';

export default function AppShell() {
  const { state } = useApp();

  const sidebarWidth = state.sidebarCollapsed ? '64px' : '240px';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar />
      <Sidebar />

      {/* Main content area */}
      <main
        className="pt-[56px] pb-[56px] sm:pb-0 transition-all duration-200"
        style={{ marginLeft: `var(--sidebar-width, ${sidebarWidth})` }}
      >
        <style>{`
          @media (max-width: 639px) {
            main { margin-left: 0 !important; }
          }
          @media (min-width: 640px) {
            main { --sidebar-width: ${sidebarWidth}; }
          }
        `}</style>
        <div className="max-w-[960px] mx-auto px-4 sm:px-8 py-8">
          {state.activeModule === 'today' ? (
            <TodayFlow />
          ) : state.activeModule === 'concept' ? (
            <ConceptEngine />
          ) : state.activeModule === 'drill' ? (
            <DrillMode />
          ) : state.activeModule === 'review' ? (
            <SpacedReview />
          ) : state.activeModule === 'mock' ? (
            <MockExam />
          ) : state.activeModule === 'seed' ? (
            <DailySeed />
          ) : (
            <div
              className="rounded-lg p-6"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <p style={{ color: 'var(--text)' }}>
                Module: {state.activeModule} - Under Construction
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
