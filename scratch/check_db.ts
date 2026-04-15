
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log("Checking columns for billing_history...");
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'billing_history' });
    
    // If RPC doesn't exist, try a simple query to see if notes exists
    const { data: testData, error: testError } = await supabase.from('billing_history').select('notes').limit(1);
    
    if (testError) {
        console.log("Error selecting 'notes' column. It probably doesn't exist:", testError.message);
    } else {
        console.log("'notes' column exists!");
    }
}

checkColumns();
