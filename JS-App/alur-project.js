// JS-App/alur-project.js
// Program JavaScript untuk setiap ALUR pada aplikasi RepoSIKa
// (auth -> users -> matkul -> materi -> riwayat_baca / favorit)
// Terhubung langsung ke modul Auth & Supabase terpusat (Vanilla JS / Browser)

import { supabase } from '../JS-Login/utils.js';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  getCurrentUserProfile,
} from '../JS-Login/auth.js';

const BUCKET = "materi";

// Helper umum: lempar error jika query gagal
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function currentUserId() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Anda belum login.");
  return user.id;
}

/* =====================================================================
 * ALUR 1 - AUTENTIKASI: auth.users -> users
 * Terhubung ke modul auth teruji (JS-Login/auth.js)
 * =================================================================== */
export const alurAuth = {
  async register({ email, password, npm, nama }) {
    const res = await signUp({ email, password, npm, nama });
    if (!res.ok) throw new Error(res.message);
    return res.data?.user;
  },

  async login({ email, password }) {
    const res = await signIn({ email, password });
    if (!res.ok) throw new Error(res.message);
    return res.data?.profile;
  },

  async logout() {
    const res = await signOut();
    if (!res.ok) throw new Error(res.message);
    return true;
  },

  async getProfil() {
    const profile = await getCurrentUserProfile();
    if (!profile) throw new Error("Anda belum login.");
    return profile;
  },

  async updateNama(nama) {
    const id = await currentUserId();
    return unwrap(
      await supabase.from("users").update({ nama }).eq("id", id).select().single()
    );
  },

  // Pembatas akses berdasarkan role (dipakai alur lain)
  async requireRole(...roles) {
    const profil = await this.getProfil();
    const isActive = profil.aktif ?? profil.is_active;
    if (!isActive) throw new Error("Akun tidak aktif.");
    if (!roles.includes(profil.role)) {
      throw new Error(`Akses ditolak. Dibutuhkan role: ${roles.join(" / ")}.`);
    }
    return profil;
  },
};

/* =====================================================================
 * ALUR 2 - JELAJAH: matkul -> materi
 * Lihat daftar matkul -> pilih matkul -> daftar materi (cari, filter, halaman)
 * =================================================================== */
export const alurJelajah = {
  async daftarMatkul({ semester } = {}) {
    let q = supabase.from("matkul").select("*").order("semester").order("nama");
    if (semester) q = q.eq("semester", semester);
    return unwrap(await q);
  },

  async daftarMateri({
    matkul_id,
    keyword = "",
    tahun_akademik,
    urut = "terbaru", // "terbaru" | "terpopuler"
    halaman = 1,
    perHalaman = 10,
  } = {}) {
    const dari = (halaman - 1) * perHalaman;
    const sampai = dari + perHalaman - 1;

    let q = supabase
      .from("materi")
      .select("*, matkul(kode, nama), users(nama)", { count: "exact" });

    if (matkul_id) q = q.eq("matkul_id", matkul_id);
    if (tahun_akademik) q = q.eq("tahun_akademik", tahun_akademik);
    if (keyword.trim()) q = q.ilike("judul", `%${keyword.trim()}%`);

    q = urut === "terpopuler"
      ? q.order("jumlah_dilihat", { ascending: false })
      : q.order("dibuat_pada", { ascending: false });

    const { data, error, count } = await q.range(dari, sampai);
    if (error) throw new Error(error.message);

    return {
      data,
      total: count,
      halaman,
      totalHalaman: Math.ceil((count ?? 0) / perHalaman),
    };
  },
};

/* =====================================================================
 * ALUR 3 - UPLOAD MATERI (dosen/admin): users -> materi -> matkul + storage
 * Validasi role & file -> upload ke storage -> simpan baris materi
 * =================================================================== */
const TIPE_BOLEH = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
];
const MAKS_UKURAN = 20 * 1024 * 1024; // 20 MB

