import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const STATUS_COLOR = {
  pending:   'orange',
  confirmed: 'green',
  paid:      'blue',
  delivered: 'purple',
  completed: 'teal',
  disputed:  'red',
  cancelled: 'red',
  refunded:  'gray'
}

// Status ke baad kya hota hai — user ko guide karne ke liye
const STATUS_HINT = {
  pending:   'Wait until it gets accepted',
  confirmed: 'Chat with the owner, then make the payment',
  paid:      'Owner will deliver the tool',
  delivered: 'Confirm once you receive the tool',
  completed: 'Transaction completed',
  disputed:  'Admin is reviewing the dispute',
  cancelled: 'Request has been cancelled',
  refunded:  'Refund has been processed'
}

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script    = document.createElement('script')
    script.src      = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload   = () => resolve(true)
    script.onerror  = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [stats,         setStats]         = useState(null)
  const [rented,        setRented]        = useState([])
  const [incoming,      setIncoming]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [activeTab,     setActiveTab]     = useState('rented')
  const [payingId,      setPayingId]      = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [disputeModal,  setDisputeModal]  = useState(null)
  const [disputeReason, setDisputeReason] = useState('')

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    try {
      const token = localStorage.getItem('token')
      const res   = await axios.get('/api/bookings/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setStats(res.data.stats)
      setRented(res.data.myBookings)
      setIncoming(res.data.incomingBookings)
    } catch {
      setError('Unable to load the Dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Owner: accept ya reject
  async function handleStatus(bookingId, newStatus) {
    setActionLoading(bookingId + newStatus)
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `/api/bookings/${bookingId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setIncoming(prev =>
        prev.map(b => b._id === bookingId ? { ...b, status: newStatus } : b)
      )
      setStats(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests - 1,
        activeBookings:  newStatus === 'confirmed' ? prev.activeBookings + 1 : prev.activeBookings
      }))
    } catch {
      alert('Status not updated')
    } finally {
      setActionLoading(null)
    }
  }

  // Renter: Razorpay checkout kholo
  async function handlePayment(booking) {
    setPayingId(booking._id)
    try {
      const loaded = await loadRazorpay()
      if (!loaded) {
        alert('Unable to load the Razorpay. Check your Internet.')
        setPayingId(null)
        return
      }

      const token = localStorage.getItem('token')

      // Step 1 — Backend se order create karo
      // Amount yahan se aata hai — frontend se nahi — fraud proof
      const { data } = await axios.post(
        '/api/payment/create-order',
        { bookingId: booking._id },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Step 2 — Razorpay popup options
      const options = {
        key:         data.keyId,          // public key — safe to expose
        amount:      data.amount,         // paise mein (rupees × 100)
        currency:    data.currency,
        name:        'ToolSwap',
        description: `${booking.tool?.title} — ${booking.totalDays} day${booking.totalDays > 1 ? 's' : ''}`,
        order_id:    data.orderId,

        // Step 3 — Payment hone ke baad backend pe verify karo
        handler: async (response) => {
          try {
            await axios.post('/api/payment/verify', {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingId:         booking._id
            }, { headers: { Authorization: `Bearer ${token}` } })

            setRented(prev =>
              prev.map(b => b._id === booking._id ? { ...b, status: 'paid' } : b)
            )
            alert('Payment successful! The owner will deliver the tool.')
          } catch {
          alert('Payment verification failed. If the money has been deducted, please contact the admin.')
        }
        },

        modal:   { ondismiss: () => setPayingId(null) },
        prefill: { name: user?.name, email: user?.email },
        theme:   { color: '#f97316' }
      }

      const rzp = new window.Razorpay(options)

      // Payment fail hone pe
      rzp.on('payment.failed', () => {
        alert('Payment failed. Please try again.')
        setPayingId(null)
      })

      rzp.open()
    } catch (err) {
      alert(err.response?.data?.message || 'Payment could not be initiated.')
      setPayingId(null)
    }
  }

  // Owner: tool de diya
  async function handleMarkDelivered(bookingId) {
    setActionLoading(bookingId + 'deliver')
    try {
      const token = localStorage.getItem('token')
      await axios.post('/api/payment/mark-delivered',
        { bookingId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setIncoming(prev =>
        prev.map(b => b._id === bookingId ? { ...b, status: 'delivered' } : b)
      )
    } catch (err) {
      alert(err.response?.data?.message || 'Error')
    } finally {
      setActionLoading(null)
    }
  }

  // Renter: tool mila — transaction complete
  async function handleConfirmReceipt(bookingId) {
    setActionLoading(bookingId + 'receipt')
    try {
      const token = localStorage.getItem('token')
      await axios.post('/api/payment/confirm-receipt',
        { bookingId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setRented(prev =>
        prev.map(b => b._id === bookingId ? { ...b, status: 'completed' } : b)
      )
    } catch (err) {
      alert(err.response?.data?.message || 'Error')
    } finally {
      setActionLoading(null)
    }
  }

  // Renter: tool nahi mila — dispute
  async function handleDispute() {
    if (!disputeReason.trim()) return alert('Tell the Reason')
    setActionLoading('dispute')
    try {
      const token = localStorage.getItem('token')
      await axios.post('/api/payment/dispute',
        { bookingId: disputeModal, reason: disputeReason },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setRented(prev =>
        prev.map(b => b._id === disputeModal ? { ...b, status: 'disputed' } : b)
      )
      setDisputeModal(null)
      setDisputeReason('')
      alert('Dispute has been registered. Admin will review it.')
    } catch (err) {
      alert(err.response?.data?.message || 'Dispute could not be submitted.')
    } finally {
      setActionLoading(null)
    }
  }

  function handleLogout() { logout(); navigate('/') }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  // Chat kab available hai — confirmed se aage sab mein
  function canChat(status) {
    return ['confirmed', 'paid', 'delivered', 'completed'].includes(status)
  }

  if (loading) return <p style={{ padding: '40px 20px', color: '#888' }}>Loading...</p>
  if (error)   return <p style={{ padding: '40px 20px', color: 'var(--red)' }}>{error}</p>

  return (
    <div className="dashboard container">

      {/* ── Dispute Modal ── */}
      {disputeModal && (
        <div className="modal-overlay">
          <div className="modal-box card">
            <h3>🚨 Raise a Dispute</h3>
            <p className="modal-sub">
            Payment has been completed but the tool was not received ? Explain the reason — the admin will process the refund.
            </p>
            <textarea
              className="dispute-input"
              placeholder="Explain in detail what happened — the owner did not respond, did not deliver the tool, etc."
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              rows={4}
            />
            <div className="modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => { setDisputeModal(null); setDisputeReason('') }}
              >
                Cancel
              </button>
              <button
                className="btn-dispute-submit"
                onClick={handleDispute}
                disabled={actionLoading === 'dispute'}
              >
                {actionLoading === 'dispute' ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.name}</p>
        </div>
        <div className="dash-header-right">
          <div className="user-chip">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.city || user?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline">Logout</button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">📦</div>
          <div className="stat-val">{stats?.totalRented ?? 0}</div>
          <div className="stat-lbl">Tools Rented</div>
        </div>
        <div className="stat-card card green">
          <div className="stat-icon">✅</div>
          <div className="stat-val">{stats?.activeBookings ?? 0}</div>
          <div className="stat-lbl">Active Bookings</div>
        </div>
        <div className="stat-card card orange">
          <div className="stat-icon">⏳</div>
          <div className="stat-val">{stats?.pendingRequests ?? 0}</div>
          <div className="stat-lbl">Pending Requests</div>
        </div>
        <div className="stat-card card blue">
          <div className="stat-icon">🔧</div>
          <div className="stat-val">{stats?.myListings ?? 0}</div>
          <div className="stat-lbl">My Listings</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'rented' ? 'active' : ''}`}
          onClick={() => setActiveTab('rented')}
        >
          Tools I Rented ({rented.length})
        </button>
        <button
          className={`tab ${activeTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming Requests ({incoming.length})
          {stats?.pendingRequests > 0 && (
            <span className="pending-dot">{stats.pendingRequests}</span>
          )}
        </button>
      </div>

      <div className="table-wrap card">

        {/* ══ RENTED TAB ══ */}
        {activeTab === 'rented' && (
          rented.length === 0
            ? <p className="no-data">Tool is not rented till now...</p>
            : <table>
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Owner</th>
                    <th>Dates</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Next Step</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rented.map(b => (
                    <tr key={b._id}>
                      <td className="bold">{b.tool?.title}</td>
                      <td>{b.owner?.name}</td>
                      <td className="muted">
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                      </td>
                      <td className="price">₹{b.totalPrice}</td>
                      <td>
                        <span className={`badge ${STATUS_COLOR[b.status] || 'gray'}`}>
                          {b.status}
                        </span>
                      </td>
                      {/* next step hint — user ko guide karta hai */}
                      <td className="hint-text">
                        {STATUS_HINT[b.status] || ''}
                      </td>
                      <td>
                        <div className="action-btns">

                          {/* confirmed → Chat + Pay Now dono */}
                          {b.status === 'confirmed' && (
                            <>
                              <button
                                className="btn-chat"
                                onClick={() => navigate(`/chat/${b._id}`)}
                              >
                                💬 Chat
                              </button>
                              <button
                                className="btn-pay"
                                onClick={() => handlePayment(b)}
                                disabled={payingId === b._id}
                              >
                                {payingId === b._id ? '...' : '💳 Pay Now'}
                              </button>
                            </>
                          )}

                          {/* paid → Chat */}
                          {b.status === 'paid' && (
                            <>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                              {/* agar owner ne kuch nahi kiya → dispute */}
                              <button
                                className="btn-dispute"
                                onClick={() => setDisputeModal(b._id)}
                              >
                                🚨 Issue?
                              </button>
                            </>
                          )}

                          {/* delivered → confirm + chat */}
                          {b.status === 'delivered' && (
                            <>
                              <button
                                className="btn-accept"
                                onClick={() => handleConfirmReceipt(b._id)}
                                disabled={actionLoading === b._id + 'receipt'}
                              >
                                {actionLoading === b._id + 'receipt' ? '...' : '✓ Got Tool'}
                              </button>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                            </>
                          )}

                          {/* completed → chat still open */}
                          {b.status === 'completed' && (
                            <>
                              <span style={{ fontSize: '12px', color: 'var(--green)' }}>✓ Done</span>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                            </>
                          )}

                          {b.status === 'disputed' && (
                            <span style={{ fontSize: '12px', color: 'var(--red)' }}>Under Review</span>
                          )}

                          {['pending', 'cancelled', 'refunded'].includes(b.status) && (
                            <span className="muted" style={{ fontSize: '12px' }}>—</span>
                          )}

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

        {/* ══ INCOMING TAB ══ */}
        {activeTab === 'incoming' && (
          incoming.length === 0
            ? <p className="no-data">Tool is not booked till now...</p>
            : <table>
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Renter</th>
                    <th>Dates</th>
                    <th>Earnings</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incoming.map(b => (
                    <tr key={b._id}>
                      <td className="bold">{b.tool?.title}</td>
                      <td>
                        <div className="bold">{b.renter?.name}</div>
                        <div className="muted" style={{ fontSize: '11px' }}>{b.renter?.email}</div>
                      </td>
                      <td className="muted">
                        {formatDate(b.startDate)} – {formatDate(b.endDate)}
                      </td>
                      <td className="price">₹{b.totalPrice}</td>
                      <td>
                        <span className={`badge ${STATUS_COLOR[b.status] || 'gray'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">

                          {/* pending → Accept / Reject */}
                          {b.status === 'pending' && (
                            <>
                              <button
                                className="btn-accept"
                                onClick={() => handleStatus(b._id, 'confirmed')}
                                disabled={!!actionLoading}
                              >
                                Accept
                              </button>
                              <button
                                className="btn-reject"
                                onClick={() => handleStatus(b._id, 'cancelled')}
                                disabled={!!actionLoading}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* confirmed → chat available, payment ka wait */}
                          {b.status === 'confirmed' && (
                            <>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                Awaiting payment
                              </span>
                            </>
                          )}

                          {/* paid → deliver karo + chat */}
                          {b.status === 'paid' && (
                            <>
                              <button
                                className="btn-deliver"
                                onClick={() => handleMarkDelivered(b._id)}
                                disabled={actionLoading === b._id + 'deliver'}
                              >
                                {actionLoading === b._id + 'deliver' ? '...' : '📦 Mark Delivered'}
                              </button>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                            </>
                          )}

                          {/* delivered → renter confirm kare + chat */}
                          {b.status === 'delivered' && (
                            <>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                Renter will confirm...
                              </span>
                              <button className="btn-chat" onClick={() => navigate(`/chat/${b._id}`)}>
                                💬 Chat
                              </button>
                            </>
                          )}

                          {b.status === 'completed' && (
                            <span style={{ fontSize: '12px', color: 'var(--green)' }}>✓ Completed</span>
                          )}

                          {b.status === 'disputed' && (
                            <span style={{ fontSize: '12px', color: 'var(--red)' }}>⚠ Under Review</span>
                          )}

                          {['cancelled', 'refunded'].includes(b.status) && (
                            <span className="muted" style={{ fontSize: '12px' }}>—</span>
                          )}

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}

      </div>
    </div>
  )
}