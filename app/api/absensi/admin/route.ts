import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const JAM_STANDAR = "08:00";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function calcFields(jam_masuk: string, jam_keluar?: string) {
  const [hm, mm] = jam_masuk.split(":").map(Number);
  const [hs, ms] = JAM_STANDAR.split(":").map(Number);
  const masukMin = hm * 60 + mm;
  const standarMin = hs * 60 + ms;
  const selisih_menit = Math.max(0, masukMin - standarMin);
  const is_telat = selisih_menit > 0;

  let total_jam_kerja = "";
  if (jam_keluar) {
    const [hk, mk] = jam_keluar.split(":").map(Number);
    const diff = Math.max(0, hk * 60 + mk - masukMin);
    total_jam_kerja = `${Math.floor(diff / 60)}j ${diff % 60}m`;
  }

  return { is_telat, selisih_menit, total_jam_kerja };
}

function isFaisal(req: Request) {
  return req.headers.get("x-username") === "faisal";
}

export async function POST(req: Request) {
  if (!isFaisal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { karyawan_id, nama_karyawan, tanggal, jam_masuk, jam_keluar, overtime_hours, status_kehadiran, catatan } = body;

    if (!karyawan_id || !nama_karyawan || !tanggal || !jam_masuk) {
      return NextResponse.json({ error: "karyawan_id, nama_karyawan, tanggal, jam_masuk wajib diisi" }, { status: 400 });
    }

    const calc = calcFields(jam_masuk, jam_keluar || undefined);
    const supabase = getServiceSupabase();

    const { data, error } = await supabase.from("absensi").insert({
      karyawan_id: Number(karyawan_id),
      nama_karyawan,
      tanggal,
      jam_masuk,
      jam_keluar: jam_keluar || null,
      is_telat: calc.is_telat,
      selisih_menit: calc.selisih_menit,
      total_jam_kerja: calc.total_jam_kerja,
      overtime_hours: Number(overtime_hours) || 0,
      status_kehadiran: status_kehadiran || "hadir",
      catatan: catatan || null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!isFaisal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, jam_masuk, jam_keluar, overtime_hours, status_kehadiran, catatan } = body;

    if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

    const supabase = getServiceSupabase();
    const updates: Record<string, unknown> = {};

    if (jam_masuk !== undefined) {
      const calc = calcFields(jam_masuk, jam_keluar || undefined);
      updates.jam_masuk = jam_masuk;
      updates.is_telat = calc.is_telat;
      updates.selisih_menit = calc.selisih_menit;
      updates.total_jam_kerja = calc.total_jam_kerja;
    }
    if (jam_keluar !== undefined) updates.jam_keluar = jam_keluar || null;
    if (overtime_hours !== undefined) updates.overtime_hours = Number(overtime_hours);
    if (status_kehadiran !== undefined) updates.status_kehadiran = status_kehadiran;
    if (catatan !== undefined) updates.catatan = catatan || null;

    const { error } = await supabase.from("absensi").update(updates).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isFaisal(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

    const supabase = getServiceSupabase();
    const { error } = await supabase.from("absensi").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
