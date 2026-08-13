require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data } = await supabase.from('contacts').select('*');
  const emptyNames = data.filter(d => !d.name || d.name === d.phone || /^(\+?\d+)$/.test(d.name));
  console.log(`Out of ${data.length} contacts, ${emptyNames.length} have missing/number-only names.`);
  console.log('Sample of empty names:', emptyNames.slice(0, 3));
}
check();
