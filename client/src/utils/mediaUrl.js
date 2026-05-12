import API_URL from "../config/api";

const getMediaUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${API_URL}${path}`;
};

export default getMediaUrl;
