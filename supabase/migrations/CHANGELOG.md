# Supabase Migrations Changelog

## 20260513_security_hardening.sql
**Tujuan:** Menutup 4 security error yang diflag Supabase Advisor.

### Perubahan
| # | Objek | Aksi |
|---|-------|------|
| 1 | `billing_manual_confirmations` | Adopsi DDL ke migration history + ENABLE RLS deny-all (no policy = block semua non-service_role) |
| 2 | `v_cockpit_aging` | `SET (security_invoker = true)` — eksplisit SECURITY INVOKER |
| 3 | `v_cockpit_top_debtors` | `SET (security_invoker = true)` |
| 4 | `v_cockpit_stuck_orders` (plural, canonical) | `ALTER VIEW IF EXISTS` — nama resmi dari migration 20260419 |
| 4b | `v_cockpit_stuck_order` (singular, safety net) | DO block + `EXCEPTION WHEN undefined_table THEN NULL` |

### Rollback
```sql
-- 2. Kembalikan view ke implicit behavior
ALTER VIEW IF EXISTS public.v_cockpit_stuck_orders SET (security_invoker = false);
ALTER VIEW IF EXISTS public.v_cockpit_stuck_order  SET (security_invoker = false);
ALTER VIEW IF EXISTS public.v_cockpit_top_debtors  SET (security_invoker = false);
ALTER VIEW IF EXISTS public.v_cockpit_aging         SET (security_invoker = false);

-- 1. Nonaktifkan RLS (hati-hati: data jadi terbuka lagi)
ALTER TABLE public.billing_manual_confirmations DISABLE ROW LEVEL SECURITY;
-- DROP TABLE hanya jika environment fresh — JANGAN di production
```

---

## 20260513_rls_performance.sql
**Tujuan:** Menutup 34 security warning + 12 performance warning Supabase Advisor.

### Perubahan
| # | Objek | Sebelum | Sesudah |
|---|-------|---------|---------|
| 1 | `cockpit_settings` | DDL tidak di-version; no RLS | Adopsi DDL + ENABLE RLS deny-all |
| 2 | `monthly_targets` | 2 policy menarget `authenticated` (tidak efektif — app pakai custom auth) | 1 policy SELECT untuk `anon, authenticated`; **write policy dihapus** — write harus via service_role API route |
| 3 | `billing_history` | 2 permissive SELECT policy (overhead ganda) | 1 policy SELECT `billing_history_select_combined` |

### Catatan Arsitektur
App menggunakan **custom auth** (tabel `app_users`), **bukan** Supabase Auth.
`auth.uid()` selalu NULL. Role `authenticated` tidak pernah aktif.
Pola `(SELECT auth.uid())` adalah hygiene Advisor — dievaluasi sekali per query (subquery cache), bukan sekali per baris.

### Rollback
```sql
-- 3. Kembalikan policies billing_history
DROP POLICY IF EXISTS "billing_history_select_combined" ON public.billing_history;
CREATE POLICY "Allow read for all on billing_history"
    ON public.billing_history FOR SELECT USING (true);
CREATE POLICY "Allow system handle billing_history"
    ON public.billing_history FOR ALL USING (true) WITH CHECK (true);

-- 2. Kembalikan policies monthly_targets
DROP POLICY IF EXISTS "monthly_targets_select" ON public.monthly_targets;
DROP POLICY IF EXISTS "monthly_targets_write"  ON public.monthly_targets;
CREATE POLICY "Allow read for authenticated"
    ON public.monthly_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write for all"
    ON public.monthly_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 1. Nonaktifkan RLS cockpit_settings
ALTER TABLE public.cockpit_settings DISABLE ROW LEVEL SECURITY;
```

---

## Migration Sebelumnya

| File | Isi |
|------|-----|
| `20260419_cockpit.sql` | Tabel & view cockpit ERP awal |
| `20260420_add_bpjs_to_gaji.sql` | Tambah kolom BPJS ke tabel gaji |
| `20260423_push_subscriptions.sql` | Tabel push_subscriptions untuk Web Push |
