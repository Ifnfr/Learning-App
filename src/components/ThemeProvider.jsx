import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function ThemeProvider({ children }) {
  const { state } = useApp();

  useEffect(() => {
    if (state.theme === 'academic-dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  return children;
}
