import { useState }          from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios                 from 'axios'
import { useAuth }           from '../context/AuthContext'
import './Auth.css'

// apna university domain yahan daalo
const UNIVERSITY_DOMAIN = 'chitkara.edu.in'

export default function Register() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [form,    setForm]    = useState({ name: '', email: '', password: '', phone: '', city: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    // email type karte waqt error clear karo
    if (e.target.name === 'email') setError('')
  }

  // email field se focus hatne pe check karo
  function handleEmailBlur() {
    if (form.email && !form.email.toLowerCase().endsWith(`@${UNIVERSITY_DOMAIN}`)) {
      setError(`Only @${UNIVERSITY_DOMAIN} emails are allowed`)
    } else {
      setError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // frontend pe pehle check karo — server tak jaane ki zarurat hi nahi
    if (!form.email.toLowerCase().endsWith(`@${UNIVERSITY_DOMAIN}`)) {
      setError(`Only @${UNIVERSITY_DOMAIN} emails are allowed`)
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post('/api/auth/register', form)
      login(res.data.user, res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">

        <div className="auth-top">
          <div className="auth-icon">🔧</div>
          <h2>Create account</h2>
          <p>Only university students can join</p>
        </div>

        {/* university restriction notice */}
        <div className="domain-notice">
          🎓 Registration is restricted to <strong>@{UNIVERSITY_DOMAIN}</strong> email addresses only
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full Name</label>
            <input
              name="name"
              placeholder="Enter Your Name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="field">
            <label>University Email</label>
            <input
              type="email"
              name="email"
              placeholder={`you@${UNIVERSITY_DOMAIN}`}
              value={form.email}
              onChange={handleChange}
              onBlur={handleEmailBlur}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="two-col">
            <div className="field">
              <label>Phone</label>
              <input
                name="phone"
                placeholder="+91 98765..."
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label>City</label>
              <input
                name="city"
                placeholder="Chandigarh"
                value={form.city}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn btn-primary full-btn" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}