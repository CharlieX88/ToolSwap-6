const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  booking: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Booking',
    required: true,
    unique:   true   // ek booking pe sirf ek review ho sakta hai
  },
  tool: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Tool',
    required: true
  },
  reviewer: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true  // renter hi review deta hai
  },
  rating: {
    type:     Number,
    required: true,
    min:      1,
    max:      5
  },
  comment: {
    type:  String,
    trim:  true,
    default: ''
  }
}, { timestamps: true })

module.exports = mongoose.model('Review', reviewSchema)