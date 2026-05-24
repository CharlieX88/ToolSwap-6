const express = require('express')
const router  = express.Router()
const Review  = require('../models/Review')
const Booking = require('../models/Booking')
const protect = require('../middleware/auth')

// POST /api/reviews
// Renter completed booking pe review deta hai
router.post('/', protect, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    // sirf renter review de sakta hai
    if (booking.renter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Sirf renter review de sakta hai' })
    }

    // sirf completed booking pe review allowed hai
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Review sirf completed booking ke baad de sakte hain' })
    }

    // pehle se review diya hai?
    const existing = await Review.findOne({ booking: bookingId })
    if (existing) {
      return res.status(400).json({ message: 'Is booking ka review pehle se diya ja chuka hai' })
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating 1 se 5 ke beech honi chahiye' })
    }

    const review = await Review.create({
      booking:  bookingId,
      tool:     booking.tool,
      reviewer: req.user._id,
      rating,
      comment: comment?.trim() || ''
    })

    await review.populate('reviewer', 'name')

    res.status(201).json({ review })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/reviews/tool/:toolId
// Ek tool ke saare reviews + average rating
router.get('/tool/:toolId', async (req, res) => {
  try {
    const reviews = await Review.find({ tool: req.params.toolId })
      .populate('reviewer', 'name')
      .sort({ createdAt: -1 })

    // average rating calculate karo
    const avg = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null

    res.json({ reviews, averageRating: avg, totalReviews: reviews.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/reviews/check/:bookingId
// Check karo ki current user ne is booking ka review diya hai ya nahi
router.get('/check/:bookingId', protect, async (req, res) => {
  try {
    const existing = await Review.findOne({
      booking:  req.params.bookingId,
      reviewer: req.user._id
    })
    res.json({ hasReviewed: !!existing, review: existing })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router