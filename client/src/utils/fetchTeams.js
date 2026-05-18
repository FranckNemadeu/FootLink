import axios from "axios";
import API_URL from "../config/api";
import requestWithRetry from "./requestWithRetry";

const normalizeTeams = (data) => (Array.isArray(data) ? data : data?.teams || []);

const fetchTeamsEndpoint = async (endpoint) => {
  const res = await axios.get(`${API_URL}/api/team/${endpoint}`, {
    params: { _: Date.now() },
    timeout: 45000,
  });

  return normalizeTeams(res.data);
};

const fetchTeamsFromEndpoints = (preferredEndpoint) =>
  requestWithRetry(async () => {
    const endpoints =
      preferredEndpoint === "options" ? ["options", "list"] : ["list", "options"];
    const results = await Promise.allSettled(
      endpoints.map((endpoint) => fetchTeamsEndpoint(endpoint))
    );
    const fulfilledLists = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const nonEmptyList = fulfilledLists.find((teams) => teams.length > 0);

    if (nonEmptyList) return nonEmptyList;
    if (fulfilledLists.length > 0) return fulfilledLists[0];

    const firstError = results.find((result) => result.status === "rejected")?.reason;
    if (results.every((result) => result.reason?.response?.status === 404)) {
      return [];
    }

    throw firstError;
  }, 3, 1500);

export const fetchTeamOptions = () => fetchTeamsFromEndpoints("options");

export const fetchTeamList = () => fetchTeamsFromEndpoints("list");
