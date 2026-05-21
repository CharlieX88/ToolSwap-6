import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="container nav-inner">

        <Link to="/" className="nav-logo">
          🔧 Tool<span>Swap</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          {user && (
            <>
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
              <Link to="/my-tools"  className="nav-link">My Tools</Link>
            </>
          )}
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <Link to="/add-tool" className="btn btn-primary">+ Add Tool</Link>
              <span className="nav-user">Hi, {user.name.split(' ')[0]}</span>
              <button onClick={handleLogout} className="btn btn-outline">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login"    className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary">Sign Up</Link>
            </>
          )}
        </div>

      </div>
    </nav>
  )
}