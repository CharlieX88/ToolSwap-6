import { useState }          from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios                 from 'axios'
import { useAuth }           from '../context/AuthContext'
import './Auth.css'

const UNIVERSITY_DOMAIN = 'chitkara.edu.in'

export default function Register() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  // step 1 = form, step 2 = OTP
  const [step,    setStep]    = useState(1)
  const [email,   setEmail]   = useState('')  // save for step 2

  // Step 1 form
  const [form,    setForm]    = useState({ name: '', email: '', password: '', phone: '', city: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // Step 2 OTP
  const [otp,         setOtp]         = useState('')
  const [otpError,    setOtpError]    = useState('')
  const [otpLoading,  setOtpLoading]  = useState(false)
  const [resendMsg,   setResendMsg]   = useState('')
  const [resendTimer, setResendTimer] = useState(0)  // cooldown

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (e.target.name === 'email') setError('')
  }

  function handleEmailBlur() {
    if (form.email && !form.email.toLowerCase().endsWith(`@${UNIVERSITY_DOMAIN}`)) {
      setError(`Only @${UNIVERSITY_DOMAIN} emails are allowed`)
    } else {
      setError('')
    }
  }

  // ── Step 1: Register → send OTP ──────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    setError('')

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
      await axios.post('/api/auth/register', form)
      setEmail(form.email)
      setStep(2)          // show OTP screen
      startResendTimer()
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP ───────────────────────────────
  async function handleVerifyOtp(e) {
    e.preventDefault()
    setOtpError('')

    if (otp.length !== 6) {
      setOtpError('Please enter the 6-digit OTP')
      return
    }

    setOtpLoading(true)
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp })
      login(res.data.user, res.data.token)  // directly log in
      navigate('/dashboard')
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Resend OTP with 30 sec cooldown ──────────────────────
  function startResendTimer() {
    setResendTimer(30)
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleResend() {
    setResendMsg('')
    setOtpError('')
    try {
      await axios.post('/api/auth/resend-otp', { email })
      setResendMsg('New OTP sent! Check your inbox.')
      startResendTimer()
    } catch {
      setOtpError('Could not resend OTP. Try again.')
    }
  }

  // ── Step 1 UI ─────────────────────────────────────────────
  if (step === 1) return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-top">
          <div className="auth-icon">🔧</div>
          <h2>Create account</h2>
          <p>Only university students can join</p>
        </div>

        <div className="domain-notice">
          🎓 Only <strong>@{UNIVERSITY_DOMAIN}</strong> email addresses can register
        </div>

        <form onSubmit={handleRegister}>
          <div className="field">
            <label>Full Name</label>
            <input
              name="name"
              placeholder="Enter your name"
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
            {loading ? 'Sending OTP...' : 'Send OTP to Email'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )

  // ── Step 2 UI — OTP Screen ────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-top">
          <div className="auth-icon">📬</div>
          <h2>Verify your email</h2>
          <p>OTP sent to <strong>{email}</strong></p>
        </div>

        <div className="otp-notice">
          Check your university inbox — a 6-digit code has been sent. Also check the spam folder.
        </div>

        <form onSubmit={handleVerifyOtp}>
          <div className="field">
            <label>Enter OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              value={otp}
              onChange={e => {
                setOtp(e.target.value.replace(/\D/g, ''))  // only numbers
                setOtpError('')
              }}
              className="otp-input"
              required
            />
          </div>

          {otpError  && <p className="error-msg">{otpError}</p>}
          {resendMsg && <p className="success-msg">{resendMsg}</p>}

          <button type="submit" className="btn btn-primary full-btn" disabled={otpLoading}>
            {otpLoading ? 'Verifying...' : 'Verify & Create Account'}
          </button>
        </form>

        <div className="resend-row">
          <span>Didn’t receive the OTP?</span>
          {resendTimer > 0
            ? <span className="resend-timer">Resend in {resendTimer}s</span>
            : <button className="resend-btn" onClick={handleResend}>Resend OTP</button>
          }
        </div>

        <button className="back-link" onClick={() => { setStep(1); setOtp(''); setOtpError('') }}>
          ← Change email
        </button>
      </div>
    </div>
  )
}