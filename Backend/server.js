const express   = require('express')
const mongoose  = require('mongoose')
const cors      = require('cors')
const http      = require('http')        // Node built-in
const { Server } = require('socket.io') // socket.io
const jwt       = require('jsonwebtoken')
const Message   = require('./models/Message')
const User      = require('./models/User')
const Booking   = require('./models/Booking')
require('dotenv').config()

const app    = express()
const server = http.createServer(app)    // Express app ko http server mein wrap karo
// Socket.io ko usi http server pe attach karo
const io     = new Server(server, {
  cors: { origin: '*' }                 // development ke liye sab allow
})

app.use(cors())
app.use(express.json())

// REST API routes — waise hi hain
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/tools',    require('./routes/tools'))
app.use('/api/bookings', require('./routes/bookings'))
app.use('/api/chat',     require('./routes/chat'))
app.use('/api/payment',  require('./routes/payment'))
app.use('/api/reviews',  require('./routes/reviews'))

app.get('/', (req, res) => res.json({ message: 'ToolSwap API running' }))

// ══════════════════════════════════════════════════════════════
// SOCKET.IO — Real-time chat logic
//
// Flow:
// 1. Client connect hota hai → token verify karo
// 2. Client 'join-room' bhejta hai bookingId ke saath
// 3. Client 'send-message' bhejta hai
// 4. Server message DB mein save karta hai
// 5. Server us room ke dono logon ko 'receive-message' emit karta hai
// ══════════════════════════════════════════════════════════════

// Middleware — connection se pehle token verify karo
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token  // frontend se aata hai
    if (!token) return next(new Error('Token missing'))

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.user   = await User.findById(decoded.id).select('-password')
    // socket.user mein ab logged-in user ka data hai

    next() // valid hai, aage jaao
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  // console.log(`User connected: ${socket.user?.name}`)

  // ── Event 1: Room join karo ────────────────────────────────
  // Client chat page kholta hai → is booking ki room mein ghuso
  socket.on('join-room', async ({ bookingId }) => {
    try {
      // verify karo ki ye user is booking mein involved hai
      const booking = await Booking.findById(bookingId)
      if (!booking) return

      const userId = socket.user._id.toString()
      const allowed =
        booking.owner.toString()  === userId ||
        booking.renter.toString() === userId

      if (!allowed) return // unauthorized, room mein mat jaane do

      socket.join(`booking_${bookingId}`)
      // ab ye socket us room ka member hai
    } catch { /* silently ignore */ }
  })

  // ── Event 2: Message bhejo ────────────────────────────────
  socket.on('send-message', async ({ bookingId, text }) => {
    try {
      if (!text?.trim()) return

      // verify karo user is booking mein hai
      const booking = await Booking.findById(bookingId)
      if (!booking) return

      const userId = socket.user._id.toString()
      const allowed =
        booking.owner.toString()  === userId ||
        booking.renter.toString() === userId
      if (!allowed) return

      // valid statuses check karo
      if (!['paid', 'delivered', 'completed', 'confirmed'].includes(booking.status)) return

      // Message database mein save karo
      const message = await Message.create({
        booking: bookingId,
        sender:  socket.user._id,
        text:    text.trim()
      })
      await message.populate('sender', 'name')

      // Room ke dono members ko turant bhejo
      // io.to() = us room ke saare connected sockets ko
      io.to(`booking_${bookingId}`).emit('receive-message', {
        _id:       message._id,
        text:      message.text,
        sender:    { _id: socket.user._id, name: socket.user.name },
        createdAt: message.createdAt
      })
    } catch { /* silently ignore */ }
  })

  // ── Event 3: Typing indicator ─────────────────────────────
  // Optional but looks good in demo
  socket.on('typing', ({ bookingId }) => {
    // apne alawa room ke baaki sab ko batao
    socket.to(`booking_${bookingId}`).emit('user-typing', {
      name: socket.user?.name
    })
  })

  socket.on('stop-typing', ({ bookingId }) => {
    socket.to(`booking_${bookingId}`).emit('user-stop-typing')
  })

  socket.on('disconnect', () => {
    // Socket.io automatically room se remove kar deta hai
  })
})

// ══════════════════════════════════════════════════════════════

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected')
    // app.listen ki jagah server.listen — WebSocket ke liye zaroori
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    })
  })
  .catch(err => console.log('DB Error:', err.message))