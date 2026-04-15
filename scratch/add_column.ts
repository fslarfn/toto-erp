
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt'; // Anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
    console.log("Attempting to add 'notes' column to billing_history...");
    // Raw SQL is usually not allowed via anon key unless an RPC is set up
    const { error } = await supabase.rpc('run_sql', { sql: 'ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS notes TEXT;' });
    
    if (error) {
        console.error("Error adding column via RPC:", error.message);
        console.log("Since anon key likely lacks DDL permissions, please run this in Supabase SQL Editor:");
        console.log("ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS notes TEXT;");
    } else {
        console.log("Column added successfully!");
    }
}

addColumn();
