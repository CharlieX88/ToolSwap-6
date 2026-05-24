const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
  tool:       { type: mongoose.Schema.Types.ObjectId, ref: 'Tool', required: true },
  renter:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate:  { type: Date,   required: true },
  endDate:    { type: Date,   required: true },
  totalDays:  { type: Number, required: true },
  totalPrice: { type: Number, required: true },

  // Status ka poora lifecycle:
  // pending    → renter ne request ki, kuch nahi hua abhi
  // confirmed  → owner ne accept kiya, renter ko payment karni hai
  // paid       → payment ho gayi, ab owner tool deliver kare
  // delivered  → owner ne bola "tool de diya"
  // completed  → renter ne confirm kiya "tool mila" — transaction done
  // disputed   → renter ne bola "tool nahi mila" — fraud flag
  // cancelled  → owner ne reject kiya (payment nahi hui thi)
  // refunded   → payment hui thi but refund hua
  status: {
    type:    String,
    enum:    ['pending', 'confirmed', 'paid', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Razorpay payment info
  razorpayOrderId:   { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  paidAt:            { type: Date },

  // Fraud protection fields
  deliveredAt:       { type: Date },   // owner ne kab deliver mark kiya
  completedAt:       { type: Date },   // renter ne kab confirm kiya
  disputeReason:     { type: String, default: '' }, // agar dispute kiya toh kyun
  disputedAt:        { type: Date }
}, { timestamps: true })

module.exports = mongoose.model('Booking', bookingSchema)