import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate }       from 'react-router-dom'
import { io }                           from 'socket.io-client'
import axios                            from 'axios'
import { useAuth }                      from '../context/AuthContext'
import './Chat.css'

// Backend ka URL — same jahan API chal rahi hai
const SOCKET_URL = 'http://localhost:5000'

export default function Chat() {
  const { bookingId } = useParams()
  const { user }      = useAuth()
  const navigate      = useNavigate()

  const [messages,    setMessages]    = useState([])
  const [text,        setText]        = useState('')
  const [booking,     setBooking]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState('')
  const [connected,   setConnected]   = useState(false)
  const [typingUser,  setTypingUser]  = useState(null) // kaun type kar raha hai
  const [showReview,  setShowReview]  = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)

  const bottomRef    = useRef(null)
  const socketRef    = useRef(null)  // socket instance store karne ke liye
  const typingTimer  = useRef(null)  // typing timeout ke liye

  // ── Socket setup ────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')

    // Socket.io server se connect karo
    // auth.token = server ka middleware isko verify karega
    const socket = io(SOCKET_URL, {
      auth: { token }
    })
    socketRef.current = socket

    // Connection events
    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // Is booking ki room mein ghuso
    socket.emit('join-room', { bookingId })

    // Naya message aaya — turant state mein add karo
    socket.on('receive-message', (newMsg) => {
      setMessages(prev => {
        // duplicate check — khud ka message pehle se add ho sakta hai
        const exists = prev.some(m => m._id === newMsg._id)
        if (exists) return prev
        return [...prev, newMsg]
      })
    })

    // Typing indicator events
    socket.on('user-typing',      ({ name }) => setTypingUser(name))
    socket.on('user-stop-typing', ()         => setTypingUser(null))

    // Cleanup — component band ho toh socket disconnect karo
    return () => {
      socket.disconnect()
    }
  }, [bookingId])

  // ── Initial data load ────────────────────────────────────────
  useEffect(() => {
    loadChat()
  }, [bookingId])

  // ── Auto scroll ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUser])

  async function loadChat() {
    try {
      const token = localStorage.getItem('token')
      const [bookRes, msgRes, reviewRes] = await Promise.all([
        axios.get('/api/bookings/dashboard',        { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/chat/${bookingId}`,          { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/reviews/check/${bookingId}`, { headers: { Authorization: `Bearer ${token}` } })
      ])

      const all   = [...(bookRes.data.myBookings || []), ...(bookRes.data.incomingBookings || [])]
      const found = all.find(b => b._id === bookingId)
      setBooking(found || null)
      setMessages(msgRes.data.messages || [])
      setHasReviewed(reviewRes.data.hasReviewed)

      // Agar booking completed hai aur review nahi diya → form dikhao
      if (found?.status === 'completed' && !reviewRes.data.hasReviewed) {
        // sirf renter ko dikhao
        if (found.renter?._id === user?._id) setShowReview(true)
      }
    } catch {
      setError('Chat load nahi ho paya')
    } finally {
      setLoading(false)
    }
  }

  // ── Message send ─────────────────────────────────────────────
  function sendMessage(e) {
    e.preventDefault()
    if (!text.trim() || sending || !socketRef.current) return

    setSending(true)

    // Socket se bhejo — HTTP request nahi
    socketRef.current.emit('send-message', {
      bookingId,
      text: text.trim()
    })

    // Typing indicator band karo
    socketRef.current.emit('stop-typing', { bookingId })
    clearTimeout(typingTimer.current)
    setTypingUser(null)

    setText('')
    setSending(false)
  }

  // ── Typing indicator ─────────────────────────────────────────
  function handleTyping(e) {
    setText(e.target.value)

    if (!socketRef.current) return

    // Typing shuru — server ko batao
    socketRef.current.emit('typing', { bookingId })

    // 2 sec baad koi type nahi kiya toh stop-typing
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('stop-typing', { bookingId })
    }, 2000)
  }

  // ── Helpers ──────────────────────────────────────────────────
  function formatTime(d) {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }
  function formatDay(d) {
    const date      = new Date(d)
    const today     = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString())     return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  function groupByDay(msgs) {
    const g = {}
    msgs.forEach(m => {
      const k = new Date(m.createdAt).toDateString()
      if (!g[k]) g[k] = []
      g[k].push(m)
    })
    return g
  }

  if (loading) return <p style={{ padding: '40px 20px', color: '#888' }}>Loading chat...</p>
  if (error)   return <p style={{ padding: '40px 20px', color: 'var(--red)' }}>{error}</p>

  const grouped     = groupByDay(messages)
  const isRenter    = booking?.renter?._id === user?._id
  const otherPerson = isRenter ? booking?.owner : booking?.renter

  return (
    <div className="chat-page">

      {/* ── Review Modal ── */}
      {showReview && (
        <ReviewForm
          bookingId={bookingId}
          onDone={() => { setShowReview(false); setHasReviewed(true) }}
          onSkip={() => setShowReview(false)}
        />
      )}

      {/* ── Top bar ── */}
      <div className="chat-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Back</button>
        <div className="chat-info">
          <div className="chat-avatar">{otherPerson?.name?.charAt(0).toUpperCase() || '?'}</div>
          <div>
            <div className="chat-name">{otherPerson?.name || 'User'}</div>
            {booking && (
              <div className="chat-sub">
                {booking.tool?.title} &nbsp;·&nbsp;
                {new Date(booking.startDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
                {' – '}
                {new Date(booking.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          {/* review button — completed booking, renter, review nahi diya */}
          {booking?.status === 'completed' && isRenter && !hasReviewed && (
            <button className="btn-review-top" onClick={() => setShowReview(true)}>
              ⭐ Rate Tool
            </button>
          )}
          {/* connection status dot */}
          <div
            className="chat-status-dot"
            style={{ background: connected ? 'var(--green)' : '#999' }}
            title={connected ? 'Connected' : 'Connecting...'}
          />
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>👋 No messages yet</p>
            <p>Discuss the meetup time and location!</p>
          </div>
        )}

        {Object.entries(grouped).map(([day, msgs]) => (
          <div key={day}>
            <div className="day-divider">
              <span>{formatDay(msgs[0].createdAt)}</span>
            </div>
            {msgs.map(m => {
              const isMine = m.sender?._id?.toString() === user?._id ||
                             m.sender?._id             === user?._id
              return (
                <div key={m._id} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                  {!isMine && (
                    <div className="msg-avatar">{m.sender?.name?.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="msg-bubble">
                    {!isMine && <div className="msg-sender">{m.sender?.name}</div>}
                    <div className="msg-text">{m.text}</div>
                    <div className="msg-time">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUser && (
          <div className="msg-row theirs">
            <div className="msg-avatar">{typingUser.charAt(0).toUpperCase()}</div>
            <div className="typing-bubble">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form className="chat-input-bar" onSubmit={sendMessage}>
        <input
          type="text"
          value={text}
          onChange={handleTyping}
          placeholder="Type your Message..."
          className="chat-input"
          autoComplete="off"
          maxLength={500}
        />
        <button type="submit" className="chat-send" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  )
}

// ── Review Form Component ────────────────────────────────────────
function ReviewForm({ bookingId, onDone, onSkip }) {
  const [rating,   setRating]   = useState(0)
  const [hover,    setHover]    = useState(0)
  const [comment,  setComment]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function submitReview() {
    if (!rating) return setError('Select the Rating')
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post('/api/reviews',
        { bookingId, rating, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      onDone()
    } catch (err) {
      setError(err.response?.data?.message || 'Review not submitted')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="review-modal card">
        <h3>⭐ Rate this tool</h3>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '6px 0 16px' }}>
        "Booking has been completed! How was the tool?"
        </p>

        {/* Star Rating */}
        <div className="stars-row">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`star-btn ${star <= (hover || rating) ? 'active' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="rating-label">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </p>
        )}

        <textarea
          className="review-textarea"
          placeholder="Want to add anything? (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={300}
        />

        {error && <p style={{ color: 'var(--red)', fontSize: '12px' }}>{error}</p>}

        <div className="review-actions">
          <button className="btn btn-outline" onClick={onSkip}>Skip</button>
          <button
            className="btn btn-primary"
            onClick={submitReview}
            disabled={loading || !rating}
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}