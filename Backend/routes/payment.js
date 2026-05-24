const express  = require('express')
const router   = express.Router()
const Razorpay = require('razorpay')
const crypto   = require('crypto')  // Node.js built-in, install nahi karna
const Booking  = require('../models/Booking')
const protect  = require('../middleware/auth')

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})

// ─────────────────────────────────────────────────────────────
// POST /api/payment/create-order
// Renter "Pay Now" dabata hai → Razorpay order create hota hai
// ─────────────────────────────────────────────────────────────
router.post('/create-order', protect, async (req, res) => {
  try {
    const { bookingId } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    // sirf renter hi pay kar sakta hai
    if (booking.renter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sirf renter hi payment kar sakta hai' })
    }

    // sirf confirmed booking pe payment allowed hai
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Payment tabhi hoti hai jab owner ne accept kiya ho' })
    }

    // Razorpay order banao
    // Razorpay paise PAISE (paisa) mein leta hai, rupees mein nahi
    // 1 rupee = 100 paise, isliye × 100
    const order = await razorpay.orders.create({
      amount:   booking.totalPrice * 100,
      currency: 'INR',
      receipt:  `booking_${bookingId}`
    })

    // order ID save karo booking mein
    booking.razorpayOrderId = order.id
    await booking.save()

    // frontend ko ye sab chahiye checkout open karne ke liye
    res.json({
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      bookingId: bookingId,
      keyId:     process.env.RAZORPAY_KEY_ID
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payment/verify
// Payment hone ke baad Razorpay humhe callback deta hai
// Hum signature verify karke confirm karte hain genuine payment hai
// ─────────────────────────────────────────────────────────────
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body

    // Signature verification — ye sabse important step hai
    // Razorpay ek HMAC-SHA256 signature bhejta hai
    // Hum apni key se same signature generate karke compare karte hain
    // Match → payment genuine hai, koi tamper nahi hua
    const body = razorpayOrderId + '|' + razorpayPaymentId
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ message: 'Payment verification failed — signature mismatch' })
    }

    // Payment verified — ab booking update karo
    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    booking.status            = 'paid'
    booking.razorpayPaymentId = razorpayPaymentId
    booking.paidAt            = new Date()
    await booking.save()

    res.json({ success: true, message: 'Payment successful! Owner se tool lo.', booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payment/mark-delivered
// Owner: "Maine tool de diya" — sirf owner kar sakta hai
// ─────────────────────────────────────────────────────────────
router.post('/mark-delivered', protect, async (req, res) => {
  try {
    const { bookingId } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sirf owner ye kar sakta hai' })
    }

    if (booking.status !== 'paid') {
      return res.status(400).json({ message: 'Pehle payment honi chahiye' })
    }

    booking.status      = 'delivered'
    booking.deliveredAt = new Date()
    await booking.save()

    res.json({ message: 'Tool delivered mark ho gaya. Renter se confirm karwao.', booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payment/confirm-receipt
// Renter: "Haan, mujhe tool mila" — transaction complete
// ─────────────────────────────────────────────────────────────
router.post('/confirm-receipt', protect, async (req, res) => {
  try {
    const { bookingId } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    if (booking.renter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sirf renter ye kar sakta hai' })
    }

    if (booking.status !== 'delivered') {
      return res.status(400).json({ message: 'Pehle owner ne deliver mark karna hai' })
    }

    booking.status      = 'completed'
    booking.completedAt = new Date()
    await booking.save()

    res.json({ message: 'Transaction complete! Tool mil gaya.', booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payment/dispute
// FRAUD PROTECTION — Renter: "Payment ki but tool nahi mila"
// Is case ko admin manually handle karega (university project)
// ─────────────────────────────────────────────────────────────
router.post('/dispute', protect, async (req, res) => {
  try {
    const { bookingId, reason } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    if (booking.renter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sirf renter dispute kar sakta hai' })
    }

    // sirf paid ya delivered status pe dispute allowed hai
    if (!['paid', 'delivered'].includes(booking.status)) {
      return res.status(400).json({ message: 'Dispute sirf paid/delivered bookings pe hoti hai' })
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Dispute reason batao' })
    }

    booking.status        = 'disputed'
    booking.disputeReason = reason.trim()
    booking.disputedAt    = new Date()
    await booking.save()

    // real app mein: admin ko email jaata, refund initiate hota
    // university project mein: admin manually dekh ke resolve karega
    res.json({
      message: 'Dispute register ho gaya. University admin review karega aur refund process karega.',
      booking
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router