// JS-App/db-services.js
// Layanan Database (Supabase) untuk tiap tabel: users, matkul, materi, riwayat_baca, favorit
// Terhubung langsung ke klien Supabase modular (kompatibel Browser / Vanilla JS)

import { supabase } from '../JS-Login/utils.js';

// Helper: lempar error jika query gagal
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

/* =========================================================
 * 1. USERS  (id uuid = auth.users.id)
 * ======================================================= */
export const usersService = {
  // Dipanggil setelah signUp berhasil (id harus sama dengan auth.users.id)
  async create({ id, npm, nama, role = "mahasiswa" }) {
    return unwrap(
      await supabase
        .from("users")
        .insert({ id, npm, nama, role, aktif: true })
        .select()
        .single()
    );
  },

  async getAll() {
    return unwrap(
      await supabase.from("users").select("*").order("dibuat_pada", { ascending: false })
    );
  },

  async getById(id) {
    return unwrap(await supabase.from("users").select("*").eq("id", id).single());
  },

  async getByNpm(npm) {
    return unwrap(await supabase.from("users").select("*").eq("npm", npm).single());
  },

  async update(id, fields) {
    return unwrap(
      await supabase.from("users").update(fields).eq("id", id).select().single()
    );
  },

  async setAktif(id, aktif) {
    return this.update(id, { aktif });
  },

  async catatLogin(id) {
    return this.update(id, { terakhir_login: new Date().toISOString() });
  },

  async remove(id) {
    unwrap(await supabase.from("users").delete().eq("id", id));
    return true;
  },
};

/* =========================================================
 * 2. MATKUL  (id int8, kode unik)
 * ======================================================= */
export const matkulService = {
  async create({ kode, nama, semester = null, deskripsi = null }) {
    return unwrap(
      await supabase
        .from("matkul")
        .insert({ kode, nama, semester, deskripsi })
        .select()
        .single()
    );
  },

  async getAll() {
    return unwrap(
      await supabase.from("matkul").select("*").order("semester").order("nama")
    );
  },

  async getById(id) {
    return unwrap(await supabase.from("matkul").select("*").eq("id", id).single());
  },

  async getByKode(kode) {
    return unwrap(await supabase.from("matkul").select("*").eq("kode", kode).single());
  },

  async getBySemester(semester) {
    return unwrap(
      await supabase.from("matkul").select("*").eq("semester", semester).order("nama")
    );
  },

  async update(id, fields) {
    return unwrap(
      await supabase.from("matkul").update(fields).eq("id", id).select().single()
    );
  },

  async remove(id) {
    unwrap(await supabase.from("matkul").delete().eq("id", id));
    return true;
  },
};

/* =========================================================
 * 3. MATERI  (matkul_id -> matkul.id, user_id -> users.id)
 * ======================================================= */
export const materiService = {
  async create({
    matkul_id,
    user_id = null,
    judul,
    deskripsi = null,
    tahun_akademik = null,
    file_path,
  }) {
    return unwrap(
      await supabase
        .from("materi")
        .insert({ matkul_id, user_id, judul, deskripsi, tahun_akademik, file_path })
        .select()
        .single()
    );
  },

  // Sekalian ambil nama matkul & pengunggah (join lewat foreign key)
  async getAll() {
    return unwrap(
      await supabase
        .from("materi")
        .select("*, matkul(kode, nama), users(nama)")
        .order("dibuat_pada", { ascending: false })
    );
  },

  async getById(id) {
    return unwrap(
      await supabase
        .from("materi")
        .select("*, matkul(kode, nama), users(nama)")
        .eq("id", id)
        .single()
    );
  },

  async getByMatkul(matkul_id) {
    return unwrap(
      await supabase
        .from("materi")
        .select("*")
        .eq("matkul_id", matkul_id)
        .order("dibuat_pada", { ascending: false })
    );
  },

  async cariJudul(keyword) {
    return unwrap(
      await supabase.from("materi").select("*").ilike("judul", `%${keyword}%`)
    );
  },

  async terpopuler(limit = 10) {
    return unwrap(
      await supabase
        .from("materi")
        .select("*")
        .order("jumlah_dilihat", { ascending: false })
        .limit(limit)
    );
  },

  async tambahDilihat(id) {
    const { jumlah_dilihat } = await this.getById(id);
    return unwrap(
      await supabase
        .from("materi")
        .update({ jumlah_dilihat: (jumlah_dilihat || 0) + 1 })
        .eq("id", id)
        .select()
        .single()
    );
  },

  async update(id, fields) {
    return unwrap(
      await supabase.from("materi").update(fields).eq("id", id).select().single()
    );
  },

  async remove(id) {
    unwrap(await supabase.from("materi").delete().eq("id", id));
    return true;
  },

  // Upload file ke Supabase Storage lalu simpan path-nya ke kolom file_path
  async upload(file, { matkul_id, user_id, judul, deskripsi, tahun_akademik }) {
    const path = `materi/${matkul_id}/${Date.now()}_${file.name}`;
    unwrap(await supabase.storage.from("materi").upload(path, file));
    return this.create({
      matkul_id,
      user_id,
      judul,
      deskripsi,
      tahun_akademik,
      file_path: path,
    });
  },

  getFileUrl(file_path) {
    return supabase.storage.from("materi").getPublicUrl(file_path).data.publicUrl;
  },
};

