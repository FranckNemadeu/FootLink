import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import DashboardBottomNav from "../components/DashboardBottomNav";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";
import getMediaUrl from "../utils/mediaUrl";

const clubRoles = ["Joueur", "Coach", "Assistant coach", "Manager", "Staff"];

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
  const [rankingTab, setRankingTab] = useState("goals");
  const [loading, setLoading] = useState(true);
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
  });

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
        <p>Role club : {player.club_role || "Joueur"}</p>
        <p>Club actuel : {player.team_name || "Aucun"}</p>
      </div>
    </div>
  );

  const rankingConfig = {
    goals: { label: "Buteurs", valueLabel: "buts", field: "goals" },
    assists: { label: "Passeurs", valueLabel: "passes", field: "assists" },
    cards: { label: "Cartons", valueLabel: "cartons", field: "cards" },
  };

  const rankingPlayers = [...players].sort((a, b) => {
    const field = rankingConfig[rankingTab].field;
    return Number(b[field] || 0) - Number(a[field] || 0) || a.name.localeCompare(b.name);
  });

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
        playersRes,
        invitationsRes,
        matchesRes,
        formerMembersRes,
        galleryRes,
      ] = await Promise.all([
        axios.get(`${API_URL}/api/team/players`, { headers }),
        axios.get(`${API_URL}/api/team/invitations`, { headers }),
        axios.get(`${API_URL}/api/team/matches`, { headers }),
        axios.get(`${API_URL}/api/team/former-members`, { headers }),
        axios.get(`${API_URL}/api/team/gallery`, { headers }),
      ]);

      setTeam(playersRes.data.team);
      setPlayers(playersRes.data.players);
      setInvitations(invitationsRes.data);
      setMatches(matchesRes.data);
      setFormerMembers(formerMembersRes.data);
      setGallery(galleryRes.data);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Impossible de charger l'équipe.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

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

      showNotice("success", res.data.message || "Demande mise a jour.");
      fetchPlayers();
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de repondre a la demande."
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
      showNotice("success", res.data.message || "Logo mis a jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre a jour le logo."
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
      showNotice("success", res.data.message || "Photo ajoutee a la galerie.");
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
      showNotice("success", "Photo supprimee.");
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
      showNotice("success", "Role mis a jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre a jour le role."
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
      await axios.post(
        `${API_URL}/api/team/players/${statsForm.playerId}/stats`,
        {
          match_id: statsForm.matchId,
          goals: statsForm.goals,
          assists: statsForm.assists,
          yellow_cards: statsForm.yellowCards,
          red_cards: statsForm.redCards,
        },
        {
          headers: {
            authorization: token,
          },
        }
      );

      showNotice("success", "Stats ajoutees.");
      fetchPlayers();
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible d'ajouter les stats."
      );
    }
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
        <section className="dashboard-header">
          <div>
            <p className="dashboard-label">Espace équipe</p>
            <h2>{team?.team_name || user?.name || "Equipe"}</h2>
          </div>

          <span className="player-status">Connecte</span>
        </section>

        {loading && <p className="dashboard-message">Chargement...</p>}
        {error && <p className="dashboard-error">{error}</p>}

        {notice && (
          <p className={`dashboard-notice dashboard-notice-${notice.type}`}>
            {notice.message}
          </p>
        )}

        {!loading && !error && (
          <div className="dashboard-grid">
            <section className="profile-panel" id="profil">
              <h3>Identité du club</h3>

              <div className="profile-photo-section">
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
              <h3>Galerie du club</h3>

              <div className="gallery-upload-panel">
                <input
                  type="text"
                  placeholder="Legende de la photo"
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  maxLength="160"
                />

                <label className="photo-upload-btn">
                  {uploadingGallery ? "Televersement..." : "Ajouter une photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    disabled={uploadingGallery}
                  />
                </label>
              </div>

              {gallery.length === 0 ? (
                <p className="dashboard-message">
                  Aucune photo dans la galerie pour le moment.
                </p>
              ) : (
                <div className="club-gallery-grid dashboard-gallery-grid">
                  {gallery.map((photo) => (
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
              )}
            </section>

            <section className="profile-panel" id="classements">
              <h3>Classements du club</h3>

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
                  {rankingPlayers.map((player, index) => (
                    <div className="ranking-row" key={player.id}>
                      <span className="rank-number">{index + 1}</span>
                      {renderPlayerIdentity(player)}
                      <strong>
                        {Number(player[rankingConfig[rankingTab].field] || 0)}{" "}
                        {rankingConfig[rankingTab].valueLabel}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dashboard-message">
                  Aucun joueur dans l'effectif pour établir un classement.
                </p>
              )}
            </section>

            <section className="profile-panel" id="recherche">
              <h3>Rechercher des joueurs</h3>

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
                <div className="team-player-list">
                  {searchResults.map((player) => (
                    <div className="team-player-card" key={player.id}>
                      {renderPlayerIdentity(player)}

                      <button onClick={() => handleInvitePlayer(player.id)}>
                        Inviter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-panel" id="demandes">
              <h3>Demandes recues</h3>

              {invitations.filter((invitation) => invitation.status === "pending").length === 0 ? (
                <p className="dashboard-message">Aucune demande en attente.</p>
              ) : (
                <div className="team-player-list">
                  {invitations
                    .filter((invitation) => invitation.status === "pending")
                    .map((invitation) => (
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
                              ? "Demande a rejoindre ton club"
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
              <h3>Joueurs de l'équipe</h3>

              {players.length === 0 ? (
                <p className="dashboard-message">
                  Aucun joueur n'a encore indiqué cette équipe.
                </p>
              ) : (
                <div className="team-player-list">
                  {players.map((player) => (
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
                          <p>Role club : {player.club_role || "Joueur"}</p>
                        <p>
                          Buts {player.goals || 0} - Passes{" "}
                          {player.assists || 0} - Cartons {player.cards || 0}
                        </p>
                        </div>
                      </div>

                      <div className="member-actions">
                        <select
                          value={player.club_role || "Joueur"}
                          onChange={(e) => handleRoleChange(player.id, e.target.value)}
                          aria-label={`Role club de ${player.name}`}
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
              )}
            </section>

            <section className="profile-panel" id="anciens">
              <h3>Anciens membres</h3>

              {formerMembers.length === 0 ? (
                <p className="dashboard-message">
                  Aucun ancien membre avec stats enregistrees pour ce club.
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
              <h3>Créer un match</h3>

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

              <h3>Ajuster stats</h3>

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

                <button type="submit">Ajouter stats</button>
              </form>
            </section>

            <form className="danger-zone" id="compte" onSubmit={handleDeleteAccount}>
              <h3>Supprimer mon compte club</h3>
              <p>
                Cette action supprime le compte équipe, le club, ses matchs,
                ses invitations et detache les joueurs de l'effectif.
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

