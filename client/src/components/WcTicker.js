import { useTheme } from "../contexts/ThemeContext";

const SCORES = [
  "🇨🇦 CAN 1–0 AFS 🇿🇦",
  "🇧🇷 BRÉ 2–1 JAP 🇯🇵",
  "🇫🇷 FRA 3–0 SUÈ 🇸🇪",
  "🇲🇽 MEX 2–0 ÉQU 🇪🇨",
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿 ANG 2–1 COD 🇨🇩",
  "🇧🇪 BEL 3–2 SÉN 🇸🇳",
  "🇺🇸 USA 2–0 BOS 🇧🇦",
  "🇪🇸 ESP 3–0 AUT 🇦🇹",
  "🇵🇹 POR 2–1 CRO 🇭🇷",
  "🇨🇭 SUI 2–0 ALG 🇩🇿",
];

export default function WcTicker() {
  const { theme } = useTheme();
  if (theme !== "wc2026") return null;

  return (
    <div className="wc-ticker" aria-label="Scores en direct — Coupe du Monde 2026">
      <span className="wc-ticker-label">⚡ EN DIRECT</span>
      <div className="wc-ticker-viewport" aria-hidden="true">
        <div className="wc-ticker-track">
          {[...SCORES, ...SCORES].map((score, i) => (
            <span key={i} className="wc-ticker-item">{score}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
