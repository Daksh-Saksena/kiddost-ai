const axios = require('axios');

async function testPost() {
  try {
    const res = await axios.post('https://kiddost-ai.onrender.com/contacts', {
      phone: '+919988776655',
      name: 'Test Update Name',
      notes: 'Testing'
    });
    console.log("Success:", res.data);
  } catch (e) {
    console.log("Failed:", e.response?.data || e.message);
  }
}

testPost();
