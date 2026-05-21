const express              = require('express')
const router               = express.Router()
const Tool                 = require('../models/Tool')
const protect              = require('../middleware/auth')
const { cloudinary, upload } = require('../config/cloudinary')

// GET /api/tools — saare tools
router.get('/', async (req, res) => {
  try {
    const filter = {}
    if (req.query.category) filter.category = req.query.category
    if (req.query.search)   filter.title = { $regex: req.query.search, $options: 'i' }

    const tools = await Tool.find(filter)
      .populate('owner', 'name city')
      .sort({ createdAt: -1 })

    res.json({ tools })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/tools/my — meri listings
router.get('/my', protect, async (req, res) => {
  try {
    const tools = await Tool.find({ owner: req.user._id }).sort({ createdAt: -1 })
    res.json({ tools })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/tools/:id — single tool
router.get('/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id)
      .populate('owner', 'name city phone')
    if (!tool) return res.status(404).json({ message: 'Tool not found' })
    res.json({ tool })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/tools
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, pricePerDay, city, condition } = req.body

    let imageUrl      = ''
    let imagePublicId = ''

    // Agar image upload ki hai toh Cloudinary pe bhejo
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'toolswap' },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(req.file.buffer)
      })
      imageUrl      = result.secure_url
      imagePublicId = result.public_id
    }

    const tool = await Tool.create({
      owner: req.user._id,
      title, description, category,
      pricePerDay, city, condition,
      imageUrl, imagePublicId
    })

    res.status(201).json({ tool })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})


// PUT /api/tools/:id 
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id)
    if (!tool) return res.status(404).json({ message: 'Tool not found' })

    if (tool.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' })
    }

    const { title, description, category, pricePerDay, city, condition, isAvailable } = req.body

    if (title)                     tool.title       = title
    if (description)               tool.description = description
    if (category)                  tool.category    = category
    if (pricePerDay)               tool.pricePerDay = pricePerDay
    if (city)                      tool.city        = city
    if (condition)                 tool.condition   = condition
    if (isAvailable !== undefined) tool.isAvailable = isAvailable

    if (req.file) {
      // Purani image delete karo
      if (tool.imagePublicId) {
        await cloudinary.uploader.destroy(tool.imagePublicId)
      }
      // Nayi image upload karo
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'toolswap' },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(req.file.buffer)
      })
      tool.imageUrl      = result.secure_url
      tool.imagePublicId = result.public_id
    }

    await tool.save()
    res.json({ tool })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/tools/:id — tool delete karo
router.delete('/:id', protect, async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id)
    if (!tool) return res.status(404).json({ message: 'Tool not found' })

    if (tool.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' })
    }

    // Cloudinary se bhi image delete karo
    if (tool.imagePublicId) {
      await cloudinary.uploader.destroy(tool.imagePublicId)
    }

    await tool.deleteOne()
    res.json({ message: 'Tool deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router