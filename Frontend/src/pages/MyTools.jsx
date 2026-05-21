import { useState, useEffect } from 'react'
import { Link }                from 'react-router-dom'
import axios                   from 'axios'
import './MyTools.css'

export default function MyTools() {
  const [tools,   setTools]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetchMyTools()
  }, [])

  async function fetchMyTools() {
    try {
      const res = await axios.get('/api/tools/my')
      setTools(res.data.tools)
    } catch (err) {
      setError('Could not load your tools')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this tool?')) return
    try {
      await axios.delete(`/api/tools/${id}`)
      setTools(tools.filter(t => t._id !== id))
    } catch (err) {
      alert('Could not delete tool')
    }
  }

  if (loading) return <p style={{ padding: '40px 20px', color: '#888' }}>Loading...</p>

  return (
    <div className="mytools-page container">

      <div className="mytools-header">
        <div>
          <h1>My Tools</h1>
          <p>Manage your listed tools</p>
        </div>
        <Link to="/add-tool" className="btn btn-primary">+ Add New Tool</Link>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {tools.length === 0 ? (
        <div className="empty-state card">
          <span>🔧</span>
          <p>You haven't listed any tools yet.</p>
          <Link to="/add-tool" className="btn btn-primary">List Your First Tool</Link>
        </div>
      ) : (
        <div className="mytools-grid">
          {tools.map(tool => (
            <div key={tool._id} className="mytool-card card">

              <div className="mytool-img">
                {tool.imageUrl
                  ? <img src={tool.imageUrl} alt={tool.title} />
                  : <span>🔧</span>
                }
                <span className={`avail-tag ${tool.isAvailable ? 'green' : 'red'}`}>
                  {tool.isAvailable ? 'Available' : 'Booked'}
                </span>
              </div>

              <div className="mytool-body">
                <span className="tool-cat">{tool.category}</span>
                <h3>{tool.title}</h3>
                <p className="tool-city">📍 {tool.city}</p>
                <p className="tool-price">₹{tool.pricePerDay}<span>/day</span></p>
              </div>

              <div className="mytool-actions">
                <Link to={`/tools/${tool._id}`} className="btn btn-outline">View</Link>
                <button
                  onClick={() => handleDelete(tool._id)}
                  className="btn btn-danger"
                >
                  Delete
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}