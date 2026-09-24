import axios from 'axios'
import { clearStoredToken, getStoredToken } from './authStorage.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getStoredToken()) {
      clearStoredToken()
      window.dispatchEvent(new Event('uacms:auth-expired'))
    }
    return Promise.reject(error)
  }
)

export default api
