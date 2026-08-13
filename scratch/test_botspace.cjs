require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// We don't have SUPABASE_URL locally, but we can hit BotSpace API if we have a conversationId!
// Let's just fetch ONE conversation using BotSpace API if the user knows one, or we can just 
// check if the BotSpace /conversations endpoint works.

const BOTSPACE_API_KEY = 'botspace_a2e25513-0105-4d6a-aac9-06e7dbc5b702'; // From the error log earlier
const CHANNEL_ID = '148d8c36-829d-473d-9a91-d309088cb15f';

async function testBotspace() {
  try {
    // Try to get a list of conversations
    const res = await axios.get(`https://public-api.bot.space/v1/${CHANNEL_ID}/conversation`, {
      params: { apiKey: BOTSPACE_API_KEY }
    });
    console.log("Conversations endpoint worked! Found:", res.data?.length || res.data);
    if (res.data && res.data.length > 0) {
      console.log("First conversation:", res.data[0]);
    }
  } catch (err) {
    console.log("Failed GET /conversation. Error:", err.response?.data || err.message);
  }
}

testBotspace();
