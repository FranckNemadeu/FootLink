import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "footlink-theme";
export const THEMES = [
  { id: "dark-gold",  label: "Sombre Doré",   labelEn: "Dark Gold" },
  { id: "dark-red",   label: "Sombre Rouge",  labelEn: "Dark Red" },
  { id: "dark-navy",  label: "Nuit Marine",   labelEn: "Dark Navy" },
  { id: "light",      label: "Clair",         labelEn: "Light" },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "dark-gold"
  );

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
