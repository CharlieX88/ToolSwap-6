const nodemailer = require('nodemailer')

// Create transporter once — reuse it
// Using Gmail — free and easy setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // your Gmail — inside .env
    pass: process.env.EMAIL_PASS    // Gmail App Password — inside .env
  }
})

// ─────────────────────────────────────────────────────────────
// OTP Email — while registering
// ─────────────────────────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, name) {
  await transporter.sendMail({
    from:    `"ToolSwap" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: 'ToolSwap — Verify Your Email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#f97316;">🔧 ToolSwap</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Use this OTP to verify your university email:</p>
        <div style="background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#f97316;">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;">This OTP will expire in <strong>10 minutes</strong>.</p>
        <p style="color:#888;font-size:13px;">If you did not register, please ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bbb;font-size:11px;">ToolSwap — University Tool Rental Platform</p>
      </div>
    `
  })
}

// ─────────────────────────────────────────────────────────────
// Booking Request Email — to owner
// When someone books their tool
// ─────────────────────────────────────────────────────────────
async function sendBookingRequestEmail(ownerEmail, ownerName, renterName, toolTitle, startDate, endDate, totalPrice) {
  const start = new Date(startDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const end   = new Date(endDate).toLocaleDateString('en-IN',   { day:'numeric', month:'short', year:'numeric' })

  await transporter.sendMail({
    from:    `"ToolSwap" <${process.env.EMAIL_USER}>`,
    to:      ownerEmail,
    subject: `ToolSwap — New Booking Request for "${toolTitle}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#f97316;">🔧 ToolSwap</h2>
        <p>Hi <strong>${ownerName}</strong>,</p>
        <p><strong>${renterName}</strong> has requested to book your tool.</p>

        <div style="background:#f9f9f9;border-radius:10px;padding:16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Tool:</strong> ${toolTitle}</p>
          <p style="margin:4px 0;"><strong>Dates:</strong> ${start} – ${end}</p>
          <p style="margin:4px 0;"><strong>Total Amount:</strong> ₹${totalPrice}</p>
          <p style="margin:4px 0;"><strong>Requested By:</strong> ${renterName}</p>
        </div>

        <p>Go to the dashboard and <strong>Accept</strong> or <strong>Reject</strong> the request.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard"
           style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">
          Go to Dashboard
        </a>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bbb;font-size:11px;">ToolSwap — University Tool Rental Platform</p>
      </div>
    `
  })
}

// ─────────────────────────────────────────────────────────────
// Booking Accepted Email — to renter
// ─────────────────────────────────────────────────────────────
async function sendBookingAcceptedEmail(renterEmail, renterName, ownerName, toolTitle, startDate, endDate, totalPrice) {
  const start = new Date(startDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
  const end   = new Date(endDate).toLocaleDateString('en-IN',   { day:'numeric', month:'short', year:'numeric' })

  await transporter.sendMail({
    from:    `"ToolSwap" <${process.env.EMAIL_USER}>`,
    to:      renterEmail,
    subject: `ToolSwap — Booking Confirmed! "${toolTitle}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#22c55e;">✅ Booking Confirmed!</h2>
        <p>Hi <strong>${renterName}</strong>,</p>
        <p><strong>${ownerName}</strong> has accepted your booking request!</p>

        <div style="background:#f0fdf4;border:1px solid #22c55e;border-radius:10px;padding:16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Tool:</strong> ${toolTitle}</p>
          <p style="margin:4px 0;"><strong>Dates:</strong> ${start} – ${end}</p>
          <p style="margin:4px 0;"><strong>Total Amount:</strong> ₹${totalPrice}</p>
          <p style="margin:4px 0;"><strong>Owner:</strong> ${ownerName}</p>
        </div>

        <p>You can now <strong>chat</strong> with the owner and then proceed with the <strong>payment</strong>.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard"
           style="display:inline-block;background:#22c55e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">
          Go to Dashboard
        </a>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bbb;font-size:11px;">ToolSwap — University Tool Rental Platform</p>
      </div>
    `
  })
}

// ─────────────────────────────────────────────────────────────
// Booking Rejected Email — to renter
// ─────────────────────────────────────────────────────────────
async function sendBookingRejectedEmail(renterEmail, renterName, ownerName, toolTitle) {
  await transporter.sendMail({
    from:    `"ToolSwap" <${process.env.EMAIL_USER}>`,
    to:      renterEmail,
    subject: `ToolSwap — Booking Request Update for "${toolTitle}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#f97316;">🔧 ToolSwap</h2>
        <p>Hi <strong>${renterName}</strong>,</p>
        <p>Unfortunately, <strong>${ownerName}</strong> could not accept your booking for <strong>${toolTitle}</strong> at this time.</p>
        <p>You can search for another tool or try again later.</p>
        <a href="${process.env.FRONTEND_URL}"
           style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">
          Browse Tools
        </a>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#bbb;font-size:11px;">ToolSwap — University Tool Rental Platform</p>
      </div>
    `
  })
}

module.exports = {
  sendOtpEmail,
  sendBookingRequestEmail,
  sendBookingAcceptedEmail,
  sendBookingRejectedEmail
}