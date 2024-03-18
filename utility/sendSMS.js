require('dotenv').config();
const twilio = require('twilio');


const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSMS = async (to, message) => {
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`SMS sent: ${result.sid}`);
  } catch (error) {
    console.error(`Error sending SMS: ${error.message}`);
  }
};

module.exports = sendSMS;
