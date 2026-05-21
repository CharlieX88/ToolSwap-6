import { useState }      from 'react'
import { useNavigate }   from 'react-router-dom'
import axios             from 'axios'
import './AddTool.css'

const CATEGORIES = ['Power Tools', 'Hand Tools', 'Garden Tools', 'Cleaning Equipment', 'Construction', 'Automotive', 'Other']

export default function AddTool() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    title: '', description: '', category: '',
    pricePerDay: '', city: '', condition: 'Good'
  })
  const [image,   setImage]   = useState(null)
  const [preview, setPreview] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleImage(e) {
    const file = e.target.files[0]
    if (file) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // FormData use karna zaroori hai — image ke saath
      const data = new FormData()
      Object.entries(form).forEach(([key, val]) => data.append(key, val))
      if (image) data.append('image', image)

      await axios.post('/api/tools', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      navigate('/my-tools')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add tool')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="addtool-page container">
      <div className="addtool-card card">
        <h2>List a New Tool</h2>
        <p className="addtool-sub">Fill in the details to start renting out your tool</p>

        <form onSubmit={handleSubmit}>

          <div className="field">
            <label>Tool Name</label>
            <input
              name="title" placeholder="e.g. Bosch Power Drill"
              value={form.title} onChange={handleChange} required
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              name="description" rows={3}
              placeholder="Describe the tool — model, condition, what it's good for..."
              value={form.description} onChange={handleChange} required
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Condition</label>
              <select name="condition" value={form.condition} onChange={handleChange}>
                <option>Excellent</option>
                <option>Good</option>
                <option>Fair</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Price per Day (₹)</label>
              <input
                type="number" name="pricePerDay" placeholder="e.g. 150" min="1"
                value={form.pricePerDay} onChange={handleChange} required
              />
            </div>
            <div className="field">
              <label>City</label>
              <input
                name="city" placeholder="e.g. Chandigarh"
                value={form.city} onChange={handleChange} required
              />
            </div>
          </div>

          {/* Image upload */}
          <div className="field">
            <label>Photo</label>
            <div className="upload-box" onClick={() => document.getElementById('img-input').click()}>
              {preview
                ? <img src={preview} alt="preview" className="img-preview" />
                : <div className="upload-placeholder">
                    <span>📷</span>
                    <p>Click to upload a photo</p>
                  </div>
              }
              <input
                id="img-input" type="file" accept="image/*"
                onChange={handleImage} style={{ display: 'none' }}
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn btn-primary full-btn" disabled={loading}>
            {loading ? 'Adding...' : 'Publish Listing'}
          </button>

        </form>
      </div>
    </div>
  )
}