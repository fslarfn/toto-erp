
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditDatabase() {
  console.log('--- Database Audit ---');
  
  // List all tables (hacky way via RPC or just try common ones)
  const tables = ['pesanan_rows', 'orders', 'cash_flow', 'bank_accounts', 'app_users'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${table}: ERROR (${error.message})`);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }

  const { data: pesanan, error: pErr } = await supabase.from('pesanan_rows').select('*').limit(1);
  if (pesanan?.[0]) {
     console.log('\nPesanan Rows sample columns:', Object.keys(pesanan[0]));
  }
}

auditDatabase();
