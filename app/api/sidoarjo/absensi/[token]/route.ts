import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const JAM_MASUK_BATAS = 8 * 60;
const UNIT = "toto_sidoarjo";

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function wibNow() {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 7 * 3_600_000);
}

function isoDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function clock(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function imageFromDataUrl(value: unknown) {
    if (typeof value !== "string") return null;
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) return null;
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, extension: match[1] === "png" ? "png" : "jpg", contentType: `image/${match[1]}` };
}

async function employeeByToken(token: string) {
    const { data, error } = await db()
        .from("karyawan")
        .select("id,nama,jabatan,divisi,status")
        .eq("operating_unit", UNIT)
        .eq("attendance_token", token)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await context.params;
        const employee = await employeeByToken(token);
        if (!employee || employee.status === "Nonaktif") return NextResponse.json({ error: "Link absensi tidak aktif." }, { status: 404 });

        const tanggal = isoDate(wibNow());
        const { data: attendance, error } = await db()
            .from("absensi")
            .select("id,tanggal,jam_masuk,jam_keluar,is_telat,selisih_menit,total_jam_kerja,overtime_hours")
            .eq("operating_unit", UNIT)
            .eq("karyawan_id", employee.id)
            .eq("tanggal", tanggal)
            .maybeSingle();
        if (error) throw error;
        return NextResponse.json({ employee, attendance: attendance ?? null, today: tanggal });
    } catch (error) {
        console.error("Sidoarjo attendance lookup error", error);
        return NextResponse.json({ error: "Link absensi tidak dapat diproses." }, { status: 500 });
    }
}

export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await context.params;
        const employee = await employeeByToken(token);
        if (!employee || employee.status === "Nonaktif") return NextResponse.json({ error: "Link absensi tidak aktif." }, { status: 404 });

        const body = await req.json() as { type?: "masuk" | "pulang"; selfie?: string };
        if (body.type !== "masuk" && body.type !== "pulang") return NextResponse.json({ error: "Jenis absensi tidak valid." }, { status: 400 });
        const image = imageFromDataUrl(body.selfie);
        if (!image) return NextResponse.json({ error: "Selfie wajib berupa JPEG/PNG maksimal 2 MB." }, { status: 400 });

        const now = wibNow();
        const tanggal = isoDate(now);
        const jam = clock(now);
        const supabase = db();
        const { data: existing, error: existingError } = await supabase
            .from("absensi")
            .select("id,jam_masuk,jam_keluar")
            .eq("operating_unit", UNIT)
            .eq("karyawan_id", employee.id)
            .eq("tanggal", tanggal)
            .maybeSingle();
        if (existingError) throw existingError;

        if (body.type === "masuk" && existing?.jam_masuk) return NextResponse.json({ error: "Absen masuk hari ini sudah tercatat." }, { status: 409 });
        if (body.type === "pulang" && (!existing?.jam_masuk || existing?.jam_keluar)) return NextResponse.json({ error: existing?.jam_keluar ? "Absen pulang hari ini sudah tercatat." : "Silakan absen masuk terlebih dahulu." }, { status: 409 });

        const path = `sidoarjo/${employee.id}/${tanggal}_${body.type}.${image.extension}`;
        const { error: uploadError } = await supabase.storage.from("absensi-foto").upload(path, image.bytes, {
            contentType: image.contentType,
            upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from("absensi-foto").getPublicUrl(path);

        if (body.type === "masuk") {
            const minute = now.getHours() * 60 + now.getMinutes();
            const late = minute > JAM_MASUK_BATAS;
            const { data, error } = await supabase.from("absensi").insert({
                workspace: "toto",
                operating_unit: UNIT,
                karyawan_id: employee.id,
                alu_employee_id: null,
                nama_karyawan: employee.nama,
                tanggal,
                jam_masuk: jam,
                jam_keluar: "",
                foto_masuk_url: publicUrl.publicUrl,
                foto_keluar_url: "",
                is_telat: late,
                selisih_menit: late ? minute - JAM_MASUK_BATAS : 0,
                total_jam_kerja: "",
                overtime_hours: 0,
                status_kehadiran: "hadir",
            }).select().single();
            if (error) throw error;
            return NextResponse.json({ attendance: data, type: "masuk" }, { status: 201 });
        }

        if (!existing) return NextResponse.json({ error: "Silakan absen masuk terlebih dahulu." }, { status: 409 });
        const [hm, mm] = String(existing.jam_masuk).split(":").map(Number);
        const diffMinutes = Math.max(0, now.getHours() * 60 + now.getMinutes() - hm * 60 - mm);
        const overtimeHours = now.getHours() >= 22 ? 1.5 : now.getHours() >= 20 ? 1 : now.getHours() >= 18 ? 0.5 : 0;
        const { data, error } = await supabase.from("absensi").update({
            jam_keluar: jam,
            foto_keluar_url: publicUrl.publicUrl,
            total_jam_kerja: `${Math.floor(diffMinutes / 60)}j ${diffMinutes % 60}m`,
            overtime_hours: overtimeHours,
        }).eq("id", existing.id).select().single();
        if (error) throw error;
        return NextResponse.json({ attendance: data, type: "pulang" });
    } catch (error) {
        console.error("Sidoarjo attendance error", error);
        return NextResponse.json({ error: "Absensi gagal disimpan. Silakan coba lagi." }, { status: 500 });
    }
}
