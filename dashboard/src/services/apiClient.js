import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export const getSpatialData = (filters = {}) =>
  apiClient.get('/api/v1/admin/spatial-data', { params: filters }).then((r) => r.data);

export const getModalSplit = () =>
  apiClient.get('/api/v1/admin/modal-split').then((r) => r.data);

export const getTripChains = (userId) =>
  apiClient
    .get('/api/v1/admin/trip-chains', { params: { user_id: userId } })
    .then((r) => r.data);

export const exportData = (format, filters = {}) =>
  apiClient
    .get('/api/v1/admin/export', {
      params: { format, ...filters },
      responseType: 'blob',
    })
    .then((r) => r.data);

export default apiClient;
