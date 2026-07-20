-- ============================================================
-- 20260720_rls_alucurv.sql
-- Kunci RLS SEMUA tabel Alucurv (alu_*) — hanya user login ber-role
-- owner atau alucurv. Anon (publishable key publik) diblokir total.
--
-- Alasan aman untuk seluruh alu_*: workspace Alucurv HANYA diakses role
-- owner & alucurv (data user_workspaces + app_users). Tidak ada halaman
-- publik yang membaca alu_* (/alucurv-invoice butuh login). View
-- v_alu_account_balances = security_invoker → ikut RLS pemanggil.
--
-- Mengganti policy "Allow all" (dari supabase-migration-alucurv-tables.sql)
-- menjadi berbasis peran. Jalankan di Supabase → SQL Editor.
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'alu_accounts','alu_sub_categories','alu_suppliers','alu_employees',
      'alu_transactions','alu_orders','alu_invoices','alu_invoice_items',
      'alu_delivery_notes','alu_delivery_note_items','alu_hpp_calculations',
      'alu_hpp_components','alu_purchases','alu_stock_items','alu_stock_movements',
      'alu_bending_orders','alu_attendance','alu_salaries','alu_cashbons',
      'alu_cashbon_payments'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "Allow all" on %I;', t);
    execute format(
      'create policy "alu owner-alucurv" on %I for all to authenticated '
      || 'using ((auth.jwt() ->> ''user_role'') in (''owner'',''alucurv'')) '
      || 'with check ((auth.jwt() ->> ''user_role'') in (''owner'',''alucurv''));',
      t
    );
  end loop;
end $$;

-- ============================================================
-- ROLLBACK (kembalikan semua alu_* ke allow-all):
--   do $$
--   declare t text;
--   begin
--     for t in select unnest(array[
--       'alu_accounts','alu_sub_categories','alu_suppliers','alu_employees',
--       'alu_transactions','alu_orders','alu_invoices','alu_invoice_items',
--       'alu_delivery_notes','alu_delivery_note_items','alu_hpp_calculations',
--       'alu_hpp_components','alu_purchases','alu_stock_items','alu_stock_movements',
--       'alu_bending_orders','alu_attendance','alu_salaries','alu_cashbons',
--       'alu_cashbon_payments'])
--     loop
--       execute format('drop policy if exists "alu owner-alucurv" on %I;', t);
--       execute format('create policy "Allow all" on %I for all using (true) with check (true);', t);
--     end loop;
--   end $$;
-- ============================================================