export const alurUpload = {
  async uploadMateri(file, { matkul_id, judul, deskripsi = null, tahun_akademik = null }) {
    const profil = await alurAuth.requireRole("dosen", "admin");

    if (!judul?.trim()) throw new Error("Judul wajib diisi.");
    if (!TIPE_BOLEH.includes(file.type)) throw new Error("Tipe file tidak diizinkan.");
    if (file.size > MAKS_UKURAN) throw new Error("Ukuran file maksimal 20 MB.");

    // Pastikan matkul ada
    unwrap(await supabase.from("matkul").select("id").eq("id", matkul_id).single());

    const namaAman = file.name.replace(/[^\w.\-]+/g, "_");
    const file_path = `${matkul_id}/${Date.now()}_${namaAman}`;

    unwrap(await supabase.storage.from(BUCKET).upload(file_path, file));

    const { data, error } = await supabase
      .from("materi")
      .insert({
        matkul_id,
        user_id: profil.id,
        judul: judul.trim(),
        deskripsi,
        tahun_akademik,
        file_path,
      })
      .select()
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([file_path]); // Rollback
      throw new Error(error.message);
    }
    return data;
  },

  async ubahMateri(id, { judul, deskripsi, tahun_akademik }) {
    const fields = Object.fromEntries(
      Object.entries({ judul, deskripsi, tahun_akademik }).filter(([, v]) => v !== undefined)
    );
    return unwrap(
      await supabase.from("materi").update(fields).eq("id", id).select().single()
    );
  },

  async hapusMateri(id) {
    const { file_path } = unwrap(
      await supabase.from("materi").select("file_path").eq("id", id).single()
    );
    unwrap(await supabase.from("materi").delete().eq("id", id));
    await supabase.storage.from(BUCKET).remove([file_path]);
    return true;
  },
};

/* =====================================================================
 * ALUR 4 - BACA MATERI: materi -> riwayat_baca (+ jumlah_dilihat)
 * Buka detail -> buat signed URL -> catat riwayat -> tambah jumlah_dilihat
 * =================================================================== */
export const alurBaca = {
  async bukaMateri(materi_id) {
    const user_id = await currentUserId();

    const materi = unwrap(
      await supabase
        .from("materi")
        .select("*, matkul(kode, nama), users(nama)")
        .eq("id", materi_id)
        .single()
    );

    // URL sementara 1 jam (Signed URL untuk private storage sesuai PRD)
    let signedUrl = null;
    if (materi.file_path) {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(materi.file_path, 3600);
        if (!signedError && signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        } else {
          signedUrl = supabase.storage.from(BUCKET).getPublicUrl(materi.file_path).data.publicUrl;
        }
      } catch (e) {
        signedUrl = supabase.storage.from(BUCKET).getPublicUrl(materi.file_path).data.publicUrl;
      }
    }

    try {
      await supabase.from("riwayat_baca").insert({ user_id, materi_id });
    } catch (e) {
      console.warn("Insert riwayat_baca fallback:", e.message);
    }

    // Update jumlah dilihat via RPC increment_material_views (FR-05)
    let jumlah_dilihat = (materi.jumlah_dilihat || 0) + 1;
    try {
      const { data, error } = await supabase.rpc('increment_material_views', { p_materi_id: materi_id });
      if (!error && data !== null) {
        jumlah_dilihat = data;
      } else {
        await supabase.from("materi").update({ jumlah_dilihat }).eq("id", materi_id);
      }
    } catch (e) {
      await supabase.from("materi").update({ jumlah_dilihat }).eq("id", materi_id);
    }

    return { ...materi, jumlah_dilihat, url: signedUrl };
  },
};

/* =====================================================================
 * ALUR 5 - RIWAYAT BACA: users -> riwayat_baca -> materi
 * =================================================================== */
