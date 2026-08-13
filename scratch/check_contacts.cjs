require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data } = await supabase.from('contacts').select('*');
  console.log('Total contacts:', data?.length);
  const duplicates = {};
  data?.forEach(r => {
    duplicates[r.phone] = (duplicates[r.phone] || 0) + 1;
  });
  Object.keys(duplicates).forEach(k => {
    if (duplicates[k] > 1) {
      console.log(`Duplicate found for phone: ${k}, count: ${duplicates[k]}`);
    }
  });
  console.log('Sample contact with raw phone number as name:', data?.find(c => c.name === c.phone || c.name === ''));
}
check();
