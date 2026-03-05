import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = {};
  for (const l of lines) {
    const [k, ...rest] = l.split('=');
    out[k] = rest.join('=');
  }
  return out;
}

const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found in', process.cwd());
  process.exit(1);
}

const env = loadEnv(envPath);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.NEXT_PUBLIC_SUPABASE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Supabase URL or KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

async function run() {
  try {
    const { data, error, count } = await supabase.from('messages').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(20);
    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }
    console.log('Total rows (approx):', count ?? (data && data.length));
    console.log('Sample rows:', JSON.stringify(data?.slice(0, 10), null, 2));
  } catch (err) {
    console.error('Unexpected error', err);
    process.exit(1);
  }
}

run();
