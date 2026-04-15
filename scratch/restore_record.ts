
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreRecord() {
    console.log("Restoring missing history record (without notes)...");
    const { data, error } = await supabase.from('billing_history').insert({
        order_id: `ADMIN-MANUAL-FIX-${Date.now()}`,
        amount: 20500000,
        payment_type: 'initial',
        status: 'settlement',
        payment_method: 'ADMIN_DIRECT',
        created_at: new Date().toISOString()
    });

    if (error) {
        console.error("Error restoring record:", error.message);
    } else {
        console.log("Record restored successfully!");
    }
}

restoreRecord();
