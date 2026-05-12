import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import DashboardBottomNav from "../components/DashboardBottomNav";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";

function PlayerDashboard() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const mobileNavItems = [
    { id: "profil", target: "profil", label: "Profil", icon: "P" },
    { id: "stats", target: "stats", label: "Stats", icon: "S" },
    { id: "clubs", target: "clubs", label: "Clubs", icon: "C" },
    { id: "compte", target: "compte", label: "Compte", icon: "!" },
  ];
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState({
    matches: 0,
    goals: 0,
    assists: 0,
    cards: 0,
  });
  const [clubs, setClubs] = useState([]);
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

        const [profileRes, statsRes, clubsRes, invitationsRes] = await Promise.all([
          axios.get(`${API_URL}/api/player`, { headers }),
          axios.get(`${API_URL}/api/player/stats`, { headers }),
          axios.get(`${API_URL}/api/team/list`),
          axios.get(`${API_URL}/api/player/invitations`, { headers }),
        ]);

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

        setStats({
          matches: statsRes.data.matches || 0,
          goals: statsRes.data.goals || 0,
          assists: statsRes.data.assists || 0,
          cards: statsRes.data.cards || 0,
        });

        setClubs(clubsRes.data || []);
        setInvitations(invitationsRes.data || []);
      } catch (err) {
        console.log(err);
        setError("Impossible de charger le profil joueur.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleChangeClub = async () => {
    if (!selectedClub) {
      showNotice("error", "Selectionne un club avant d'envoyer la demande.");
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
      showNotice("success", res.data.message || "Demande envoyee au club.");
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
      showNotice("success", "Profil mis a jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de mettre a jour le profil."
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
      showNotice("success", "Photo de profil mise a jour.");
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

      showNotice("success", res.data.message || "Invitation mise a jour.");
    } catch (err) {
      console.log(err);
      showNotice(
        "error",
        err.response?.data?.message || "Impossible de repondre a l'invitation."
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

      logout("Ton compte joueur a ete supprime.");
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
          <button type="button" onClick={() => scrollToSection("profil")}>
            Profil
          </button>
          <button type="button" onClick={() => scrollToSection("stats")}>
            Stats
          </button>
          <button onClick={handleLogout}>Deconnexion</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <section className="dashboard-header">
          <div>
            <p className="dashboard-label">Dashboard Joueur</p>
            <h2>Bienvenue {user.name || "joueur"}</h2>
          </div>

          <span className="player-status">Connecte</span>
        </section>

        {loading && <p className="dashboard-message">Chargement du profil...</p>}

        {error && <p className="dashboard-error">{error}</p>}

        {notice && (
          <p className={`dashboard-notice dashboard-notice-${notice.type}`}>
            {notice.message}
          </p>
        )}

        {!loading && !error && (
          <div className="dashboard-grid">
            <section className="profile-panel" id="profil">
              <h3>Infos profil</h3>

              {player ? (
                <div>
                  <div className="profile-photo-section">
                    <div className="profile-photo">
                      {player.profile_photo ? (
                        <img
                          src={`${API_URL}${player.profile_photo}`}
                          alt="Profil joueur"
                        />
                      ) : (
                        <span>{(user.name || "J").charAt(0)}</span>
                      )}
                    </div>

                    <div className="profile-identity">
                      <h4>{user.name || "Joueur"}</h4>
                      <p>{player.team_name || "Sans club"}</p>

                      <label className="photo-upload-btn">
                        {uploadingPhoto ? "Televersement..." : "Changer la photo"}
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
                      {player.position || "Non renseigne"}
                    </p>
                    <p>
                      <span>Age</span>
                      {player.age || "Non renseigne"}
                    </p>
                    <p>
                      <span>Ville</span>
                      {player.city || "Non renseignee"}
                    </p>
                    <p>
                      <span>Taille</span>
                      {player.height || "Non renseignee"}
                    </p>
                    <p>
                      <span>Pied fort</span>
                      {player.preferred_foot || "Non renseigne"}
                    </p>
                    <p>
                      <span>Club</span>
                      {player.team_name || "Aucun"}
                    </p>
                    <p className="profile-bio">
                      <span>Bio</span>
                      {player.bio || "Aucune bio pour le moment."}
                    </p>

                    <div className="club-change-section" id="clubs">
                      <h4>Changer de club</h4>
                      <div className="club-selection">
                        <select
                          value={selectedClub}
                          onChange={(e) => setSelectedClub(e.target.value)}
                          disabled={clubLoading}
                        >
                          <option value="">-- Selectionne un club --</option>
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
                          {clubLoading ? "Envoi..." : "Demander a rejoindre"}
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
                      <h4>Modifier mon profil</h4>

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
                <p className="dashboard-message">
                  Aucun profil joueur trouve pour ce compte.
                </p>
              )}
            </section>

            <section className="stats-panel" id="stats">
              <h3>Stats</h3>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Matchs</span>
                  <strong>{stats.matches}</strong>
                </div>
                <div className="stat-card">
                  <span>Buts</span>
                  <strong>{stats.goals}</strong>
                </div>
                <div className="stat-card">
                  <span>Passes</span>
                  <strong>{stats.assists}</strong>
                </div>
                <div className="stat-card">
                  <span>Cartons</span>
                  <strong>{stats.cards}</strong>
                </div>
              </div>

              <div className="invitations-panel">
                <h3>Invitations</h3>

                {invitations.length === 0 ? (
                  <p className="dashboard-message">Aucune invitation en attente.</p>
                ) : (
                  <div className="team-player-list">
                    {invitations.map((invitation) => (
                      <div className="team-player-card" key={invitation.id}>
                        <div>
                          <h4>{invitation.team_name}</h4>
                          <p>
                            {invitation.city || "Ville inconnue"} -{" "}
                            {invitation.level || "Niveau non renseigne"}
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
                  et tes invitations. Elle est definitive.
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
    </div>
  );
}

export default PlayerDashboard;

