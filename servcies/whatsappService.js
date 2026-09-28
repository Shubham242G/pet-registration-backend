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
    
    const data = {
      template_name: "tailio_otp_verification",
      phone: cleanPhone,
      otp: otp,
      name: name
    };

    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/sendAuthTemplate?apikey=${API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
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
      jaipur: 'Jaipur',
      mumbai: 'Mumbai',
      thane: 'Thane',
      other: 'Other'
    };
    const cityDisplay = cityNames[city] || city || 'Not specified';
    
    const orderID = paymentId || `ORD${Date.now().toString().slice(-6)}`;
    
    console.log(`📱 Sending payment receipt to ${cleanPhone}`);
    
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
      headers: { 'Content-Type': 'application/json' },
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

/**
 * ✅ NEW: Notify ADMIN when a payment is completed
 * 
 * TODO: Replace the console.log with an actual WhatsApp API call once
 * you have an admin notification template set up. Something like:
 * 
 *   const data = {
 *     template_name: "tailio_admin_payment_alert",
 *     phone: ADMIN_WHATSAPP_NUMBER,
 *     variables: { "1": petName, "2": ownerName, "3": city, "4": amount }
 *   };
 *   await axios.post(`${BASE_URL}/sendTemplate?apikey=${API_KEY}`, data);
 */
async function sendAdminPaymentNotification(pet, owner, amount, paymentId) {
  try {
    const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER || null;
    
    console.log('\n🔔 ================ ADMIN ALERT: PAYMENT COMPLETED ================');
    console.log(`   Pet Name:   ${pet?.name || 'N/A'}`);
    console.log(`   Pet ID:     ${pet?._id || 'N/A'}`);
    console.log(`   Owner:      ${owner?.name || owner?.username || 'N/A'} (${owner?.whatsappNumber || owner?.mobile || 'N/A'})`);
    console.log(`   City:       ${pet?.city || 'N/A'}`);
    console.log(`   Amount:     ₹${Number(amount || 0).toFixed(2)}`);
    console.log(`   Payment ID: ${paymentId || 'N/A'}`);
    console.log('=================================================================\n');
    
    // TODO: Replace with real WhatsApp admin notification
    // if (ADMIN_WHATSAPP_NUMBER) {
    //   const data = {
    //     template_name: "tailio_admin_payment_alert",
    //     phone: ADMIN_WHATSAPP_NUMBER,
    //     variables: {
    //       "1": pet?.name || 'Pet',
    //       "2": owner?.name || 'Owner',
    //       "3": pet?.city || '',
    //       "4": `₹${Number(amount || 0).toFixed(2)}`
    //     }
    //   };
    //   const response = await axios.post(
    //     `${BASE_URL}/sendTemplate?apikey=${API_KEY}`,
    //     data,
    //     { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    //   );
    //   return { success: true, data: response.data };
    // }
    
    return { success: true, note: 'Logged to console. Wire up WhatsApp API in sendAdminPaymentNotification.' };
  } catch (error) {
    console.error("❌ Admin payment notification error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ✅ NEW: Notify ADMIN when all required documents are uploaded
 * 
 * TODO: Replace the console.log with an actual WhatsApp API call once
 * you have an admin notification template set up.
 */
async function sendAdminDocumentsNotification(pet, owner, uploadedCount, totalRequired) {
  try {
    console.log('\n🔔 ================ ADMIN ALERT: DOCUMENTS COMPLETE ================');
    console.log(`   Pet Name:        ${pet?.name || 'N/A'}`);
    console.log(`   Pet ID:          ${pet?._id || 'N/A'}`);
    console.log(`   Owner:           ${owner?.name || owner?.username || 'N/A'} (${owner?.whatsappNumber || owner?.mobile || 'N/A'})`);
    console.log(`   City:            ${pet?.city || 'N/A'}`);
    console.log(`   Documents:       ${uploadedCount}/${totalRequired}`);
    console.log(`   Payment Status:  ${pet?.paymentStatus || 'N/A'}`);
    console.log(`   Ready for:       License issuance`);
    console.log('==================================================================\n');
    
    // TODO: Replace with real WhatsApp admin notification
    // if (ADMIN_WHATSAPP_NUMBER) {
    //   const data = {
    //     template_name: "tailio_admin_documents_alert",
    //     phone: ADMIN_WHATSAPP_NUMBER,
    //     variables: {
    //       "1": pet?.name || 'Pet',
    //       "2": owner?.name || 'Owner',
    //       "3": pet?.city || '',
    //       "4": `${uploadedCount}/${totalRequired} docs`
    //     }
    //   };
    //   const response = await axios.post(
    //     `${BASE_URL}/sendTemplate?apikey=${API_KEY}`,
    //     data,
    //     { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    //   );
    //   return { success: true, data: response.data };
    // }
    
    return { success: true, note: 'Logged to console. Wire up WhatsApp API in sendAdminDocumentsNotification.' };
  } catch (error) {
    console.error("❌ Admin documents notification error:", error.message);
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
    
    const data = {
      template_name: "tailio_otp_verification",
      phone: cleanPhone,
      name: "Tailio Bot",
      otp: message.substring(0, 100)
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
  sendAdminPaymentNotification,
  sendAdminDocumentsNotification,
};