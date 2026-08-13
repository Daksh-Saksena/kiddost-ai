require('dotenv').config();
const axios = require('axios');

const BOTSPACE_API_KEY = process.env.BOTSPACE_API_KEY;
const CHANNEL_ID = process.env.BOTSPACE_CHANNEL_ID || '148d8c36-829d-473d-9a91-d309088cb15f'; // default if missing in env

async function fetchContacts() {
  try {
    const res = await axios.get(`https://public-api.bot.space/v1/${CHANNEL_ID}/contacts`, {
      params: { apiKey: BOTSPACE_API_KEY }
    });
    console.log("Success! Contacts found:", res.data?.length || res.data);
    if (res.data && res.data.length > 0) {
      console.log("Sample contact:", res.data[0]);
    }
  } catch (err) {
    console.log("Failed to fetch /contacts directly. Error:", err.response?.data || err.message);
  }
}

fetchContacts();
