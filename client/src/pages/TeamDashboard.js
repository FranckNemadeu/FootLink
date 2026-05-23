import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import DashboardBottomNav from "../components/DashboardBottomNav";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";
import getMediaUrl from "../utils/mediaUrl";
import requestWithRetry from "../utils/requestWithRetry";

const clubRoles = ["Joueur", "Coach", "Assistant coach", "Manager", "Staff"];
const seasonStatFields = [
  { key: "matches", label: "MJ" },
  { key: "goals", label: "Buts" },
  { key: "assists", label: "Passes" },
  { key: "yellow_cards", label: "Jaunes" },
  { key: "red_cards", label: "Rouges" },
  { key: "motm_count", label: "MVP" },
];

const toStatInputValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const buildSeasonImportRows = (items) =>
  items.map((player) => ({
    player_id: player.id,
    name: player.name,
    position: player.position,
    matches: toStatInputValue(player.matches),
    goals: toStatInputValue(player.goals),
    assists: toStatInputValue(player.assists),
    yellow_cards: toStatInputValue(player.yellow_cards),
    red_cards: toStatInputValue(player.red_cards),
    motm_count: toStatInputValue(player.motm_count),
  }));

function TeamDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [formerMembers, setFormerMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [matchForm, setMatchForm] = useState({
    type: "local",
    matchDate: "",
  });
  const [searchResults, setSearchResults] = useState([]);
  const [searchParams, setSearchParams] = useState({
    position: "",
    city: "",
    maxAge: "",
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [rankingTab, setRankingTab] = useState("goals");
  const [seasonYear, setSeasonYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [importRows, setImportRows] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importRowsLoading, setImportRowsLoading] = useState(false);
  const [availableSeasonYears, setAvailableSeasonYears] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [deleteForm, setDeleteForm] = useState({
    password: "",
    confirmation: "",
  });
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [statsForm, setStatsForm] = useState({
    playerId: "",
    matchId: "",
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    motmPlayerId: "",
  });
  const [matchStatsByMatch, setMatchStatsByMatch] = useState({});

  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const mobileNavItems = [
    { id: "profil", target: "profil", label: "Club", icon: "C" },
    { id: "galerie", target: "galerie", label: "Galerie", icon: "G" },
    { id: "classements", target: "classements", label: "Stats", icon: "S" },
    { id: "joueurs", target: "joueurs", label: "Joueurs", icon: "J" },
    { id: "anciens", target: "anciens", label: "Anciens", icon: "A" },
    { id: "matchs", target: "matchs", label: "Matchs", icon: "M" },
    { id: "compte", target: "compte", label: "Compte", icon: "!" },
  ];

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

  const renderPlayerIdentity = (player) => (
    <div className="player-card-main">
      <div className="mini-avatar">
        {player.profile_photo ? (
          <img
            src={getMediaUrl(player.profile_photo)}
            alt={player.name || "Joueur"}
          />
        ) : (
          <span>{(player.name || "J").charAt(0)}</span>
        )}
      </div>

      <div>
        <h4>{player.name}</h4>
        <p>
          {player.position || "Poste inconnu"} - {player.city || "Ville inconnue"}
        </p>
        <p>Rôle club : {player.club_role || "Joueur"}</p>
        <p>Club actuel : {player.team_name || "Aucun"}</p>
      </div>
    </div>
  );

  const rankingConfig = {
    goals: { label: "Buteurs", valueLabel: "buts", field: "goals" },
    assists: { label: "Passeurs", valueLabel: "passes", field: "assists" },
    motm: { label: "Meilleurs joueurs", valueLabel: "fois homme du match", field: "motm_count" },
    cards: { label: "Cartons", valueLabel: "cartons", field: "cards" },
  };

  const seasonYears = [
    ...new Set(
      [
        ...availableSeasonYears.map(String),
        ...matches.map((match) => match.match_date?.slice(0, 4)),
      ].filter(Boolean)
    ),
  ].sort((a, b) => Number(b) - Number(a));

  const rankingPlayers = [...players].sort((a, b) => {
    const field = rankingConfig[rankingTab].field;
    return Number(b[field] || 0) - Number(a[field] || 0) || a.name.localeCompare(b.name);
  });
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending"
  );
  const teamGoals = players.reduce((sum, player) => sum + Number(player.goals || 0), 0);
  const teamAssists = players.reduce(
    (sum, player) => sum + Number(player.assists || 0),
    0
  );
  const teamMotm = players.reduce(
    (sum, player) => sum + Number(player.motm_count || 0),
    0
  );
  const selectedMatch = matches.find(
    (match) => String(match.id) === String(statsForm.matchId)
  );
  const selectedMatchStats = statsForm.matchId
    ? matchStatsByMatch[statsForm.matchId] || []
    : [];
  const selectedPlayerStat = selectedMatchStats.find(
    (stat) => String(stat.player_id) === String(statsForm.playerId)
  );

  const fetchPlayers = useCallback(async () => {
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
        playersResult,
        invitationsResult,
        matchesResult,
        formerMembersResult,
        galleryResult,
        seasonsResult,
      ] = await Promise.allSettled([
        requestWithRetry(() => axios.get(`${API_URL}/api/team/players`, {
          headers,
          params: seasonYear === "all" ? {} : { year: seasonYear },
        })),
        requestWithRetry(() => axios.get(`${API_URL}/api/team/invitations`, { headers })),
        requestWithRetry(() => axios.get(`${API_URL}/api/team/matches`, { headers })),
        requestWithRetry(() => axios.get(`${API_URL}/api/team/former-members`, { headers })),
        requestWithRetry(() => axios.get(`${API_URL}/api/team/gallery`, { headers })),
        requestWithRetry(() => axios.get(`${API_URL}/api/team/stats/seasons`, { headers })),
      ]);

      if (playersResult.status === "rejected") {
        throw playersResult.reason;
      }

      const playersRes = playersResult.value;

      setTeam(playersRes.data.team);
      setPlayers(playersRes.data.players);
      setInvitations(
        invitationsResult.status === "fulfilled" ? invitationsResult.value.data : []
      );
      setMatches(matchesResult.status === "fulfilled" ? matchesResult.value.data : []);
      setFormerMembers(
        formerMembersResult.status === "fulfilled" ? formerMembersResult.value.data : []
      );
      setGallery(galleryResult.status === "fulfilled" ? galleryResult.value.data : []);
      setAvailableSeasonYears(
        seasonsResult.status === "fulfilled" ? seasonsResult.value.data : []
      );
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Impossible de charger l'équipe.");
    } finally {
      setLoading(false);
    }
  }, [seasonYear, token]);

  const handleOpenImportModal = () => {
    const yearPref = seasonYear === "all" ? new Date().getFullYear() : seasonYear;
    setImportYear(yearPref);
    setImportRows(buildSeasonImportRows(players));
    setShowImportModal(true);
  };

  useEffect(() => {
    if (!showImportModal || !token || !importYear) return;

    const loadImportRows = async () => {
      setImportRowsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/team/players`, {
          headers: { authorization: token },
          params: { year: importYear },
        });

        setImportRows(buildSeasonImportRows(res.data.players || []));
      } catch (err) {
        console.log(err);
        showNotice(
          "error",
          err.response?.data?.message ||
            "Impossible de charger les stats de cette annee."
        );
      } finally {
        setImportRowsLoading(false);
      }
    };

    loadImportRows();
  }, [showImportModal, importYear, token]);

  const handleImportRowChange = (playerId, field, value) => {
    setImportRows((currentRows) =>
      currentRows.map((row) =>
        row.player_id === playerId
          ? { ...row, [field]: Math.max(0, Number(value) || 0) }
          : row
      )
    );
  };

  const handleSubmitImport = async () => {
    setImportLoading(true);
    try {
      if (importRows.length === 0) {
        throw new Error("Aucun joueur actif dans l'effectif.");
      }

      const payload = {
        year: Number(importYear),
        stats: importRows.map(({ name, position, ...row }) => row),
      };
      await axios.post(`${API_URL}/api/team/stats/season`, payload, {
        headers: { authorization: token },
      });

      showNotice("success", `Stats ${importYear} enregistrées.`);
      setAvailableSeasonYears((currentYears) => [
        ...new Set([String(importYear), ...currentYears.map(String)]),
      ]);
      setSeasonYear(String(importYear));
      setShowImportModal(false);
      if (String(seasonYear) === String(importYear)) {
        fetchPlayers();
      }
    } catch (err) {
      console.log(err);
      showNotice("error", err.response?.data?.message || err.message || "Import impossible");
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const loadMatchStats = useCallback(
    async (matchId, force = false) => {
      if (!token || !matchId) return;
      if (!force && matchStatsByMatch[matchId]) return;

      try {
        const res = await axios.get(`${API_URL}/api/team/matches/${matchId}/stats`, {
          headers: {
            authorization: token,
          },
        });

        setMatchStatsByMatch((currentStats) => ({
          ...currentStats,
          [matchId]: res.data || [],
        }));
      } catch (err) {
        console.log(err);
        showNotice(
          "error",
          err.response?.data?.message || "Impossible de charger les stats du match."
        );
      }
    },
    [matchStatsByMatch, token]
  );

  useEffect(() => {
    if (!statsForm.matchId) return;
    loadMatchStats(statsForm.matchId);
  }, [loadMatchStats, statsForm.matchId]);

  useEffect(() => {
    if (!statsForm.matchId || !statsForm.playerId) return;

    const rows = matchStatsByMatch[statsForm.matchId];
    if (!rows) return;

    const existingStat = rows.find(
      (stat) => String(stat.player_id) === String(statsForm.playerId)
    );
    const motmPlayerId = selectedMatch?.man_of_match_player_id
      ? String(selectedMatch.man_of_match_player_id)
      : "";
    const nextValues = {
      goals: existingStat ? Number(existingStat.goals || 0) : 0,
      assists: existingStat ? Number(existingStat.assists || 0) : 0,
      yellowCards: existingStat ? Number(existingStat.yellow_cards || 0) : 0,
      redCards: existingStat ? Number(existingStat.red_cards || 0) : 0,
      motmPlayerId,
    };

    setStatsForm((currentForm) => {
      const isSame =
        Number(currentForm.goals || 0) === nextValues.goals &&
        Number(currentForm.assists || 0) === nextValues.assists &&
        Number(currentForm.yellowCards || 0) === nextValues.yellowCards &&
        Number(currentForm.redCards || 0) === nextValues.redCards &&
        String(currentForm.motmPlayerId || "") === nextValues.motmPlayerId;

      if (isSame) return currentForm;

      return {
        ...currentForm,
        ...nextValues,
      };
    });
  }, [
    matchStatsByMatch,
    selectedMatch,
    statsForm.matchId,
    statsForm.playerId,
  ]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();

      if (searchParams.position) params.append("position", searchParams.position);
      if (searchParams.city) params.append("city", searchParams.city);
      if (searchParams.maxAge) params.append("maxAge", searchParams.maxAge);

      const res = await axios.get(
        `${API_URL}/api/player/search?${params.toString()}`,
        {
          headers: {
            authorization: token,
          },
        }
      );

      setSearchResults(res.data);
      setSearchResultsOpen(true);
    } catch (err) {
      console.log(err);
      setSearchError(err.response?.data?.message || "Impossible de rechercher des joueurs.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInvitePlayer = async (playerId) => {
    try {
      await axios.post(
        `${API_URL}/api/team/players/${playerId}/invite`,
        {},
        {
          headers: {
            authorization: token,
          },
        }
      );

      showNotice("success", "Invitation envoyée au joueur.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible d'inviter le joueur."
      );
    }
  };

  const handleAddPlayer = async (playerId) => {
    try {
      await axios.post(
        `${API_URL}/api/team/players/${playerId}/add`,
        {},
        {
          headers: {
            authorization: token,
          },
        }
      );

      showNotice("success", "Joueur ajouté à l'équipe.");
      fetchPlayers();
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible d'ajouter le joueur."
      );
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/team/invitations/${invitationId}/${action}`,
        {},
        {
          headers: {
            authorization: token,
          },
        }
      );

      showNotice("success", res.data.message || "Demande mise à jour.");
      fetchPlayers();
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de répondre à la demande."
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotice("error", "Le logo doit etre une image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showNotice("error", "Le logo ne doit pas depasser 5 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    setUploadingLogo(true);

    try {
      const res = await axios.post(`${API_URL}/api/team/logo`, formData, {
        headers: {
          authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      setTeam((currentTeam) => ({
        ...currentTeam,
        logo_photo: res.data.logo_photo,
      }));
      showNotice("success", res.data.message || "Logo mis à jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre à jour le logo."
      );
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotice("error", "La photo doit etre une image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showNotice("error", "La photo ne doit pas depasser 5 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("caption", galleryCaption);
    setUploadingGallery(true);

    try {
      const res = await axios.post(`${API_URL}/api/team/gallery`, formData, {
        headers: {
          authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      setGallery((currentGallery) => [res.data.photo, ...currentGallery]);
      setGalleryCaption("");
      showNotice("success", res.data.message || "Photo ajoutée à la galerie.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible d'ajouter la photo."
      );
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const handleDeleteGalleryPhoto = async (photoId) => {
    try {
      await axios.delete(`${API_URL}/api/team/gallery/${photoId}`, {
        headers: {
          authorization: token,
        },
      });

      setGallery((currentGallery) =>
        currentGallery.filter((photo) => photo.id !== photoId)
      );
      showNotice("success", "Photo supprimée.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de supprimer la photo."
      );
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await axios.delete(`${API_URL}/api/team/players/${playerId}`, {
        headers: {
          authorization: token,
        },
      });

      setPlayers((currentPlayers) =>
        currentPlayers.filter((player) => player.id !== playerId)
      );
      fetchPlayers();
      showNotice("success", "Joueur retiré de l'équipe.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de retirer le joueur."
      );
    }
  };

  const handleRoleChange = async (playerId, clubRole) => {
    try {
      await axios.put(
        `${API_URL}/api/team/players/${playerId}/role`,
        { club_role: clubRole },
        {
          headers: {
            authorization: token,
          },
        }
      );

      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === playerId ? { ...player, club_role: clubRole } : player
        )
      );
      showNotice("success", "Rôle mis à jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre à jour le rôle."
      );
    }
  };

  const handleStatsSubmit = async (e) => {
    e.preventDefault();

    if (!statsForm.playerId || !statsForm.matchId) {
      showNotice("error", "Sélectionne un joueur et un match avant d'ajouter les stats.");
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/team/players/${statsForm.playerId}/stats`,
        {
          match_id: statsForm.matchId,
          goals: statsForm.goals,
          assists: statsForm.assists,
          yellow_cards: statsForm.yellowCards,
          red_cards: statsForm.redCards,
          man_of_match_player_id: statsForm.motmPlayerId || null,
        },
        {
          headers: {
            authorization: token,
          },
        }
      );

      showNotice(
        "success",
        res.data.message ||
          (res.data.mode === "updated" ? "Stats mises à jour." : "Stats ajoutées.")
      );
      await loadMatchStats(statsForm.matchId, true);
      if (res.data.mode !== "updated") {
        setStatsForm((currentForm) => ({
          ...currentForm,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          motmPlayerId: "",
        }));
      }
      fetchPlayers();
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible d'ajouter les stats."
      );
    }
  };

  const handleEditStat = (stat) => {
    setStatsForm({
      playerId: String(stat.player_id),
      matchId: String(stat.match_id),
      goals: Number(stat.goals || 0),
      assists: Number(stat.assists || 0),
      yellowCards: Number(stat.yellow_cards || 0),
      redCards: Number(stat.red_cards || 0),
      motmPlayerId: selectedMatch?.man_of_match_player_id
        ? String(selectedMatch.man_of_match_player_id)
        : "",
    });
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();

    if (!matchForm.matchDate) {
      showNotice("error", "Choisis une date de match.");
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/team/matches`,
        {
          type: matchForm.type,
          match_date: matchForm.matchDate,
        },
        {
          headers: {
            authorization: token,
          },
        }
      );

      setMatches((currentMatches) => [res.data.match, ...currentMatches]);
      setMatchForm({ type: "local", matchDate: "" });
      showNotice("success", "Match créé.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de créer le match."
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

      await axios.delete(`${API_URL}/api/team/account`, {
        headers: {
          authorization: token,
        },
        data: {
          password: deleteForm.password,
        },
      });

      logout("Ton compte équipe a été supprimé.");
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
          <Link to="/">Accueil</Link>
          <button type="button" onClick={() => scrollToSection("classements")}>
            Classements
          </button>
          <button type="button" onClick={() => scrollToSection("recherche")}>
            Recherche
          </button>
          <button type="button" onClick={() => scrollToSection("galerie")}>
            Galerie
          </button>
          <button type="button" onClick={() => scrollToSection("joueurs")}>
            Joueurs
          </button>
          <button type="button" onClick={() => scrollToSection("anciens")}>
            Anciens
          </button>
          <button type="button" onClick={() => scrollToSection("matchs")}>
            Matchs
          </button>
          <button type="button" onClick={() => scrollToSection("compte")}>
            Compte
          </button>
          <button onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>
      <main className="dashboard-content">
        <section className="dashboard-header dashboard-hero team-dashboard-hero">
          <div className="dashboard-title-block">
            <div className="dashboard-badge-row">
              <p className="dashboard-label">Espace équipe</p>
              <span className="dashboard-pill">{team?.level || "Club"}</span>
            </div>
            <h2>{team?.team_name || user?.name || "Équipe"}</h2>
            <p>
              Pilote ton effectif, tes demandes, tes matchs et ta vitrine club.
            </p>
          </div>

          <div className="dashboard-hero-metrics">
            <div>
              <span>Joueurs</span>
              <strong>{players.length}</strong>
            </div>
            <div>
              <span>Demandes</span>
              <strong>{pendingInvitations.length}</strong>
            </div>
            <div>
              <span>Matchs</span>
              <strong>{matches.length}</strong>
            </div>
          </div>
        </section>

        {loading && (
          <p className="dashboard-message dashboard-loading-state">
            Chargement...
          </p>
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
                  <span className="dashboard-label">Clubhouse</span>
                  <h3>Identité du club</h3>
                </div>
                <span className="dashboard-pill">{team?.city || "Ville"}</span>
              </div>

              <div className="profile-photo-section dashboard-profile-card">
                <div className="profile-photo club-logo-photo">
                  {team?.logo_photo ? (
                    <img src={getMediaUrl(team.logo_photo)} alt="Logo du club" />
                  ) : (
                    <span>{(team?.team_name || user?.name || "C").charAt(0)}</span>
                  )}
                </div>

                <div className="profile-identity">
                  <h4>{team?.team_name || user?.name || "Club"}</h4>
                  <p>{team?.city || "Ville non renseignée"}</p>

                  <label className="photo-upload-btn">
                    {uploadingLogo ? "Téléversement..." : "Changer le logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="profile-panel" id="galerie">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Vitrine</span>
                  <h3>Galerie du club</h3>
                </div>
                <span className="dashboard-pill">Photos {gallery.length}/30</span>
              </div>

              <div className="gallery-upload-panel">
                <input
                  type="text"
                  placeholder="Légende de la photo"
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  maxLength="160"
                />

                <label className="photo-upload-btn">
                    {uploadingGallery ? "Téléversement..." : "Ajouter une photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    disabled={uploadingGallery}
                  />
                </label>
              </div>

              {gallery.length === 0 ? (
                <p className="dashboard-message dashboard-empty-state">
                  Aucune photo dans la galerie pour le moment.
                </p>
              ) : (
                <>
                  <div className="club-gallery-grid dashboard-gallery-grid">
                    {gallery.slice(0, 2).map((photo) => (
                      <div className="club-gallery-item" key={photo.id}>
                        <img
                          src={getMediaUrl(photo.image_url)}
                          alt={photo.caption || "Photo du club"}
                        />
                        <div>
                          <p>{photo.caption || "Photo du club"}</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteGalleryPhoto(photo.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {gallery.length > 2 && (
                    <details className="ranking-more">
                      <summary>Voir le reste de la galerie</summary>
                      <div className="club-gallery-grid dashboard-gallery-grid">
                        {gallery.slice(2).map((photo) => (
                          <div className="club-gallery-item" key={photo.id}>
                            <img
                              src={getMediaUrl(photo.image_url)}
                              alt={photo.caption || "Photo du club"}
                            />
                            <div>
                              <p>{photo.caption || "Photo du club"}</p>
                              <button
                                type="button"
                                onClick={() => handleDeleteGalleryPhoto(photo.id)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </section>

            <section className="profile-panel" id="classements">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Leaders</span>
                  <h3>Classements du club</h3>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="dashboard-pill">
                    {seasonYear === "all" ? "Toutes saisons" : seasonYear}
                  </span>
                  <button type="button" className="btn-import" onClick={handleOpenImportModal}>
                    Importer stats
                  </button>
                </div>
              </div>

              <div className="dashboard-mini-stats">
                <span>
                  <strong>{teamGoals}</strong>
                  Buts
                </span>
                <span>
                  <strong>{teamAssists}</strong>
                  Passes
                </span>
                <span>
                  <strong>{teamMotm}</strong>
                  Hommes du match
                </span>
              </div>

              <div className="season-filter">
                <label htmlFor="team-season-filter">Saison</label>
                <select
                  id="team-season-filter"
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

              {showImportModal && (
                <div className="modal-overlay">
                  <div className="modal-dialog">
                    <div className="modal-heading">
                      <div>
                        <span className="dashboard-label">Saison</span>
                        <h3>Stats anciennes</h3>
                      </div>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={() => setShowImportModal(false)}
                        disabled={importLoading}
                        aria-label="Fermer"
                      >
                        X
                      </button>
                    </div>

                    <div className="season-import-year">
                      <label>Année</label>
                      <input
                        type="number"
                        value={importYear}
                        onChange={(e) => setImportYear(e.target.value)}
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>

                    <div className="season-import-grid">
                      <div className="season-import-row season-import-head">
                        <span>Joueur</span>
                        {seasonStatFields.map((field) => (
                          <span key={field.key}>{field.label}</span>
                        ))}
                      </div>

                      {importRowsLoading ? (
                        <p className="dashboard-message dashboard-loading-state">
                          Chargement des stats de {importYear}...
                        </p>
                      ) : importRows.length > 0 ? (
                        importRows.map((row) => (
                          <div className="season-import-row" key={row.player_id}>
                            <div className="season-import-player">
                              <strong>{row.name}</strong>
                              <span>{row.position || "Joueur"}</span>
                            </div>

                            {seasonStatFields.map((field) => (
                              <input
                                key={field.key}
                                type="number"
                                min="0"
                                value={row[field.key]}
                                onChange={(e) =>
                                  handleImportRowChange(
                                    row.player_id,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                aria-label={`${field.label} - ${row.name}`}
                              />
                            ))}
                          </div>
                        ))
                      ) : (
                        <p className="dashboard-message dashboard-empty-state">
                          Aucun joueur actif dans l'effectif.
                        </p>
                      )}
                    </div>

                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowImportModal(false)} disabled={importLoading}>
                        Annuler
                      </button>
                      <button type="button" onClick={handleSubmitImport} disabled={importLoading || importRowsLoading}>
                        {importLoading ? "Import..." : "Importer"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="ranking-tabs">
                {Object.entries(rankingConfig).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    className={rankingTab === key ? "active" : ""}
                    onClick={() => setRankingTab(key)}
                  >
                    {config.label}
                  </button>
                ))}
              </div>

              {rankingPlayers.length > 0 ? (
                <div className="ranking-list">
                  {rankingPlayers.slice(0, 2).map((player, index) => (
                    <div className="ranking-row" key={player.id}>
                      <span className="rank-number">{index + 1}</span>
                      {renderPlayerIdentity(player)}
                      <strong>
                        {Number(player[rankingConfig[rankingTab].field] || 0)}{" "}
                        {rankingConfig[rankingTab].valueLabel}
                      </strong>
                    </div>
                  ))}
                  {rankingPlayers.length > 2 && (
                    <details className="ranking-more">
                      <summary>Voir le reste du classement</summary>
                      <div className="ranking-list">
                        {rankingPlayers.slice(2).map((player, extraIndex) => (
                          <div className="ranking-row" key={player.id}>
                            <span className="rank-number">{extraIndex + 3}</span>
                            {renderPlayerIdentity(player)}
                            <strong>
                              {Number(player[rankingConfig[rankingTab].field] || 0)}{" "}
                              {rankingConfig[rankingTab].valueLabel}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="dashboard-message dashboard-empty-state">
                  Aucun joueur dans l'effectif pour établir un classement.
                </p>
              )}
            </section>

            <section className="profile-panel" id="recherche">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Scouting</span>
                  <h3>Rechercher des joueurs</h3>
                </div>
                <span className="dashboard-pill">Recrutement</span>
              </div>

              <form className="team-search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Position"
                  value={searchParams.position}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, position: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Ville"
                  value={searchParams.city}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, city: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Age max"
                  value={searchParams.maxAge}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, maxAge: e.target.value })
                  }
                  min="0"
                />
                <button type="submit">Rechercher</button>
              </form>

              {searchLoading && <p className="dashboard-message">Recherche en cours...</p>}
              {searchError && <p className="dashboard-error">{searchError}</p>}

              {searchResults.length > 0 && (
                <details
                  className="ranking-more collapsible-results"
                  open={searchResultsOpen}
                  onToggle={(e) => setSearchResultsOpen(e.currentTarget.open)}
                >
                  <summary>{searchResults.length} joueur(s) trouve(s)</summary>
                  <div className="panel-inline-actions">
                    <button type="button" onClick={() => setSearchResultsOpen(false)}>
                      Fermer les resultats
                    </button>
                  </div>
                  <div className="team-player-list compact-scroll-list">
                    {searchResults.map((player) => (
                      <div className="team-player-card" key={player.id}>
                        {renderPlayerIdentity(player)}

                        <div className="member-actions">
                          <button onClick={() => handleInvitePlayer(player.id)}>
                            Inviter
                          </button>
                          <button onClick={() => handleAddPlayer(player.id)}>
                            Ajouter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>

            <section className="profile-panel" id="demandes">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Inbox</span>
                  <h3>Demandes reçues</h3>
                </div>
                <span className="dashboard-pill">{pendingInvitations.length}</span>
              </div>

              {pendingInvitations.length === 0 ? (
                <p className="dashboard-message dashboard-empty-state">
                  Aucune demande en attente.
                </p>
              ) : (
                <div className="team-player-list">
                  {pendingInvitations.map((invitation) => (
                      <div className="team-player-card" key={invitation.id}>
                        <div className="player-card-main">
                          <div className="mini-avatar">
                            {invitation.profile_photo ? (
                              <img
                                src={getMediaUrl(invitation.profile_photo)}
                                alt={invitation.name || "Joueur"}
                              />
                            ) : (
                              <span>{(invitation.name || "J").charAt(0)}</span>
                            )}
                          </div>

                          <div>
                            <h4>{invitation.name}</h4>
                          <p>
                            {invitation.requested_by === "player"
                              ? "Demande à rejoindre ton club"
                              : "Invitation envoyée par ton club"}
                          </p>
                          <p>
                            {invitation.position || "Poste inconnu"} -{" "}
                            {invitation.city || "Ville inconnue"} - Club actuel :{" "}
                            {invitation.team_name || "Aucun"}
                          </p>
                          </div>
                        </div>

                        {invitation.requested_by === "player" ? (
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
                        ) : (
                          <span className="dashboard-label">En attente joueur</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="profile-panel" id="joueurs">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Effectif</span>
                  <h3>Joueurs de l'équipe</h3>
                </div>
                <span className="dashboard-pill">{players.length}</span>
              </div>

              {players.length === 0 ? (
                <p className="dashboard-message dashboard-empty-state">
                  Aucun joueur n'a encore indiqué cette équipe.
                </p>
              ) : (
                <div className="team-player-list compact-roster-list">
                  {players.slice(0, 6).map((player) => (
                    <div className="team-player-card" key={player.id}>
                      <div className="player-card-main">
                        <div className="mini-avatar">
                          {player.profile_photo ? (
                            <img
                              src={getMediaUrl(player.profile_photo)}
                              alt={player.name || "Joueur"}
                            />
                          ) : (
                            <span>{(player.name || "J").charAt(0)}</span>
                          )}
                        </div>

                        <div>
                          <h4>{player.name}</h4>
                          <p>
                            {player.position || "Poste inconnu"} -{" "}
                            {player.city || "Ville inconnue"}
                          </p>
                          <p>Rôle club : {player.club_role || "Joueur"}</p>
                        <p>
                          Buts {player.goals || 0} - Passes{" "}
                          {player.assists || 0} - Hommes du match{" "}
                          {player.motm_count || 0} - Cartons {player.cards || 0}
                        </p>
                        </div>
                      </div>

                      <div className="member-actions">
                        <select
                          value={player.club_role || "Joueur"}
                          onChange={(e) => handleRoleChange(player.id, e.target.value)}
                          aria-label={`Rôle club de ${player.name}`}
                        >
                          {clubRoles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => handleRemovePlayer(player.id)}>
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                  {players.length > 6 && (
                    <details className="ranking-more">
                      <summary>Voir les {players.length - 6} autres joueurs</summary>
                      <div className="team-player-list compact-scroll-list">
                        {players.slice(6).map((player) => (
                          <div className="team-player-card" key={player.id}>
                            <div className="player-card-main">
                              <div className="mini-avatar">
                                {player.profile_photo ? (
                                  <img
                                    src={getMediaUrl(player.profile_photo)}
                                    alt={player.name || "Joueur"}
                                  />
                                ) : (
                                  <span>{(player.name || "J").charAt(0)}</span>
                                )}
                              </div>

                              <div>
                                <h4>{player.name}</h4>
                                <p>
                                  {player.position || "Poste inconnu"} -{" "}
                                  {player.city || "Ville inconnue"}
                                </p>
                                <p>RÃ´le club : {player.club_role || "Joueur"}</p>
                                <p>
                                  Buts {player.goals || 0} - Passes{" "}
                                  {player.assists || 0} - Hommes du match{" "}
                                  {player.motm_count || 0} - Cartons {player.cards || 0}
                                </p>
                              </div>
                            </div>

                            <div className="member-actions">
                              <select
                                value={player.club_role || "Joueur"}
                                onChange={(e) =>
                                  handleRoleChange(player.id, e.target.value)
                                }
                                aria-label={`RÃ´le club de ${player.name}`}
                              >
                                {clubRoles.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                              <button onClick={() => handleRemovePlayer(player.id)}>
                                Retirer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>

            <section className="profile-panel" id="anciens">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Historique</span>
                  <h3>Anciens membres</h3>
                </div>
                <span className="dashboard-pill">{formerMembers.length}</span>
              </div>

              {formerMembers.length === 0 ? (
                <p className="dashboard-message dashboard-empty-state">
                  Aucun ancien membre avec stats enregistrées pour ce club.
                </p>
              ) : (
                <div className="team-player-list">
                  {formerMembers.map((member) => (
                    <div className="team-player-card" key={member.id}>
                      <div className="player-card-main">
                        <div className="mini-avatar">
                          {member.profile_photo ? (
                            <img
                              src={getMediaUrl(member.profile_photo)}
                              alt={member.name || "Ancien membre"}
                            />
                          ) : (
                            <span>{(member.name || "A").charAt(0)}</span>
                          )}
                        </div>

                        <div>
                          <h4>{member.name}</h4>
                          <p>
                            {member.club_role || "Ancien membre"} -{" "}
                            {member.position || "Poste inconnu"}
                          </p>
                          <p>
                            Matchs {member.matches || 0} - Buts {member.goals || 0} -{" "}
                            Passes {member.assists || 0} - Cartons {member.cards || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="stats-panel" id="matchs">
              <div className="panel-heading">
                <div>
                  <span className="dashboard-label">Match center</span>
                  <h3>Créer un match</h3>
                </div>
                <span className="dashboard-pill">{matches.length} matchs</span>
              </div>

              <form className="team-stats-form" onSubmit={handleCreateMatch}>
                <select
                  value={matchForm.type}
                  onChange={(e) =>
                    setMatchForm({ ...matchForm, type: e.target.value })
                  }
                >
                  <option value="local">Local</option>
                  <option value="tournoi">Tournoi</option>
                </select>

                <input
                  type="date"
                  value={matchForm.matchDate}
                  onChange={(e) =>
                    setMatchForm({ ...matchForm, matchDate: e.target.value })
                  }
                  required
                />

                <button type="submit">Créer match</button>
              </form>

              <div className="panel-heading compact-heading">
                <div>
                  <span className="dashboard-label">Feuille de match</span>
                  <h3>Ajouter ou modifier stats</h3>
                </div>
              </div>

              <form className="team-stats-form" onSubmit={handleStatsSubmit}>
                <select
                  value={statsForm.playerId}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, playerId: e.target.value })
                  }
                  required
                >
                  <option value="">Joueur</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statsForm.matchId}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, matchId: e.target.value })
                  }
                  required
                >
                  <option value="">Match</option>
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      #{match.id} - {match.type} - {match.match_date?.slice(0, 10)}
                      {match.man_of_match_name
                        ? ` - HDM: ${match.man_of_match_name}`
                        : ""}
                    </option>
                  ))}
                </select>

                <select
                  value={statsForm.motmPlayerId}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, motmPlayerId: e.target.value })
                  }
                >
                  <option value="">Homme du match</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Buts"
                  value={statsForm.goals}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, goals: e.target.value })
                  }
                  min="0"
                />

                <input
                  type="number"
                  placeholder="Passes"
                  value={statsForm.assists}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, assists: e.target.value })
                  }
                  min="0"
                />

                <input
                  type="number"
                  placeholder="Cartons jaunes"
                  value={statsForm.yellowCards}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, yellowCards: e.target.value })
                  }
                  min="0"
                />

                <input
                  type="number"
                  placeholder="Cartons rouges"
                  value={statsForm.redCards}
                  onChange={(e) =>
                    setStatsForm({ ...statsForm, redCards: e.target.value })
                  }
                  min="0"
                />

                <button type="submit">
                  {selectedPlayerStat ? "Modifier stats" : "Ajouter stats"}
                </button>
              </form>

              {statsForm.matchId && (
                <div className="match-stats-editor">
                  <div className="panel-heading compact-heading">
                    <div>
                      <span className="dashboard-label">Stats enregistrées</span>
                      <h4>
                        Match #{statsForm.matchId}
                        {selectedMatch?.man_of_match_name
                          ? ` - HDM: ${selectedMatch.man_of_match_name}`
                          : ""}
                      </h4>
                    </div>
                  </div>

                  {selectedMatchStats.length > 0 ? (
                    <div className="match-stats-list">
                      {selectedMatchStats.map((stat) => (
                        <div className="match-stat-row" key={stat.id}>
                          <div>
                            <strong>{stat.player_name}</strong>
                            <p>
                              {stat.goals || 0} buts - {stat.assists || 0} passes -
                              {" "}
                              {stat.yellow_cards || 0} jaunes - {stat.red_cards || 0} rouges
                            </p>
                          </div>
                          <button type="button" onClick={() => handleEditStat(stat)}>
                            Modifier
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="dashboard-message dashboard-empty-state">
                      Aucune stat enregistrée pour ce match.
                    </p>
                  )}
                </div>
              )}
            </section>

            <form className="danger-zone" id="compte" onSubmit={handleDeleteAccount}>
              <h3>Supprimer mon compte club</h3>
              <p>
                Cette action supprime le compte équipe, le club, ses matchs,
                ses invitations et détache les joueurs de l'effectif.
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
                {deletingAccount ? "Suppression..." : "Supprimer mon compte club"}
              </button>
            </form>
          </div>
        )}
      </main>

      <DashboardBottomNav items={mobileNavItems} />
    </div>
  );
}

export default TeamDashboard;

