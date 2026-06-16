-- ============================================================
-- Pustaka Tunas Harapan — SMP Tunas Hidup Harapan Kita
-- Script database untuk Supabase (PostgreSQL)
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New query,
--             copy-paste seluruh isi file ini, lalu klik "Run".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bersihkan tabel lama (aman dijalankan berulang)
-- ------------------------------------------------------------
drop table if exists peminjaman cascade;
drop table if exists buku cascade;
drop table if exists anggota cascade;

-- ------------------------------------------------------------
-- 2. Tabel BUKU
-- ------------------------------------------------------------
create table buku (
  id        bigint generated always as identity primary key,
  judul     text    not null,
  pengarang text,
  kategori  text,
  stok      integer not null default 0,
  tahun     integer
);

-- ------------------------------------------------------------
-- 3. Tabel ANGGOTA
-- ------------------------------------------------------------
create table anggota (
  id    bigint generated always as identity primary key,
  nama  text not null,
  kelas text,
  nis   text
);

-- ------------------------------------------------------------
-- 4. Tabel PEMINJAMAN
-- ------------------------------------------------------------
create table peminjaman (
  id                   bigint generated always as identity primary key,
  buku_id              bigint references buku(id)    on delete cascade,
  anggota_id           bigint references anggota(id) on delete cascade,
  tanggal_pinjam       date    not null default current_date,
  tanggal_jatuh_tempo  date,                              -- batas pengembalian
  tanggal_kembali      date,
  denda                integer not null default 0,        -- denda keterlambatan (Rupiah)
  status               text    not null default 'dipinjam'  -- 'dipinjam' / 'kembali'
);

-- ------------------------------------------------------------
-- 5. Data dummy
-- ------------------------------------------------------------
insert into buku (judul, pengarang, kategori, stok, tahun) values
  ('Laskar Pelangi',            'Andrea Hirata',   'Novel',      5, 2005),
  ('Bumi',                      'Tere Liye',       'Fantasi',    3, 2014),
  ('Sang Pemimpi',             'Andrea Hirata',   'Novel',      4, 2006),
  ('Matematika Kelas 7',        'Tim Kemdikbud',   'Pelajaran',  10, 2021),
  ('IPA Terpadu Kelas 8',       'Tim Kemdikbud',   'Pelajaran',  8, 2021),
  ('Atlas Dunia',               'Penerbit Erlangga','Referensi', 2, 2019),
  ('Kamus Bahasa Inggris',      'John Echols',     'Referensi',  6, 2018),
  ('Negeri 5 Menara',          'Ahmad Fuadi',     'Novel',      4, 2009);

insert into anggota (nama, kelas, nis) values
  ('Budi Santoso',   '7A', '2024001'),
  ('Siti Aminah',    '7A', '2024002'),
  ('Andi Wijaya',    '7B', '2024003'),
  ('Dewi Lestari',   '8A', '2024004'),
  ('Rizky Pratama',  '8B', '2024005'),
  ('Nur Halimah',    '9A', '2024006');

-- Beberapa peminjaman dummy
-- Catatan: stok di tabel buku sengaja sudah disesuaikan secara manual di atas
-- Lama pinjam default 7 hari (tanggal_jatuh_tempo = tanggal_pinjam + 7).
insert into peminjaman (buku_id, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status) values
  -- sedang dipinjam (masih dalam tenggang)
  (1, 1, current_date,            current_date + 7,  'dipinjam'),
  -- sedang dipinjam tapi sudah TERLAMBAT (jatuh tempo kemarin)
  (2, 3, current_date - 10,       current_date - 3,  'dipinjam');

-- Riwayat: peminjaman yang sudah dikembalikan (status 'kembali')
-- denda = jumlah hari terlambat x Rp500 (tarif default)
insert into peminjaman (buku_id, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, denda, status) values
  (3, 2, current_date - 14, current_date - 7,  current_date - 8,  0,   'kembali'),  -- tepat waktu
  (4, 4, current_date - 20, current_date - 13, current_date - 12, 500, 'kembali');  -- telat 1 hari

-- ------------------------------------------------------------
-- 6. Row Level Security (RLS)
-- ------------------------------------------------------------
-- PERHATIAN: Policy di bawah ini "allow all" (siapa pun boleh baca/tulis).
-- Ini HANYA untuk mempermudah PENGUJIAN dengan anon key.
-- SAAT PRODUKSI: hapus policy ini dan buat policy yang lebih ketat
-- (mis. berdasarkan auth.uid() / role tertentu).
-- ------------------------------------------------------------
alter table buku       enable row level security;
alter table anggota    enable row level security;
alter table peminjaman enable row level security;

-- Buku
create policy "allow all - buku (PENGUJIAN SAJA)"
  on buku for all using (true) with check (true);

-- Anggota
create policy "allow all - anggota (PENGUJIAN SAJA)"
  on anggota for all using (true) with check (true);

-- Peminjaman
create policy "allow all - peminjaman (PENGUJIAN SAJA)"
  on peminjaman for all using (true) with check (true);

-- ============================================================
-- Selesai. Database siap dipakai oleh aplikasi Pustaka Tunas Harapan.
-- ============================================================
