const axios = require('axios');

const BASE_URL = "https://api.wapp.biz/api/external";
const API_KEY = process.env.WAPP_BIZ_API_KEY;

/**
 * Send OTP via WhatsApp using tailio_otp_verification template
 */
async function sendOTPviaWhatsApp(phone, otp, name = "Tailio User") {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    console.log(`📱 Sending OTP to ${cleanPhone}: ${otp}`);
    
    // ✅ Using the ORIGINAL format that worked before
    const data = {
      template_name: "tailio_otp_verification",
      phone: cleanPhone,
      otp: otp,  // Top-level field
      name: name // Top-level field
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendAuthTemplate?apikey=${API_KEY}`,  // ✅ Original endpoint
      headers: {
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 15000
    });

    console.log("✅ WhatsApp API response:", response.data);
    
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

/**
 * Send payment receipt via WhatsApp using shubham_bill_template
 */
async function sendPaymentReceiptWhatsApp(phone, petName, amount, paymentId, city, tagDeliveryOption, tagDeliveryCost) {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    const formattedAmount = `₹${Number(amount).toFixed(2)}`;
    
    const cityNames = {
      ghaziabad: 'Ghaziabad',
      delhi: 'Delhi',
      noida: 'Noida',
      gurgaon: 'Gurgaon',
      faridabad: 'Faridabad',
      other: 'Other'
    };
    const cityDisplay = cityNames[city] || city || 'Not specified';
    
    const orderID = paymentId || `ORD${Date.now().toString().slice(-6)}`;
    
    console.log(`📱 Sending payment receipt to ${cleanPhone}`);
    console.log(`📝 Template variables:`, {
      orderID: orderID,
      orderAmount: formattedAmount,
      name: petName || "Pet Parent",
      city: cityDisplay
    });
    
    // ✅ Correct receipt template with 4 parameters
    const data = {
      template_name: "shubham_bill_template",
      phone: cleanPhone,
      variables: {
        "1": orderID,
        "2": formattedAmount,
        "3": petName || "Pet Parent",
        "4": cityDisplay
      }
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendTemplate?apikey=${API_KEY}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data,
      timeout: 15000
    });

    console.log("✅ WhatsApp receipt response:", response.data);
    
    if (response.data && response.data.status === 200 && response.data.error === false) {
      return { success: true, data: response.data };
    } else {
      return { success: false, error: response.data?.message || "API returned error" };
    }
  } catch (error) {
    console.error("❌ WhatsApp receipt error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}


async function sendWhatsAppMessage(phone, message) {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    console.log(`📱 Sending WhatsApp message to ${cleanPhone}`);
    
    // Use the Wapp.biz API to send a text message
    // Note: You may need to create a template for this
    // For now, we'll use the existing OTP template as a fallback
    
    const data = {
      template_name: "tailio_otp_verification",
      phone: cleanPhone,
      name: "Tailio Bot",
      otp: message.substring(0, 100) // Truncate if needed
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendAuthTemplate?apikey=${API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      data: data,
      timeout: 15000
    });

    if (response.data && response.data.status === 200 && response.data.error === false) {
      return { success: true, data: response.data };
    } else {
      return { success: false, error: response.data?.message || "API returned error" };
    }
  } catch (error) {
    console.error("❌ WhatsApp send error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}


module.exports = { 
  sendOTPviaWhatsApp,
  sendPaymentReceiptWhatsApp,
  sendWhatsAppMessage,
};