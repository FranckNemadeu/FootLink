import "./App.css";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import PlayerDashboard from "./pages/playerDashboard";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import TeamDashboard from "./pages/TeamDashboard";
import VerifyEmail from "./pages/VerifyEmail";
import BrandLogo from "./components/BrandLogo";
import PrivateRoute from "./components/PrivateRoute";
import API_URL from "./config/api";
import getMediaUrl from "./utils/mediaUrl";
import requestWithRetry from "./utils/requestWithRetry";
import { fetchTeamList } from "./utils/fetchTeams";

const playerLink = (player) => `/players/${player.id || player.slug}`;
const clubLink = (club) =>
  club.id ? `/clubs/${club.id}` : club.slug ? `/clubs/${club.slug}` : "/clubs";

const normalizePlayer = (player, index = 0) => ({
  id: player.id,
  slug: player.slug,
  name: player.name || "Joueur FootLink",
  club: player.team_name || player.club || player.club_name || "Sans club",
  position: player.position || "Joueur",
  club_role: player.club_role || "Joueur",
  goals: Number(player.goals) || 0,
  assists: Number(player.assists) || 0,
  matches: Number(player.matches) || 0,
  cards: Number(player.cards) || 0,
  motm_count: Number(player.motm_count) || 0,
  ga: Number(player.ga ?? player.goals + player.assists) || 0,
  goal_ratio: Number(player.goal_ratio) || 0,
  city: player.city || "Ville inconnue",
  profile_photo: player.profile_photo,
  bio: player.bio,
  seasons: player.seasons || [],
  tone: player.tone || ["red", "green", "gold", "blue"][index % 4],
});

const normalizeClub = (club) => ({
  id: club.id,
  slug: club.slug,
  name: club.team_name || club.name || "Club FootLink",
  city: club.city || "Ville inconnue",
  players: Number(club.player_count ?? club.players) || 0,
  level: club.level || "Niveau non renseigné",
  category: club.category,
  bio: club.bio,
  logo_photo: club.logo_photo,
  goals: Number(club.goals) || 0,
  assists: Number(club.assists) || 0,
  matches: Number(club.matches) || 0,
  top_scorer: club.top_scorer,
  top_scorer_goals: Number(club.top_scorer_goals) || 0,
  top_assister: club.top_assister,
  top_assister_assists: Number(club.top_assister_assists) || 0,
  colors: club.colors || "Rouge / Blanc",
});

const getRandomClubs = (items, count = 3) =>
  [...items].sort(() => Math.random() - 0.5).slice(0, count);

