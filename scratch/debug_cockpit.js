
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCockpit() {
  console.log('--- Debugging Cockpit Data ---');

  // 1. Check order_date format
  const { data: orderDates, error: orderErr } = await supabase.from('orders').select('order_date').limit(3);
  console.log('Order Dates sample:', orderDates);

  // 2. Check cash_flow date format
  const { data: cfDates, error: cfErr } = await supabase.from('cash_flow').select('date').limit(3);
  console.log('Cash Flow Dates sample:', cfDates);

  // 3. Test RPC fn_cockpit_cashflow_14d
  console.log('\nTesting fn_cockpit_cashflow_14d...');
  const { data: forecast, error: forecastErr } = await supabase.rpc('fn_cockpit_cashflow_14d');
  if (forecastErr) {
    console.error('Forecast RPC Error:', forecastErr);
  } else {
    console.log('Forecast RPC Success (first 2 items):', forecast?.slice(0, 2));
  }

  // 4. Check Aging
  const { data: aging, error: agingErr } = await supabase.from('v_cockpit_aging').select('*');
  console.log('\nAging Data:', aging);

  // 5. Check stuck orders
  const { data: stuck, error: stuckErr } = await supabase.from('v_cockpit_stuck_orders').select('*');
  console.log('\nStuck Orders Count:', stuck?.length || 0);
}

debugCockpit();
