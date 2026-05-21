import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import './Chat.css'

export default function Chat() {
  const { bookingId } = useParams()
  const { user }      = useAuth()
  const navigate      = useNavigate()

  const [messages,  setMessages]  = useState([])
  const [text,      setText]      = useState('')
  const [booking,   setBooking]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')

  const bottomRef   = useRef(null)   // auto scroll ke liye
  const pollRef     = useRef(null)   // polling interval store karne ke liye

  // booking info aur messages load karo
  useEffect(() => {
    loadChat()

    // har 4 second pe naye messages check karo (polling)
    // real-time feel deta hai bina socket ke
    pollRef.current = setInterval(fetchMessages, 4000)

    return () => clearInterval(pollRef.current)
  }, [bookingId])

  // jab bhi messages update ho, neeche scroll karo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadChat() {
    try {
      const token = localStorage.getItem('token')
      const [bookRes, msgRes] = await Promise.all([
        axios.get(`/api/bookings/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/chat/${bookingId}`,   { headers: { Authorization: `Bearer ${token}` } })
      ])

      // apni saari bookings mein se current wali dhundho
      const all = [
        ...(bookRes.data.myBookings      || []),
        ...(bookRes.data.incomingBookings || [])
      ]
      const found = all.find(b => b._id === bookingId)
      setBooking(found || null)
      setMessages(msgRes.data.messages || [])
    } catch (err) {
      setError('Chat load nahi ho paya')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMessages() {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(`/api/chat/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages(res.data.messages || [])
    } catch {
      // polling fail ho toh silently ignore karo
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim() || sending) return

    setSending(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `/api/chat/${bookingId}`,
        { text: text.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      // naya message seedha list mein add karo — polling ka wait nahi
      setMessages(prev => [...prev, res.data.message])
      setText('')
    } catch (err) {
      alert(err.response?.data?.message || 'Message nahi gaya, dobara try karo')
    } finally {
      setSending(false)
    }
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    })
  }

  function formatDay(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (d.toDateString() === today.toDateString())     return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // messages ko din ke hisaab se group karo
  function groupByDay(msgs) {
    const groups = {}
    msgs.forEach(m => {
      const day = new Date(m.createdAt).toDateString()
      if (!groups[day]) groups[day] = []
      groups[day].push(m)
    })
    return groups
  }

  if (loading) return <p style={{ padding: '40px 20px', color: '#888' }}>Loading chat...</p>
  if (error)   return <p style={{ padding: '40px 20px', color: 'var(--red)' }}>{error}</p>

  const grouped    = groupByDay(messages)
  const otherPerson = booking
    ? (booking.renter?._id === user?._id ? booking.owner : booking.renter)
    : null

  return (
    <div className="chat-page">

      {/* Top bar */}
      <div className="chat-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back
        </button>
        <div className="chat-info">
          <div className="chat-avatar">
            {otherPerson?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div className="chat-name">{otherPerson?.name || 'User'}</div>
            {booking && (
              <div className="chat-sub">
                {booking.tool?.title} &nbsp;·&nbsp;
                {new Date(booking.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(booking.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </div>
        </div>
        <div className="chat-status-dot" title="Connected"></div>
      </div>

      {/* Messages area */}
      <div className="chat-messages">

        {messages.length === 0 && (
          <div className="chat-empty">
            <p>👋 Abhi tak koi message nahi</p>
            <p>Meetup time aur location discuss karo!</p>
          </div>
        )}

        {Object.entries(grouped).map(([day, msgs]) => (
          <div key={day}>
            {/* din ka separator */}
            <div className="day-divider">
              <span>{formatDay(msgs[0].createdAt)}</span>
            </div>

            {msgs.map(m => {
              const isMine = m.sender?._id === user?._id ||
                             m.sender === user?._id

              return (
                <div
                  key={m._id}
                  className={`msg-row ${isMine ? 'mine' : 'theirs'}`}
                >
                  {!isMine && (
                    <div className="msg-avatar">
                      {m.sender?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="msg-bubble">
                    {!isMine && (
                      <div className="msg-sender">{m.sender?.name}</div>
                    )}
                    <div className="msg-text">{m.text}</div>
                    <div className="msg-time">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* auto scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form className="chat-input-bar" onSubmit={sendMessage}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message likho... (meetup time, location, etc.)"
          className="chat-input"
          autoComplete="off"
          maxLength={500}
        />
        <button
          type="submit"
          className="chat-send"
          disabled={!text.trim() || sending}
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>

    </div>
  )
}