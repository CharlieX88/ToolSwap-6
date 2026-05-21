import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar     from './components/Navbar'
import Home       from './pages/Home'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import AddTool    from './pages/AddTool'
import MyTools    from './pages/MyTools'
import ToolDetail from './pages/ToolDetail'
import Chat       from './pages/Chat'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ padding: '2rem', color: '#888' }}>Loading...</p>
  if (!user)   return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/tools/:id"     element={<ToolDetail />} />
          <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/add-tool"      element={<PrivateRoute><AddTool /></PrivateRoute>} />
          <Route path="/my-tools"      element={<PrivateRoute><MyTools /></PrivateRoute>} />
          <Route path="/chat/:bookingId" element={<PrivateRoute><Chat /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}