import axios from "axios";
import API_URL from "../config/api";
import requestWithRetry from "./requestWithRetry";

const normalizeTeams = (data) => (Array.isArray(data) ? data : data?.teams || []);

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
          return [];
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
          return [];
        }

        throw fallbackError;
      }
    }
  }, 3, 1000);
