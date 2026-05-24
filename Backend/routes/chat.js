const express = require('express')
const router  = express.Router()
const Message = require('../models/Message')
const Booking = require('../models/Booking')
const protect = require('../middleware/auth')

// GET /api/chat/:bookingId — purane messages load karo (page open hone pe)
router.get('/:bookingId', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking nahi mili' })

    const userId = req.user._id.toString()
    const isAllowed =
      booking.owner.toString()  === userId ||
      booking.renter.toString() === userId

    if (!isAllowed) return res.status(403).json({ message: 'Access nahi hai' })

    const messages = await Message.find({ booking: req.params.bookingId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })

    res.json({ messages })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/chat/:bookingId — REST fallback (Socket.io primarily use hoga)
// Ye route tab useful hoga agar socket disconnect ho jaaye
router.post('/:bookingId', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking nahi mili' })

    // payment ke baad chat allowed hai
    const chatAllowed = ['confirmed', 'paid', 'delivered', 'completed']
    if (!chatAllowed.includes(booking.status)) {
      return res.status(400).json({ message: 'Chat sirf active bookings mein available hai' })
    }

    const userId = req.user._id.toString()
    const isAllowed =
      booking.owner.toString()  === userId ||
      booking.renter.toString() === userId
    if (!isAllowed) return res.status(403).json({ message: 'Access nahi hai' })

    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ message: 'Message khali nahi ho sakta' })

    const message = await Message.create({
      booking: req.params.bookingId,
      sender:  req.user._id,
      text:    text.trim()
    })
    await message.populate('sender', 'name')

    res.status(201).json({ message })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router