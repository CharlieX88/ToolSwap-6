const express = require('express')
const router  = express.Router()
const Booking = require('../models/Booking')
const Tool    = require('../models/Tool')
const User    = require('../models/User')
const protect = require('../middleware/auth')
const {
  sendBookingRequestEmail,
  sendBookingAcceptedEmail,
  sendBookingRejectedEmail
} = require('../utils/mailer')

// GET /api/bookings/booked-dates/:toolId — public
router.get('/booked-dates/:toolId', async (req, res) => {
  try {
    const bookings = await Booking.find({
      tool:   req.params.toolId,
      status: { $in: ['pending', 'confirmed', 'paid', 'delivered'] }
    }).select('startDate endDate -_id')
    res.json({ bookedRanges: bookings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/bookings/dashboard — protected
router.get('/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user._id

    const myBookings = await Booking.find({ renter: userId })
      .populate('tool',  'title category pricePerDay')
      .populate('owner', 'name')
      .sort({ createdAt: -1 })

    const incomingBookings = await Booking.find({ owner: userId })
      .populate('tool',   'title')
      .populate('renter', 'name email')
      .sort({ createdAt: -1 })

    const myToolsCount = await Tool.countDocuments({ owner: userId })

    const stats = {
      totalRented:     myBookings.length,
      activeBookings:  myBookings.filter(b =>
        ['confirmed', 'paid', 'delivered'].includes(b.status)
      ).length,
      pendingRequests: incomingBookings.filter(b => b.status === 'pending').length,
      myListings:      myToolsCount
    }

    res.json({ stats, myBookings, incomingBookings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/bookings — new booking + email to owner
router.post('/', protect, async (req, res) => {
  try {
    const { toolId, startDate, endDate } = req.body

    const tool = await Tool.findById(toolId).populate('owner')
    if (!tool) return res.status(404).json({ message: 'Tool not found' })

    if (tool.owner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot book your own tool' })
    }

    const start = new Date(startDate)
    const end   = new Date(endDate)

    if (start >= end) {
      return res.status(400).json({ message: 'End date must be after start date' })
    }

    const conflict = await Booking.findOne({
      tool:      toolId,
      status:    { $in: ['pending', 'confirmed', 'paid', 'delivered'] },
      startDate: { $lt: end   },
      endDate:   { $gt: start }
    })

    if (conflict) {
      const cStart = conflict.startDate.toISOString().split('T')[0]
      const cEnd   = conflict.endDate.toISOString().split('T')[0]
      return res.status(409).json({
        message: `Tool already booked from ${cStart} to ${cEnd}. Please choose different dates.`
      })
    }

    const totalDays  = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    const totalPrice = totalDays * tool.pricePerDay

    const booking = await Booking.create({
      tool: toolId, renter: req.user._id, owner: tool.owner._id,
      startDate: start, endDate: end, totalDays, totalPrice
    })

    // Send email to owner — async, response will not wait
    sendBookingRequestEmail(
      tool.owner.email,
      tool.owner.name,
      req.user.name,
      tool.title,
      start,
      end,
      totalPrice
    ).catch(() => {}) // booking will not be cancelled if email fails

    res.status(201).json({ booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/bookings/:id/status — owner accept/reject + email to renter
router.put('/:id/status', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('tool',   'title')
      .populate('renter', 'name email')
      .populate('owner',  'name')

    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    if (booking.owner._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can change the status' })
    }

    const { status } = req.body
    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending bookings can have their status changed' })
    }

    booking.status = status
    await booking.save()

    // Send email to renter — accepted or rejected
    if (status === 'confirmed') {
      sendBookingAcceptedEmail(
        booking.renter.email,
        booking.renter.name,
        booking.owner.name,
        booking.tool.title,
        booking.startDate,
        booking.endDate,
        booking.totalPrice
      ).catch(() => {})
    } else {
      sendBookingRejectedEmail(
        booking.renter.email,
        booking.renter.name,
        booking.owner.name,
        booking.tool.title
      ).catch(() => {})
    }

    res.json({ booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router