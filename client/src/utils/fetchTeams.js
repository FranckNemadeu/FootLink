import axios from "axios";
import API_URL from "../config/api";
import requestWithRetry from "./requestWithRetry";

const normalizeTeams = (data) => (Array.isArray(data) ? data : data?.teams || []);

const buildTeamsFromPlayers = (players = []) => {
  const teamsByName = new Map();

  players.forEach((player) => {
    const teamName = player.team_name || player.club;
    if (!teamName) return;

    const current = teamsByName.get(teamName) || {
      id: null,
      team_name: teamName,
      city: player.city || "Ville inconnue",
      level: "Club actif",
      category: "",
      player_count: 0,
      logo_photo: null,
      goals: 0,
      assists: 0,
      matches: 0,
    };

    current.player_count += 1;
    current.goals += Number(player.goals) || 0;
    current.assists += Number(player.assists) || 0;
    current.matches += Number(player.matches) || 0;
    teamsByName.set(teamName, current);
  });

  return [...teamsByName.values()].sort((a, b) =>
    a.team_name.localeCompare(b.team_name)
  );
};

const fetchTeamsFromPlayers = async () => {
  const res = await axios.get(`${API_URL}/api/player/public/featured?limit=50`, {
    timeout: 15000,
  });

  return buildTeamsFromPlayers(res.data || []);
};

export const fetchTeamOptions = () =>
  requestWithRetry(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/team/options`, {
        timeout: 15000,
      });

      return normalizeTeams(res.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      try {
        const fallbackRes = await axios.get(`${API_URL}/api/team/list`, {
          timeout: 15000,
        });

        return normalizeTeams(fallbackRes.data);
      } catch (fallbackError) {
        if (fallbackError.response?.status === 404) {
          return fetchTeamsFromPlayers();
        }

        throw fallbackError;
      }
    }
  }, 3, 1000);

export const fetchTeamList = () =>
  requestWithRetry(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/team/list`, {
        timeout: 20000,
      });

      return normalizeTeams(res.data);
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }

      try {
        const fallbackRes = await axios.get(`${API_URL}/api/team/options`, {
          timeout: 15000,
        });

        return normalizeTeams(fallbackRes.data);
      } catch (fallbackError) {
        if (fallbackError.response?.status === 404) {
          return fetchTeamsFromPlayers();
        }

        throw fallbackError;
      }
    }
  }, 3, 1000);
