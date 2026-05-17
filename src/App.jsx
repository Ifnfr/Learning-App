import { AppProvider, useApp } from './context/AppContext';
import ThemeProvider from './components/ThemeProvider';
import AppShell from './components/AppShell';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import LoginGate from './components/LoginGate';

function AppContent() {
  const { state } = useApp();

  if (!state.onboarded) {
    return <OnboardingFlow />;
  }

  return <AppShell />;
}

function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <LoginGate>
          <AppContent />
        </LoginGate>
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
