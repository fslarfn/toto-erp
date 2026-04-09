const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

const demoUsernames = ['owner', 'finance', 'sales', 'produksi', 'barang'];

async function deleteDemoUsers() {
    console.log('Memulai penghapusan user demo...');
    
    for (const username of demoUsernames) {
        console.log(`Menghapus user: ${username}...`);
        const { error } = await supabase
            .from('app_users')
            .delete()
            .eq('username', username);

        if (error) {
            console.error(`Gagal menghapus user ${username}:`, error.message);
        } else {
            console.log(`User ${username} berhasil dihapus.`);
        }
    }
    
    console.log('Selesai!');
}

deleteDemoUsers();
