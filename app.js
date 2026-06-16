// ============================================================
// Pustaka Tunas Harapan — Logika aplikasi (vanilla JS)
// Membutuhkan: config.js (SUPABASE_URL, SUPABASE_ANON_KEY)
//              dan supabase-js v2 (dimuat via CDN di index.html)
// ============================================================

// ============================================================
// TEMA (terang / gelap) — tersimpan di localStorage
// ============================================================
function terapkanTema(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  const ico = document.querySelector("#theme-toggle .theme-ico");
  if (ico) ico.textContent = mode === "dark" ? "☀️" : "🌙";
  // sesuaikan warna bar status di Android/browser
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#0a1f15" : "#0f5132");
}
function toggleTema() {
  const sekarang = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const baru = sekarang === "dark" ? "light" : "dark";
  try { localStorage.setItem("tema", baru); } catch (e) {}
  terapkanTema(baru);
}
// Terapkan tema sedini mungkin (sebelum render konten) untuk hindari "kedip"
(function initTema() {
  let simpan = null;
  try { simpan = localStorage.getItem("tema"); } catch (e) {}
  if (!simpan && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    simpan = "dark";
  }
  terapkanTema(simpan === "dark" ? "dark" : "light");
})();

// ---- Inisialisasi klien Supabase ----
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Pengaturan ----
const LAMA_PINJAM_HARI = 7;   // lama peminjaman default (hari)
const TARIF_DENDA = 500;      // denda keterlambatan per hari (Rupiah)

