
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGross() {
    console.log("Checking gross_amount column...");
    const { data: testData, error: testError } = await supabase.from('billing_history').select('gross_amount').limit(1);
    
    if (testError) {
        console.log("Error selecting 'gross_amount' column. It probably doesn't exist:", testError.message);
    } else {
        console.log("'gross_amount' column exists!");
    }
}

checkGross();
