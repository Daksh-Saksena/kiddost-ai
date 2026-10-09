const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('agent-dashboard/.env.local', 'utf8'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY);

async function inspectChat(phone) {
  console.log(`\n================ CHAT: ${phone} ================`);
  const { data: conv } = await supabase.from('conversations').select('*').eq('phone', phone).single();
  console.log('Conversation record:', JSON.stringify(conv, null, 2));

  const { data: msgs } = await supabase
    .from('messages')
    .select('role, sender, content, created_at')
    .eq('phone', phone)
    .order('created_at', { ascending: true });

  for (const m of msgs || []) {
    const time = new Date(m.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`[${time}] [${m.sender || m.role}]: ${m.content}`);
  }
}

async function run() {
  await inspectChat('+916363103844');
  await inspectChat('+919740271462');
  await inspectChat('+919449151225');
}
run();