// ---- Util format Rupiah ----
function rupiah(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

// ---- Util: unduh data sebagai file CSV ----
// baris = array of array (baris pertama dianggap header)
function unduhCSV(namaFile, baris) {
  const isi = baris.map((r) =>
    r.map((sel) => {
      const s = String(sel ?? "");
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")
  ).join("\r\n");

  // ﻿ (BOM) supaya Excel membaca UTF-8 dengan benar
  const blob = new Blob(["﻿" + isi], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Util tanggal ----
function hariIni() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function tambahHari(tanggalStr, jumlah) {
  const d = new Date(tanggalStr + "T00:00:00");
  d.setDate(d.getDate() + jumlah);
  return d.toISOString().slice(0, 10);
}
// selisih hari (positif = jatuh tempo masih akan datang, negatif = sudah lewat)
function sisaHari(jatuhTempoStr) {
  if (!jatuhTempoStr) return null;
  const ms = new Date(jatuhTempoStr + "T00:00:00") - new Date(hariIni() + "T00:00:00");
  return Math.round(ms / 86400000);
}

// ---- Util: animasi angka menghitung naik (count-up) ----
function countUp(el, target) {
  if (!el) return;
  target = Number(target) || 0;
  const awal = Number(el.dataset.val) || 0;
  // Jika tidak berubah, atau pengguna minta kurangi gerakan: set langsung
  if (awal === target || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    el.textContent = target; el.dataset.val = target; return;
  }

  const durasi = 900; // ms
  let mulai = null;
  // easeOutCubic untuk gerakan yang terasa premium
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function langkah(waktu) {
    if (mulai === null) mulai = waktu;
    const progres = Math.min((waktu - mulai) / durasi, 1);
    const nilai = Math.round(awal + (target - awal) * ease(progres));
    el.textContent = nilai;
    if (progres < 1) {
      requestAnimationFrame(langkah);
    } else {
      el.textContent = target;
      el.dataset.val = target;
      el.classList.remove("count-pop");
      void el.offsetWidth;       // reset agar animasi bisa diputar ulang
      el.classList.add("count-pop");
    }
  }
  requestAnimationFrame(langkah);
}

// ---- Util: placeholder skeleton (shimmer) saat memuat ----
function skeletonItems(n = 5) {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += `
    <div class="item item-compact skeleton-item">
      <div class="sk sk-cover"></div>
      <div class="item-body">
        <div class="sk sk-line sk-title"></div>
        <div class="sk sk-line sk-meta"></div>
        <div class="item-tags">
          <span class="sk sk-chip"></span><span class="sk sk-chip"></span>
        </div>
      </div>
    </div>`;
  }
  return s;
}

// ---- Muat ulang data tab yang sedang aktif (dipakai pull-to-refresh) ----
async function muatTabAktif() {
  const aktif = document.querySelector(".page.active");
  const id = aktif ? aktif.id : "dashboard";
  if (id === "dashboard") await muatDashboard();
  else if (id === "buku") await muatBuku(document.getElementById("cari-buku").value.trim());
  else if (id === "anggota") await muatAnggota(document.getElementById("cari-anggota").value.trim());
  else if (id === "peminjaman") await muatPeminjaman();
}

// ---- Util: tampilkan pesan toast ----
let toastTimer = null;
function toast(pesan, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = pesan;
  el.className = "toast" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
}

// ---- Util: escape teks agar aman dimasukkan ke HTML ----
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ============================================================
// EFEK RIPPLE (Material-style) untuk tombol & tab
// ============================================================
const KURANGI_GERAK = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.addEventListener("pointerdown", (e) => {
  if (KURANGI_GERAK) return; // hormati preferensi kurangi gerakan
  const target = e.target.closest(".btn, .tab, .subtab, .theme-toggle, .ikon-btn");
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const ukuran = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = ukuran + "px";
  ripple.style.left = (e.clientX - rect.left - ukuran / 2) + "px";
  ripple.style.top = (e.clientY - rect.top - ukuran / 2) + "px";

  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

// ============================================================
// PULL TO REFRESH (tarik ke bawah untuk muat ulang)
// ============================================================
(function setupPTR() {
  const ptr = document.getElementById("ptr");
  if (!ptr) return;
  const ico = ptr.querySelector(".ptr-ico");
  const AMBANG = 70;   // jarak minimal untuk memicu refresh
  const MAKS = 110;    // tarikan maksimal
  let startY = 0, pulling = false, jarak = 0, sibuk = false;

  function bolehTarik() {
    if (sibuk) return false;
    // hanya saat halaman di paling atas & tak ada modal terbuka
    const modalTerbuka = [...document.querySelectorAll(".modal-backdrop")]
      .some((m) => !m.classList.contains("hidden"));
    return window.scrollY <= 0 && !modalTerbuka;
  }
  function reset() {
    ptr.classList.add("snap");
    ptr.style.transform = "translate(-50%, -60px)";
    ptr.style.opacity = "0";
    ptr.classList.remove("siap");
    if (ico) ico.style.transform = "";
  }

  window.addEventListener("touchstart", (e) => {
    if (!bolehTarik()) { pulling = false; return; }
    startY = e.touches[0].clientY;
    pulling = true; jarak = 0;
    ptr.classList.remove("snap"); // ikuti jari tanpa lag
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    jarak = e.touches[0].clientY - startY;
    if (jarak <= 0) { pulling = false; reset(); return; }
    if (!bolehTarik()) { pulling = false; reset(); return; }
    e.preventDefault(); // cegah overscroll bawaan
    const tarik = Math.min(jarak * 0.5, MAKS);
    ptr.style.transform = `translate(-50%, ${tarik - 8}px)`;
    ptr.style.opacity = String(Math.min(tarik / AMBANG, 1));
    ptr.classList.toggle("siap", tarik >= AMBANG);
    if (ico) ico.style.transform = `rotate(${tarik * 3}deg)`;
  }, { passive: false });

  window.addEventListener("touchend", async () => {
    if (!pulling) return;
    pulling = false;
    const tarik = Math.min(jarak * 0.5, MAKS);
    if (tarik >= AMBANG) {
      sibuk = true;
      ptr.classList.add("loading", "snap");
      ptr.classList.remove("siap");
      ptr.style.transform = "translate(-50%, 58px)";
      ptr.style.opacity = "1";
      try { await muatTabAktif(); } catch (e) {}
      ptr.classList.remove("loading");
      sibuk = false;
    }
    reset();
  });
})();

// ============================================================
// NAVIGASI TAB
// ============================================================
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => pindahTab(tab.dataset.target, tab));
});

const URUTAN_TAB = ["dashboard", "buku", "anggota", "peminjaman"];

function pindahTab(target, tabEl) {
  const halamanLama = document.querySelector(".page.active");
  const halamanBaru = document.getElementById(target);
  if (halamanBaru === halamanLama) return; // sudah di tab ini

  // Tentukan arah: ke kanan (tab berikutnya) atau ke kiri (sebelumnya)
  const idxLama = halamanLama ? URUTAN_TAB.indexOf(halamanLama.id) : -1;
  const idxBaru = URUTAN_TAB.indexOf(target);
  const keKanan = idxBaru > idxLama;

  // Pindahkan status tab aktif
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  (tabEl || document.querySelector(`.tab[data-target="${target}"]`)).classList.add("active");

  // Animasi keluar untuk halaman lama, lalu masuk untuk halaman baru
  if (halamanLama) {
    halamanLama.classList.add(keKanan ? "slide-out-left" : "slide-out-right");
    const lama = halamanLama;
    setTimeout(() => {
      lama.classList.remove("active", "slide-out-left", "slide-out-right");
    }, 180);
  }

  halamanBaru.classList.remove("slide-out-left", "slide-out-right");
  halamanBaru.classList.add("active", keKanan ? "slide-in-right" : "slide-in-left");
  setTimeout(() => halamanBaru.classList.remove("slide-in-right", "slide-in-left"), 360);

  // Muat data sesuai tab
  if (target === "dashboard") muatDashboard();
  if (target === "buku") muatBuku();
  if (target === "anggota") muatAnggota();
  if (target === "peminjaman") muatPeminjaman();
}

// ============================================================
// DASHBOARD
// ============================================================
async function muatDashboard() {
  try {
    const [buku, anggota, pinjam, terlambat] = await Promise.all([
      db.from("buku").select("id", { count: "exact", head: true }),
      db.from("anggota").select("id", { count: "exact", head: true }),
      db.from("peminjaman").select("id", { count: "exact", head: true }).eq("status", "dipinjam"),
      // terlambat = masih dipinjam DAN jatuh tempo sudah lewat hari ini
      db.from("peminjaman").select("id", { count: "exact", head: true })
        .eq("status", "dipinjam").lt("tanggal_jatuh_tempo", hariIni()),
    ]);
    countUp(document.getElementById("stat-buku"), buku.count ?? 0);
    countUp(document.getElementById("stat-anggota"), anggota.count ?? 0);
    countUp(document.getElementById("stat-dipinjam"), pinjam.count ?? 0);
    countUp(document.getElementById("stat-terlambat"), terlambat.count ?? 0);
  } catch (e) {
    toast("Gagal memuat dashboard: " + e.message, true);
  }
}

// ============================================================
// BUKU — list, cari, tambah, edit, hapus
// ============================================================
async function muatBuku(keyword = "") {
  const wadah = document.getElementById("list-buku");
  wadah.innerHTML = skeletonItems();
  // Ambil buku beserta eksemplar (untuk hitung total & tersedia)
  let query = db.from("buku").select("*, eksemplar(id,status)").order("judul");
  if (keyword) query = query.ilike("judul", `%${keyword}%`);

  const { data, error } = await query;
  if (error) { wadah.innerHTML = ""; return toast("Error: " + error.message, true); }
  if (!data.length) { wadah.innerHTML = `<p class="empty">Tidak ada buku.</p>`; return; }

  wadah.innerHTML = data.map((b) => {
    const total = (b.eksemplar || []).length;
    const tersedia = (b.eksemplar || []).filter((e) => e.status === "tersedia").length;
    return `
    <div class="item item-compact">
      <div class="item-cover">📖</div>
      <div class="item-body">
        <div class="item-title">${esc(b.judul)}</div>
        <div class="item-meta">${esc(b.pengarang || "-")}${b.tahun ? " • " + esc(b.tahun) : ""}</div>
        <div class="item-tags">
          ${b.kategori ? `<span class="chip">${esc(b.kategori)}</span>` : ""}
          <span class="chip ${tersedia > 0 ? "chip-stok" : "chip-habis"}">Tersedia ${tersedia}/${total}</span>
        </div>
      </div>
      <div class="item-aksi">
        <button class="ikon-btn" title="Edit info" onclick="bukaFormBuku(${b.id})">✏️</button>
        <button class="ikon-btn" title="Kelola Eksemplar" onclick="kelolaEksemplar(${b.id})">📦</button>
        <button class="ikon-btn ikon-danger" title="Hapus" onclick="hapusBuku(${b.id})">🗑️</button>
      </div>
    </div>`;
  }).join("");
}

// Cari buku (debounce sederhana)
let cariBukuTimer = null;
document.getElementById("cari-buku").addEventListener("input", (e) => {
  clearTimeout(cariBukuTimer);
  cariBukuTimer = setTimeout(() => muatBuku(e.target.value.trim()), 250);
});

async function bukaFormBuku(id = null) {
  let data = { judul: "", pengarang: "", kategori: "", tahun: "" };
  if (id) {
    const { data: row, error } = await db.from("buku").select("*").eq("id", id).single();
    if (error) return toast("Error: " + error.message, true);
    data = row;
  }

  // Saat TAMBAH buku baru: minta jumlah eksemplar awal (otomatis diberi kode unik).
  const barisJumlah = id ? "" : `
    <label>Jumlah eksemplar (salinan fisik)
      <input type="number" id="f-jumlah" min="1" value="1" />
    </label>`;

  bukaModal(id ? "Edit Info Buku" : "Tambah Buku", `
    <label>Judul<input type="text" id="f-judul" value="${esc(data.judul)}" /></label>
    <label>Pengarang<input type="text" id="f-pengarang" value="${esc(data.pengarang)}" /></label>
    <label>Kategori<input type="text" id="f-kategori" value="${esc(data.kategori)}" /></label>
    <label>Tahun<input type="number" id="f-tahun" value="${data.tahun ?? ""}" /></label>
    ${barisJumlah}
  `, async () => {
    const payload = {
      judul: document.getElementById("f-judul").value.trim(),
      pengarang: document.getElementById("f-pengarang").value.trim(),
      kategori: document.getElementById("f-kategori").value.trim(),
      tahun: parseInt(document.getElementById("f-tahun").value) || null,
    };
    if (!payload.judul) return toast("Judul wajib diisi", true);

    if (id) {
      // Edit: hanya perbarui info buku
      const { error } = await db.from("buku").update(payload).eq("id", id);
      if (error) return toast("Gagal menyimpan: " + error.message, true);
    } else {
      // Tambah: buat buku baru, lalu buat eksemplar sejumlah yang diminta
      const jumlah = Math.max(1, parseInt(document.getElementById("f-jumlah").value) || 1);
      const { data: bukuBaru, error } = await db.from("buku").insert(payload).select("id").single();
      if (error) return toast("Gagal menyimpan: " + error.message, true);
      const err2 = await tambahEksemplar(bukuBaru.id, jumlah);
      if (err2) return toast("Buku dibuat, tapi eksemplar gagal: " + err2, true);
    }

    tutupModal();
    toast("Buku tersimpan ✓");
    muatBuku();
  });
}

// Buat N eksemplar baru untuk sebuah buku, kode unik berurutan (B<id>-NN).
// Mengembalikan null jika sukses, atau pesan error.
async function tambahEksemplar(bukuId, jumlah) {
  // Cari nomor urut terakhir yang sudah ada agar kode tidak bentrok
  const { data: ada, error: e1 } = await db.from("eksemplar").select("kode").eq("buku_id", bukuId);
  if (e1) return e1.message;

  const prefix = "B" + String(bukuId).padStart(3, "0") + "-";
  let maksNomor = 0;
  (ada || []).forEach((e) => {
    const m = e.kode.match(/-(\d+)$/);
    if (m) maksNomor = Math.max(maksNomor, parseInt(m[1]));
  });

  const baris = [];
  for (let i = 1; i <= jumlah; i++) {
    baris.push({
      buku_id: bukuId,
      kode: prefix + String(maksNomor + i).padStart(2, "0"),
      status: "tersedia",
    });
  }
  const { error: e2 } = await db.from("eksemplar").insert(baris);
  return e2 ? e2.message : null;
}

async function hapusBuku(id) {
  if (!confirm("Hapus buku ini beserta SEMUA eksemplar & data peminjamannya?")) return;
  const { error } = await db.from("buku").delete().eq("id", id);
  if (error) return toast("Gagal hapus: " + error.message, true);
  toast("Buku dihapus ✓");
  muatBuku();
}

// ============================================================
// KELOLA EKSEMPLAR (lihat / tambah / hapus salinan fisik per judul)
// ============================================================
async function kelolaEksemplar(bukuId) {
  const { data: buku, error: eb } = await db.from("buku").select("judul").eq("id", bukuId).single();
  if (eb) return toast("Error: " + eb.message, true);

  const { data: list, error } = await db
    .from("eksemplar").select("*").eq("buku_id", bukuId).order("kode");
  if (error) return toast("Error: " + error.message, true);

  const baris = (list || []).map((e) => `
    <div class="eks-row">
      <span class="eks-kode">${esc(e.kode)}</span>
      <span class="chip ${e.status === "tersedia" ? "chip-ok" : "chip-late"}">${esc(e.status)}</span>
      <button class="ikon-btn" title="Cetak label" onclick="cetakLabelEksemplar(${e.id})">🏷️</button>
      <button class="ikon-btn ikon-danger" title="Hapus eksemplar"
        onclick="hapusEksemplar(${e.id}, '${esc(e.status)}', ${bukuId})">🗑️</button>
    </div>`).join("") || `<p class="empty">Belum ada eksemplar.</p>`;

  bukaModal(`Eksemplar — ${esc(buku.judul)}`, `
    <p class="item-meta">Total: ${(list || []).length} salinan</p>
    <div class="eks-list">${baris}</div>
    <label>Tambah eksemplar baru (jumlah)
      <input type="number" id="f-tambah-eks" min="1" value="1" />
    </label>
    <button class="btn btn-primary btn-block" onclick="tambahEksemplarDariModal(${bukuId})">➕ Tambah Eksemplar</button>
    <button class="btn btn-block" onclick="cetakLabelBuku(${bukuId})">🏷️ Cetak Semua Label Buku Ini</button>
  `, null);
}

async function tambahEksemplarDariModal(bukuId) {
  const jumlah = Math.max(1, parseInt(document.getElementById("f-tambah-eks").value) || 1);
  const err = await tambahEksemplar(bukuId, jumlah);
  if (err) return toast("Gagal: " + err, true);
  toast(`${jumlah} eksemplar ditambahkan ✓`);
  kelolaEksemplar(bukuId); // refresh modal
  muatBuku();
}

async function hapusEksemplar(id, status, bukuId) {
  if (status === "dipinjam") return toast("Tidak bisa hapus: eksemplar sedang dipinjam", true);
  if (!confirm("Hapus eksemplar ini?")) return;
  const { error } = await db.from("eksemplar").delete().eq("id", id);
  if (error) return toast("Gagal hapus: " + error.message, true);
  toast("Eksemplar dihapus ✓");
  kelolaEksemplar(bukuId);
  muatBuku();
}

// ============================================================
// ANGGOTA — list, cari, tambah, edit, hapus
// ============================================================
async function muatAnggota(keyword = "") {
  const wadah = document.getElementById("list-anggota");
  wadah.innerHTML = skeletonItems();
  let query = db.from("anggota").select("*").order("nama");
  if (keyword) query = query.ilike("nama", `%${keyword}%`);

  const { data, error } = await query;
  if (error) { wadah.innerHTML = ""; return toast("Error: " + error.message, true); }
  if (!data.length) { wadah.innerHTML = `<p class="empty">Tidak ada anggota.</p>`; return; }

  wadah.innerHTML = data.map((a) => `
    <div class="item item-compact">
      <div class="item-cover">👤</div>
      <div class="item-body">
        <div class="item-title">${esc(a.nama)}</div>
        <div class="item-meta">NIS: ${esc(a.nis || "-")}</div>
        <div class="item-tags">
          <span class="chip chip-stok">Kelas ${esc(a.kelas || "-")}</span>
        </div>
      </div>
      <div class="item-aksi">
        <button class="ikon-btn" title="Edit" onclick="bukaFormAnggota(${a.id})">✏️</button>
        <button class="ikon-btn" title="Cetak Kartu" onclick="cetakKartu(${a.id})">🪪</button>
        <button class="ikon-btn ikon-danger" title="Hapus" onclick="hapusAnggota(${a.id})">🗑️</button>
      </div>
    </div>`).join("");
}

let cariAnggotaTimer = null;
document.getElementById("cari-anggota").addEventListener("input", (e) => {
  clearTimeout(cariAnggotaTimer);
  cariAnggotaTimer = setTimeout(() => muatAnggota(e.target.value.trim()), 250);
});

async function bukaFormAnggota(id = null) {
  let data = { nama: "", kelas: "", nis: "" };
  if (id) {
    const { data: row, error } = await db.from("anggota").select("*").eq("id", id).single();
    if (error) return toast("Error: " + error.message, true);
    data = row;
  }

  bukaModal(id ? "Edit Anggota" : "Tambah Anggota", `
    <label>Nama<input type="text" id="f-nama" value="${esc(data.nama)}" /></label>
    <label>Kelas<input type="text" id="f-kelas" value="${esc(data.kelas)}" /></label>
    <label>NIS<input type="text" id="f-nis" value="${esc(data.nis)}" /></label>
  `, async () => {
    const payload = {
      nama: document.getElementById("f-nama").value.trim(),
      kelas: document.getElementById("f-kelas").value.trim(),
      nis: document.getElementById("f-nis").value.trim(),
    };
    if (!payload.nama) return toast("Nama wajib diisi", true);

    const res = id
      ? await db.from("anggota").update(payload).eq("id", id)
      : await db.from("anggota").insert(payload);
    if (res.error) return toast("Gagal menyimpan: " + res.error.message, true);

    tutupModal();
    toast("Anggota tersimpan ✓");
    muatAnggota();
  });
}

async function hapusAnggota(id) {
  if (!confirm("Hapus anggota ini? Data peminjaman terkait juga akan terhapus.")) return;
  const { error } = await db.from("anggota").delete().eq("id", id);
  if (error) return toast("Gagal hapus: " + error.message, true);
  toast("Anggota dihapus ✓");
  muatAnggota();
}

// ============================================================
// PEMINJAMAN
// ============================================================
async function muatPeminjaman() {
  await isiDropdownPinjam();
  await muatDaftarDipinjam();
  await muatRiwayat();
}

// Navigasi sub-tab (Sedang Dipinjam / Riwayat)
document.querySelectorAll(".subtab").forEach((st) => {
  st.addEventListener("click", () => {
    document.querySelectorAll(".subtab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".subpage").forEach((x) => x.classList.remove("active"));
    st.classList.add("active");
    document.getElementById("sub-" + st.dataset.sub).classList.add("active");
  });
});

// Isi dropdown anggota & eksemplar (hanya eksemplar berstatus 'tersedia')
async function isiDropdownPinjam() {
  const selAnggota = document.getElementById("pinjam-anggota");
  const selBuku = document.getElementById("pinjam-buku");

  const [{ data: anggota }, { data: eks }] = await Promise.all([
    db.from("anggota").select("id,nama,kelas").order("nama"),
    db.from("eksemplar").select("id,kode,buku:buku_id(judul)").eq("status", "tersedia").order("kode"),
  ]);

  selAnggota.innerHTML = (anggota || [])
    .map((a) => `<option value="${a.id}">${esc(a.nama)} (${esc(a.kelas || "-")})</option>`)
    .join("") || `<option value="">— belum ada anggota —</option>`;

  selBuku.innerHTML = (eks || [])
    .map((e) => `<option value="${e.id}">${esc(e.buku?.judul || "?")} — ${esc(e.kode)}</option>`)
    .join("") || `<option value="">— tidak ada eksemplar tersedia —</option>`;
}

// Daftar buku yang sedang dipinjam (join nama buku & anggota)
async function muatDaftarDipinjam() {
  const wadah = document.getElementById("list-peminjaman");
  wadah.innerHTML = skeletonItems(3);

  const { data, error } = await db
    .from("peminjaman")
    .select("id, tanggal_pinjam, tanggal_jatuh_tempo, status, eksemplar:eksemplar_id(kode, buku:buku_id(judul)), anggota:anggota_id(nama,kelas)")
    .eq("status", "dipinjam")
    .order("tanggal_jatuh_tempo", { ascending: true });

  if (error) { wadah.innerHTML = ""; return toast("Error: " + error.message, true); }
  if (!data.length) { wadah.innerHTML = `<p class="empty">Tidak ada buku yang sedang dipinjam.</p>`; return; }

  wadah.innerHTML = data.map((p) => {
    const sisa = sisaHari(p.tanggal_jatuh_tempo);
    let statusChip = "";
    let dendaChip = "";
    if (sisa !== null) {
      if (sisa < 0) {
        statusChip = `<span class="chip chip-late">Terlambat ${Math.abs(sisa)} hari</span>`;
        dendaChip = `<span class="chip chip-late">Denda ± ${rupiah(Math.abs(sisa) * TARIF_DENDA)}</span>`;
      } else if (sisa === 0) {
        statusChip = `<span class="chip chip-late">Jatuh tempo hari ini</span>`;
      } else {
        statusChip = `<span class="chip chip-ok">Sisa ${sisa} hari</span>`;
      }
    }
    const late = sisa !== null && sisa < 0;
    const judul = p.eksemplar?.buku?.judul || "(buku terhapus)";
    const kode = p.eksemplar?.kode || "-";
    return `
    <div class="item item-compact${late ? " late" : ""}">
      <div class="item-cover ${late ? "cover-late" : ""}">📕</div>
      <div class="item-body">
        <div class="item-title">${esc(judul)}</div>
        <div class="item-meta">🏷️ ${esc(kode)} • 👤 ${esc(p.anggota?.nama || "(anggota terhapus)")} • ${esc(p.anggota?.kelas || "-")}</div>
        <div class="item-meta">📅 Tempo: ${esc(p.tanggal_jatuh_tempo || "-")}</div>
        <div class="item-tags">${statusChip}${dendaChip}</div>
      </div>
      <div class="item-aksi">
        <button class="ikon-btn ikon-primary" title="Kembalikan" onclick="kembalikanBuku(${p.id})">📤</button>
        <button class="ikon-btn" title="Cetak Struk" onclick="cetakStruk(${p.id})">🖨️</button>
      </div>
    </div>`;
  }).join("");
}

// Daftar riwayat: peminjaman yang sudah dikembalikan (status 'kembali')
async function muatRiwayat() {
  const wadah = document.getElementById("list-riwayat");
  wadah.innerHTML = skeletonItems(3);

  const { data, error } = await db
    .from("peminjaman")
    .select("id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, denda, eksemplar:eksemplar_id(kode, buku:buku_id(judul)), anggota:anggota_id(nama,kelas)")
    .eq("status", "kembali")
    .order("tanggal_kembali", { ascending: false })
    .limit(100);

  if (error) { wadah.innerHTML = ""; return toast("Error: " + error.message, true); }
  if (!data.length) { wadah.innerHTML = `<p class="empty">Belum ada riwayat pengembalian.</p>`; return; }

  // Total denda terkumpul dari semua riwayat
  const totalDenda = data.reduce((s, p) => s + (p.denda || 0), 0);
  const ringkasan = `<div class="ringkasan">Total denda terkumpul: <b>${rupiah(totalDenda)}</b></div>`;

  wadah.innerHTML = ringkasan + data.map((p) => {
    // tandai jika dulu dikembalikan terlambat
    let statusChip = "";
    if (p.tanggal_jatuh_tempo && p.tanggal_kembali) {
      statusChip = p.tanggal_kembali > p.tanggal_jatuh_tempo
        ? `<span class="chip chip-late">Terlambat</span>`
        : `<span class="chip chip-ok">Tepat waktu</span>`;
    }
    const dendaChip = p.denda > 0 ? `<span class="chip chip-late">Denda ${rupiah(p.denda)}</span>` : "";
    const judul = p.eksemplar?.buku?.judul || "(buku terhapus)";
    const kode = p.eksemplar?.kode || "-";
    return `
    <div class="item item-compact">
      <div class="item-cover">📗</div>
      <div class="item-body">
        <div class="item-title">${esc(judul)}</div>
        <div class="item-meta">🏷️ ${esc(kode)} • 👤 ${esc(p.anggota?.nama || "(anggota terhapus)")} • ${esc(p.anggota?.kelas || "-")}</div>
        <div class="item-meta">📅 Kembali: ${esc(p.tanggal_kembali || "-")}</div>
        <div class="item-tags">${statusChip}${dendaChip}</div>
      </div>
      <div class="item-aksi">
        <button class="ikon-btn" title="Cetak Struk" onclick="cetakStruk(${p.id})">🖨️</button>
      </div>
    </div>`;
  }).join("");
}

// Pinjam: buat record peminjaman untuk EKSEMPLAR tertentu + tandai 'dipinjam'
async function pinjamBuku() {
  const anggotaId = parseInt(document.getElementById("pinjam-anggota").value);
  const eksemplarId = parseInt(document.getElementById("pinjam-buku").value);
  if (!anggotaId || !eksemplarId) return toast("Pilih anggota dan buku dulu", true);

  // Pastikan eksemplar masih tersedia
  const { data: eks, error: e1 } = await db
    .from("eksemplar").select("status").eq("id", eksemplarId).single();
  if (e1) return toast("Error: " + e1.message, true);
  if (eks.status !== "tersedia") return toast("Eksemplar ini sedang dipinjam", true);

  // Buat peminjaman (jatuh tempo = hari ini + LAMA_PINJAM_HARI)
  const tglPinjam = hariIni();
  const { error: e2 } = await db.from("peminjaman").insert({
    eksemplar_id: eksemplarId,
    anggota_id: anggotaId,
    tanggal_pinjam: tglPinjam,
    tanggal_jatuh_tempo: tambahHari(tglPinjam, LAMA_PINJAM_HARI),
    status: "dipinjam",
  });
  if (e2) return toast("Gagal meminjam: " + e2.message, true);

  // Tandai eksemplar jadi 'dipinjam'
  const { error: e3 } = await db.from("eksemplar").update({ status: "dipinjam" }).eq("id", eksemplarId);
  if (e3) return toast("Peminjaman dibuat, tapi status eksemplar gagal: " + e3.message, true);

  toast("Buku berhasil dipinjam ✓");
  muatPeminjaman();
}

// Kembalikan: status peminjaman -> kembali, dan eksemplar -> tersedia
async function kembalikanBuku(peminjamanId) {
  // Ambil data peminjaman untuk tahu eksemplar & jatuh tempo
  const { data: pinjam, error: e1 } = await db
    .from("peminjaman").select("eksemplar_id, tanggal_jatuh_tempo").eq("id", peminjamanId).single();
  if (e1) return toast("Error: " + e1.message, true);

  // Hitung denda = jumlah hari terlambat x TARIF_DENDA
  const tglKembali = hariIni();
  const sisa = sisaHari(pinjam.tanggal_jatuh_tempo); // negatif = terlambat
  const hariTelat = sisa !== null && sisa < 0 ? Math.abs(sisa) : 0;
  const denda = hariTelat * TARIF_DENDA;

  // Update status peminjaman
  const { error: e2 } = await db.from("peminjaman")
    .update({ status: "kembali", tanggal_kembali: tglKembali, denda })
    .eq("id", peminjamanId);
  if (e2) return toast("Gagal mengembalikan: " + e2.message, true);

  // Kembalikan status eksemplar jadi 'tersedia'
  if (pinjam.eksemplar_id) {
    await db.from("eksemplar").update({ status: "tersedia" }).eq("id", pinjam.eksemplar_id);
  }

  toast(denda > 0 ? `Buku dikembalikan ✓ — Denda ${rupiah(denda)} (telat ${hariTelat} hari)` : "Buku dikembalikan ✓");
  muatPeminjaman();
}

// ============================================================
// CETAK STRUK (peminjaman / pengembalian)
// ============================================================
async function cetakStruk(id) {
  const { data: p, error } = await db
    .from("peminjaman")
    .select("id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, denda, status, eksemplar:eksemplar_id(kode, buku:buku_id(judul)), anggota:anggota_id(nama,kelas,nis)")
    .eq("id", id).single();
  if (error) return toast("Error: " + error.message, true);

  const isKembali = p.status === "kembali";
  const judulStruk = isKembali ? "STRUK PENGEMBALIAN" : "STRUK PEMINJAMAN";

  const barisKembali = isKembali ? `
    <tr><td>Tgl Kembali</td><td>: ${esc(p.tanggal_kembali || "-")}</td></tr>
    <tr><td>Denda</td><td>: ${rupiah(p.denda)}</td></tr>` : "";

  const catatan = isKembali
    ? (p.denda > 0
        ? `Mohon lunasi denda keterlambatan sebesar ${rupiah(p.denda)}.`
        : "Terima kasih, buku dikembalikan tepat waktu.")
    : "Harap kembalikan buku sebelum tanggal jatuh tempo.";

  document.getElementById("struk").innerHTML = `
    <div class="struk-isi">
      <div class="struk-head">
        <div class="struk-logo"><img src="logo.png" alt="Logo" style="width: 40px; height: 40px; object-fit: contain;"></div>
        <div>
          <div class="struk-nama">Pustaka Tunas Harapan</div>
          <div class="struk-sekolah">SMP Tunas Hidup Harapan Kita</div>
        </div>
      </div>
      <hr>
      <div class="struk-judul">${judulStruk}</div>
      <table class="struk-tabel">
        <tr><td>No. Transaksi</td><td>: ${p.id}</td></tr>
        <tr><td>Nama</td><td>: ${esc(p.anggota?.nama || "-")}</td></tr>
        <tr><td>Kelas</td><td>: ${esc(p.anggota?.kelas || "-")}</td></tr>
        <tr><td>NIS</td><td>: ${esc(p.anggota?.nis || "-")}</td></tr>
        <tr><td>Judul Buku</td><td>: ${esc(p.eksemplar?.buku?.judul || "-")}</td></tr>
        <tr><td>Kode Buku</td><td>: ${esc(p.eksemplar?.kode || "-")}</td></tr>
        <tr><td>Tgl Pinjam</td><td>: ${esc(p.tanggal_pinjam || "-")}</td></tr>
        <tr><td>Jatuh Tempo</td><td>: ${esc(p.tanggal_jatuh_tempo || "-")}</td></tr>
        ${barisKembali}
      </table>
      <hr>
      <p class="struk-catatan">${catatan}</p>
      <div class="struk-ttd">
        <p>Petugas Perpustakaan</p>
        <p class="struk-garis">(......................................)</p>
      </div>
    </div>`;

  window.print();
}

// ============================================================
// KARTU ANGGOTA (QR + Barcode) — siap cetak
// ============================================================
async function cetakKartu(id) {
  const { data: a, error } = await db.from("anggota").select("*").eq("id", id).single();
  if (error) return toast("Error: " + error.message, true);

  // Kode unik yang di-encode ke QR & barcode (pakai NIS, fallback ke ID)
  const kode = (a.nis && a.nis.trim()) ? a.nis.trim() : "ANG" + a.id;

  document.getElementById("struk").innerHTML = `
    <div class="kartu">
      <div class="kartu-head">
        <div class="kartu-title"><img src="logo.png" alt="Logo" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 6px; object-fit: contain;">Pustaka Tunas Harapan</div>
        <div class="kartu-sub">SMP Tunas Hidup Harapan Kita</div>
        <span class="kartu-label">KARTU ANGGOTA</span>
      </div>
      <div class="kartu-body">
        <div class="kartu-info">
          <div class="kartu-nama">${esc(a.nama)}</div>
          <div>Kelas : ${esc(a.kelas || "-")}</div>
          <div>NIS&nbsp;&nbsp;&nbsp;: ${esc(a.nis || "-")}</div>
        </div>
        <div class="kartu-qr"><div id="qrbox"></div></div>
      </div>
      <svg id="barcode" class="kartu-barcode"></svg>
      <div class="kartu-foot">Kartu ini milik perpustakaan sekolah. Wajib dibawa saat meminjam buku.</div>
    </div>`;

  // Buat QR code
  const qrbox = document.getElementById("qrbox");
  qrbox.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrbox, { text: kode, width: 96, height: 96, correctLevel: QRCode.CorrectLevel.M });
  } else {
    qrbox.textContent = "(QR gagal dimuat)";
  }

  // Buat barcode (Code128) dari kode
  try {
    if (typeof JsBarcode !== "undefined") {
      JsBarcode("#barcode", kode, { format: "CODE128", width: 2, height: 44, fontSize: 14, margin: 0 });
    }
  } catch (e) { /* abaikan jika kode tidak valid untuk barcode */ }

  // Beri jeda agar QR & barcode selesai dirender sebelum dialog cetak
  setTimeout(() => window.print(), 350);
}

// ============================================================
// LABEL BUKU (barcode + keterangan) — untuk ditempel di buku
// ============================================================
// HTML satu label EKSEMPLAR (barcode = kode unik eksemplar)
function htmlLabelEksemplar(eks) {
  const kode = eks.kode;
  const judul = eks.buku?.judul || "";
  const pengarang = eks.buku?.pengarang || "-";
  const kategori = eks.buku?.kategori || "";
  return `
    <div class="label-buku">
      <div class="label-head">
        <img src="logo.png" alt="" class="label-logo" />
        <div>
          <div class="label-sekolah">Pustaka Tunas Harapan</div>
          <div class="label-sub">SMP Tunas Hidup Harapan Kita</div>
        </div>
      </div>
      <div class="label-judul">${esc(judul)}</div>
      <div class="label-info">${esc(pengarang)}${kategori ? " • " + esc(kategori) : ""}</div>
      <svg class="label-barcode" data-kode="${esc(kode)}"></svg>
      <div class="label-kode">${esc(kode)}</div>
    </div>`;
}

// Gambar semua barcode pada elemen <svg data-kode> di dalam area struk
function gambarBarcodeLabel() {
  if (typeof JsBarcode === "undefined") return;
  document.querySelectorAll("#struk .label-barcode").forEach((svg) => {
    try {
      JsBarcode(svg, svg.dataset.kode, { format: "CODE128", width: 1.6, height: 38, fontSize: 12, margin: 0, displayValue: false });
    } catch (e) { /* abaikan kode yang tidak valid */ }
  });
}

// Cetak label SEMUA eksemplar dari satu judul (tiap salinan = 1 label unik)
async function cetakLabelBuku(bukuId) {
  const { data, error } = await db
    .from("eksemplar")
    .select("kode, buku:buku_id(judul,pengarang,kategori)")
    .eq("buku_id", bukuId).order("kode");
  if (error) return toast("Error: " + error.message, true);
  if (!data || !data.length) return toast("Belum ada eksemplar untuk dicetak", true);

  const tunggal = data.length === 1 ? " label-tunggal" : "";
  document.getElementById("struk").innerHTML =
    `<div class="label-grid${tunggal}">${data.map(htmlLabelEksemplar).join("")}</div>`;
  gambarBarcodeLabel();
  setTimeout(() => window.print(), 380);
}

// Cetak label SATU eksemplar saja
async function cetakLabelEksemplar(eksId) {
  const { data, error } = await db
    .from("eksemplar")
    .select("kode, buku:buku_id(judul,pengarang,kategori)")
    .eq("id", eksId).single();
  if (error) return toast("Error: " + error.message, true);

  document.getElementById("struk").innerHTML =
    `<div class="label-grid label-tunggal">${htmlLabelEksemplar(data)}</div>`;
  gambarBarcodeLabel();
  setTimeout(() => window.print(), 350);
}


// Cetak label SEMUA eksemplar yang dimiliki perpustakaan (abaikan pencarian)
async function cetakLabelSemuaBuku() {
  const { data, error } = await db
    .from("eksemplar")
    .select("kode, buku:buku_id(judul,pengarang,kategori)")
    .order("buku_id")
    .order("kode")
    .limit(5000);
  if (error) return toast("Error: " + error.message, true);
  if (!data || !data.length) return toast("Belum ada eksemplar untuk dicetak", true);

  if (!confirm(`Cetak label SEMUA buku?\nTotal ${data.length} label akan dicetak.`)) return;

  document.getElementById("struk").innerHTML =
    `<div class="label-grid">${data.map(htmlLabelEksemplar).join("")}</div>`;
  gambarBarcodeLabel();
  setTimeout(() => window.print(), 450);
}

// ============================================================
// SCANNER QR / BARCODE — pilih anggota ATAU buku lewat kamera
// ============================================================
let scannerAktif = null;
let scannerMode = "anggota"; // "anggota" | "buku" | "kembali"

// mode: "anggota" (NIS/ANG<id>), "buku" (BUK<id> -> pilih utk pinjam),
//       "kembali" (BUK<id> -> langsung cari peminjaman aktif & kembalikan)
async function bukaScanner(mode = "anggota") {
  scannerMode = mode;
  const status = document.getElementById("scanner-status");
  const judul = document.getElementById("scanner-judul");
  const labelManual = document.getElementById("scanner-manual-label");
  const inputManual = document.getElementById("scanner-manual");

  // Sesuaikan teks sesuai mode
  if (mode === "buku") {
    judul.textContent = "📷 Scan Barcode Buku";
    labelManual.childNodes[0].nodeValue = "Atau ketik / scan kode buku manual:";
    inputManual.placeholder = "Mis. BUK1 atau judul buku";
  } else if (mode === "kembali") {
    judul.textContent = "📷 Scan Buku untuk Kembalikan";
    labelManual.childNodes[0].nodeValue = "Atau ketik / scan kode buku manual:";
    inputManual.placeholder = "Mis. BUK1 atau judul buku";
  } else {
    judul.textContent = "📷 Scan Kartu Anggota";
    labelManual.childNodes[0].nodeValue = "Atau ketik / scan NIS manual:";
    inputManual.placeholder = "Masukkan NIS lalu klik Cari";
  }

  document.getElementById("scanner-modal").classList.remove("hidden");
  inputManual.value = "";

  if (typeof Html5Qrcode === "undefined") {
    status.textContent = "Library scanner gagal dimuat (cek internet). Gunakan input manual di bawah.";
    return;
  }

  try {
    scannerAktif = new Html5Qrcode("scanner-view");
    await scannerAktif.start(
      { facingMode: "environment" },               // kamera belakang
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (teks) => onScanSukses(teks),                 // berhasil baca
      () => {}                                       // abaikan error per-frame
    );
    status.textContent = mode === "anggota"
      ? "Arahkan kamera ke QR / barcode pada kartu anggota."
      : "Arahkan kamera ke barcode pada label buku.";
  } catch (e) {
    status.textContent = "Tidak bisa membuka kamera (" + e + "). Gunakan input manual di bawah.";
    scannerAktif = null;
  }
}

async function onScanSukses(teks) {
  await stopScanner();
  if (scannerMode === "kembali") await kembalikanDariKode(teks);
  else if (scannerMode === "buku") await pilihBukuDariKode(teks);
  else await pilihAnggotaDariKode(teks);
}

async function cariManual() {
  const kode = document.getElementById("scanner-manual").value.trim();
  if (!kode) return toast("Masukkan kode dulu", true);
  await stopScanner();
  if (scannerMode === "kembali") await kembalikanDariKode(kode);
  else if (scannerMode === "buku") await pilihBukuDariKode(kode);
  else await pilihAnggotaDariKode(kode);
}

// Cari anggota berdasarkan kode hasil scan (NIS atau "ANG<id>") lalu pilih di dropdown
async function pilihAnggotaDariKode(kodeRaw) {
  const kode = String(kodeRaw).trim();
  let anggotaId = null;

  if (/^ANG\d+$/i.test(kode)) {
    anggotaId = parseInt(kode.slice(3));
  } else {
    const { data, error } = await db.from("anggota").select("id,nama").eq("nis", kode).limit(1);
    if (error) { tutupScanner(); return toast("Error: " + error.message, true); }
    if (data && data.length) anggotaId = data[0].id;
  }

  if (!anggotaId) {
    tutupScanner();
    return toast(`Anggota dengan kode "${kode}" tidak ditemukan`, true);
  }

  // Pastikan tab peminjaman & dropdown terisi
  const sel = document.getElementById("pinjam-anggota");
  if (![...sel.options].some((o) => o.value == anggotaId)) {
    await isiDropdownPinjam();
  }
  sel.value = anggotaId;
  tutupScanner();

  const nama = sel.options[sel.selectedIndex]?.text || kode;
  toast("Anggota dipilih: " + nama + " ✓");
}

// Cari buku berdasarkan kode hasil scan ("BUK<id>") atau judul, lalu pilih di dropdown
async function pilihBukuDariKode(kodeRaw) {
  const kode = String(kodeRaw).trim();

  // Cari eksemplar dari kode unik (mis. B001-02). Cocokkan persis lebih dulu.
  let { data, error } = await db
    .from("eksemplar")
    .select("id,kode,status,buku:buku_id(judul)")
    .ilike("kode", kode).limit(1);
  if (error) { tutupScanner(); return toast("Error: " + error.message, true); }

  // Kalau tak ketemu, mungkin input manual berupa judul → cari eksemplar tersedia
  if (!data || !data.length) {
    const r = await db
      .from("eksemplar")
      .select("id,kode,status,buku:buku_id(judul)")
      .eq("status", "tersedia").limit(50);
    const cocok = (r.data || []).find((e) => (e.buku?.judul || "").toLowerCase().includes(kode.toLowerCase()));
    data = cocok ? [cocok] : [];
  }

  tutupScanner();
  if (!data.length) return toast(`Buku dengan kode "${kode}" tidak ditemukan`, true);

  const eks = data[0];
  const judul = eks.buku?.judul || eks.kode;
  if (eks.status !== "tersedia") {
    return toast(`"${judul}" (${eks.kode}) sedang dipinjam`, true);
  }

  // Pastikan dropdown berisi eksemplar ini, lalu pilih
  const sel = document.getElementById("pinjam-buku");
  if (![...sel.options].some((o) => o.value == eks.id)) {
    await isiDropdownPinjam();
  }
  if ([...sel.options].some((o) => o.value == eks.id)) {
    sel.value = eks.id;
    toast(`Buku dipilih: ${judul} (${eks.kode}) ✓`);
  } else {
    toast(`"${judul}" tidak tersedia di daftar pinjam`, true);
  }
}

// Kembalikan dari hasil scan: cari peminjaman AKTIF berdasarkan KODE EKSEMPLAR,
// lalu konfirmasi & kembalikan. Karena kode unik per fisik buku, langsung tepat.
async function kembalikanDariKode(kodeRaw) {
  const kode = String(kodeRaw).trim();

  // Cari eksemplar dari kode unik
  const { data: eksList, error: ee } = await db
    .from("eksemplar").select("id,kode,buku:buku_id(judul)").ilike("kode", kode).limit(1);
  if (ee) { tutupScanner(); return toast("Error: " + ee.message, true); }

  let eksemplarId = null, judul = "", kodeEks = kode;
  if (eksList && eksList.length) {
    eksemplarId = eksList[0].id;
    judul = eksList[0].buku?.judul || "";
    kodeEks = eksList[0].kode;
  }

  if (!eksemplarId) {
    tutupScanner();
    return toast(`Eksemplar dengan kode "${kode}" tidak ditemukan`, true);
  }

  // Cari peminjaman aktif untuk eksemplar ini
  const { data: pinjam, error } = await db
    .from("peminjaman")
    .select("id, anggota:anggota_id(nama,kelas)")
    .eq("eksemplar_id", eksemplarId)
    .eq("status", "dipinjam")
    .limit(1);

  tutupScanner();
  if (error) return toast("Error: " + error.message, true);
  if (!pinjam || !pinjam.length) {
    return toast(`Eksemplar ${kodeEks} tidak sedang dipinjam`, true);
  }

  const p = pinjam[0];
  const peminjam = p.anggota?.nama || "(anggota terhapus)";
  if (!confirm(`Kembalikan buku ini?\n\n📕 ${judul || kodeEks} (${kodeEks})\n👤 Peminjam: ${peminjam}`)) return;

  await kembalikanBuku(p.id);
}

async function stopScanner() {
  if (scannerAktif) {
    try { await scannerAktif.stop(); scannerAktif.clear(); } catch (e) { /* sudah berhenti */ }
    scannerAktif = null;
  }
}

function tutupScanner() {
  stopScanner();
  document.getElementById("scanner-modal").classList.add("hidden");
}

// ============================================================
// EKSPOR CSV
// ============================================================
async function exportBukuCSV() {
  // Ekspor per eksemplar (tiap fisik buku 1 baris, lengkap dengan kode & status)
  const { data, error } = await db
    .from("eksemplar")
    .select("kode, status, buku:buku_id(judul,pengarang,kategori,tahun)")
    .order("kode");
  if (error) return toast("Gagal ekspor: " + error.message, true);
  const baris = [["Kode", "Judul", "Pengarang", "Kategori", "Tahun", "Status"]];
  (data || []).forEach((e) => baris.push([
    e.kode, e.buku?.judul || "", e.buku?.pengarang || "", e.buku?.kategori || "",
    e.buku?.tahun || "", e.status,
  ]));
  unduhCSV("buku.csv", baris);
  toast(`Ekspor ${(data || []).length} eksemplar ✓`);
}

async function exportAnggotaCSV() {
  const { data, error } = await db.from("anggota").select("*").order("nama");
  if (error) return toast("Gagal ekspor: " + error.message, true);
  const baris = [["ID", "Nama", "Kelas", "NIS"]];
  (data || []).forEach((a) => baris.push([a.id, a.nama, a.kelas, a.nis]));
  unduhCSV("anggota.csv", baris);
  toast(`Ekspor ${(data || []).length} anggota ✓`);
}

async function exportPeminjamanCSV() {
  const { data, error } = await db
    .from("peminjaman")
    .select("id, tanggal_pinjam, tanggal_jatuh_tempo, tanggal_kembali, denda, status, eksemplar:eksemplar_id(kode, buku:buku_id(judul)), anggota:anggota_id(nama,kelas)")
    .order("tanggal_pinjam", { ascending: false });
  if (error) return toast("Gagal ekspor: " + error.message, true);
  const baris = [["ID", "Kode Buku", "Buku", "Peminjam", "Kelas", "Tgl Pinjam", "Jatuh Tempo", "Tgl Kembali", "Denda", "Status"]];
  (data || []).forEach((p) => baris.push([
    p.id, p.eksemplar?.kode || "", p.eksemplar?.buku?.judul || "", p.anggota?.nama || "", p.anggota?.kelas || "",
    p.tanggal_pinjam, p.tanggal_jatuh_tempo, p.tanggal_kembali, p.denda, p.status,
  ]));
  unduhCSV("peminjaman.csv", baris);
  toast(`Ekspor ${(data || []).length} data peminjaman ✓`);
}

// ============================================================
// MODAL (dipakai bersama oleh form buku & anggota)
// ============================================================
function bukaModal(judul, isiHTML, onSimpan) {
  document.getElementById("modal-judul").textContent = judul;
  document.getElementById("modal-body").innerHTML = isiHTML;
  const tombol = document.getElementById("modal-simpan");
  // Ganti handler lama dengan meng-clone tombol
  const tombolBaru = tombol.cloneNode(true);
  tombol.parentNode.replaceChild(tombolBaru, tombol);
  // Jika onSimpan null (mis. modal kelola eksemplar), sembunyikan tombol Simpan
  if (onSimpan) {
    tombolBaru.style.display = "";
    tombolBaru.addEventListener("click", onSimpan);
  } else {
    tombolBaru.style.display = "none";
  }
  document.getElementById("modal").classList.remove("hidden");
}

function tutupModal() {
  document.getElementById("modal").classList.add("hidden");
}

// Tutup modal saat klik area gelap
document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") tutupModal();
});

