import "./App.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
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

const featuredPlayers = [
  {
    slug: "franck-m",
    name: "Franck M.",
    club: "SSL",
    position: "Attaquant",
    goals: 18,
    assists: 7,
    city: "Montreal",
    tone: "red",
  },
  {
    slug: "yanis-d",
    name: "Yanis D.",
    club: "Nord FC",
    position: "Milieu",
    goals: 14,
    assists: 11,
    city: "Laval",
    tone: "green",
  },
  {
    slug: "samuel-k",
    name: "Samuel K.",
    club: "Rive Sud",
    position: "Ailier",
    goals: 12,
    assists: 6,
    city: "Longueuil",
    tone: "gold",
  },
];

const topScorers = [
  ...featuredPlayers,
  {
    slug: "malik-b",
    name: "Malik B.",
    club: "Laval Stars",
    position: "Avant-centre",
    goals: 10,
    assists: 4,
    city: "Laval",
    tone: "blue",
  },
];

const clubs = [
  {
    slug: "ssl",
    name: "SSL",
    city: "Montreal",
    players: 24,
    level: "Senior local",
    colors: "Vert / Blanc",
  },
  {
    slug: "nord-fc",
    name: "Nord FC",
    city: "Laval",
    players: 19,
    level: "Competitif",
    colors: "Bleu / Or",
  },
  {
    slug: "rive-sud",
    name: "Rive Sud",
    city: "Longueuil",
    players: 21,
    level: "Regional",
    colors: "Cyan / Marine",
  },
];

const playerLink = (player) => `/players/${player.id || player.slug}`;
const clubLink = (club) => `/clubs/${club.id || club.slug}`;

