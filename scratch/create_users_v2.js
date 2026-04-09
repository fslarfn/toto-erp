const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jsezyvrxhgpdbitxaezn.supabase.co';
const supabaseKey = 'sb_publishable_7NpAoRR6bkQuArhOx5VC6A_SsgZGBrt';
const supabase = createClient(supabaseUrl, supabaseKey);

const usersToCreate = [
    { username: 'toto', name: 'Toto', role: 'owner', password_hash: 'toto123' },
    { username: 'fauzi', name: 'Fauzi', role: 'owner', password_hash: 'toto123' },
    { username: 'faisal', name: 'Faisal', role: 'owner', password_hash: 'toto123' },
    { username: 'vira', name: 'Vira', role: 'finance', password_hash: 'toto123' },
    { username: 'yuni', name: 'Yuni', role: 'owner', password_hash: 'toto123' },
    { username: 'fadli', name: 'Fadli', role: 'produksi', password_hash: 'toto123' },
    { username: 'dika', name: 'Dika', role: 'barang', password_hash: 'toto123' },
];

async function createUsersV2() {
    console.log('Memulai pembuatan user (V2)...');
    
    for (const u of usersToCreate) {
        console.log(`Memproses user: ${u.username}...`);
        const { data, error } = await supabase
            .from('app_users')
            .upsert(u, { onConflict: 'username' });

        if (error) {
            console.error(`Gagal membuat user ${u.username}:`, error.message);
        } else {
            console.log(`User ${u.username} berhasil dibuat/diperbarui.`);
        }
    }
    
    console.log('Selesai!');
}

createUsersV2();
