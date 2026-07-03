import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "footlink-theme";
const THEME_VERSION = "2026-1";
const VERSION_KEY = "footlink-theme-v";
export const THEMES = [
  { id: "dark-gold",  label: "Sombre Doré",    labelEn: "Dark Gold" },
  { id: "dark-red",   label: "Sombre Rouge",   labelEn: "Dark Red" },
  { id: "dark-navy",  label: "Nuit Marine",    labelEn: "Dark Navy" },
  { id: "wc2026",     label: "Coupe du Monde", labelEn: "World Cup" },
  { id: "light",      label: "Clair",          labelEn: "Light" },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== THEME_VERSION) {
      localStorage.setItem(STORAGE_KEY, "wc2026");
      localStorage.setItem(VERSION_KEY, THEME_VERSION);
      return "wc2026";
    }
    return localStorage.getItem(STORAGE_KEY) || "wc2026";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
