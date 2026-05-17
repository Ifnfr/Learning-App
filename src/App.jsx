import { AppProvider, useApp } from './context/AppContext';
import ThemeProvider from './components/ThemeProvider';
import AppShell from './components/AppShell';
import OnboardingFlow from './components/onboarding/OnboardingFlow';

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
        <AppContent />
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
