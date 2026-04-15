
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearHistory() {
    console.log("Clearing billing_history...");
    const { data, error } = await supabase
        .from('billing_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
        console.error("Error clearing history:", error);
    } else {
        console.log("History cleared successfully!");
    }
}

clearHistory();
