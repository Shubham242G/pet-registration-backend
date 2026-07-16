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
    
    const cityNames = {
      ghaziabad: 'Ghaziabad',
      delhi: 'Delhi',
      noida: 'Noida',
      gurgaon: 'Gurgaon',
      faridabad: 'Faridabad',
      other: 'Other'
    };
    const cityDisplay = cityNames[city] || city || 'Not specified';
    
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = currentDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    const tagDeliveryDisplay = tagDeliveryOption === 'deliver_to_home' 
      ? `Deliver to Home (₹${tagDeliveryCost || 0})` 
      : 'Collect from Municipal Office';
    
    console.log(`📱 Sending payment receipt to ${cleanPhone} using invoice_razorpay template`);
    console.log(`📝 Template variables:`, {
      name: "Pet Parent",
      amount: formattedAmount,
      pet_name: petName,
      city: cityDisplay,
      date: dateStr,
      time: timeStr,
      payment_id: paymentId || 'N/A',
      tag_delivery: tagDeliveryDisplay
    });
    
    // ✅ Using the correct endpoint: /sendTemplate (not /sendMessage)
    // Variables format depends on your template structure
    // Option 1: Numbered variables {{1}}, {{2}}, {{3}}, etc.
    const data = {
      template_name: "invoice_razorpay",
      phone: cleanPhone,
      variables: {
        "1": "Pet Parent",
        "2": formattedAmount,
        "3": petName,
        "4": cityDisplay,
        "5": dateStr,
        "6": timeStr,
        "7": paymentId || 'N/A',
        "8": tagDeliveryDisplay
      }
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendTemplate?apikey=${API_KEY}`, // ✅ Correct endpoint
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
      // If numbered variables don't work, try named variables
      console.log('⚠️ Numbered variables failed, trying named variables...');
      
      const namedData = {
        template_name: "invoice_razorpay",
        phone: cleanPhone,
        customer_name: "Pet Parent",
        amount: formattedAmount,
        pet_name: petName,
        city: cityDisplay,
        date: dateStr,
        time: timeStr,
        payment_id: paymentId || 'N/A',
        tag_delivery: tagDeliveryDisplay
      };
      
      const namedResponse = await axios({
        method: 'post',
        url: `${BASE_URL}/sendTemplate?apikey=${API_KEY}`,
        headers: {
          'Content-Type': 'application/json'
        },
        data: namedData,
        timeout: 15000
      });
      
      console.log("✅ WhatsApp receipt response (named):", namedResponse.data);
      
      if (namedResponse.data && namedResponse.data.status === 200 && namedResponse.data.error === false) {
        return { success: true, data: namedResponse.data };
      } else {
        return { success: false, error: namedResponse.data?.message || "API returned error" };
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