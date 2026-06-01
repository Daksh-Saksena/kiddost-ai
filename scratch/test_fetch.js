const url = 'https://msgttjqntxqzcaqcftkm.supabase.co/rest/v1/messages?select=phone,created_at&limit=500';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ3R0anFudHhxemNhcWNmdGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTQ4NzMsImV4cCI6MjA4ODE3MDg3M30.JeFpEk2gjwWUbePCQ_Jk_R1EMCt0D-_I1ZRtGkg_n8o';

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const json = await res.json();
    const phoneCounts = {};
    for (const m of json) {
      phoneCounts[m.phone] = (phoneCounts[m.phone] || 0) + 1;
    }
    
    // Get the phone with most messages
    let topPhone = '';
    let maxCount = 0;
    for (const [phone, count] of Object.entries(phoneCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topPhone = phone;
      }
    }
    
    console.log(`Top phone: ${topPhone} with ${maxCount} messages in last 500 rows.`);
    
    // Fetch messages for this top phone
    const detailUrl = `https://msgttjqntxqzcaqcftkm.supabase.co/rest/v1/messages?phone=eq.${encodeURIComponent(topPhone)}&select=id,content,sender,role,created_at&order=created_at.asc`;
    const resDetail = await fetch(detailUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const detailJson = await resDetail.json();
    console.log(`\nMessages for ${topPhone}:`);
    for (const m of detailJson) {
      console.log(`[${m.created_at}] ID: ${m.id} | Content: ${m.content ? m.content.slice(0, 30) : ''}`);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