const getClubRankingGroups = (clubPlayers) => [
  {
    id: "buteurs",
    title: "Meilleurs buteurs",
    field: "goals",
    suffix: "buts",
    players: [...clubPlayers].sort(
      (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
    ),
  },
  {
    id: "passeurs",
    title: "Meilleurs passeurs",
    field: "assists",
    suffix: "passes",
    players: [...clubPlayers].sort(
      (a, b) => b.assists - a.assists || a.name.localeCompare(b.name)
    ),
  },
  {
    id: "ga",
    title: "Meilleurs G/A",
    field: "ga",
    suffix: "G/A",
    players: [...clubPlayers].sort(
      (a, b) =>
        Number(b.ga || 0) - Number(a.ga || 0) ||
        b.goals - a.goals ||
        a.name.localeCompare(b.name)
    ),
  },
  {
    id: "mvp",
    title: "Meilleurs joueurs",
    field: "motm_count",
    suffix: "HDM",
    players: [...clubPlayers].sort(
      (a, b) => b.motm_count - a.motm_count || a.name.localeCompare(b.name)
    ),
  },
  {
    id: "cartons",
    title: "Plus de cartons",
    field: "cards",
    suffix: "cartons",
    players: [...clubPlayers].sort(
      (a, b) => b.cards - a.cards || a.name.localeCompare(b.name)
    ),
  },
];

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [players, setPlayers] = useState([]);
  const [homeClubs, setHomeClubs] = useState([]);
  const [homePlayerOffset, setHomePlayerOffset] = useState(0);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        setHomeLoading(true);
        setHomeError("");

        const [playersResult, clubsResult] = await Promise.allSettled([
          requestWithRetry(() =>
            axios.get(`${API_URL}/api/player/public/featured?limit=8`)
          ),
          fetchTeamList(),
        ]);

        let apiPlayers = [];
        let apiClubs = [];

        if (playersResult.status === "fulfilled") {
          apiPlayers = (playersResult.value.data || []).map(normalizePlayer);
          setPlayers(apiPlayers);
        }

        if (clubsResult.status === "fulfilled") {
          apiClubs = clubsResult.value.map(normalizeClub);
        }

        setHomeClubs(getRandomClubs(apiClubs, 3));

        if (
          playersResult.status === "rejected" ||
          clubsResult.status === "rejected"
        ) {
          setHomeError("Les données live prennent plus de temps à charger.");
        }
      } catch (err) {
        console.log(err);
        setHomeError("Impossible de charger les données live pour le moment.");
      } finally {
        setHomeLoading(false);
      }
    };

    loadHomeData();
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);

  useEffect(() => {
    if (players.length <= 3) return undefined;

    const intervalId = setInterval(() => {
      setHomePlayerOffset((currentOffset) => (currentOffset + 3) % players.length);
    }, 9000);

    return () => clearInterval(intervalId);
  }, [players.length]);

  const featuredHomePlayers =
    players.length <= 3
      ? players
      : [...players, ...players].slice(homePlayerOffset, homePlayerOffset + 3);
  const leaderboardPlayers = players.slice(0, 4);
  const heroPlayer = featuredHomePlayers[0] || {
    name: "Joueurs FootLink",
    position: "Profils live",
    goals: 0,
    assists: 0,
    club: "Clubs inscrits",
  };
  const heroClub = homeClubs[0] || {
    name: homeLoading ? "Chargement clubs" : "Aucun club actif",
    players: 0,
    goals: 0,
    assists: 0,
    top_scorer: "",
  };
  const getLeaderName = (name) => name || "À définir";
  const heroImage =
    "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1400&q=80";

  return (
    <div className="home">
      <PublicNav />

      <main>

        <section className="home-hero landing-hero">
          <div className="home-hero-copy">
            <div className="hero-badge-row">
              <p className="home-kicker">FootLink performance hub</p>
              <span className="live-pill">Stats live</span>
            </div>

            <h1>Ta carrière. Ton club. Tes stats.</h1>
            <p>FootLink connecte joueurs, clubs et performances locales.</p>

            <div className="hero-buttons">
              {isAuthenticated ? (
                <>
                  <button
                    className="player-btn"
                    onClick={() => navigate(dashboardPath)}
                  >
                    Aller à mon espace
                  </button>

                  <button
                    className="team-btn"
                    onClick={() => navigate("/clubs")}
                  >
                    Voir les clubs
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="player-btn"
                    onClick={() => navigate("/register/player")}
                  >
                    Profil joueur
                  </button>

                  <button
                    className="team-btn"
                    onClick={() => navigate("/register/team")}
                  >
                    Inscrire un club
                  </button>
                </>
              )}
            </div>

            <div className="hero-trust-row" aria-label="Points forts">
              <span>Profils</span>
              <span>Clubs</span>
              <span>Stats</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Aperçu FootLink">
            <img className="hero-stadium-image" src={heroImage} alt="" />

            <div className="hero-score-card">
              <div>
                <span>Spotlight</span>
                <strong>{heroPlayer.name}</strong>
              </div>
              <b>{heroPlayer.goals} buts</b>
            </div>

            <div className="hero-scout-card">
              <div className="scout-card-head">
                <span>Scouting board</span>
                <strong>{heroClub.name}</strong>
              </div>

              <div className="hero-player-stack">
                {homeLoading ? (
                  [1, 2, 3].map((n) => (
                    <div key={n} className="hero-player-chip hero-chip-skeleton">
                      <span className="mini-avatar skeleton-avatar" />
                      <span>
                        <span className="skeleton-line skeleton-line-lg" />
                        <span className="skeleton-line skeleton-line-sm" />
                      </span>
                    </div>
                  ))
                ) : featuredHomePlayers.length > 0 ? (
                  featuredHomePlayers.map((player) => (
                    <Link
                      className="hero-player-chip"
                      key={player.id || player.slug || player.name}
                      to={playerLink(player)}
                    >
                      <span className="mini-avatar">
                        {player.profile_photo ? (
                          <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                        ) : player.name.charAt(0)}
                      </span>
                      <span>
                        <strong>{player.name}</strong>
                        <small>{player.position} · {player.goals} buts</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="dashboard-message dashboard-empty-state">
                    Aucun joueur public pour le moment.
                  </p>
                )}
              </div>

              <div className="hero-mini-stats">
                <span>
                  <strong>{heroClub.players}</strong>
                  Joueurs
                </span>
                <span>
                  <strong>{heroClub.goals}</strong>
                  Buts
                </span>
                <span>
                  <strong>{heroClub.assists}</strong>
                  Passes
                </span>
              </div>
            </div>
          </div>
        </section>

        {homeError && (
          <p className="dashboard-message dashboard-empty-state home-api-notice">
            {homeError}
          </p>
        )}

        {/* ── Section 2 : Joueurs en vedette ── */}
        <section className="home-section players-section" id="players">
          <div className="section-heading">
            <div>
              <p className="home-kicker">Joueurs</p>
              <h2>Profils en vue</h2>
            </div>
            <Link className="team-btn nav-link-btn" to="/players">
              Voir tous les joueurs
            </Link>
          </div>

          <div className="player-showcase-grid">
            {homeLoading ? (
              ["red", "green", "gold", "blue"].map((tone) => (
                <div key={tone} className={`player-poster player-feature-card poster-${tone} poster-skeleton`}>
                  <div className="poster-player-art" />
                  <div className="poster-content">
                    <span className="skeleton-line skeleton-line-sm" />
                    <span className="skeleton-line skeleton-line-lg" style={{ marginTop: 6 }} />
                    <span className="skeleton-line skeleton-line-md" style={{ marginTop: 4 }} />
                  </div>
                </div>
              ))
            ) : featuredHomePlayers.length > 0 ? (
              featuredHomePlayers.map((player) => (
                <Link
                  className={`player-poster player-feature-card poster-${player.tone}`}
                  key={player.id || player.slug || player.name}
                  to={playerLink(player)}
                >
                  <div className="poster-player-art">
                    {player.profile_photo ? (
                      <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                    ) : <span>{player.name.charAt(0)}</span>}
                  </div>
                  <div className="poster-content">
                    <span>{player.position}</span>
                    <h3>{player.name}</h3>
                    <p>{player.club}</p>
                    <strong>{player.goals} buts</strong>
                  </div>
                </Link>
              ))
            ) : (
              <p className="dashboard-message dashboard-empty-state">
                Aucun joueur public disponible pour le moment.
              </p>
            )}
          </div>

          {leaderboardPlayers.length > 0 && (
            <div className="scorer-board compact-leaderboard">
              {leaderboardPlayers.map((player, index) => (
                <Link className="scorer-row" key={`${player.name}-${index}`} to={playerLink(player)}>
                  <span className="rank-number">{index + 1}</span>
                  <div className="scorer-player">
                    <span className="mini-avatar scorer-avatar">
                      {player.profile_photo ? (
                        <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                      ) : player.name.charAt(0)}
                    </span>
                    <div>
                      <h3>{player.name}</h3>
                      <p>{player.club}</p>
                    </div>
                  </div>
                  <strong>{player.goals}</strong>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3 : Clubs actifs ── */}
        <section className="home-section clubs-section" id="clubs">
          <div className="section-heading">
            <div>
              <p className="home-kicker">Équipes</p>
              <h2>Clubs actifs</h2>
            </div>
            <Link className="team-btn nav-link-btn" to="/clubs">
              Voir tous les clubs
            </Link>
          </div>

          <div className="club-grid">
            {homeClubs.length > 0 ? (
              homeClubs.map((club) => (
              <Link className="club-card" key={club.name} to={clubLink(club)}>
                <div className="club-badge">
                  {club.logo_photo ? (
                    <img src={getMediaUrl(club.logo_photo)} alt={club.name} />
                  ) : (
                    club.name.slice(0, 3)
                  )}
                </div>
                <h3>{club.name}</h3>
                <p>{club.city}</p>
                <div className="club-card-stats">
                  <span>
                    <strong>{club.players}</strong>
                    Joueurs
                  </span>
                  <span>
                    <strong>{club.goals}</strong>
                    Buts
                  </span>
                  <span>
                    <strong>{club.assists}</strong>
                    Passes
                  </span>
                </div>
                <div className="club-card-leaders">
                  <p>Top: {getLeaderName(club.top_scorer)}</p>
                  <p>Passes: {getLeaderName(club.top_assister)}</p>
                </div>
              </Link>
              ))
            ) : (
              <p className="dashboard-message dashboard-empty-state">
                {homeLoading
                  ? "Chargement des clubs..."
                  : "Aucun club n'est disponible pour le moment."}
              </p>
            )}
          </div>
        </section>

        {/* ── Section 4 : Comment démarrer ── */}
        <section className="home-section guidance-section" id="how-it-works">
          <div className="section-heading section-heading-centered">
            <p className="home-kicker">Démarrer</p>
            <h2>Simple à mettre en place</h2>
          </div>

          <div className="audience-grid">
            <Link
              className="audience-card audience-player"
              to={isAuthenticated ? dashboardPath : "/register/player"}
            >
              <span>Joueur</span>
              <h3>Crée ton profil joueur</h3>
              <p>Ajoute ta photo, ton poste et tes clubs passés. Tes stats saison s'accumulent automatiquement à chaque match ajouté par ton équipe.</p>
              <strong>{isAuthenticated ? "Mon espace →" : "Commencer gratuitement →"}</strong>
            </Link>

            <Link
              className="audience-card audience-club"
              to={isAuthenticated ? "/clubs" : "/register/team"}
            >
              <span>Club</span>
              <h3>Ouvre la vitrine de ton équipe</h3>
              <p>Gère ton effectif, reçois les demandes de joueurs et publie les résultats de tes matchs. Visible publiquement sur FootLink.</p>
              <strong>{isAuthenticated ? "Explorer les clubs →" : "Inscrire mon club →"}</strong>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ClubsList() {
  const [allClubs, setAllClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clubError, setClubError] = useState("");
  const [clubQuery, setClubQuery] = useState("");
  const [reloadClubs, setReloadClubs] = useState(0);

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setLoading(true);
        setClubError("");
        const apiClubs = (await fetchTeamList()).map(normalizeClub);
        setAllClubs(apiClubs);
      } catch (err) {
        console.log(err);
        setClubError(
          "Impossible de charger les clubs. Le serveur est peut-etre en train de demarrer."
        );
      } finally {
        setLoading(false);
      }
    };

    loadClubs();
  }, [reloadClubs]);

  const filteredClubs = allClubs.filter((club) => {
    const query = clubQuery.trim().toLowerCase();
    if (!query) return true;

    return [club.name, club.city, club.level, club.category]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
  const totalPlayers = allClubs.reduce((sum, club) => sum + club.players, 0);
  const totalGoals = allClubs.reduce((sum, club) => sum + club.goals, 0);

  return (
    <PublicShell>
      <section className="home-section clubs-list-page club-directory-page">
        <div className="section-heading">
          <div>
            <p className="home-kicker">{loading ? "Chargement" : "Clubs inscrits"}</p>
            <h2>Tous les clubs FootLink</h2>
          </div>
          <Link className="player-btn nav-link-btn" to="/register/team">
            Inscrire mon club
          </Link>
        </div>

        <div className="club-directory-hero">
          <div>
            <span className="dashboard-pill">Répertoire officiel</span>
            <h3>Trouve un club par nom, ville ou niveau.</h3>
            <p>
              Une liste claire pour découvrir les équipes actives et ouvrir leur
              vitrine publique.
            </p>
          </div>
          <div className="club-directory-stats">
            <span>
              <strong>{allClubs.length}</strong>
              Clubs
            </span>
            <span>
              <strong>{totalPlayers}</strong>
              Joueurs
            </span>
            <span>
              <strong>{totalGoals}</strong>
              Buts
            </span>
          </div>
        </div>

        <div className="directory-search-panel">
          <input
            type="search"
            placeholder="Rechercher un club, une ville ou un niveau"
            value={clubQuery}
            onChange={(e) => setClubQuery(e.target.value)}
          />
          <span>{filteredClubs.length} club{filteredClubs.length > 1 ? "s" : ""} trouvé{filteredClubs.length > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p className="dashboard-message dashboard-loading-state">
            Chargement des clubs...
          </p>
        ) : filteredClubs.length > 0 ? (
          <div className="club-grid clubs-list-grid">
          {filteredClubs.map((club) => (
            <Link className="club-card" key={club.id || club.name} to={clubLink(club)}>
              <div className="club-badge">
                {club.logo_photo ? (
                  <img src={getMediaUrl(club.logo_photo)} alt={club.name} />
                ) : (
                  club.name.slice(0, 3)
                )}
              </div>
              <h3>{club.name}</h3>
              <p>{club.city} - {club.level}</p>
              <div className="club-card-stats">
                <span>
                  <strong>{club.players}</strong>
                  Joueurs
                </span>
                <span>
                  <strong>{club.goals}</strong>
                  Buts
                </span>
                <span>
                  <strong>{club.assists}</strong>
                  Passes
                </span>
              </div>
              <div className="club-card-leaders">
                <p>Buteur : {club.top_scorer || "À définir"}</p>
                <p>Passeur : {club.top_assister || "À définir"}</p>
              </div>
            </Link>
          ))}
          </div>
        ) : (
          <div className="dashboard-message dashboard-empty-state">
            <p>
              {clubError ||
                (clubQuery
                  ? "Aucun club ne correspond a cette recherche."
                  : "Aucun club actif pour le moment.")}
            </p>
            {(clubError || !clubQuery) && (
              <button
                type="button"
                onClick={() => setReloadClubs((count) => count + 1)}
              >
                Recharger les clubs
              </button>
            )}
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function PlayersList() {
  const [allClubs, setAllClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [players, setPlayers] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setLoadingClubs(true);
        const apiClubs = (await fetchTeamList()).map(normalizeClub);
        setAllClubs(apiClubs);
        setSelectedClubId(apiClubs[0]?.id ? String(apiClubs[0].id) : "");
      } catch (err) {
        console.log(err);
        setPlayerError("Impossible de charger les clubs.");
      } finally {
        setLoadingClubs(false);
      }
    };

    loadClubs();
  }, []);

  useEffect(() => {
    if (!selectedClubId) {
      setPlayers([]);
      return;
    }

    const loadPlayers = async () => {
      try {
        setLoadingPlayers(true);
        setPlayerError("");
        const res = await axios.get(`${API_URL}/api/team/public/${selectedClubId}`);
        const clubName = res.data.team?.team_name || res.data.team?.name;
        setPlayers(
          (res.data.players || []).map((player, index) =>
            normalizePlayer(
              {
                ...player,
                team_name: player.team_name || clubName,
                club: player.club || clubName,
              },
              index
            )
          )
        );
      } catch (err) {
        console.log(err);
        setPlayers([]);
        setPlayerError(
          err.response?.data?.message || "Impossible de charger les joueurs du club."
        );
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [selectedClubId]);

  const selectedClub = allClubs.find(
    (club) => String(club.id) === String(selectedClubId)
  );

  return (
    <PublicShell>
      <section className="home-section club-directory-page">
        <div className="section-heading">
          <div>
            <p className="home-kicker">{loadingClubs ? "Chargement" : "Joueurs"}</p>
            <h2>Tous les joueurs par club</h2>
          </div>
          <Link className="team-btn nav-link-btn" to="/clubs">
            Voir les clubs
          </Link>
        </div>

        <div className="directory-search-panel players-directory-filter">
          <select
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
            aria-label="Choisir un club"
          >
            {allClubs.map((club) => (
              <option key={club.id || club.slug || club.name} value={club.id || ""}>
                {club.name} ({club.city})
              </option>
            ))}
          </select>
          <span>
            {selectedClub
              ? `${players.length} joueur(s) - ${selectedClub.name}`
              : "Selectionne un club"}
          </span>
        </div>

        {playerError && (
          <p className="dashboard-message dashboard-empty-state">{playerError}</p>
        )}

        {loadingPlayers ? (
          <p className="dashboard-message dashboard-loading-state">
            Chargement des joueurs...
          </p>
        ) : players.length > 0 ? (
          <div className="player-showcase-grid players-directory-grid">
            {players.map((player) => (
              <Link
                className={`player-poster player-feature-card poster-${player.tone}`}
                key={player.id || player.slug || player.name}
                to={playerLink(player)}
              >
                <div className="poster-player-art">
                  {player.profile_photo ? (
                    <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                  ) : (
                    <span>{player.name.charAt(0)}</span>
                  )}
                </div>
                <div className="poster-content">
                  <span>{player.position}</span>
                  <h3>{player.name}</h3>
                  <p>{player.club}</p>
                  <strong>{player.goals} buts</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="dashboard-message dashboard-empty-state">
            Aucun joueur public pour ce club.
          </p>
        )}
      </section>
    </PublicShell>
  );
}

function PublicPlayer() {
  const { slug } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerError, setPlayerError] = useState("");
  const [reloadPlayer, setReloadPlayer] = useState(0);
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!Number(slug)) {
      setPlayer(null);
      setPlayerError("Joueur introuvable.");
      setLoading(false);
      return;
    }

    const loadPlayer = async () => {
      try {
        setLoading(true);
        setPlayerError("");
        const res = await axios.get(`${API_URL}/api/player/public/${slug}`);
        setPlayer(normalizePlayer(res.data));
      } catch (err) {
        console.log(err);
        setPlayer(null);
        setPlayerError(
          err.response?.data?.message ||
            "Impossible de charger les vraies donnees de ce joueur."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPlayer();
  }, [reloadPlayer, slug]);

  if (loading && !player) {
    return (
      <PublicShell>
        <section className="home-section">
          <p className="dashboard-message dashboard-loading-state">
            Chargement du joueur...
          </p>
        </section>
      </PublicShell>
    );
  }

  if (!player) {
    return (
      <PublicShell>
        <section className="home-section">
          <div className="dashboard-message dashboard-empty-state">
            <p>{playerError || "Joueur introuvable."}</p>
            <button type="button" onClick={() => setReloadPlayer((count) => count + 1)}>
              Recharger le joueur
            </button>
            <Link className="team-btn nav-link-btn" to="/">
              Retour accueil
            </Link>
          </div>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <section className="public-detail public-showcase">
        <div className="public-visual-panel">
          <div className={`public-avatar poster-${player.tone}`}>
            {player.profile_photo ? (
              <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
            ) : (
              <span>{player.name.charAt(0)}</span>
            )}
          </div>
          <div className="public-identity-strip">
            <strong>{player.position}</strong>
            <span>{player.club}</span>
          </div>
        </div>

        <div className="public-copy-panel">
          <p className="home-kicker">{loading ? "Chargement" : "Profil joueur"}</p>
          <h2>{player.name}</h2>
          <p className="public-lead">
            {player.position} à {player.club}, basé à {player.city}. Une fiche
            publique claire pour suivre ses stats et son évolution.
          </p>

          <div className="public-stats public-stat-grid">
            <span>
              <strong>{player.goals}</strong>
              Buts
            </span>
            <span>
              <strong>{player.assists}</strong>
              Passes
            </span>
            <span>
              <strong>{player.matches || 0}</strong>
              Matchs
            </span>
            <span>
              <strong>{player.cards || 0}</strong>
              Cartons
            </span>
          </div>

          <div className="public-bio-card">
            <h3>Bio</h3>
            <p>{player.bio || "Ce joueur n'a pas encore ajouté de bio publique."}</p>
          </div>

          {player.seasons.length > 0 && (
            <div className="public-bio-card season-stats-card">
              <h3>Stats par saison</h3>
              <div className="season-stats-table">
                <div className="season-stats-row season-stats-head">
                  <span>Saison</span>
                  <span>Club</span>
                  <span>MJ</span>
                  <span>B</span>
                  <span>P</span>
                  <span>G/A</span>
                  <span>Ratio</span>
                </div>
                {player.seasons.map((season) => (
                  <div
                    className="season-stats-row"
                    key={`${season.team_id}-${season.season_year}`}
                  >
                    <span>{season.season_year}</span>
                    <span>{season.team_name}</span>
                    <span>{season.matches || 0}</span>
                    <span>{season.goals || 0}</span>
                    <span>{season.assists || 0}</span>
                    <span>{season.ga || 0}</span>
                    <span>{season.goal_ratio || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="public-actions">
            <Link className="player-btn nav-link-btn" to={isAuthenticated ? dashboardPath : "/register/team"}>
              {isAuthenticated ? "Ouvrir mon espace" : "Recruter des joueurs"}
            </Link>
            <Link className="team-btn nav-link-btn" to="/#players">
              Voir le classement
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function PublicClub() {
  const { slug } = useParams();
  const [club, setClub] = useState(null);
  const [clubPlayers, setClubPlayers] = useState([]);
  const [clubMatches, setClubMatches] = useState([]);
  const [clubGallery, setClubGallery] = useState([]);
  const [clubSeasonStats, setClubSeasonStats] = useState([]);
  const [activeTab, setActiveTab] = useState("classements");
  const [seasonYear, setSeasonYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [clubError, setClubError] = useState("");
  const [reloadClub, setReloadClub] = useState(0);
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!Number(slug)) {
      setClub(null);
      setClubPlayers([]);
      setClubMatches([]);
      setClubGallery([]);
      setClubSeasonStats([]);
      setClubError("Club introuvable.");
      setLoading(false);
      return;
    }

    const loadClub = async () => {
      try {
        setLoading(true);
        setClubError("");
        const res = await axios.get(`${API_URL}/api/team/public/${slug}`, {
          params: seasonYear === "all" ? {} : { year: seasonYear },
        });
        setClub(normalizeClub(res.data.team));
        setClubPlayers((res.data.players || []).map(normalizePlayer));
        setClubMatches(res.data.matches || []);
        setClubGallery(res.data.gallery || []);
        setClubSeasonStats(res.data.seasonStats || []);
      } catch (err) {
        console.log(err);
        setClub(null);
        setClubPlayers([]);
        setClubMatches([]);
        setClubGallery([]);
        setClubError(
          err.response?.data?.message ||
            "Impossible de charger les vraies donnees de ce club."
        );
      } finally {
        setLoading(false);
      }
    };

    loadClub();
  }, [reloadClub, seasonYear, slug]);

  if (loading && !club) {
    return (
      <PublicShell>
        <section className="home-section">
          <p className="dashboard-message dashboard-loading-state">
            Chargement du club...
          </p>
        </section>
      </PublicShell>
    );
  }

  if (!club) {
    return (
      <PublicShell>
        <section className="home-section">
          <div className="dashboard-message dashboard-empty-state">
            <p>{clubError || "Club introuvable."}</p>
            <button type="button" onClick={() => setReloadClub((count) => count + 1)}>
              Recharger le club
            </button>
            <Link className="team-btn nav-link-btn" to="/clubs">
              Retour aux clubs
            </Link>
          </div>
        </section>
      </PublicShell>
    );
  }

  const topScorer = [...clubPlayers].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
  )[0];
  const topAssister = [...clubPlayers].sort(
    (a, b) => b.assists - a.assists || a.name.localeCompare(b.name)
  )[0];
  const topMotm = [...clubPlayers].sort(
    (a, b) => b.motm_count - a.motm_count || a.name.localeCompare(b.name)
  )[0];
  const seasonYears = [
    ...new Set(
      clubMatches
        .map((match) => match.match_date?.slice(0, 4))
        .filter(Boolean)
        .concat(clubSeasonStats.map((row) => String(row.season_year)).filter(Boolean))
    ),
  ].sort((a, b) => Number(b) - Number(a));
  const rankingGroups = getClubRankingGroups(clubPlayers);
  const tabs = [
    { id: "classements", label: "Classements" },
    { id: "matchs", label: "Matchs" },
    { id: "effectif", label: "Effectif" },
    { id: "galerie", label: "Galerie" },
    { id: "infos", label: "Infos" },
  ];
  const clubBadges = [
    club.city,
    club.level,
    club.category || "Catégorie ouverte",
  ].filter(Boolean);
  const displayedSeasonStats =
    seasonYear === "all"
      ? clubSeasonStats
      : clubSeasonStats.filter((row) => String(row.season_year) === String(seasonYear));

  return (
    <PublicShell>
      <section className="public-detail public-showcase club-detail">
        <div className="public-visual-panel club-visual-panel">
          <span className="official-club-label">Vitrine club</span>
          <div className="club-badge public-club-badge">
            {club.logo_photo ? (
              <img src={getMediaUrl(club.logo_photo)} alt={club.name} />
            ) : (
              club.name.slice(0, 3)
            )}
          </div>
          <div className="public-identity-strip">
            <strong>{club.city}</strong>
            <span>{club.level}</span>
          </div>
        </div>

          <div className="public-copy-panel">
            <p className="home-kicker">{loading ? "Chargement" : "Club inscrit"}</p>
            <h2>{club.name}</h2>
            <div className="official-badge-row">
              {clubBadges.map((badge) => (
                <span className="dashboard-pill" key={badge}>{badge}</span>
              ))}
            </div>
            <p className="public-lead">
              {club.name} représente {club.city} avec un effectif actif, des
              demandes de joueurs et une présence visible sur FootLink.
            </p>

            <div className="public-stats public-stat-grid">
            <span>
              <strong>{club.players}</strong>
              Joueurs
            </span>
            <span>
              <strong>{club.level}</strong>
              Niveau
            </span>
            <span>
              <strong>{club.category || "Ouvert"}</strong>
              Catégorie
            </span>
            <span>
              <strong>{club.matches}</strong>
              Matchs
            </span>
          </div>

            <div className="club-leaders-panel">
              <div>
                <span>Meilleur buteur</span>
                <strong>{topScorer?.name || club.top_scorer || "À définir"}</strong>
              <p>{topScorer?.goals ?? club.top_scorer_goals} buts</p>
            </div>
            <div>
              <span>Meilleur passeur</span>
              <strong>{topAssister?.name || club.top_assister || "À définir"}</strong>
              <p>{topAssister?.assists ?? club.top_assister_assists} passes</p>
            </div>
            <div>
              <span>Meilleur joueur</span>
              <strong>{topMotm?.name || "À définir"}</strong>
              <p>{topMotm?.motm_count || 0} hommes du match</p>
            </div>
          </div>

          <div className="public-bio-card">
            <h3>Présentation</h3>
            <p>{club.bio || "Ce club n'a pas encore ajouté de description publique."}</p>
          </div>

          <div className="public-actions">
            <Link className="player-btn nav-link-btn" to={isAuthenticated ? dashboardPath : "/register/player"}>
              {isAuthenticated ? "Ouvrir mon espace" : "Rejoindre un club"}
            </Link>
            <Link className="team-btn nav-link-btn" to="/clubs">
              Voir les autres clubs
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section public-club-tabs-section">
        <div className="public-club-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "classements" && (
          <div className="public-tab-panel">
            <div className="section-heading">
              <div>
                <p className="home-kicker">Stats publiques</p>
                <h2>Classements du club</h2>
              </div>
            </div>

            <div className="season-filter">
              <label htmlFor="public-season-filter">Saison</label>
              <select
                id="public-season-filter"
                value={seasonYear}
                onChange={(e) => setSeasonYear(e.target.value)}
              >
                <option value="all">Toutes les années</option>
                {seasonYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {clubPlayers.length > 0 ? (
              <div className="public-ranking-grid">
                {rankingGroups.map((group) => (
                  <div className="public-ranking-card" key={group.id}>
                    <div className="public-ranking-card-head">
                      <h3>{group.title}</h3>
                      <Link
                        className="ranking-screenshot-link"
                        to={`/clubs/${slug}/rankings/${group.id}?season=${seasonYear}`}
                      >
                        Page screenshot
                      </Link>
                    </div>
                    <div className="ranking-list">
                      {group.players.slice(0, 2).map((player, index) => (
                        <Link
                          className="ranking-row public-ranking-row"
                          key={player.id}
                          to={playerLink(player)}
                        >
                          <span className="rank-number">{index + 1}</span>
                          <div>
                            <strong>{player.name}</strong>
                        <p>{player.position || "Poste inconnu"}</p>
                        <p>{player.club_role || "Joueur"}</p>
                          </div>
                          <strong>
                            {Number(player[group.field] || 0)} {group.suffix}
                          </strong>
                        </Link>
                      ))}
                    </div>
                    {group.players.length > 2 && (
                      <details className="ranking-more">
                        <summary>Voir le reste</summary>
                        <div className="ranking-list">
                          {group.players.slice(2).map((player, extraIndex) => (
                            <Link
                              className="ranking-row public-ranking-row"
                              key={player.id}
                              to={playerLink(player)}
                            >
                              <span className="rank-number">{extraIndex + 3}</span>
                              <div>
                                <strong>{player.name}</strong>
                                <p>{player.position || "Poste inconnu"}</p>
                              </div>
                              <strong>
                                {Number(player[group.field] || 0)} {group.suffix}
                              </strong>
                            </Link>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-message dashboard-empty-state">
                Aucun joueur public n'est encore rattaché à ce club.
              </p>
            )}
            {displayedSeasonStats.length > 0 && (
              <div className="public-bio-card season-stats-card">
                <h3>Stats detaillees par saison</h3>
                <div className="season-stats-table">
                  <div className="season-stats-row season-stats-head">
                    <span>Saison</span>
                    <span>Joueur</span>
                    <span>MJ</span>
                    <span>B</span>
                    <span>P</span>
                    <span>G/A</span>
                    <span>Ratio</span>
                  </div>
                  {displayedSeasonStats.map((row) => (
                    <div
                      className="season-stats-row"
                      key={`${row.season_year}-${row.player_id}`}
                    >
                      <span>{row.season_year}</span>
                      <span>{row.player_name}</span>
                      <span>{row.matches || 0}</span>
                      <span>{row.goals || 0}</span>
                      <span>{row.assists || 0}</span>
                      <span>{row.ga || 0}</span>
                      <span>{row.goal_ratio || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "matchs" && (
          <div className="public-tab-panel">
            <div className="section-heading">
              <div>
                <p className="home-kicker">Calendrier</p>
                <h2>Derniers matchs</h2>
              </div>
            </div>

            {clubMatches.length > 0 ? (
              <div className="public-match-list">
                {clubMatches.map((match) => (
                  <div className="public-match-row" key={match.id}>
                    <span>{match.type?.slice(0, 1).toUpperCase() || "M"}</span>
                    <div>
                      <h4>{match.type || "Match"}</h4>
                        <p>{match.match_date?.slice(0, 10) || "Date à définir"}</p>
                        {match.man_of_match_name && (
                        <p>Homme du match : {match.man_of_match_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-message dashboard-empty-state">Aucun match public pour le moment.</p>
            )}
          </div>
        )}

        {activeTab === "effectif" && (
          <div className="public-tab-panel">
            <div className="section-heading">
              <div>
                <p className="home-kicker">Effectif public</p>
                <h2>Joueurs du club</h2>
              </div>
            </div>

            {clubPlayers.length > 0 ? (
              <div className="public-roster-grid">
                {clubPlayers.slice(0, 2).map((player) => (
                  <Link
                    className="team-player-card public-player-card"
                    key={player.id}
                    to={playerLink(player)}
                  >
                    <div className="player-card-main">
                      <span className="mini-avatar">
                        {player.profile_photo ? (
                          <img
                            src={getMediaUrl(player.profile_photo)}
                            alt={player.name}
                          />
                        ) : (
                          player.name.charAt(0)
                        )}
                      </span>
                      <div>
                        <h4>{player.name}</h4>
                        <p>
                          {player.club_role || "Joueur"} - {player.position} - {player.goals} buts - {player.assists} passes
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {clubPlayers.length > 2 && (
                  <details className="ranking-more">
                    <summary>Voir les {clubPlayers.length - 2} autres joueurs</summary>
                    <div className="public-roster-grid">
                      {clubPlayers.slice(2).map((player) => (
                        <Link
                          className="team-player-card public-player-card"
                          key={player.id}
                          to={playerLink(player)}
                        >
                          <div className="player-card-main">
                            <span className="mini-avatar">
                              {player.profile_photo ? (
                                <img
                                  src={getMediaUrl(player.profile_photo)}
                                  alt={player.name}
                                />
                              ) : (
                                player.name.charAt(0)
                              )}
                            </span>
                            <div>
                              <h4>{player.name}</h4>
                              <p>
                                {player.club_role || "Joueur"} - {player.position} - {player.goals} buts - {player.assists} passes
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <p className="dashboard-message dashboard-empty-state">
                Aucun joueur public n'est encore rattaché à ce club.
              </p>
            )}
          </div>
        )}

        {activeTab === "galerie" && (
          <div className="public-tab-panel">
            <div className="section-heading">
              <div>
                <p className="home-kicker">Photos du club</p>
                <h2>Galerie</h2>
              </div>
            </div>

            {clubGallery.length > 0 ? (
              <>
                <div className="club-gallery-grid">
                  {clubGallery.slice(0, 2).map((photo) => (
                    <div className="club-gallery-item" key={photo.id}>
                      <img
                        src={getMediaUrl(photo.image_url)}
                        alt={photo.caption || `Photo de ${club.name}`}
                      />
                      <p>{photo.caption || club.name}</p>
                    </div>
                  ))}
                </div>

                {clubGallery.length > 2 && (
                  <details className="ranking-more">
                    <summary>Voir le reste de la galerie</summary>
                    <div className="club-gallery-grid">
                      {clubGallery.slice(2).map((photo) => (
                        <div className="club-gallery-item" key={photo.id}>
                          <img
                            src={getMediaUrl(photo.image_url)}
                            alt={photo.caption || `Photo de ${club.name}`}
                          />
                          <p>{photo.caption || club.name}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <p className="dashboard-message dashboard-empty-state">
                Ce club n'a pas encore ajouté de photos.
              </p>
            )}
          </div>
        )}

        {activeTab === "infos" && (
          <div className="public-tab-panel public-club-info-grid">
            <div className="public-bio-card">
              <h3>Identité</h3>
              <p>Ville: {club.city}</p>
              <p>Niveau: {club.level}</p>
              <p>Catégorie: {club.category || "Ouvert"}</p>
            </div>
            <div className="public-bio-card">
              <h3>Stats club</h3>
              <p>{club.players} joueurs inscrits</p>
              <p>{club.goals} buts marqués</p>
              <p>{club.assists} passes décisives</p>
            </div>
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function PublicClubRanking() {
  const { slug, rankingType } = useParams();
  const [searchParams] = useSearchParams();
  const seasonYear = searchParams.get("season") || "all";
  const [club, setClub] = useState(null);
  const [clubPlayers, setClubPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    if (!Number(slug)) {
      setClub(null);
      setClubPlayers([]);
      setRankingError("Club introuvable.");
      setLoading(false);
      return;
    }

    const loadRanking = async () => {
      try {
        setLoading(true);
        setRankingError("");
        const res = await axios.get(`${API_URL}/api/team/public/${slug}`, {
          params: seasonYear === "all" ? {} : { year: seasonYear },
        });
        const normalizedClub = normalizeClub(res.data.team);
        setClub(normalizedClub);
        setClubPlayers(
          (res.data.players || []).map((player, index) =>
            normalizePlayer(
              {
                ...player,
                club: player.club || normalizedClub.name,
                team_name: player.team_name || normalizedClub.name,
              },
              index
            )
          )
        );
      } catch (err) {
        console.log(err);
        setClub(null);
        setClubPlayers([]);
        setRankingError(
          err.response?.data?.message || "Impossible de charger ce classement."
        );
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
  }, [seasonYear, slug]);

  const rankingGroups = getClubRankingGroups(clubPlayers);
  const ranking =
    rankingGroups.find((group) => group.id === rankingType) || rankingGroups[0];
  const seasonLabel =
    seasonYear === "all" ? "Toutes les saisons" : `Saison ${seasonYear}`;

  if (loading) {
    return (
      <PublicShell>
        <section className="home-section">
          <p className="dashboard-message dashboard-loading-state">
            Chargement du classement...
          </p>
        </section>
      </PublicShell>
    );
  }

  if (!club) {
    return (
      <PublicShell>
        <section className="home-section">
          <div className="dashboard-message dashboard-empty-state">
            <p>{rankingError || "Classement introuvable."}</p>
            <Link className="team-btn nav-link-btn" to="/clubs">
              Retour aux clubs
            </Link>
          </div>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <section className="ranking-share-page">
        <div className="ranking-share-header">
          <div>
            <p className="home-kicker">{club.name}</p>
            <h2>{ranking.title}</h2>
            <div className="official-badge-row">
              <span className="dashboard-pill">{seasonLabel}</span>
              <span className="dashboard-pill">{clubPlayers.length} joueurs</span>
            </div>
          </div>
          <Link className="team-btn nav-link-btn" to={`/clubs/${slug}`}>
            Retour au club
          </Link>
        </div>

        {ranking.players.length > 0 ? (
          <div className="ranking-share-list">
            {ranking.players.map((player, index) => (
              <Link
                className="ranking-share-row"
                key={player.id}
                to={playerLink(player)}
              >
                <span className="rank-number">{index + 1}</span>
                <div className="ranking-share-player">
                  <span className="mini-avatar">
                    {player.profile_photo ? (
                      <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                    ) : (
                      player.name.slice(0, 2)
                    )}
                  </span>
                  <div>
                    <strong>{player.name}</strong>
                    <p>{player.position || "Poste inconnu"}</p>
                  </div>
                </div>
                <strong>
                  {Number(player[ranking.field] || 0)} {ranking.suffix}
                </strong>
              </Link>
            ))}
          </div>
        ) : (
          <p className="dashboard-message dashboard-empty-state">
            Aucun joueur public n'est encore rattache a ce club.
          </p>
        )}
      </section>
    </PublicShell>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <BrandLogo />
          <p>La plateforme football des joueurs et clubs locaux.</p>
        </div>
        <nav className="site-footer-links" aria-label="Liens secondaires">
          <Link to="/players">Joueurs</Link>
          <Link to="/clubs">Clubs</Link>
          <Link to="/register/player">Créer un profil</Link>
          <Link to="/register/team">Inscrire un club</Link>
          <Link to="/confidentialite">Confidentialité</Link>
        </nav>
      </div>
      <p className="site-footer-copy">© {new Date().getFullYear()} FootLink. Tous droits réservés.</p>
    </footer>
  );
}

function PublicShell({ children }) {
  return (
    <div className="home">
      <PublicNav showBack />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

function PublicNav({ showBack = false }) {
  const { dashboardPath, isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="navbar">
      <BrandLogo />

      <div className="nav-menu" aria-label="Navigation principale">
        <Link to="/">Accueil</Link>
        <Link to="/players">Joueurs</Link>
        <Link to="/clubs">Clubs</Link>
        <Link to="/#stats">Stats</Link>
        <Link to="/#how-it-works">Guide</Link>
      </div>

      <div className="nav-buttons">
        {isAuthenticated ? (
          <>
            <span className="nav-user">{user?.name}</span>
            <Link className="login-btn nav-link-btn nav-primary" to={dashboardPath}>
              Espace
            </Link>
            <button className="login-btn nav-link-btn" onClick={logout}>
              Déconnexion
            </button>
          </>
        ) : (
          <Link className="login-btn nav-link-btn nav-primary" to="/login">
            Connexion
          </Link>
        )}

        {showBack && (
          <Link className="login-btn nav-link-btn" to="/">
            Retour
          </Link>
        )}
      </div>
    </nav>
  );
}

function PrivacyPolicy() {
  return (
    <PublicShell>
      <section className="legal-page">
        <p className="home-kicker">Loi 25</p>
        <h2>Politique de confidentialite FootLink</h2>
        <p className="legal-updated">Derniere mise a jour : 22 mai 2026</p>

        <div className="legal-content">
          <section>
            <h3>Responsable des renseignements personnels</h3>
            <p>
              FootLink designe la direction de la plateforme comme responsable
              de la protection des renseignements personnels. Les demandes
              d'acces, de correction, de suppression ou de retrait du
              consentement peuvent etre envoyees a footlink.site@gmail.com.
            </p>
          </section>

          <section>
            <h3>Renseignements collectes</h3>
            <p>
              FootLink collecte les renseignements necessaires a la creation et
              a l'utilisation d'un compte : nom, courriel, mot de passe chiffre,
              role, ville, poste, pied fort, club demande ou gere, description,
              statistiques sportives, photos de profil, logos, galerie et
              messages ou demandes transmis dans la plateforme.
            </p>
          </section>

          <section>
            <h3>Utilisation</h3>
            <p>
              Ces renseignements servent a creer le compte, afficher les profils
              publics ou d'equipe, mettre en relation joueurs et clubs, gerer
              les demandes, securiser l'acces, envoyer les emails de verification
              et ameliorer le service.
            </p>
          </section>

          <section>
            <h3>Partage et hebergement</h3>
            <p>
              Les donnees peuvent etre traitees par les fournisseurs techniques
              utilises pour l'hebergement, la base de donnees, les images et les
              emails. Certains fournisseurs peuvent traiter des donnees hors du
              Quebec ou du Canada. FootLink limite ce partage aux services
              necessaires au fonctionnement de la plateforme.
            </p>
          </section>

          <section>
            <h3>Consentement et visibilite</h3>
            <p>
              Le consentement est demande a l'inscription. Les profils joueurs
              peuvent contenir des informations visibles par les clubs et, selon
              les pages publiques, par les visiteurs. Les utilisateurs doivent
              eviter d'ajouter des renseignements sensibles non necessaires dans
              leur bio ou leurs images.
            </p>
          </section>

          <section>
            <h3>Conservation et suppression</h3>
            <p>
              FootLink conserve les renseignements tant que le compte est actif
              ou que leur conservation est necessaire au service, a la securite
              ou aux obligations legales. Un utilisateur peut demander la
              suppression de son compte depuis son espace ou par une demande de
              confidentialite.
            </p>
          </section>

          <section>
            <h3>Incidents de confidentialite</h3>
            <p>
              En cas d'acces, d'utilisation, de communication ou de perte non
              autorises impliquant des renseignements personnels, FootLink
              documente l'incident, prend les mesures raisonnables pour limiter
              les risques et avise les personnes concernees ainsi que la
              Commission d'acces a l'information lorsque la loi l'exige.
            </p>
          </section>

          <section>
            <h3>Vos droits</h3>
            <p>
              Vous pouvez demander l'acces a vos renseignements, leur
              rectification, leur suppression, le retrait de votre consentement
              ou, lorsque applicable, une copie portable des renseignements que
              vous avez fournis.
            </p>
          </section>
        </div>
      </section>
    </PublicShell>
  );
}

function NotFound() {
  return (
    <PublicShell>
      <section className="not-found">
        <p className="home-kicker">Page introuvable</p>
        <h2>Cette page n'existe pas sur FootLink.</h2>
        <p>Retourne à l'accueil ou ouvre ton espace si tu es connecté.</p>
        <Link className="player-btn nav-link-btn" to="/">
          Retour à l'accueil
        </Link>
      </section>
    </PublicShell>
  );
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players" element={<PlayersList />} />
        <Route path="/players/:slug" element={<PublicPlayer />} />
        <Route path="/clubs" element={<ClubsList />} />
        <Route path="/clubs/:slug/rankings/:rankingType" element={<PublicClubRanking />} />
        <Route path="/clubs/:slug" element={<PublicClub />} />
        <Route path="/confidentialite" element={<PrivacyPolicy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/register/player" element={<Register accountType="player" />} />
        <Route path="/register/team" element={<Register accountType="team" />} />
        <Route
          path="/player/dashboard"
          element={
            <PrivateRoute allowedRoles={["player"]}>
              <PlayerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/team/dashboard"
          element={
            <PrivateRoute allowedRoles={["team"]}>
              <TeamDashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
