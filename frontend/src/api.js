import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("terciform_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("terciform_token");
      localStorage.removeItem("terciform_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  return err?.response?.data?.detail || err.message || "Une erreur est survenue.";
}
