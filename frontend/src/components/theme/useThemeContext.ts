import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';
interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);
export const useThemeContext = () => useContext(ThemeContext);
