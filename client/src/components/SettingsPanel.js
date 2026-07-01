import { useTranslation } from "react-i18next";
import { THEMES, useTheme } from "../contexts/ThemeContext";

const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English",  flag: "🇬🇧" },
];

const THEME_PREVIEWS = {
  "dark-gold": { bg: "#0d0a06", accent: "#c9a227" },
  "dark-red":  { bg: "#050608", accent: "#ef233c" },
  "dark-navy": { bg: "#020c1b", accent: "#3b82f6" },
  "light":     { bg: "#f5f0e8", accent: "#b8901f" },
};

function SettingsPanel({ onClose }) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>{t("settings.title")}</h3>
          <button className="settings-close" onClick={onClose} type="button" aria-label={t("common.close")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-section">
          <p className="settings-label">{t("settings.theme")}</p>
          <div className="settings-themes">
            {THEMES.map((th) => {
              const preview = THEME_PREVIEWS[th.id];
              return (
                <button
                  key={th.id}
                  type="button"
                  className={`theme-card${theme === th.id ? " active" : ""}`}
                  onClick={() => setTheme(th.id)}
                >
                  <span
                    className="theme-preview"
                    style={{ background: preview.bg }}
                  >
                    <span
                      className="theme-accent-dot"
                      style={{ background: preview.accent }}
                    />
                  </span>
                  <span className="theme-name">
                    {i18n.language === "en" ? th.labelEn : th.label}
                  </span>
                  {theme === th.id && (
                    <span className="theme-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="settings-section">
          <p className="settings-label">{t("settings.language")}</p>
          <div className="settings-langs">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`lang-btn${i18n.language === lang.code ? " active" : ""}`}
                onClick={() => i18n.changeLanguage(lang.code)}
              >
                <span>{lang.flag}</span>
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