/* =========================================================
 * 4. RIWAYAT_BACA  (user_id -> users.id, materi_id -> materi.id)
 * ======================================================= */
export const riwayatBacaService = {
  // Catat saat user membuka materi, sekaligus menambah jumlah_dilihat
  async catat(user_id, materi_id) {
    const row = unwrap(
      await supabase
        .from("riwayat_baca")
        .insert({ user_id, materi_id })
        .select()
        .single()
    );
    await materiService.tambahDilihat(materi_id);
    return row;
  },

  async getByUser(user_id, limit = 50) {
    return unwrap(
      await supabase
        .from("riwayat_baca")
        .select("id, dibaca_pada, materi(id, judul, matkul_id)")
        .eq("user_id", user_id)
        .order("dibaca_pada", { ascending: false })
        .limit(limit)
    );
  },

  async getByMateri(materi_id) {
    return unwrap(
      await supabase
        .from("riwayat_baca")
        .select("id, dibaca_pada, users(nama, npm)")
        .eq("materi_id", materi_id)
        .order("dibaca_pada", { ascending: false })
    );
  },

  async hapusSatu(id) {
    unwrap(await supabase.from("riwayat_baca").delete().eq("id", id));
    return true;
  },

  async hapusSemuaUser(user_id) {
    unwrap(await supabase.from("riwayat_baca").delete().eq("user_id", user_id));
    return true;
  },
};

/* =========================================================
 * 5. FAVORIT  (user_id -> users.id, materi_id -> materi.id)
 * ======================================================= */
export const favoritService = {
  async sudahFavorit(user_id, materi_id) {
    const data = unwrap(
      await supabase
        .from("favorit")
        .select("id")
        .eq("user_id", user_id)
        .eq("materi_id", materi_id)
        .maybeSingle()
    );
    return data !== null;
  },

  async tambah(user_id, materi_id) {
    if (await this.sudahFavorit(user_id, materi_id)) return null; // Cegah duplikat
    return unwrap(
      await supabase
        .from("favorit")
        .insert({ user_id, materi_id })
        .select()
        .single()
    );
  },

  async hapus(user_id, materi_id) {
    unwrap(
      await supabase
        .from("favorit")
        .delete()
        .eq("user_id", user_id)
        .eq("materi_id", materi_id)
    );
    return true;
  },

  // Tambah jika belum ada, hapus jika sudah ada (Toggle)
  async toggle(user_id, materi_id) {
    if (await this.sudahFavorit(user_id, materi_id)) {
      await this.hapus(user_id, materi_id);
      return false;
    }
    await this.tambah(user_id, materi_id);
    return true;
  },

  async getByUser(user_id) {
    return unwrap(
      await supabase
        .from("favorit")
        .select("id, dibuat_pada, materi(id, judul, matkul(nama))")
        .eq("user_id", user_id)
        .order("dibuat_pada", { ascending: false })
    );
  },
};
