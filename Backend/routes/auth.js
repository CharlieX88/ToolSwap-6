const express  = require('express')
const router   = express.Router()
const jwt      = require('jsonwebtoken')
const bcrypt   = require('bcryptjs')
const User     = require('../models/User')
const protect  = require('../middleware/auth')
const { sendOtpEmail } = require('../utils/mailer')

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || null

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// 6 digit random OTP generate karo
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// Step 1: Form data lo → OTP bhejo → unverified user banao
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, city } = req.body

    // University domain check
    if (ALLOWED_DOMAIN && !email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(403).json({
        message: `Only @${ALLOWED_DOMAIN} email addresses can register`
      })
    }

    // Already registered?
    const existing = await User.findOne({ email })
    if (existing && existing.isVerified) {
      return res.status(400).json({ message: 'Email already registered' })
    }

    // OTP generate karo
    const otp       = generateOtp()                                // plain OTP — email mein jaayega
    const otpHashed = await bcrypt.hash(otp, 10)                  // hashed — DB mein save hoga
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)       // 10 minutes baad expire

    if (existing && !existing.isVerified) {
      // Pehle se unverified user hai — OTP refresh karo
      existing.name      = name
      existing.password  = password   // pre-save hook hash karega
      existing.phone     = phone
      existing.city      = city
      existing.otp       = otpHashed
      existing.otpExpiry = otpExpiry
      await existing.save()
    } else {
      // Naya user banao (unverified)
      await User.create({
        name, email, password, phone, city,
        isVerified: false,
        otp:        otpHashed,
        otpExpiry
      })
    }

    // OTP email bhejo
    await sendOtpEmail(email, otp, name)

    res.status(200).json({
      message: `OTP sent to ${email}. Please verify to complete registration.`,
      email   // frontend ko chahiye verify step ke liye
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Step 2: User OTP daale → verify karo → account activate karo
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body

    const user = await User.findOne({ email }).select('+otp +otpExpiry')
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' })
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified. Please login.' })
    }

    // OTP expire toh nahi hua?
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Please register again to get a new OTP.' })
    }

    // OTP sahi hai?
    const isMatch = await bcrypt.compare(otp, user.otp)
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' })
    }

    // Sab sahi — account activate karo, OTP saaf karo
    user.isVerified = true
    user.otp        = undefined
    user.otpExpiry  = undefined
    await user.save()

    // Token de do — seedha login ho jaayega
    res.json({
      message: 'Email verified successfully!',
      token:   generateToken(user._id),
      user:    { _id: user._id, name: user.name, email: user.email, city: user.city }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
// User ne OTP nahi mila — dobara bhejo
// ─────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user)             return res.status(404).json({ message: 'User not found' })
    if (user.isVerified)   return res.status(400).json({ message: 'Already verified' })

    const otp       = generateOtp()
    const otpHashed = await bcrypt.hash(otp, 10)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

    user.otp       = otpHashed
    user.otpExpiry = otpExpiry
    await user.save()

    await sendOtpEmail(email, otp, user.name)

    res.json({ message: 'New OTP sent to your email.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Verified nahi hai toh login nahi hoga
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Email not verified. Please check your inbox for the OTP.',
        needsVerification: true,
        email
      })
    }

    res.json({
      token: generateToken(user._id),
      user:  { _id: user._id, name: user.name, email: user.email, city: user.city }
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user })
})

module.exports = router