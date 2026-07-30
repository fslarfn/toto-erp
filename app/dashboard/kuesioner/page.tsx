"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PERTANYAAN_UMUM, getBagian } from "@/lib/kuesioner-questions";

interface Row {
  id: string;
  token: string;
  nama: string;
  bagian: string;
  answers: Record<string, string>;
  submitted_at: string | null;
}

const GRUP: { key: string; judul: string; bagianList: string[] }[] = [
  { key: "owner", judul: "Owner", bagianList: ["owner"] },
  {
    key: "toto",
    judul: "CV Toto Aluminium",
    bagianList: ["admin_finance", "admin_barang", "pic_produksi", "pic_gudang", "marketing"],
  },
  {
    key: "alucurv",
    judul: "Alucurv",
    bagianList: ["marketing_alucurv", "admin_finance_alucurv"],
  },
];

export default function KuesionerAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.replace("/login");
      else if (user.role !== "owner" && user.username !== "faisal")
        router.replace("/dashboard");
      else setAuthorized(true);
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      try {
        const res = await fetch("/api/kuesioner/admin");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat");
        setRows(json.data);
      } catch (err) {
        setErrorMsg((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized]);

  if (authLoading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#A67B5B]" />
      </div>
    );
  }

  const linkFor = (r: Row) => `${window.location.origin}/kuesioner/${r.token}`;

  async function salin(r: Row) {
    await navigator.clipboard.writeText(linkFor(r));
    setCopied(r.id);
    setTimeout(() => setCopied(null), 1500);
  }

  function bagikanWA(r: Row) {
    const label = getBagian(r.bagian)?.label ?? r.bagian;
    const text =
      `Halo ${r.nama}, ini link kuesioner pribadi Anda (${label}) dari meeting bulanan Juli.\n` +
      `Diisi paling lambat Sabtu 1 Agustus 2026. Jawaban hanya dibaca owner.\n\n${linkFor(r)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const sudahIsi = rows.filter((r) => r.submitted_at).length;
  const pct = rows.length ? Math.round((sudahIsi / rows.length) * 100) : 0;

  return (
    <div className="kq-page">
      <style>{css}</style>

      {/* ===== Header ===== */}
      <div className="kq-hero">
        <div className="kq-hero-left">
          <div className="kq-kicker">Meeting Bulanan · Juli 2026</div>
          <h1 className="kq-title">Kuesioner Tim</h1>
          <p className="kq-sub">
            Kirim link pribadi ke masing-masing orang lewat tombol WA. Jawaban
            bersifat rahasia — hanya terlihat di halaman ini.
          </p>
        </div>
        <div className="kq-hero-right">
          <div className="kq-ring" style={{ ["--pct" as string]: `${pct}` }}>
            <svg viewBox="0 0 84 84">
              <circle className="kq-ring-bg" cx="42" cy="42" r="36" />
              <circle
                className="kq-ring-fg"
                cx="42"
                cy="42"
                r="36"
                strokeDasharray={`${(pct / 100) * 226.2} 226.2`}
              />
            </svg>
            <div className="kq-ring-text">
              <b>{sudahIsi}</b>
              <span>dari {rows.length || "–"}</span>
            </div>
          </div>
          <div className="kq-ring-label">sudah mengisi</div>
        </div>
      </div>

      {errorMsg && (
        <div className="kq-error">
          {errorMsg} — pastikan migrasi <code>20260730_kuesioner.sql</code> sudah
          dijalankan di Supabase.
        </div>
      )}

      {loading ? (
        <div className="mt-10 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A67B5B]" />
        </div>
      ) : (
        GRUP.map((g) => {
          const anggota = rows.filter((r) => g.bagianList.includes(r.bagian));
          if (anggota.length === 0) return null;
          const isiGrup = anggota.filter((r) => r.submitted_at).length;
          return (
            <section key={g.key} className="kq-group">
              <div className="kq-group-head">
                <h2>{g.judul}</h2>
                <span>
                  {isiGrup}/{anggota.length} mengisi
                </span>
              </div>
              <div className="kq-cards">
                {anggota.map((r) => {
                  const bagian = getBagian(r.bagian);
                  const isAlu = bagian?.brand === "alucurv";
                  const qList = [...PERTANYAAN_UMUM, ...(bagian?.khusus ?? [])];
                  const terjawab = qList.filter(
                    (q) => (r.answers?.[q.id] ?? "").trim().length > 0
                  ).length;
                  const open = openId === r.id;
                  return (
                    <div key={r.id} className={`kq-card ${open ? "kq-card-open" : ""}`}>
                      <div className="kq-row">
                        <div className={`kq-ava ${isAlu ? "kq-ava-alu" : g.key === "owner" ? "kq-ava-owner" : ""}`}>
                          {r.nama.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="kq-ident">
                          <div className="kq-nama">{r.nama}</div>
                          <div className="kq-bagian">{bagian?.label ?? r.bagian}</div>
                        </div>
                        <div className="kq-status">
                          {r.submitted_at ? (
                            <span className="kq-pill kq-pill-done">
                              ✓ Terisi {terjawab}/{qList.length}
                            </span>
                          ) : (
                            <span className="kq-pill kq-pill-wait">Belum mengisi</span>
                          )}
                        </div>
                        <div className="kq-btns">
                          <button className="kq-btn" onClick={() => salin(r)} title="Salin link pribadi">
                            {copied === r.id ? "✓ Tersalin" : "Salin Link"}
                          </button>
                          <button className="kq-btn kq-btn-wa" onClick={() => bagikanWA(r)} title="Kirim lewat WhatsApp">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2.1 1c.3.2.5.3.6.4 0 .1 0 .7-.2 1.3Z"/></svg>
                            WA
                          </button>
                          <button
                            className="kq-btn kq-btn-baca"
                            onClick={() => setOpenId(open ? null : r.id)}
                            disabled={!r.submitted_at}
                          >
                            {open ? "Tutup ▴" : "Baca ▾"}
                          </button>
                        </div>
                      </div>
                      {open && r.submitted_at && (
                        <div className="kq-answers">
                          <div className="kq-answers-meta">
                            Dikirim{" "}
                            {new Date(r.submitted_at).toLocaleString("id-ID", {
                              dateStyle: "long",
                              timeStyle: "short",
                            })}
                          </div>
                          {qList.map((q, i) => (
                            <div key={q.id} className="kq-answer">
                              <div className="kq-q">
                                <span className="kq-q-num">{i + 1}</span>
                                <span>{q.teks}</span>
                              </div>
                              <div className="kq-a">
                                {(r.answers?.[q.id] ?? "").trim() || (
                                  <span className="kq-a-empty">— tidak dijawab —</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

const css = `
  .kq-page { padding: 20px; max-width: 980px; margin: 0 auto; color: #4A3428; }
  @media (min-width: 768px) { .kq-page { padding: 32px; } }

  /* ===== hero ===== */
  .kq-hero {
    display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
    background: linear-gradient(120deg, #5C4033 0%, #7a5540 60%, #8a6047 100%);
    color: #F5EBDD; border-radius: 20px; padding: 26px 30px;
    box-shadow: 0 10px 26px rgba(92, 64, 51, 0.22);
  }
  .kq-kicker { font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(245,235,221,0.7); font-weight: 700; }
  .kq-title { font-size: 28px; font-weight: 800; margin-top: 4px; }
  .kq-sub { font-size: 14px; color: rgba(245,235,221,0.85); margin-top: 8px; max-width: 460px; line-height: 1.6; }

  .kq-hero-right { display: flex; flex-direction: column; align-items: center; }
  .kq-ring { position: relative; width: 84px; height: 84px; }
  .kq-ring svg { transform: rotate(-90deg); width: 84px; height: 84px; }
  .kq-ring-bg { fill: none; stroke: rgba(245,235,221,0.2); stroke-width: 7; }
  .kq-ring-fg { fill: none; stroke: #F5C518; stroke-width: 7; stroke-linecap: round; transition: stroke-dasharray 0.6s ease; }
  .kq-ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
  .kq-ring-text b { font-size: 24px; font-weight: 800; }
  .kq-ring-text span { font-size: 10px; color: rgba(245,235,221,0.75); }
  .kq-ring-label { margin-top: 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(245,235,221,0.75); font-weight: 700; }

  .kq-error { margin-top: 18px; background: #FDF0EE; border: 1px solid #E2A69B; color: #A4392A; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; }

  /* ===== grup ===== */
  .kq-group { margin-top: 30px; }
  .kq-group-head { display: flex; align-items: baseline; gap: 12px; padding: 0 4px; }
  .kq-group-head h2 { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #5C4033; }
  .kq-group-head span { font-size: 12px; color: #A67B5B; font-weight: 600; }
  .kq-group-head::after { content: ""; flex: 1; height: 1px; background: #E4D5C3; }

  .kq-cards { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }

  /* ===== kartu orang ===== */
  .kq-card {
    background: #FFFDF9; border: 1px solid #EADFCF; border-radius: 16px;
    box-shadow: 0 2px 6px rgba(92,64,51,0.05);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .kq-card:hover { box-shadow: 0 6px 16px rgba(92,64,51,0.1); border-color: #DCC9AF; }
  .kq-card-open { border-color: #C9A17E; }

  .kq-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; }
  .kq-ava {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 15px; letter-spacing: 0.02em;
    background: #E8F0FB; color: #2456c4;
  }
  .kq-ava-alu { background: #FCEBDD; color: #C05012; }
  .kq-ava-owner { background: #F5E9C8; color: #8a6a12; }
  .kq-ident { flex: 1; min-width: 150px; }
  .kq-nama { font-weight: 800; font-size: 16px; color: #3E2C22; }
  .kq-bagian { font-size: 12px; color: #A67B5B; margin-top: 1px; font-weight: 600; }

  .kq-status { min-width: 120px; }
  .kq-pill { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 5px 12px; border-radius: 999px; }
  .kq-pill-done { background: #E5F4E4; color: #2E7D32; }
  .kq-pill-wait { background: #FBF2DC; color: #9C6F13; }

  .kq-btns { display: flex; gap: 8px; flex-wrap: wrap; }
  .kq-btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
    padding: 8px 14px; border-radius: 10px;
    border: 1.5px solid #D9C6AE; background: #fff; color: #5C4033;
    transition: all 0.15s;
  }
  .kq-btn:hover:not(:disabled) { background: #F5EBDD; border-color: #C9A17E; }
  .kq-btn-wa { background: #25A05A; border-color: #25A05A; color: #fff; }
  .kq-btn-wa:hover { background: #1E8A4C; border-color: #1E8A4C; }
  .kq-btn-baca { background: #5C4033; border-color: #5C4033; color: #F5EBDD; }
  .kq-btn-baca:hover:not(:disabled) { background: #4A3428; }
  .kq-btn:disabled { opacity: 0.35; cursor: default; }

  /* ===== jawaban ===== */
  .kq-answers { border-top: 1px dashed #E4D5C3; padding: 18px 18px 20px; background: #FBF6EE; border-radius: 0 0 16px 16px; }
  .kq-answers-meta { font-size: 11.5px; color: #A67B5B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
  .kq-answer { margin-bottom: 16px; }
  .kq-answer:last-child { margin-bottom: 0; }
  .kq-q { display: flex; gap: 10px; font-size: 13px; font-weight: 700; color: #6B4E3D; line-height: 1.5; }
  .kq-q-num {
    flex-shrink: 0; width: 22px; height: 22px; border-radius: 7px;
    background: #5C4033; color: #F5EBDD; font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; margin-top: 1px;
  }
  .kq-a {
    margin: 8px 0 0 32px; font-size: 14.5px; color: #3E2C22; white-space: pre-wrap; line-height: 1.65;
    background: #fff; border: 1px solid #EADFCF; border-radius: 12px; padding: 12px 14px;
  }
  .kq-a-empty { color: #C4B5A4; font-style: italic; }
`;
