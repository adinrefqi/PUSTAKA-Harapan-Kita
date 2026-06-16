-- ============================================================
-- Pustaka Tunas Harapan — SMP Tunas Hidup Harapan Kita
-- Script database untuk Supabase (PostgreSQL)
-- Cara pakai: buka Supabase Dashboard > SQL Editor > New query,
--             copy-paste seluruh isi file ini, lalu klik "Run".
--
-- MODEL: tiap FISIK buku (eksemplar) punya KODE UNIK sendiri.
--   buku       = judul/pengarang/kategori (informasi umum)
--   eksemplar  = salinan fisik, 1 baris = 1 buku nyata, punya kode unik
--   peminjaman = mengacu ke eksemplar tertentu (bukan sekadar judul)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bersihkan tabel lama (aman dijalankan berulang)
-- ------------------------------------------------------------
drop table if exists peminjaman cascade;
drop table if exists eksemplar  cascade;
drop table if exists buku       cascade;
drop table if exists anggota    cascade;

-- ------------------------------------------------------------
-- 2. Tabel BUKU (informasi judul; TANPA kolom stok)
-- ------------------------------------------------------------
create table buku (
  id        bigint generated always as identity primary key,
  judul     text    not null,
  pengarang text,
  kategori  text,
  tahun     integer
);

-- ------------------------------------------------------------
-- 3. Tabel EKSEMPLAR (salinan fisik, tiap baris = 1 buku nyata)
--    kode = identitas unik yang dicetak jadi barcode label
--    status = 'tersedia' / 'dipinjam'
-- ------------------------------------------------------------
create table eksemplar (
  id      bigint generated always as identity primary key,
  buku_id bigint not null references buku(id) on delete cascade,
  kode    text   not null unique,
  status  text   not null default 'tersedia'
);

-- ------------------------------------------------------------
-- 4. Tabel ANGGOTA
-- ------------------------------------------------------------
create table anggota (
  id    bigint generated always as identity primary key,
  nama  text not null,
  kelas text,
  nis   text
);

-- ------------------------------------------------------------
-- 5. Tabel PEMINJAMAN (mengacu ke EKSEMPLAR tertentu)
-- ------------------------------------------------------------
create table peminjaman (
  id                   bigint generated always as identity primary key,
  eksemplar_id         bigint references eksemplar(id) on delete cascade,
  anggota_id           bigint references anggota(id)   on delete cascade,
  tanggal_pinjam       date    not null default current_date,
  tanggal_jatuh_tempo  date,                              -- batas pengembalian
  tanggal_kembali      date,
  denda                integer not null default 0,        -- denda keterlambatan (Rupiah)
  status               text    not null default 'dipinjam'  -- 'dipinjam' / 'kembali'
);

-- ------------------------------------------------------------
-- 6. Data dummy
-- ------------------------------------------------------------
insert into buku (judul, pengarang, kategori, tahun) values
  ('Laskar Pelangi',            'Andrea Hirata',    'Novel',      2005),
  ('Bumi',                      'Tere Liye',        'Fantasi',    2014),
  ('Sang Pemimpi',              'Andrea Hirata',    'Novel',      2006),
  ('Matematika Kelas 7',        'Tim Kemdikbud',    'Pelajaran',  2021),
  ('IPA Terpadu Kelas 8',       'Tim Kemdikbud',    'Pelajaran',  2021),
  ('Atlas Dunia',               'Penerbit Erlangga','Referensi',  2019),
  ('Kamus Bahasa Inggris',      'John Echols',      'Referensi',  2018),
  ('Negeri 5 Menara',           'Ahmad Fuadi',      'Novel',      2009);

-- Buat eksemplar otomatis sesuai jumlah salinan tiap buku.
-- Kode unik berformat: B<idbuku 3 digit>-<nomor salinan 2 digit>, mis. B001-01
insert into eksemplar (buku_id, kode, status)
select s.bid,
       'B' || lpad(s.bid::text, 3, '0') || '-' || lpad(n::text, 2, '0'),
       'tersedia'
from (values (1,5),(2,3),(3,4),(4,10),(5,8),(6,2),(7,6),(8,4)) as s(bid, jml)
cross join lateral generate_series(1, s.jml) as n;

insert into anggota (nama, kelas, nis) values
  ('Budi Santoso',   '7A', '2024001'),
  ('Siti Aminah',    '7A', '2024002'),
  ('Andi Wijaya',    '7B', '2024003'),
  ('Dewi Lestari',   '8A', '2024004'),
  ('Rizky Pratama',  '8B', '2024005'),
  ('Nur Halimah',    '9A', '2024006');

-- Peminjaman dummy yang SEDANG berjalan (status 'dipinjam')
insert into peminjaman (eksemplar_id, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, status)
select e.id, 1, current_date,      current_date + 7, 'dipinjam' from eksemplar e where e.kode = 'B001-01'
union all
select e.id, 3, current_date - 10, current_date - 3, 'dipinjam' from eksemplar e where e.kode = 'B002-01';

-- Tandai eksemplar yang sedang dipinjam
update eksemplar set status = 'dipinjam' where kode in ('B001-01', 'B002-01');

-- Riwayat: sudah dikembalikan (status 'kembali'); eksemplar tetap 'tersedia'
insert into peminjaman (eksemplar_id, anggota_id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, denda, status)
select e.id, 2, current_date - 14, current_date - 7,  current_date - 8,  0,   'kembali' from eksemplar e where e.kode = 'B003-01'
union all
select e.id, 4, current_date - 20, current_date - 13, current_date - 12, 500, 'kembali' from eksemplar e where e.kode = 'B004-01';

-- ------------------------------------------------------------
-- 7. Row Level Security (RLS)
-- ------------------------------------------------------------
-- PERHATIAN: Policy "allow all" HANYA untuk PENGUJIAN dengan anon key.
-- SAAT PRODUKSI: perketat (mis. berdasarkan auth.uid() / role).
-- ------------------------------------------------------------
alter table buku       enable row level security;
alter table eksemplar  enable row level security;
alter table anggota    enable row level security;
alter table peminjaman enable row level security;

create policy "allow all - buku (PENGUJIAN SAJA)"
  on buku for all using (true) with check (true);
create policy "allow all - eksemplar (PENGUJIAN SAJA)"
  on eksemplar for all using (true) with check (true);
create policy "allow all - anggota (PENGUJIAN SAJA)"
  on anggota for all using (true) with check (true);
create policy "allow all - peminjaman (PENGUJIAN SAJA)"
  on peminjaman for all using (true) with check (true);

-- ============================================================
-- Selesai. Database siap dipakai oleh aplikasi Pustaka Tunas Harapan.
-- ============================================================
