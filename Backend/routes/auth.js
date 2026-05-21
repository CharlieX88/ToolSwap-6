const express = require('express')
const router  = express.Router()
const jwt     = require('jsonwebtoken')
const User    = require('../models/User')
const protect = require('../middleware/auth')

// .env mein ALLOWED_DOMAIN=chitkara.edu.in rakho
// agar set nahi hai toh koi restriction nahi hogi (dev mode ke liye)
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || null

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, city } = req.body

    // university email check — sirf allowed domain wale register kar sakte hain
    if (ALLOWED_DOMAIN && !email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(403).json({
        message: `Only ${ALLOWED_DOMAIN} email addresses can register on this platform`
      })
    }

    const userExists = await User.findOne({ email })
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered' })
    }

    const user = await User.create({ name, email, password, phone, city })

    res.status(201).json({
      token: generateToken(user._id),
      user:  { _id: user._id, name: user.name, email: user.email, city: user.city }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    res.json({
      token: generateToken(user._id),
      user:  { _id: user._id, name: user.name, email: user.email, city: user.city }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/auth/me — protected
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user })
})

module.exports = router