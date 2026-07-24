// backend/services/whatsappService.js
const axios = require('axios');

const BASE_URL = "https://api.wapp.biz/api/external";
const API_KEY = process.env.WAPP_BIZ_API_KEY;

/**
 * Send OTP via WhatsApp using template
 */
async function sendOTPviaWhatsApp(phone, otp, name = "Tailio User") {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    console.log(`📱 Sending OTP to ${cleanPhone}: ${otp}`);
    
    const data = {
      template_name: "shubham_bill_template",
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
 * Send payment receipt via WhatsApp using invoice_razorpay template
 * ✅ Uses the approved template with /sendTemplate endpoint
 */
async function sendPaymentReceiptWhatsApp(phone, petName, amount, paymentId, city, tagDeliveryOption, tagDeliveryCost) {
  try {
    let cleanPhone = phone.toString().replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    
    const formattedAmount = `₹${Number(amount).toFixed(2)}`;
    
    // ✅ Use the correct city name mapping
    const cityNames = {
      ghaziabad: 'Ghaziabad',
      delhi: 'Delhi',
      noida: 'Noida',
      gurgaon: 'Gurgaon',
      faridabad: 'Faridabad',
      other: 'Other'
    };
    const cityDisplay = cityNames[city] || city || 'Not specified';
    
    // ✅ Generate a proper order ID (use paymentId or timestamp)
    const orderID = paymentId || `ORD${Date.now().toString().slice(-6)}`;
    
    console.log(`📱 Sending payment receipt to ${cleanPhone}`);
    console.log(`📝 Template variables:`, {
      orderID: orderID,
      orderAmount: formattedAmount,
      name: "Pet Parent",
      city: cityDisplay
    });
    
    // ✅ Match your template structure EXACTLY
    const data = {
      template_name: "invoice_razorpay", // Your template name
      phone: cleanPhone,
      // ✅ Option 1: If your template uses NAMED variables (recommended)
      orderID: orderID,
      orderAmount: formattedAmount,
      name: "Pet Parent",
      city: cityDisplay
      // OR ✅ Option 2: If your template uses NUMBERED variables
      // variables: {
      //   "1": orderID,
      //   "2": formattedAmount,
      //   "3": "Pet Parent",
      //   "4": cityDisplay
      // }
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
      // Try numbered variables as fallback
      console.log('⚠️ Named variables failed, trying numbered variables...');
      
      const numberedData = {
        template_name: "invoice_razorpay",
        phone: cleanPhone,
        variables: {
          "1": orderID,
          "2": formattedAmount,
          "3": "Pet Parent",
          "4": cityDisplay
        }
      };
      
      const numberedResponse = await axios({
        method: 'post',
        url: `${BASE_URL}/sendTemplate?apikey=${API_KEY}`,
        headers: {
          'Content-Type': 'application/json'
        },
        data: numberedData,
        timeout: 15000
      });
      
      console.log("✅ WhatsApp receipt response (numbered):", numberedResponse.data);
      
      if (numberedResponse.data && numberedResponse.data.status === 200 && numberedResponse.data.error === false) {
        return { success: true, data: numberedResponse.data };
      } else {
        return { success: false, error: numberedResponse.data?.message || "API returned error" };
      }
    }
  } catch (error) {
    console.error("❌ WhatsApp receipt error:", error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { 
  sendOTPviaWhatsApp,
  sendPaymentReceiptWhatsApp
};