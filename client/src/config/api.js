const isLocalhost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

const API_URL =
  process.env.REACT_APP_API_URL ||
  (isLocalhost ? "http://localhost:5000" : "https://footlink.onrender.com");

export default API_URL;
