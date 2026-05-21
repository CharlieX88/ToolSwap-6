import { useState, useEffect } from 'react'
import { Link }                from 'react-router-dom'
import axios                   from 'axios'
import './Home.css'

const CATEGORIES = ['All', 'Power Tools', 'Hand Tools', 'Garden Tools', 'Cleaning Equipment', 'Construction', 'Automotive', 'Other']

export default function Home() {
  const [tools,    setTools]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => { fetchTools() }, [category])

  async function fetchTools() {
    setLoading(true)
    try {
      const params = {}
      if (category !== 'All') params.category = category
      if (search)             params.search   = search
      const res = await axios.get('/api/tools', { params })
      setTools(res.data.tools)
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-page">

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1>Borrow tools from your <span>neighbours</span></h1>
          <p>ToolSwap is a peer-to-peer tool sharing marketplace. List your tools, earn money when idle — or rent from neighbours for a fraction of the buying cost.</p>
          <div className="hero-btns">
            <Link to="/register" className="btn btn-primary">Get Started Free</Link>
            {/* <Link to="/login"    className="btn btn-outline">Login</Link> */}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item"><span>500+</span>Tools Listed</div>
            <div className="stat-item"><span>120+</span>Active Users</div>
            <div className="stat-item"><span>₹0</span>To Join</div>
            <div className="stat-item"><span>4.8★</span>Avg Rating</div>
          </div>
        </div>
      </section>

      {/* Browse tools */}
      <section className="browse-section">
        <div className="container">

          {/* Search + filter */}
          <div className="browse-top">
            <form className="search-form" onSubmit={e => { e.preventDefault(); fetchTools() }}>
              <input
                type="text" placeholder="Search tools..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
          </div>

          <div className="category-pills">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tool cards */}
          {loading ? (
            <div className="tools-grid">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton card" />)}
            </div>
          ) : tools.length === 0 ? (
            <div className="empty-tools">
              <p>No tools found.</p>
              <Link to="/add-tool" className="btn btn-primary">Be the first to list one!</Link>
            </div>
          ) : (
            <div className="tools-grid">
              {tools.map(tool => <ToolCard key={tool._id} tool={tool} />)}
            </div>
          )}

        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <div className="container">
          <p className="section-label">How it works</p>
          <div className="steps-grid">
            <div className="step-card card">
              <div className="step-num">1</div>
              <h3>Create an account</h3>
              <p>Sign up for free. No credit card needed to browse or list.</p>
            </div>
            <div className="step-card card">
              <div className="step-num">2</div>
              <h3>Browse or list tools</h3>
              <p>Find tools near you or list your own with photos and pricing.</p>
            </div>
            <div className="step-card card">
              <div className="step-num">3</div>
              <h3>Book and earn</h3>
              <p>Request a booking for the dates you need, or accept requests and earn.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

function ToolCard({ tool }) {
  return (
    <Link to={`/tools/${tool._id}`} className="tool-card card">
      <div className="tool-img">
        {tool.imageUrl
          ? <img src={tool.imageUrl} alt={tool.title} />
          : <span>🔧</span>
        }
        <span className={`avail-tag ${tool.isAvailable ? 'green' : 'red'}`}>
          {tool.isAvailable ? 'Available' : 'Booked'}
        </span>
      </div>
      <div className="tool-body">
        <span className="tool-cat">{tool.category}</span>
        <h3>{tool.title}</h3>
        <p className="tool-desc">{tool.description?.slice(0, 70)}...</p>
        <div className="tool-footer">
          <span className="tool-city">📍 {tool.city}</span>
          <span className="tool-price">₹{tool.pricePerDay}<small>/day</small></span>
        </div>
      </div>
    </Link>
  )
}