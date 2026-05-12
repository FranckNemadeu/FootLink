import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";

function TeamDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [matches, setMatches] = useState([]);
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
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
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
            src={`${API_URL}${player.profile_photo}`}
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
        <p>Club actuel : {player.team_name || "Aucun"}</p>
      </div>
    </div>
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

      const [playersRes, invitationsRes, matchesRes] = await Promise.all([
        axios.get(`${API_URL}/api/team/players`, { headers }),
        axios.get(`${API_URL}/api/team/invitations`, { headers }),
        axios.get(`${API_URL}/api/team/matches`, { headers }),
      ]);

      setTeam(playersRes.data.team);
      setPlayers(playersRes.data.players);
      setInvitations(invitationsRes.data);
      setMatches(matchesRes.data);
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Impossible de charger l'equipe.");
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

      showNotice("success", "Invitation envoyee au joueur.");
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
      showNotice("success", "Joueur retire de l'equipe.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de retirer le joueur."
      );
    }
  };

  const handleStatsSubmit = async (e) => {
    e.preventDefault();

    if (!statsForm.playerId || !statsForm.matchId) {
      showNotice("error", "Selectionne un joueur et un match avant d'ajouter les stats.");
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
      showNotice("success", "Match cree.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de creer le match."
      );
    }
  };

  return (
    <div className="dashboard-page">
      <nav className="dashboard-navbar">
        <BrandLogo />

        <div className="dashboard-nav-links">
          <Link to="/">Accueil</Link>
          <button type="button" onClick={() => scrollToSection("recherche")}>
            Recherche
          </button>
          <button type="button" onClick={() => scrollToSection("joueurs")}>
            Joueurs
          </button>
          <button type="button" onClick={() => scrollToSection("matchs")}>
            Matchs
          </button>
          <button onClick={handleLogout}>Deconnexion</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <section className="dashboard-header">
          <div>
            <p className="dashboard-label">Dashboard Equipe</p>
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
              <h3>Identite du club</h3>

              <div className="profile-photo-section">
                <div className="profile-photo club-logo-photo">
                  {team?.logo_photo ? (
                    <img src={`${API_URL}${team.logo_photo}`} alt="Logo du club" />
                  ) : (
                    <span>{(team?.team_name || user?.name || "C").charAt(0)}</span>
                  )}
                </div>

                <div className="profile-identity">
                  <h4>{team?.team_name || user?.name || "Club"}</h4>
                  <p>{team?.city || "Ville non renseignee"}</p>

                  <label className="photo-upload-btn">
                    {uploadingLogo ? "Televersement..." : "Changer le logo"}
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
                                src={`${API_URL}${invitation.profile_photo}`}
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
                              : "Invitation envoyee par ton club"}
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
              <h3>Joueurs de l'equipe</h3>

              {players.length === 0 ? (
                <p className="dashboard-message">
                  Aucun joueur n'a encore indique cette equipe.
                </p>
              ) : (
                <div className="team-player-list">
                  {players.map((player) => (
                    <div className="team-player-card" key={player.id}>
                      <div className="player-card-main">
                        <div className="mini-avatar">
                          {player.profile_photo ? (
                            <img
                              src={`${API_URL}${player.profile_photo}`}
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
                        <p>
                          Buts {player.goals || 0} - Passes{" "}
                          {player.assists || 0} - Cartons {player.cards || 0}
                        </p>
                        </div>
                      </div>

                      <button onClick={() => handleRemovePlayer(player.id)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="stats-panel" id="matchs">
              <h3>Creer un match</h3>

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

                <button type="submit">Creer match</button>
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
          </div>
        )}
      </main>
    </div>
  );
}

export default TeamDashboard;

