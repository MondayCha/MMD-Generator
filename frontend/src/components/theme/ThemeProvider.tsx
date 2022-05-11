import { ReactNode, useEffect } from 'react';
import { ThemeContext, ThemeMode } from '@components/theme/useThemeContext';
import useLocalStorage from '@hooks/useLocalStorage';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const isDarkOS = window.matchMedia(DARK_SCHEME_QUERY).matches;

  const [themeMode, setThemeMode] = useLocalStorage<ThemeMode>(
    'themeMode',
    isDarkOS ? 'light' : 'dark'
  );

  const toggleTheme = () => {
    setThemeMode((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme }}>{children}</ThemeContext.Provider>
  );
};
