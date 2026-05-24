import React    from 'react'
import ReactDOM from 'react-dom/client'
import axios    from 'axios'
axios.defaults.baseURL = import.meta.env.VITE_API_URL
import App      from './App.jsx'
import './index.css'

// yeh interceptor app load hote hi ek baar register ho jaata hai
// ab har axios request pe automatically token lagega
// chahe page fresh reload ho ya koi bhi component call kare
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)