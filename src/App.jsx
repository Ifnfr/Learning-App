import { AppProvider } from './context/AppContext';
import ThemeProvider from './components/ThemeProvider';
import AppShell from './components/AppShell';

function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
