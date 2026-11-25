import axios from 'axios'

const DEV_OMNI_TOKEN = 'dev-omni-admin-token-2026'

const request = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '',
    timeout: 15000
})

request.interceptors.request.use(config => {
    const token = localStorage.getItem('token') || DEV_OMNI_TOKEN
    config.headers.Authorization = `Bearer ${token}`
    return config
})

request.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        }
        return Promise.reject(error)
    }
)

export function getErrorMessage(error, fallback = '请求失败，请稍后重试') {
    return error?.response?.data?.message || error?.message || fallback
}

export default request