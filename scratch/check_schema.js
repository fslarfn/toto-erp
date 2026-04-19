
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking orders schema...');
  const { data: orders, error } = await supabase.from('orders').select().limit(1);
  if (error) console.error(error);
  else console.log('Orders columns:', Object.keys(orders[0] || {}));

  console.log('\nChecking cash_flow schema...');
  const { data: cf, error: cfErr } = await supabase.from('cash_flow').select().limit(1);
  if (cfErr) console.error(cfErr);
  else console.log('Cash Flow columns:', Object.keys(cf[0] || {}));
}

checkSchema();