const normalizePlayer = (player, index = 0) => ({
  id: player.id,
  slug: player.slug,
  name: player.name || "Joueur FootLink",
  club: player.team_name || player.club || "Sans club",
  position: player.position || "Joueur",
  club_role: player.club_role || "Joueur",
  goals: Number(player.goals) || 0,
  assists: Number(player.assists) || 0,
  matches: Number(player.matches) || 0,
  cards: Number(player.cards) || 0,
  city: player.city || "Ville inconnue",
  profile_photo: player.profile_photo,
  bio: player.bio,
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

function Home() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState(topScorers);
  const [homeClubs, setHomeClubs] = useState(clubs);
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        const [playersRes, clubsRes] = await Promise.all([
          axios.get(`${API_URL}/api/player/public/featured?limit=8`),
          axios.get(`${API_URL}/api/team/list`),
        ]);

        const apiPlayers = (playersRes.data || []).map(normalizePlayer);
        const apiClubs = (clubsRes.data || []).map(normalizeClub);

        if (apiPlayers.length > 0) setPlayers(apiPlayers);
        if (apiClubs.length > 0) setHomeClubs(getRandomClubs(apiClubs, 3));
      } catch (err) {
        console.log(err);
      }
    };

    loadHomeData();
  }, []);

  const featuredHomePlayers = players.slice(0, 3);
  const getLeaderName = (name) => name || "À définir";

  return (
    <div className="home">
      <PublicNav />

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker">Recrutement local - stats - clubs</p>
            <h2>La vitrine des joueurs et équipes de ton quartier.</h2>
            <p>
              Crée ton profil, rejoins un club enregistré et laisse tes stats
              parler sur le terrain.
            </p>

            <div className="hero-buttons">
              {isAuthenticated ? (
                <>
                  <button
                    className="player-btn"
                    onClick={() => navigate(dashboardPath)}
                  >
                    Ouvrir mon espace
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
                    Je suis un joueur
                  </button>

                  <button
                    className="team-btn"
                    onClick={() => navigate("/register/team")}
                  >
                    Je suis une équipe
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="hero-posters" aria-label="Joueurs a la une">
            {featuredHomePlayers.map((player, index) => (
              <Link
                className={`player-poster poster-${player.tone}`}
                key={player.name}
                to={playerLink(player)}
              >
                <div className="poster-player-art">
                  {player.profile_photo ? (
                    <img
                      src={getMediaUrl(player.profile_photo)}
                      alt={player.name}
                    />
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
        </section>

        <section className="home-section" id="players">
          <div className="section-heading">
            <p className="home-kicker">A la une</p>
            <h2>Meilleurs buteurs</h2>
          </div>

          <div className="scorer-board">
            {players.map((player, index) => (
              <Link className="scorer-row" key={`${player.name}-${index}`} to={playerLink(player)}>
                <span className="rank-number">{index + 1}</span>
                <div className="scorer-player">
                  <span className="mini-avatar scorer-avatar">
                    {player.profile_photo ? (
                      <img src={getMediaUrl(player.profile_photo)} alt={player.name} />
                    ) : (
                      player.name.charAt(0)
                    )}
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
        </section>

        <section className="home-section clubs-section" id="clubs">
          <div className="section-heading">
            <div>
              <p className="home-kicker">Clubs inscrits</p>
              <h2>Clubs a decouvrir</h2>
            </div>
            <Link className="team-btn nav-link-btn" to="/clubs">
              Voir tous les clubs
            </Link>
          </div>

          <div className="club-grid">
            {homeClubs.map((club) => (
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
                  <p>Buteur: {getLeaderName(club.top_scorer)}</p>
                  <p>Passeur: {getLeaderName(club.top_assister)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ClubsList() {
  const [allClubs, setAllClubs] = useState(clubs.map(normalizeClub));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClubs = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/team/list`);
        const apiClubs = (res.data || []).map(normalizeClub);
        if (apiClubs.length > 0) setAllClubs(apiClubs);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    loadClubs();
  }, []);

  return (
    <PublicShell>
      <section className="home-section clubs-list-page">
        <div className="section-heading">
          <div>
            <p className="home-kicker">{loading ? "Chargement" : "Clubs inscrits"}</p>
            <h2>Tous les clubs FootLink</h2>
          </div>
          <Link className="player-btn nav-link-btn" to="/register/team">
            Inscrire mon club
          </Link>
        </div>

        <div className="club-grid clubs-list-grid">
          {allClubs.map((club) => (
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
                <p>Buteur: {club.top_scorer || "A definir"}</p>
                <p>Passeur: {club.top_assister || "A definir"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

function PublicPlayer() {
  const { slug } = useParams();
  const fallbackPlayer = topScorers.find((item) => item.slug === slug) || topScorers[0];
  const [player, setPlayer] = useState(normalizePlayer(fallbackPlayer));
  const [loading, setLoading] = useState(Boolean(Number(slug)));
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!Number(slug)) return;

    const loadPlayer = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/player/public/${slug}`);
        setPlayer(normalizePlayer(res.data));
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    loadPlayer();
  }, [slug]);

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

          <div className="public-actions">
            <Link className="player-btn nav-link-btn" to={isAuthenticated ? dashboardPath : "/register/team"}>
              {isAuthenticated ? "Ouvrir mon espace" : "Recruter des joueurs"}
            </Link>
            <Link className="team-btn nav-link-btn" to="/">
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
  const fallbackClub = clubs.find((item) => item.slug === slug) || clubs[0];
  const [club, setClub] = useState(normalizeClub(fallbackClub));
  const [clubPlayers, setClubPlayers] = useState([]);
  const [clubMatches, setClubMatches] = useState([]);
  const [clubGallery, setClubGallery] = useState([]);
  const [activeTab, setActiveTab] = useState("classements");
  const [loading, setLoading] = useState(Boolean(Number(slug)));
  const { dashboardPath, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!Number(slug)) return;

    const loadClub = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/team/public/${slug}`);
        setClub(normalizeClub(res.data.team));
        setClubPlayers((res.data.players || []).map(normalizePlayer));
        setClubMatches(res.data.matches || []);
        setClubGallery(res.data.gallery || []);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    loadClub();
  }, [slug]);

  const topScorer = [...clubPlayers].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
  )[0];
  const topAssister = [...clubPlayers].sort(
    (a, b) => b.assists - a.assists || a.name.localeCompare(b.name)
  )[0];
  const rankingGroups = [
    {
      title: "Meilleurs buteurs",
      field: "goals",
      suffix: "buts",
      players: [...clubPlayers].sort(
        (a, b) => b.goals - a.goals || a.name.localeCompare(b.name)
      ),
    },
    {
      title: "Meilleurs passeurs",
      field: "assists",
      suffix: "passes",
      players: [...clubPlayers].sort(
        (a, b) => b.assists - a.assists || a.name.localeCompare(b.name)
      ),
    },
    {
      title: "Plus de cartons",
      field: "cards",
      suffix: "cartons",
      players: [...clubPlayers].sort(
        (a, b) => b.cards - a.cards || a.name.localeCompare(b.name)
      ),
    },
  ];
  const tabs = [
    { id: "classements", label: "Classements" },
    { id: "matchs", label: "Matchs" },
    { id: "effectif", label: "Effectif" },
    { id: "galerie", label: "Galerie" },
    { id: "infos", label: "Infos" },
  ];

  return (
    <PublicShell>
      <section className="public-detail public-showcase club-detail">
        <div className="public-visual-panel club-visual-panel">
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
          <p className="public-lead">
            {club.name} represente {club.city} avec un effectif actif, des demandes
            de joueurs et une presence visible sur FootLink.
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
          </div>

          <div className="public-bio-card">
            <h3>Présentation</h3>
            <p>{club.bio || "Ce club n'a pas encore ajouté de description publique."}</p>
          </div>

          <div className="public-actions">
            <Link className="player-btn nav-link-btn" to={isAuthenticated ? dashboardPath : "/register/player"}>
              {isAuthenticated ? "Ouvrir mon espace" : "Rejoindre un club"}
            </Link>
            <Link className="team-btn nav-link-btn" to="/">
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

            {clubPlayers.length > 0 ? (
              <div className="public-ranking-grid">
                {rankingGroups.map((group) => (
                  <div className="public-ranking-card" key={group.field}>
                    <h3>{group.title}</h3>
                    <div className="ranking-list">
                      {group.players.map((player, index) => (
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-message">
                Aucun joueur public n'est encore rattaché à ce club.
              </p>
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-message">Aucun match public pour le moment.</p>
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
                {clubPlayers.map((player) => (
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
            ) : (
              <p className="dashboard-message">
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
              <div className="club-gallery-grid">
                {clubGallery.map((photo) => (
                  <div className="club-gallery-item" key={photo.id}>
                    <img
                      src={getMediaUrl(photo.image_url)}
                      alt={photo.caption || `Photo de ${club.name}`}
                    />
                    <p>{photo.caption || club.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-message">
                Ce club n'a pas encore ajoute de photos.
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
              <p>{club.goals} buts marques</p>
              <p>{club.assists} passes decisives</p>
            </div>
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function PublicShell({ children }) {
  return (
    <div className="home">
      <PublicNav showBack />
      <main>{children}</main>
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
        <a href="/#players">Joueurs</a>
        <Link to="/clubs">Clubs</Link>
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
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/players/:slug" element={<PublicPlayer />} />
        <Route path="/clubs" element={<ClubsList />} />
        <Route path="/clubs/:slug" element={<PublicClub />} />
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
  );
}

export default App;
