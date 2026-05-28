import axios from "axios";

const TOKEN_KEY = "iv_access";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

let accessToken = localStorage.getItem(TOKEN_KEY) || null;
let refreshing = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          api
            .post("/auth/refresh")
            .then((r) => {
              setAccessToken(r.data.accessToken);
              return r.data.accessToken;
            })
            .finally(() => {
              refreshing = null;
            });
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

// ---------- typed endpoint helpers ----------

export const authApi = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  updateProfile: (patch) => api.patch("/auth/me", patch).then((r) => r.data),
  changePassword: (data) =>
    api.post("/auth/change-password", data).then((r) => r.data),
};

export const cvApi = {
  list: () => api.get("/cvs").then((r) => r.data),
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post("/cvs", fd, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  get: (id) => api.get(`/cvs/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/cvs/${id}`).then((r) => r.data),
};

export const interviewApi = {
  list: () => api.get("/interviews").then((r) => r.data),
  create: (data) => api.post("/interviews", data).then((r) => r.data),
  get: (id) => api.get(`/interviews/${id}`).then((r) => r.data),
  start: (id) => api.post(`/interviews/${id}/start`).then((r) => r.data),
  submitAnswer: (id, data) =>
    api.post(`/interviews/${id}/answers`, data).then((r) => r.data),
  end: (id, data = {}) =>
    api.post(`/interviews/${id}/end`, data).then((r) => r.data),
};

export const reportApi = {
  list: () => api.get("/reports").then((r) => r.data),
  get: (interviewId) =>
    api.get(`/reports/${interviewId}`).then((r) => r.data),
  regenerate: (interviewId) =>
    api.post(`/reports/${interviewId}/regenerate`).then((r) => r.data),
};

export const jobsApi = {
  recommendations: () => api.get("/jobs/recommendations").then((r) => r.data),
  get: (id) => api.get(`/jobs/${id}`).then((r) => r.data),
};
