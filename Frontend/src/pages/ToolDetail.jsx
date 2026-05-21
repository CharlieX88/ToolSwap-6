import { useState, useEffect } from 'react'
import { useParams, Link }     from 'react-router-dom'
import axios                   from 'axios'
import DatePicker              from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useAuth }             from '../context/AuthContext'
import './ToolDetail.css'

// Helper: ek range ke andar saari dates generate karo
function getDatesInRange(start, end) {
  const dates = []
  const cur   = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endD  = new Date(end)
  endD.setHours(0, 0, 0, 0)
  while (cur <= endD) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export default function ToolDetail() {
  const { id }   = useParams()
  const { user } = useAuth()

  const [tool,         setTool]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  // Booking state
  const [startDate,    setStartDate]    = useState(null)
  const [endDate,      setEndDate]      = useState(null)
  const [bookMsg,      setBookMsg]      = useState('')
  const [bookErr,      setBookErr]      = useState('')
  const [bookLoad,     setBookLoad]     = useState(false)

  // Booked dates from server
  const [bookedDates,  setBookedDates]  = useState([])   // flat array of Date objects
  const [datesLoading, setDatesLoading] = useState(false)

  // Fetch tool
  useEffect(() => {
    async function fetchTool() {
      try {
        const res = await axios.get(`/api/tools/${id}`)
        setTool(res.data.tool)
      } catch {
        setError('Tool not found')
      } finally {
        setLoading(false)
      }
    }
    fetchTool()
  }, [id])

  // Fetch booked dates for this tool
  useEffect(() => {
    async function fetchBookedDates() {
      setDatesLoading(true)
      try {
        const res = await axios.get(`/api/bookings/booked-dates/${id}`)
        // har range ko individual dates mein expand karo
        const allDates = []
        res.data.bookedRanges.forEach(({ startDate, endDate }) => {
          getDatesInRange(new Date(startDate), new Date(endDate))
            .forEach(d => allDates.push(d))
        })
        setBookedDates(allDates)
      } catch {
        // silently fail — user manually check karega
      } finally {
        setDatesLoading(false)
      }
    }
    fetchBookedDates()
  }, [id])

  // Price calculation
  function calcTotal() {
    if (!startDate || !endDate || !tool) return null
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    return days > 0 ? { days, total: days * tool.pricePerDay } : null
  }

  async function handleBook(e) {
    e.preventDefault()
    setBookErr('')
    setBookMsg('')

    if (!startDate || !endDate) {
      setBookErr('Please select both start and end dates')
      return
    }

    setBookLoad(true)
    try {
      await axios.post('/api/bookings', {
        toolId: id,
        startDate: startDate.toISOString(),
        endDate:   endDate.toISOString()
      })
      setBookMsg('Booking request sent! Owner will confirm shortly.')
      setStartDate(null)
      setEndDate(null)

      // Refresh booked dates so calendar updates immediately
      const res = await axios.get(`/api/bookings/booked-dates/${id}`)
      const allDates = []
      res.data.bookedRanges.forEach(({ startDate, endDate }) => {
        getDatesInRange(new Date(startDate), new Date(endDate))
          .forEach(d => allDates.push(d))
      })
      setBookedDates(allDates)

    } catch (err) {
      setBookErr(err.response?.data?.message || 'Booking failed')
    } finally {
      setBookLoad(false)
    }
  }

  if (loading) return <p style={{ padding: '40px 20px', color: '#888' }}>Loading...</p>
  if (error)   return <p style={{ padding: '40px 20px', color: 'var(--red)' }}>{error}</p>

  const calc    = calcTotal()
  const isOwner = user && tool.owner?._id === user._id
  const today   = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="detail-page container">
      <div className="detail-grid">

        {/* ── Left side ── */}
        <div className="detail-left">

          <div className="detail-img">
            {tool.imageUrl
              ? <img src={tool.imageUrl} alt={tool.title} />
              : <span>🔧</span>
            }
          </div>

          <div className="detail-info card">
            <div className="detail-top">
              <div>
                <span className="tool-cat">{tool.category}</span>
                <h1>{tool.title}</h1>
              </div>
              <div className="detail-price">
                <span>₹{tool.pricePerDay}</span>
                <small>/day</small>
              </div>
            </div>

            <div className="detail-badges">
              <span className={`avail-tag ${tool.isAvailable ? 'green' : 'red'}`}>
                {tool.isAvailable ? '✓ Available' : '✗ Unavailable'}
              </span>
              <span className="cond-tag">{tool.condition}</span>
            </div>

            <p className="detail-desc">{tool.description}</p>

            <div className="detail-owner">
              <div className="owner-av">{tool.owner?.name?.charAt(0).toUpperCase()}</div>
              <div>
                <p className="owner-name">{tool.owner?.name}</p>
                <p className="owner-city">📍 {tool.owner?.city || tool.city}</p>
              </div>
              {isOwner && (
                <Link to="/my-tools" className="btn btn-outline" style={{ marginLeft: 'auto' }}>
                  Manage
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Right side — booking card ── */}
        <div className="detail-right">
          <div className="booking-card card">
            <h3>Book This Tool</h3>
            <div className="booking-price">₹{tool.pricePerDay}<small>/day</small></div>

            {!tool.isAvailable ? (
              <p className="error-msg">This tool is currently unavailable.</p>

            ) : isOwner ? (
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>This is your listing.</p>

            ) : !user ? (
              <Link to="/login" className="btn btn-primary full-btn">Login to Book</Link>

            ) : (
              <form onSubmit={handleBook}>

                {/* ── Calendar legend ── */}
                <div className="cal-legend">
                  <span className="leg-item">
                    <span className="leg-dot leg-available"></span> Available
                  </span>
                  <span className="leg-item">
                    <span className="leg-dot leg-booked"></span> Booked
                  </span>
                  <span className="leg-item">
                    <span className="leg-dot leg-selected"></span> Selected
                  </span>
                </div>

                {datesLoading && (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                    Loading availability...
                  </p>
                )}

                {/* ── Start Date Picker ── */}
                <div className="field">
                  <label>Start Date</label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => {
                      setStartDate(date)
                      // Agar end date pehle se select hai aur start usse aage ja rahi hai
                      if (endDate && date >= endDate) setEndDate(null)
                    }}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    minDate={today}
                    excludeDates={bookedDates}
                    placeholderText="Select start date"
                    dateFormat="dd MMM yyyy"
                    className="date-input"
                    calendarClassName="toolswap-cal"
                    highlightDates={[
                      { 'react-datepicker__day--highlighted-booked': bookedDates }
                    ]}
                  />
                </div>

                {/* ── End Date Picker ── */}
                <div className="field">
                  <label>End Date</label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate
                      ? new Date(startDate.getTime() + 86400000)
                      : new Date(today.getTime() + 86400000)
                    }
                    excludeDates={bookedDates}
                    placeholderText="Select end date"
                    dateFormat="dd MMM yyyy"
                    className="date-input"
                    calendarClassName="toolswap-cal"
                    disabled={!startDate}
                  />
                </div>

                {/* ── Price summary ── */}
                {calc && (
                  <div className="booking-total">
                    <span>{calc.days} days × ₹{tool.pricePerDay}</span>
                    <strong>₹{calc.total}</strong>
                  </div>
                )}

                {bookErr && <p className="error-msg">{bookErr}</p>}
                {bookMsg && <p className="success-msg">{bookMsg}</p>}

                <button
                  type="submit"
                  className="btn btn-primary full-btn"
                  disabled={bookLoad || !startDate || !endDate}
                >
                  {bookLoad ? 'Sending...' : 'Request Booking'}
                </button>

              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}