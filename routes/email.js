// // routes/email.js
// const express = require('express');
// const router = express.Router();
// const nodemailer = require('nodemailer');

// // Configure email transporter
// let transporter = null;
// try {
//   if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
//     transporter = nodemailer.createTransport({
//       host: process.env.EMAIL_HOST,
//       port: parseInt(process.env.EMAIL_PORT) || 587,
//       secure: process.env.EMAIL_SECURE === 'true',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });
//     console.log('✅ Email transporter initialized');
//   } else {
//     console.error('❌ Email credentials missing');
//   }
// } catch (error) {
//   console.error('❌ Failed to initialize email:', error.message);
// }

// // Send email
// router.post('/send', async (req, res) => {
//   try {
//     const { to, subject, html, text } = req.body;
    
//     if (!to || !subject || (!html && !text)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'To, subject, and html/text are required' 
//       });
//     }
    
//     if (!transporter) {
//       console.error('❌ Email transporter not configured');
//       return res.status(500).json({ 
//         success: false, 
//         error: 'Email service is not configured' 
//       });
//     }
    
//     const mailOptions = {
//       from: process.env.EMAIL_FROM || 'noreply@tailio.com',
//       to: to,
//       subject: subject,
//       html: html,
//       text: text || html.replace(/<[^>]*>/g, ''),
//     };
    
//     const info = await transporter.sendMail(mailOptions);
//     console.log('✅ Email sent:', info.messageId);
    
//     res.json({
//       success: true,
//       message: 'Email sent successfully',
//       messageId: info.messageId,
//     });
//   } catch (error) {
//     console.error('❌ Email send error:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: error.message 
//     });
//   }
// });

// module.exports = router;