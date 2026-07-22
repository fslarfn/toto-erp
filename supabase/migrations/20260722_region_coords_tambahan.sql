-- ============================================================
-- 20260722_region_coords_tambahan.sql
-- Seed tambahan region_coords: 49 kota luar Jabodetabek (Jawa,
-- Sumatera, Kalimantan, Sulawesi, Bali/NT, Maluku/Papua).
--
-- CATATAN: sudah DITERAPKAN ke produksi 22 Jul 2026 via skrip
-- (bersama auto-isi customers.kota dari nama utk 295 customer).
-- File ini arsip repo agar environment lain bisa direproduksi —
-- ON CONFLICT DO NOTHING → aman dijalankan ulang kapan pun.
-- ============================================================

INSERT INTO region_coords (kota, provinsi, lat, lng) VALUES
  ('Jakarta',        'DKI Jakarta',          -6.2000, 106.8167),
  ('Cibubur',        'Jawa Barat',           -6.3676, 106.9022),
  ('Serang',         'Banten',               -6.1149, 106.1502),
  ('Cilegon',        'Banten',               -6.0027, 106.0119),
  ('Sukabumi',       'Jawa Barat',           -6.9277, 106.9300),
  ('Purwakarta',     'Jawa Barat',           -6.5569, 107.4432),
  ('Cirebon',        'Jawa Barat',           -6.7320, 108.5523),
  ('Semarang',       'Jawa Tengah',          -6.9667, 110.4167),
  ('Kendal',         'Jawa Tengah',          -6.9217, 110.2031),
  ('Solo',           'Jawa Tengah',          -7.5755, 110.8243),
  ('Yogyakarta',     'DI Yogyakarta',        -7.7956, 110.3695),
  ('Tegal',          'Jawa Tengah',          -6.8694, 109.1402),
  ('Pekalongan',     'Jawa Tengah',          -6.8886, 109.6753),
  ('Purwokerto',     'Jawa Tengah',          -7.4244, 109.2396),
  ('Kudus',          'Jawa Tengah',          -6.8048, 110.8405),
  ('Surabaya',       'Jawa Timur',           -7.2575, 112.7521),
  ('Gresik',         'Jawa Timur',           -7.1539, 112.6564),
  ('Sidoarjo',       'Jawa Timur',           -7.4478, 112.7183),
  ('Malang',         'Jawa Timur',           -7.9666, 112.6326),
  ('Kediri',         'Jawa Timur',           -7.8480, 112.0178),
  ('Jember',         'Jawa Timur',           -8.1845, 113.6681),
  ('Madiun',         'Jawa Timur',           -7.6298, 111.5300),
  ('Bali',           'Bali',                 -8.6705, 115.2126),
  ('Lombok',         'Nusa Tenggara Barat',  -8.5833, 116.1167),
  ('Bima',           'Nusa Tenggara Barat',  -8.4601, 118.7268),
  ('Kupang',         'Nusa Tenggara Timur', -10.1772, 123.6070),
  ('Medan',          'Sumatera Utara',        3.5952,  98.6722),
  ('Palembang',      'Sumatera Selatan',     -2.9761, 104.7754),
  ('Lampung',        'Lampung',              -5.4500, 105.2667),
  ('Pekanbaru',      'Riau',                  0.5071, 101.4478),
  ('Padang',         'Sumatera Barat',       -0.9471, 100.4172),
  ('Jambi',          'Jambi',                -1.6101, 103.6131),
  ('Bengkulu',       'Bengkulu',             -3.8004, 102.2655),
  ('Batam',          'Kepulauan Riau',        1.0456, 104.0305),
  ('Aceh',           'Aceh',                  5.5483,  95.3238),
  ('Pontianak',      'Kalimantan Barat',     -0.0263, 109.3425),
  ('Banjarmasin',    'Kalimantan Selatan',   -3.3186, 114.5944),
  ('Balikpapan',     'Kalimantan Timur',     -1.2379, 116.8529),
  ('Samarinda',      'Kalimantan Timur',     -0.4948, 117.1436),
  ('Palangka Raya',  'Kalimantan Tengah',    -2.2096, 113.9108),
  ('Makassar',       'Sulawesi Selatan',     -5.1477, 119.4327),
  ('Sengkang',       'Sulawesi Selatan',     -4.1349, 120.0259),
  ('Kendari',        'Sulawesi Tenggara',    -3.9985, 122.5130),
  ('Manado',         'Sulawesi Utara',        1.4748, 124.8421),
  ('Palu',           'Sulawesi Tengah',      -0.8917, 119.8707),
  ('Gorontalo',      'Gorontalo',             0.5435, 123.0568),
  ('Ambon',          'Maluku',               -3.6954, 128.1814),
  ('Jayapura',       'Papua',                -2.5916, 140.6690),
  ('Papua',          'Papua',                -2.5916, 140.6690)
ON CONFLICT (kota) DO NOTHING;

-- Verifikasi: SELECT count(*) FROM region_coords;  -- ≥ 58
-- ============================================================
