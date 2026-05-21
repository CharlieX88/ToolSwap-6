const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  sender:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  text:    { type: String, required: true, trim: true }
}, { timestamps: true })

module.exports = mongoose.model('Message', messageSchema)