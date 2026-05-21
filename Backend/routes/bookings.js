const express = require('express')
const router  = express.Router()
const Booking = require('../models/Booking')
const Tool    = require('../models/Tool')
const protect = require('../middleware/auth')

// ─────────────────────────────────────────────
// GET /api/bookings/booked-dates/:toolId
// Public — returns array of { startDate, endDate }
// for all confirmed/pending bookings of a tool
// Frontend uses this to disable those dates in calendar
// ─────────────────────────────────────────────
router.get('/booked-dates/:toolId', async (req, res) => {
  try {
    const bookings = await Booking.find({
      tool:   req.params.toolId,
      status: { $in: ['pending', 'confirmed'] }
    }).select('startDate endDate -_id')

    res.json({ bookedRanges: bookings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────
// GET /api/bookings/dashboard
// ─────────────────────────────────────────────
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
      activeBookings:  myBookings.filter(b => b.status === 'confirmed').length,
      pendingRequests: incomingBookings.filter(b => b.status === 'pending').length,
      myListings:      myToolsCount
    }

    res.json({ stats, myBookings, incomingBookings })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────
// POST /api/bookings
// With date conflict check
// ─────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { toolId, startDate, endDate } = req.body

    const tool = await Tool.findById(toolId)
    if (!tool) return res.status(404).json({ message: 'Tool not found' })

    if (tool.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot book your own tool' })
    }

    const start = new Date(startDate)
    const end   = new Date(endDate)

    if (start >= end) {
      return res.status(400).json({ message: 'End date must be after start date' })
    }

    // Conflict Check:
    // Overlap condition: existingStart < newEnd AND existingEnd > newStart
    const conflict = await Booking.findOne({
      tool:   toolId,
      status: { $in: ['pending', 'confirmed'] },
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
      tool: toolId, renter: req.user._id, owner: tool.owner,
      startDate: start, endDate: end, totalDays, totalPrice
    })

    res.status(201).json({ booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─────────────────────────────────────────────
// PUT /api/bookings/:id/status
// ─────────────────────────────────────────────
router.put('/:id/status', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' })
    }

    const { status } = req.body
    const allowed = ['confirmed', 'cancelled']
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    booking.status = status
    await booking.save()

    res.json({ booking })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router