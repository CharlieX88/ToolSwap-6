const mongoose = require('mongoose')

const toolSchema = new mongoose.Schema({
  owner:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:         { type: String, required: true },
  description:   { type: String, required: true },
  category:      { type: String, required: true },
  pricePerDay:   { type: Number, required: true },
  city:          { type: String, required: true },
  condition:     { type: String, enum: ['Excellent', 'Good', 'Fair'], default: 'Good' },
  isAvailable:   { type: Boolean, default: true },
  imageUrl:      { type: String, default: '' },
  imagePublicId: { type: String, default: '' },  // Cloudinary delete ke liye
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }
  }
}, { timestamps: true })

module.exports = mongoose.model('Tool', toolSchema)