export const alurRiwayat = {
  async daftar(limit = 50) {
    const user_id = await currentUserId();
    return unwrap(
      await supabase
        .from("riwayat_baca")
        .select("id, dibaca_pada, materi(id, judul, matkul(kode, nama))")
        .eq("user_id", user_id)
        .order("dibaca_pada", { ascending: false })
        .limit(limit)
    );
  },

  async hapusSatu(id) {
    unwrap(await supabase.from("riwayat_baca").delete().eq("id", id));
    return true;
  },

  async hapusSemua() {
    const user_id = await currentUserId();
    unwrap(await supabase.from("riwayat_baca").delete().eq("user_id", user_id));
    return true;
  },
};

/* =====================================================================
 * ALUR 6 - FAVORIT: users -> favorit -> materi
 * =================================================================== */
export const alurFavorit = {
  async tambah(materi_id) {
    const user_id = await currentUserId();
    const { error } = await supabase.from("favorit").insert({ user_id, materi_id });
    if (error && error.code !== "23505") throw new Error(error.message); // 23505 = sudah ada
    return true;
  },

  async hapus(materi_id) {
    const user_id = await currentUserId();
    unwrap(
      await supabase.from("favorit").delete().eq("user_id", user_id).eq("materi_id", materi_id)
    );
    return true;
  },

  async sudahFavorit(materi_id) {
    const user_id = await currentUserId();
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

  async toggle(materi_id) {
    if (await this.sudahFavorit(materi_id)) {
      await this.hapus(materi_id);
      return false;
    }
    await this.tambah(materi_id);
    return true;
  },

  async daftar() {
    const user_id = await currentUserId();
    return unwrap(
      await supabase
        .from("favorit")
        .select("id, dibuat_pada, materi(id, judul, matkul(kode, nama))")
        .eq("user_id", user_id)
        .order("dibuat_pada", { ascending: false })
    );
  },
};

/* =====================================================================
 * ALUR 7 - ADMIN: kelola users & matkul
 * =================================================================== */
export const alurAdmin = {
  async daftarUsers({ role, aktif } = {}) {
    await alurAuth.requireRole("admin");
    let q = supabase.from("users").select("*").order("dibuat_pada", { ascending: false });
    if (role) q = q.eq("role", role);
    if (aktif !== undefined) q = q.eq("aktif", aktif);
    return unwrap(await q);
  },

  async setAktif(user_id, aktif) {
    await alurAuth.requireRole("admin");
    return unwrap(
      await supabase.from("users").update({ aktif }).eq("id", user_id).select().single()
    );
  },

  async ubahRole(user_id, role) {
    await alurAuth.requireRole("admin");
    if (!["mahasiswa", "dosen", "admin"].includes(role)) throw new Error("Role tidak valid.");
    try {
      const { data, error } = await supabase.rpc('set_user_role', { p_user_id: user_id, p_new_role: role });
      if (!error) return true;
    } catch (e) {
      console.warn("RPC set_user_role fallback:", e);
    }
    return unwrap(
      await supabase.from("users").update({ role }).eq("id", user_id).select().single()
    );
  },

  async hapusUser(user_id) {
    await alurAuth.requireRole("admin");
    try {
      const { data, error } = await supabase.rpc('delete_user_by_admin', { p_user_id: user_id });
      if (!error) return true;
    } catch (e) {
      console.warn("RPC delete_user_by_admin fallback:", e);
    }
    unwrap(await supabase.from("users").delete().eq("id", user_id));
    return true;
  },

  async tambahMatkul({ kode, nama, semester = null, deskripsi = null }) {
    await alurAuth.requireRole("admin");
    return unwrap(
      await supabase.from("matkul").insert({ kode, nama, semester, deskripsi }).select().single()
    );
  },

  async ubahMatkul(id, fields) {
    await alurAuth.requireRole("admin");
    return unwrap(
      await supabase.from("matkul").update(fields).eq("id", id).select().single()
    );
  },

  async hapusMatkul(id) {
    await alurAuth.requireRole("admin");
    const materi = unwrap(await supabase.from("materi").select("file_path").eq("matkul_id", id));
    if (materi.length) {
      await supabase.storage.from(BUCKET).remove(materi.map((m) => m.file_path));
    }
    unwrap(await supabase.from("matkul").delete().eq("id", id));
    return true;
  },
};

