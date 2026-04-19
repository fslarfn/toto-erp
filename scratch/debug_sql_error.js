
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCockpit() {
  console.log('--- Debugging fn_cockpit_cashflow_14d ---');
  const { data, error } = await supabase.rpc('fn_cockpit_cashflow_14d');
  if (error) {
    console.error('Error calling fn_cockpit_cashflow_14d:', error);
  } else {
    console.log('Data from cashflow:', data);
  }

  console.log('\n--- Debugging v_cockpit_aging ---');
  const { data: aging, error: agingErr } = await supabase.from('v_cockpit_aging').select('*');
  if (agingErr) {
    console.error('Error fetching v_cockpit_aging:', agingErr);
  } else {
    console.log('Aging data:', aging);
  }

  console.log('\n--- Checking pesanan_rows data ---');
  const { data: rows, error: rowsErr } = await supabase
    .from('pesanan_rows')
    .select('id, tanggal, is_paid, harga, ukuran, qty')
    .limit(5);
  
  if (rowsErr) {
     console.error('Error fetching pesanan_rows:', rowsErr);
  } else {
     console.log('Sample pesanan_rows:', rows);
  }
}

debugCockpit();