// ============================================================
// LOGIN (sederhana — untuk pembatas akses petugas)
// ============================================================
// CATATAN KEAMANAN: ini login sisi-klien sederhana, BUKAN keamanan sungguhan
// (kredensial ada di kode). Cukup untuk membatasi akses petugas saat pengujian.
// Untuk produksi, gunakan Supabase Auth + RLS berbasis peran.
const LOGIN_USER = "admin";
const LOGIN_PASS = "admin";

function sudahLogin() {
  try { return localStorage.getItem("login") === "1"; } catch (e) { return false; }
}

function prosesLogin(e) {
  e.preventDefault();
  const u = document.getElementById("login-user").value.trim();
  const p = document.getElementById("login-pass").value;
  const err = document.getElementById("login-error");

  if (u === LOGIN_USER && p === LOGIN_PASS) {
    try { localStorage.setItem("login", "1"); } catch (e) {}
    err.classList.add("hidden");
    bukaAplikasi(true); // dengan animasi fade
  } else {
    err.classList.remove("hidden");
    document.getElementById("login-pass").value = "";
  }
  return false;
}

// Lihat / sembunyikan password
function togglePassword(btn) {
  const input = btn.parentElement.querySelector("input");
  const tampil = input.type === "password";
  input.type = tampil ? "text" : "password";
  btn.textContent = tampil ? "🙈" : "👁️";
  btn.setAttribute("aria-label", tampil ? "Sembunyikan password" : "Tampilkan password");
}

function logout() {
  if (!confirm("Keluar dari aplikasi?")) return;
  try { localStorage.removeItem("login"); } catch (e) {}
  const ls = document.getElementById("login-screen");
  ls.style.display = "";
  ls.classList.remove("tutup");
  document.getElementById("login-user").value = "";
  document.getElementById("login-pass").value = "";
  document.getElementById("login-user").focus();
}

function bukaAplikasi(animasi) {
  const ls = document.getElementById("login-screen");
  if (animasi) {
    ls.classList.add("tutup");            // fade halus setelah login
  } else {
    ls.style.display = "none";            // langsung sembunyi saat startup
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes("xxxxxxxx") || SUPABASE_ANON_KEY.includes("ganti-dengan")) {
    toast("⚠️ Isi dulu config.js dengan URL & anon key Supabase kamu!", true);
  }
  muatDashboard();
}

// ============================================================
// MUAT AWAL (langsung dijalankan; script berada di akhir <body>)
// ============================================================
if (sudahLogin()) {
  bukaAplikasi(false);
} else {
  document.getElementById("login-user").focus();
}
