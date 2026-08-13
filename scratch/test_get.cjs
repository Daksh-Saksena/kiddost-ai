const axios = require('axios');

async function testGet() {
  try {
    const res = await axios.get('https://kiddost-ai.onrender.com/contacts');
    console.log("Found contacts:", Object.keys(res.data.contacts).length);
    console.log("Test Update Name contact:", res.data.contacts['+919988776655']);
  } catch (e) {
    console.log("Failed:", e.response?.data || e.message);
  }
}

testGet();
