const axios = require('axios');

const phone = '+918861003734';

const newMessages = [
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'Can you confirm',
    created_at: '2026-09-19T06:21:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'Let me know what slots are possible for today',
    created_at: '2026-09-19T06:21:30.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: 'Hi Manan, as your location is a bit far from where our current members are based, we would need at least a 1.5-hour session to make it financially viable for us.\n\nAlternatively, you could wait for a few weeks - we are strengthening our team in your area and will be happy to inform you once we have a member closer to you.',
    created_at: '2026-09-19T06:22:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'We can do 1.5 hours',
    created_at: '2026-09-19T06:24:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'agent',
    agent: 'Daksh Saksena',
    content: 'Great, sharing details shortly',
    created_at: '2026-09-19T06:24:30.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'Infact make it 2 hours',
    created_at: '2026-09-19T06:27:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'Confirmed?',
    created_at: '2026-09-19T06:38:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: 'Hi, thank you for contacting KidDost.',
    created_at: '2026-09-19T06:45:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: '?',
    created_at: '2026-09-19T06:49:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: '',
    created_at: '2026-09-19T06:50:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: "Can you read above chat and confirm today's booking",
    created_at: '2026-09-19T06:54:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: 'Feel free to let us know if you have any questions.',
    created_at: '2026-09-19T06:55:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'agent',
    agent: 'Daksh Saksena',
    content: 'We are happy to introduce Dharani, one of our KidDost members. She is a 21-year-old graduate who is fluent in English and Telugu and understands basic Hindi. She has consistently received fantastic reviews from parents and should be a great fit.',
    created_at: '2026-09-19T06:56:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'agent',
    agent: 'Daksh Saksena',
    content: 'We will be sharing the QR code, kindly pay ₹750 for 1.5 hours for the booking confirmation.',
    created_at: '2026-09-19T06:57:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: 'Could you please share your child’s age with us?',
    created_at: '2026-09-19T06:59:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: '4 years',
    created_at: '2026-09-19T07:03:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'ai',
    agent: null,
    content: 'Hi, thank you for contacting KidDost.',
    created_at: '2026-09-19T07:18:00.000Z'
  },
  {
    phone,
    role: 'assistant',
    sender: 'agent',
    agent: 'Daksh Saksena',
    content: 'Sorry for our AI bot glitch. Kindly ignore',
    created_at: '2026-09-19T07:19:00.000Z'
  },
  {
    phone,
    role: 'user',
    sender: 'user',
    agent: null,
    content: 'Ok',
    created_at: '2026-09-19T07:22:00.000Z'
  }
];

async function run() {
  console.log('Sending', newMessages.length, 'messages to Render...');
  try {
    const res = await axios.post('https://kiddost-ai.onrender.com/backfill-messages', {
      secret: 'kiddost_sync_2026',
      messages: newMessages
    });
    console.log('Render Response:', res.status, res.data);
  } catch (err) {
    console.error('Failed:', err.response?.status, err.response?.data || err.message);
  }
}

run();
