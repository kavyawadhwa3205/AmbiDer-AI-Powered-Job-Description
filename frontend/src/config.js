const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
  (import.meta && import.meta.env && import.meta.env.VITE_API_URL) ||
  '/api';

export default API_BASE_URL;
