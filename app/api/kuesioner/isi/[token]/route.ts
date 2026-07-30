import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PERTANYAAN_UMUM, getBagian } from "@/lib/kuesioner-questions";

// Route PUBLIK (lihat middleware PUBLIC_PREFIXES): autentikasi = token unik
// per orang. Tabel kuesioner_responses dikunci RLS tanpa policy, jadi hanya
// service role (server ini) yang bisa membaca/menulis.

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findByToken(token: string) {
  if (!UUID_RE.test(token)) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("kuesioner_responses")
    .select("id, token, nama, bagian, answers, submitted_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const row = await findByToken(token);
    if (!row) {
      return NextResponse.json({ error: "Link tidak valid" }, { status: 404 });
    }
    const bagian = getBagian(row.bagian);
    if (!bagian) {
      return NextResponse.json({ error: "Bagian tidak dikenal" }, { status: 500 });
    }
    return NextResponse.json({
      nama: row.nama,
      bagian: row.bagian,
      label: bagian.label,
      brand: bagian.brand,
      umum: PERTANYAAN_UMUM,
      khusus: bagian.khusus,
      answers: row.answers ?? {},
      submitted_at: row.submitted_at,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const row = await findByToken(token);
    if (!row) {
      return NextResponse.json({ error: "Link tidak valid" }, { status: 404 });
    }
    const bagian = getBagian(row.bagian);
    if (!bagian) {
      return NextResponse.json({ error: "Bagian tidak dikenal" }, { status: 500 });
    }

    const body = await req.json();
    const masuk = body?.answers;
    if (!masuk || typeof masuk !== "object" || Array.isArray(masuk)) {
      return NextResponse.json({ error: "Format jawaban tidak valid" }, { status: 400 });
    }

    // Hanya terima kunci pertanyaan yang dikenal, nilai string, maks 5000 char
    const validIds = new Set([
      ...PERTANYAAN_UMUM.map((q) => q.id),
      ...bagian.khusus.map((q) => q.id),
    ]);
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(masuk)) {
      if (!validIds.has(k)) continue;
      if (typeof v !== "string") continue;
      answers[k] = v.slice(0, 5000);
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("kuesioner_responses")
      .update({ answers, submitted_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
