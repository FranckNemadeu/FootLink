import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "../components/BrandLogo";
import DashboardBottomNav from "../components/DashboardBottomNav";
import SettingsPanel from "../components/SettingsPanel";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";
import getMediaUrl from "../utils/mediaUrl";
import requestWithRetry from "../utils/requestWithRetry";
import { fetchTeamOptions } from "../utils/fetchTeams";

function PlayerDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, token, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const mobileNavItems = [
    {
      id: "profil",
      target: "profil",
      label: t("nav.profile"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
    {
      id: "stats",
      target: "stats",
      label: t("nav.stats"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
      ),
    },
    {
      id: "clubs",
      target: "clubs",
      label: t("nav.clubs"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2L4 5v6c0 5.25 3.75 10.15 8 11.5C16.25 21.15 20 16.25 20 11V5L12 2z" />
        </svg>
      ),
    },
    {
      id: "compte",
      target: "compte",
      label: t("nav.account"),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState({
    matches: 0,
    goals: 0,
    assists: 0,
    cards: 0,
  });
  const [seasonStats, setSeasonStats] = useState([]);
  const [seasonSortKey, setSeasonSortKey] = useState("season_year");
  const [seasonSortDir, setSeasonSortDir] = useState("desc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [playerClubs, setPlayerClubs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedClub, setSelectedClub] = useState("");
  const [clubLoading, setClubLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    position: "",
    age: "",
    city: "",
    height: "",
    preferred_foot: "",
    bio: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState(null);
  const [deleteForm, setDeleteForm] = useState({
    password: "",
    confirmation: "",
  });
  const [deletingAccount, setDeletingAccount] = useState(false);
  const profileCompletion = player
    ? [
        player.position,
        player.age,
        player.city,
        player.height,
        player.preferred_foot,
        player.bio,
        player.profile_photo,
      ].filter(Boolean).length
    : 0;
  const profileCompletionPercent = Math.round((profileCompletion / 7) * 100);
  const playerRole = player?.club_role || "Joueur";

  useEffect(() => {
    if (!notice) return undefined;

    const timeoutId = setTimeout(() => {
      setNotice(null);
    }, 4500);

    return () => clearTimeout(timeoutId);
  }, [notice]);

  const showNotice = (type, message) => {
    setNotice({ type, message });
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  useEffect(() => {
    const fetchPlayer = async () => {
      if (!token) {
        setError("Token introuvable. Reconnecte-toi.");
        setLoading(false);
        return;
      }

      try {
        const headers = {
          authorization: token,
        };

        const [
          profileResult,
          statsResult,
          clubsResult,
          invitationsResult,
          playerClubsResult,
        ] = await Promise.allSettled([
          requestWithRetry(() => axios.get(`${API_URL}/api/player`, { headers })),
          requestWithRetry(() => axios.get(`${API_URL}/api/player/stats`, { headers })),
          fetchTeamOptions(),
          requestWithRetry(() =>
            axios.get(`${API_URL}/api/player/invitations`, { headers })
          ),
          requestWithRetry(() => axios.get(`${API_URL}/api/player/clubs`, { headers })),
        ]);

        if (profileResult.status === "rejected") {
          throw profileResult.reason;
        }

        const profileRes = profileResult.value;

        if (profileRes.data.message) {
          setPlayer(null);
        } else {
          setPlayer(profileRes.data);
          setProfileForm({
            position: profileRes.data.position || "",
            age: profileRes.data.age || "",
            city: profileRes.data.city || "",
            height: profileRes.data.height || "",
            preferred_foot: profileRes.data.preferred_foot || "",
            bio: profileRes.data.bio || "",
          });
        }

        if (statsResult.status === "fulfilled") {
          const statsRes = statsResult.value;
          setStats({
            matches: statsRes.data.matches || 0,
            goals: statsRes.data.goals || 0,
            assists: statsRes.data.assists || 0,
            cards: statsRes.data.cards || 0,
          });
          setSeasonStats(statsRes.data.seasons || []);
        }

        setClubs(clubsResult.status === "fulfilled" ? clubsResult.value || [] : []);
        setInvitations(
          invitationsResult.status === "fulfilled"
            ? invitationsResult.value.data || []
            : []
        );
        setPlayerClubs(
          playerClubsResult.status === "fulfilled"
            ? playerClubsResult.value.data || []
            : []
        );
      } catch (err) {
        console.log(err);
        setError("Impossible de charger le profil joueur.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [token]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSeasonSort = (key) => {
    if (seasonSortKey === key) {
      setSeasonSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSeasonSortKey(key);
      setSeasonSortDir("desc");
    }
  };

  const sortedSeasonStats = [...seasonStats].sort((a, b) => {
    const av = a[seasonSortKey] ?? 0;
    const bv = b[seasonSortKey] ?? 0;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
    return seasonSortDir === "asc" ? cmp : -cmp;
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleChangeClub = async () => {
    if (!selectedClub) {
      showNotice("error", "Sélectionne un club avant d'envoyer la demande.");
      return;
    }

    try {
      setClubLoading(true);

      const res = await axios.put(
        `${API_URL}/api/player/team`,
        { team_name: selectedClub },
        {
          headers: {
            authorization: token,
          },
        }
      );

      setSelectedClub("");
      showNotice("success", res.data.message || "Demande envoyée au club.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Erreur lors du changement de club."
      );
    } finally {
      setClubLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    const age = Number(profileForm.age);
    const height = Number(profileForm.height);
    if (profileForm.age && (age < 10 || age > 60)) {
      showNotice("error", "L'âge doit être compris entre 10 et 60 ans.");
      return;
    }
    if (profileForm.height && (height < 140 || height > 220)) {
      showNotice("error", "La taille doit être entre 140 et 220 cm.");
      return;
    }
    if (profileForm.bio && profileForm.bio.length > 500) {
      showNotice("error", "La bio ne peut pas dépasser 500 caractères.");
      return;
    }

    try {
      setProfileSaving(true);

      await axios.put(`${API_URL}/api/player`, profileForm, {
        headers: {
          authorization: token,
        },
      });

      setPlayer((currentPlayer) => ({
        ...currentPlayer,
        ...profileForm,
      }));
      showNotice("success", "Profil mis à jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre à jour le profil."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLeaveTeam = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/api/player/leave-team`,
        {},
        {
          headers: {
            authorization: token,
          },
        }
      );

      setPlayer((currentPlayer) => ({
        ...currentPlayer,
        team_name: null,
        no_team: 1,
      }));
      showNotice("success", res.data.message || "Tu as quitte ton club.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de quitter le club."
      );
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];

    if (!file || !token) {
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    try {
      setUploadingPhoto(true);

      const res = await axios.post(
        `${API_URL}/api/player/photo`,
        formData,
        {
          headers: {
            authorization: token,
          },
        }
      );

      setPlayer((currentPlayer) => ({
        ...currentPlayer,
        profile_photo: res.data.profile_photo,
      }));
      showNotice("success", "Photo de profil mise à jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Erreur lors du televersement de la photo"
      );
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/player/invitations/${invitationId}/${action}`,
        {},
        {
          headers: {
            authorization: token,
          },
        }
      );

      setInvitations((currentInvitations) =>
        currentInvitations.filter((invitation) => invitation.id !== invitationId)
      );

      if (action === "accept") {
        setPlayer((currentPlayer) => ({
          ...currentPlayer,
          team_name: res.data.team_name,
          no_team: 0,
        }));
      }

      showNotice("success", res.data.message || "Invitation mise à jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de répondre à l'invitation."
      );
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();

    if (deleteForm.confirmation !== "SUPPRIMER") {
      showNotice("error", "Tape SUPPRIMER pour confirmer la suppression du compte.");
      return;
    }

    if (!deleteForm.password) {
      showNotice("error", "Entre ton mot de passe pour supprimer ton compte.");
      return;
    }

    try {
      setDeletingAccount(true);

      await axios.delete(`${API_URL}/api/player/account`, {
        headers: {
          authorization: token,
        },
        data: {
          password: deleteForm.password,
        },
      });

      logout("Ton compte joueur a été supprimé.");
      navigate("/", { replace: true });
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de supprimer le compte."
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="dashboard-page">
      <nav className="dashboard-navbar">
        <BrandLogo />

        <div className="dashboard-nav-links">
          <Link to="/">{t("nav.home")}</Link>
          <button type="button" onClick={() => scrollToSection("profil")}>
            {t("nav.profile")}
          </button>
          <button type="button" onClick={() => scrollToSection("stats")}>
            {t("nav.stats")}
          </button>
          <button onClick={handleLogout}>{t("nav.logout")}</button>
          <button
            type="button"
            className="settings-trigger"
            onClick={() => setShowSettings(true)}
            aria-label={t("nav.settings")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </nav>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <main className="dashboard-content">
        <section className="dashboard-header dashboard-hero">
          <div className="dashboard-title-block">
            <div className="dashboard-badge-row">
              <p className="dashboard-label">{t("dashboard.playerSpace")}</p>
              <span className="dashboard-pill">{playerRole}</span>
            </div>
            <h2>{t("dashboard.welcome")} {user.name || "joueur"}</h2>
            <p>
              Garde ton profil, tes clubs et tes performances prêts à être vus.
            </p>
          </div>

          <div className="dashboard-hero-aside">
            <span className="player-status">{t("dashboard.connected")}</span>
            <div className="dashboard-progress">
              <span>{t("dashboard.profileComplete")}</span>
              <strong>{profileCompletionPercent}%</strong>
              <div>
                <i style={{ width: `${profileCompletionPercent}%` }} />
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="dashboard-skeleton">
            <div className="dashboard-grid">
              <div className="skeleton-panel">
                <div className="sk-profile-card">
                  <div className="sk-avatar" />
                  <div className="sk-lines">
                    <div className="sk-block sk-line-lg" />
                    <div className="sk-block sk-line-md" />
                    <div className="sk-block sk-line-sm" />
                  </div>
                </div>
                <div className="sk-grid">
                  <div className="sk-block" style={{ height: 82 }} />
                  <div className="sk-block" style={{ height: 82 }} />
                  <div className="sk-block" style={{ height: 82 }} />
                </div>
              </div>
              <div className="skeleton-panel">
                <div className="sk-block" style={{ height: 140 }} />
                <div className="sk-grid">
                  <div className="sk-block" style={{ height: 96 }} />
                  <div className="sk-block" style={{ height: 96 }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="dashboard-error">{error}</p>}

        {notice && (
          <p className={`dashboard-notice dashboard-notice-${notice.type}`}>
            {notice.message}
          </p>
        )}

        {!loading && !error && (
          <div className="dashboard-grid">
            <section className="profile-panel" id="profil">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Identité</span>
                  <h3>Infos profil</h3>
                </div>
                <span className="dashboard-pill">
                  {player?.team_name ? "En club" : "Libre"}
                </span>
              </div>

              {player ? (
                <div>
                  <div className="profile-photo-section dashboard-profile-card">
                    <div className="profile-photo">
                      {player.profile_photo ? (
                        <img
                          src={getMediaUrl(player.profile_photo)}
                          alt="Profil joueur"
                          loading="lazy"
                        />
                      ) : (
                        <span>{(user.name || "J").charAt(0)}</span>
                      )}
                    </div>

                    <div className="profile-identity">
                      <h4>{user.name || "Joueur"}</h4>
                      <p>{player.team_name || "Sans club"}</p>

                      <label className="photo-upload-btn">
                        {uploadingPhoto ? "Téléversement..." : "Changer la photo"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="profile-info">
                    <p>
                      <span>Poste</span>
                      {player.position || "Non renseigné"}
                    </p>
                    <p>
                      <span>Age</span>
                      {player.age || "Non renseigné"}
                    </p>
                    <p>
                      <span>Ville</span>
                      {player.city || "Non renseignée"}
                    </p>
                    <p>
                      <span>Taille</span>
                      {player.height || "Non renseignée"}
                    </p>
                    <p>
                      <span>Pied fort</span>
                      {player.preferred_foot || "Non renseigné"}
                    </p>
                      <p>
                        <span>Club</span>
                        {player.team_name || "Aucun"}
                      </p>
                    <div className="club-change-section">
                        <div className="panel-heading compact-heading">
                          <div>
                            <span className="dashboard-label">Clubs</span>
                            <h4>Mes clubs</h4>
                          </div>
                          <span className="dashboard-pill">{playerClubs.length}</span>
                        </div>
                        {playerClubs.length === 0 ? (
                          <p className="dashboard-message dashboard-empty-state">
                            Aucun club accepté pour le moment.
                          </p>
                        ) : (
                          <div className="team-player-list">
                            {playerClubs.map((club) => (
                              <div className="team-player-card" key={club.id}>
                                <div>
                                  <h4>{club.team_name}</h4>
                                  <p>
                                    {club.city || "Ville inconnue"} - {club.club_role || "Joueur"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="profile-bio">
                        <span>Bio</span>
                        {player.bio || "Aucune bio pour le moment."}
                      </p>

                      <div className="club-change-section" id="clubs">
                      <div className="panel-heading compact-heading">
                        <div>
                          <span className="dashboard-label">Recrutement</span>
                          <h4>Demander à rejoindre un autre club</h4>
                        </div>
                      </div>
                      <div className="club-selection">
                        <select
                          value={selectedClub}
                          onChange={(e) => setSelectedClub(e.target.value)}
                          disabled={clubLoading}
                        >
                          <option value="">Sélectionne un club</option>
                          {clubs.map((club) => (
                            <option key={club.id} value={club.team_name}>
                          {club.team_name} ({club.city}) -{" "}
                          {club.player_count || 0} joueurs
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleChangeClub}
                          disabled={clubLoading || !selectedClub}
                        >
                          {clubLoading ? "Envoi..." : "Demander à rejoindre"}
                        </button>
                      </div>
                      {player.team_name && (
                        <button
                          className="danger-btn"
                          type="button"
                          onClick={handleLeaveTeam}
                        >
                          Quitter mon club
                        </button>
                      )}
                    </div>

                    <form className="profile-edit-form" onSubmit={handleProfileSubmit}>
                      <div className="panel-heading compact-heading">
                        <div>
                          <span className="dashboard-label">Mise à jour</span>
                          <h4>Modifier mon profil</h4>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Poste"
                        value={profileForm.position}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            position: e.target.value,
                          })
                        }
                      />

                      <input
                        type="number"
                        placeholder="Age"
                        value={profileForm.age}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, age: e.target.value })
                        }
                      />

                      <input
                        type="text"
                        placeholder="Ville"
                        value={profileForm.city}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, city: e.target.value })
                        }
                      />

                      <input
                        type="number"
                        placeholder="Taille"
                        value={profileForm.height}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            height: e.target.value,
                          })
                        }
                      />

                      <select
                        value={profileForm.preferred_foot}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            preferred_foot: e.target.value,
                          })
                        }
                      >
                        <option value="">Pied fort</option>
                        <option value="Droit">Droit</option>
                        <option value="Gauche">Gauche</option>
                        <option value="Deux pieds">Deux pieds</option>
                      </select>

                      <textarea
                        placeholder="Bio"
                        value={profileForm.bio}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, bio: e.target.value })
                        }
                        rows="3"
                      />

                      <button type="submit" disabled={profileSaving}>
                        {profileSaving ? "Sauvegarde..." : "Sauvegarder"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <p className="dashboard-message dashboard-empty-state">
                  Aucun profil joueur trouvé pour ce compte.
                </p>
              )}
            </section>

            <section className="stats-panel" id="stats">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Performance</span>
                  <h3>Stats</h3>
                </div>
                <span className="dashboard-pill">Saison</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card stat-card-modern">
                  <span>Matchs</span>
                  <strong>{stats.matches}</strong>
                </div>
                <div className="stat-card stat-card-modern">
                  <span>Buts</span>
                  <strong>{stats.goals}</strong>
                </div>
                <div className="stat-card stat-card-modern">
                  <span>Passes</span>
                  <strong>{stats.assists}</strong>
                </div>
                <div className="stat-card stat-card-modern">
                  <span>Cartons</span>
                  <strong>{stats.cards}</strong>
                </div>
                <div className="stat-card stat-card-modern">
                  <span>G/A</span>
                  <strong>{Number(stats.goals || 0) + Number(stats.assists || 0)}</strong>
                </div>
                <div className="stat-card stat-card-modern">
                  <span>Ratio buts</span>
                  <strong>
                    {stats.matches
                      ? (Number(stats.goals || 0) / Number(stats.matches)).toFixed(2)
                      : "0"}
                  </strong>
                </div>
              </div>

              {seasonStats.length > 0 && (
                <div className="public-bio-card season-stats-card">
                  <h3>Stats par saison</h3>
                  <div className="season-stats-table">
                    <div className="season-stats-row season-stats-head">
                      {[
                        { key: "season_year", label: "Saison" },
                        { key: "team_name", label: "Club" },
                        { key: "matches", label: "MJ" },
                        { key: "goals", label: "B" },
                        { key: "assists", label: "P" },
                        { key: "ga", label: "G/A" },
                        { key: "goal_ratio", label: "Ratio" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`stat-sort-btn${seasonSortKey === key ? " active" : ""}`}
                          onClick={() => handleSeasonSort(key)}
                          type="button"
                        >
                          {label}
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                            {seasonSortKey === key && seasonSortDir === "asc"
                              ? <path d="M5 2l4 6H1z" />
                              : <path d="M5 8L1 2h8z" />}
                          </svg>
                        </button>
                      ))}
                    </div>
                    {sortedSeasonStats.map((season) => (
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

              <div className="invitations-panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <span className="dashboard-label">Demandes</span>
                    <h3>Invitations</h3>
                  </div>
                  <span className="dashboard-pill">{invitations.length}</span>
                </div>

                {invitations.length === 0 ? (
                  <p className="dashboard-message dashboard-empty-state">
                    Aucune invitation en attente.
                  </p>
                ) : (
                  <div className="team-player-list">
                    {invitations.map((invitation) => (
                      <div className="team-player-card" key={invitation.id}>
                        <div>
                          <h4>{invitation.team_name}</h4>
                          <p>
                            {invitation.city || "Ville inconnue"} -{" "}
                            {invitation.level || "Niveau non renseigné"}
                          </p>
                        </div>

                        <div className="invitation-actions">
                          <button
                            onClick={() =>
                              handleInvitationResponse(invitation.id, "accept")
                            }
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() =>
                              handleInvitationResponse(invitation.id, "decline")
                            }
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form className="danger-zone" id="compte" onSubmit={handleDeleteAccount}>
                <h3>Supprimer mon compte</h3>
                <p>
                  Cette action supprime ton compte, ton profil joueur, tes stats
                  et tes invitations. Elle est définitive.
                </p>

                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={deleteForm.password}
                  onChange={(e) =>
                    setDeleteForm({ ...deleteForm, password: e.target.value })
                  }
                  disabled={deletingAccount}
                />

                <input
                  type="text"
                  placeholder="Tape SUPPRIMER"
                  value={deleteForm.confirmation}
                  onChange={(e) =>
                    setDeleteForm({
                      ...deleteForm,
                      confirmation: e.target.value,
                    })
                  }
                  disabled={deletingAccount}
                />

                <button
                  className="danger-btn"
                  type="submit"
                  disabled={
                    deletingAccount ||
                    deleteForm.confirmation !== "SUPPRIMER" ||
                    !deleteForm.password
                  }
                >
                  {deletingAccount ? "Suppression..." : "Supprimer mon compte"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>

      <DashboardBottomNav items={mobileNavItems} />

      <button
        className={`scroll-top-btn${showScrollTop ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Retour en haut"
        type="button"
      >
        ↑
      </button>
    </div>
  );
}

export default PlayerDashboard;

