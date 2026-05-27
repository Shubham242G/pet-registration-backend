// backend/services/whatsappService.js
const axios = require('axios');

const BASE_URL = "https://api.wapp.biz/api/external";
const API_KEY = process.env.WAPP_BIZ_API_KEY;

async function sendOTPviaWhatsApp(phone, otp, name = "Tailio User") {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    console.log(`📱 Sending OTP to ${cleanPhone}: ${otp}`);
    
    const data = {
      template_name: "tailio_otp_verification",
      phone: cleanPhone,
      name: name,
      otp: otp
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendAuthTemplate?apikey=${API_KEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 15000
    });

    console.log("✅ WhatsApp API response:", response.data);
    
    // The API returns { status: 200, error: false, data: {...} } on success
    if (response.data && response.data.status === 200 && response.data.error === false) {
      return { success: true, data: response.data };
    } else {
      return { success: false, error: response.data?.message || "API returned error" };
    }
  } catch (error) {
    console.error("❌ WhatsApp API error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOTPviaWhatsApp };