"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import type { PertanyaanItem } from "@/lib/kuesioner-questions";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"] });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

interface FormData {
  nama: string;
  label: string;
  brand: "toto" | "alucurv" | "both";
  umum: PertanyaanItem[];
  khusus: PertanyaanItem[];
  answers: Record<string, string>;
  submitted_at: string | null;
}

export default function KuesionerIsiPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<FormData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/kuesioner/isi/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat");
        setData(json);
        setAnswers(json.answers ?? {});
        setSavedAt(json.submitted_at);
      } catch (err) {
        setErrorMsg((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const setJawaban = useCallback((id: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [id]: v }));
    setShowConfirm(false);
  }, []);

  const semua = useMemo(
    () => (data ? [...data.umum, ...data.khusus] : []),
    [data]
  );
  const terisi = semua.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;

  async function simpan() {
    setSaving(true);
    setErrorMsg("");
    setShowConfirm(false);
    try {
      const res = await fetch(`/api/kuesioner/isi/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setSavedAt(new Date().toISOString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function kirim() {
    if (terisi < semua.length) {
      setShowConfirm(true);
      return;
    }
    void simpan();
  }

  function keYangKosong() {
    setShowConfirm(false);
    const kosong = semua.find((q) => !(answers[q.id] ?? "").trim());
    if (!kosong) return;
    document.getElementById(`q-${kosong.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------- states ---------- */
  if (loading) {
    return (
      <div className={`${body.className} kv-root kv-center`}>
        <style>{css}</style>
        <div className="kv-spinner" aria-label="Memuat" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`${body.className} kv-root kv-center`}>
        <style>{css}</style>
        <div className="kv-invalid">
          <div className={`${mono.className} kv-tag`}>AKSES DITOLAK</div>
          <h1 className={display.className}>Link tidak valid</h1>
          <p>
            Link kuesioner ini tidak dikenali. Hubungi owner untuk mendapatkan
            link pribadi Anda.
          </p>
        </div>
      </div>
    );
  }

  const isAlu = data.brand === "alucurv";

  return (
    <div className={`${body.className} kv-root ${isAlu ? "kv-alu" : ""}`}>
      <style>{css}</style>

      {/* progress bar lengket */}
      <div className="kv-progress">
        <div className="kv-progress-fill" style={{ width: `${(terisi / semua.length) * 100}%` }} />
        <span className={`${mono.className} kv-progress-text`}>
          {terisi}/{semua.length} TERJAWAB
        </span>
      </div>

      {/* header */}
      <header className="kv-header">
        <div className="kv-wrap">
          <div className={`${mono.className} kv-tag kv-tag-light`}>
            KUESIONER INTERNAL — MEETING BULANAN · JULI 2026
          </div>
          <h1 className={`${display.className} kv-title`}>
            Halo, {data.nama}<span className="kv-accent">.</span>
          </h1>
          <div className="kv-lembar">
            <span className={`${mono.className} kv-chip`}>{data.label.toUpperCase()}</span>
          </div>
          <p className="kv-note">
            Jawaban Anda <b>bersifat pribadi</b> — hanya dibaca owner, tidak
            dibagikan ke forum. Tidak ada jawaban benar atau salah; yang penting
            jujur. Batas pengisian <b>Sabtu, 1 Agustus 2026</b>.
          </p>
        </div>
        <div className="kv-header-rule" />
      </header>

      <main className="kv-wrap kv-main" ref={listRef}>
        {savedAt && (
          <div className="kv-saved kv-reveal">
            <span className={`${mono.className} kv-saved-stamp`}>TERSIMPAN</span>
            <span>
              {new Date(savedAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
              {" · "}masih bisa diubah lewat link ini sampai batas waktu.
            </span>
          </div>
        )}
        {errorMsg && <div className="kv-error kv-reveal">{errorMsg}</div>}

        {/* Bagian A */}
        <section className="kv-section kv-reveal">
          <div className={`${mono.className} kv-section-tag`}>
            <span>BAGIAN A</span> PERTANYAAN UMUM
          </div>
          {data.umum.map((q, i) => (
            <Pertanyaan
              key={q.id}
              q={q}
              nomor={i + 1}
              value={answers[q.id] ?? ""}
              onChange={setJawaban}
            />
          ))}
        </section>

        {/* Bagian B */}
        <section className="kv-section kv-reveal" style={{ animationDelay: "120ms" }}>
          <div className={`${mono.className} kv-section-tag`}>
            <span>BAGIAN B</span> KHUSUS {data.label.toUpperCase()}
          </div>
          {data.khusus.map((q, i) => (
            <Pertanyaan
              key={q.id}
              q={q}
              nomor={data.umum.length + i + 1}
              value={answers[q.id] ?? ""}
              onChange={setJawaban}
            />
          ))}
        </section>

        {/* konfirmasi inline (pengganti window.confirm) */}
        {showConfirm && (
          <div className="kv-confirm kv-reveal">
            <p>
              Masih ada <b>{semua.length - terisi} pertanyaan kosong</b>. Kirim
              sekarang, atau lengkapi dulu? (Anda tetap bisa kembali lewat link
              ini.)
            </p>
            <div className="kv-confirm-btns">
              <button className="kv-btn-ghost" onClick={keYangKosong}>
                Lengkapi dulu
              </button>
              <button className="kv-btn-solid" onClick={() => void simpan()} disabled={saving}>
                {saving ? "Menyimpan…" : "Kirim yang sudah ada"}
              </button>
            </div>
          </div>
        )}

        <button className="kv-submit" onClick={kirim} disabled={saving}>
          <span className={mono.className}>
            {saving ? "MENYIMPAN…" : savedAt ? "SIMPAN PERUBAHAN" : "KIRIM JAWABAN"}
          </span>
          <span className="kv-submit-arrow">→</span>
        </button>

        <p className={`${mono.className} kv-footer`}>
          CV TOTO ALUMINIUM MANUFACTURE × ALUCURV — TERIMA KASIH SUDAH MELUANGKAN WAKTU
        </p>
      </main>
    </div>
  );
}

/* ---------- komponen pertanyaan ---------- */
function Pertanyaan({
  q,
  nomor,
  value,
  onChange,
}: {
  q: PertanyaanItem;
  nomor: number;
  value: string;
  onChange: (id: string, v: string) => void;
}) {
  const filled = value.trim().length > 0;
  return (
    <div className={`kv-q ${filled ? "kv-q-filled" : ""}`} id={`q-${q.id}`}>
      <div className="kv-q-num" aria-hidden>
        {String(nomor).padStart(2, "0")}
      </div>
      <div className="kv-q-body">
        <label className="kv-q-label" htmlFor={`ta-${q.id}`}>
          {q.teks}
        </label>
        <textarea
          id={`ta-${q.id}`}
          value={value}
          onChange={(e) => onChange(q.id, e.target.value)}
          rows={4}
          placeholder="Tulis jawaban Anda di sini…"
        />
        <div className={`kv-q-status ${filled ? "on" : ""}`}>✓ TERISI</div>
      </div>
    </div>
  );
}

/* ---------- gaya: formulir teknis workshop ---------- */
const css = `
  .kv-root {
    --paper: #f4f1ea;
    --card: #fffdf7;
    --ink: #1c2430;
    --ink-soft: #4c5563;
    --ink-faint: #8b92a0;
    --line: #d8d3c6;
    --accent: #2456c4;
    --accent-soft: rgba(36, 86, 196, 0.08);
    --ok: #1a7a3a;
    --err: #c03434;
    min-height: 100vh;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(28,36,48,0.035) 31px, rgba(28,36,48,0.035) 32px),
      var(--paper);
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  .kv-alu { --accent: #d4550f; --accent-soft: rgba(212, 85, 15, 0.09); }
  .kv-center { display: flex; align-items: center; justify-content: center; padding: 24px; }
  .kv-wrap { max-width: 680px; margin: 0 auto; padding: 0 20px; }

  .kv-spinner {
    width: 42px; height: 42px; border-radius: 50%;
    border: 3px solid var(--line); border-top-color: var(--accent);
    animation: kv-spin 0.8s linear infinite;
  }
  @keyframes kv-spin { to { transform: rotate(360deg); } }

  .kv-invalid { max-width: 420px; text-align: center; background: var(--card); border: 1.5px solid var(--ink); padding: 40px 32px; box-shadow: 6px 6px 0 rgba(28,36,48,0.12); }
  .kv-invalid h1 { font-size: 26px; margin: 12px 0 8px; }
  .kv-invalid p { color: var(--ink-soft); font-size: 14.5px; line-height: 1.6; }

  .kv-tag { font-size: 11px; letter-spacing: 0.14em; color: var(--accent); }
  .kv-tag-light { color: rgba(244,241,234,0.75); }

  .kv-progress {
    position: sticky; top: 0; z-index: 30; height: 30px;
    background: var(--ink); overflow: hidden;
    display: flex; align-items: center;
  }
  .kv-progress-fill { position: absolute; inset: 0 auto 0 0; background: var(--accent); transition: width 0.35s cubic-bezier(.2,.8,.2,1); }
  .kv-progress-text { position: relative; margin-left: auto; margin-right: 16px; font-size: 10.5px; letter-spacing: 0.16em; color: rgba(244,241,234,0.92); }

  .kv-header { background: var(--ink); color: var(--paper); padding: 34px 0 30px; position: relative; }
  .kv-header::after {
    content: ""; position: absolute; inset: 0;
    background: repeating-linear-gradient(-45deg, transparent, transparent 9px, rgba(244,241,234,0.025) 9px, rgba(244,241,234,0.025) 10px);
    pointer-events: none;
  }
  .kv-title { font-size: clamp(34px, 8vw, 48px); line-height: 1.05; margin-top: 10px; letter-spacing: -0.01em; }
  .kv-accent { color: var(--accent); }
  .kv-alu .kv-header .kv-accent { color: #ff8a4c; }
  .kv-lembar { margin-top: 14px; }
  .kv-chip {
    display: inline-block; font-size: 11px; letter-spacing: 0.14em;
    border: 1px solid rgba(244,241,234,0.4); padding: 6px 12px;
    background: rgba(244,241,234,0.06);
  }
  .kv-note { margin-top: 16px; font-size: 14.5px; line-height: 1.65; color: rgba(244,241,234,0.82); max-width: 560px; }
  .kv-note b { color: var(--paper); }
  .kv-header-rule { height: 5px; background: var(--accent); }

  .kv-main { padding-top: 26px; padding-bottom: 70px; }

  .kv-reveal { animation: kv-up 0.5s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes kv-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

  .kv-saved {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    background: var(--card); border: 1.5px solid var(--ok);
    padding: 12px 16px; margin-bottom: 18px; font-size: 13.5px; color: var(--ink-soft);
  }
  .kv-saved-stamp {
    font-size: 11px; letter-spacing: 0.14em; color: var(--ok);
    border: 1.5px solid var(--ok); padding: 3px 9px; transform: rotate(-2deg);
  }
  .kv-error { background: #fdf1f1; border: 1.5px solid var(--err); color: var(--err); padding: 12px 16px; margin-bottom: 18px; font-size: 14px; }

  .kv-section { margin-top: 26px; }
  .kv-section-tag {
    display: flex; align-items: center; gap: 10px;
    font-size: 11.5px; letter-spacing: 0.15em; color: var(--ink-soft);
    margin-bottom: 6px;
  }
  .kv-section-tag span:first-child {
    background: var(--ink); color: var(--paper); padding: 4px 10px;
  }
  .kv-section-tag::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  .kv-q {
    position: relative; display: flex; gap: 14px;
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--line);
    padding: 18px 18px 14px 16px; margin-top: 14px;
    transition: border-color 0.25s, box-shadow 0.25s;
  }
  .kv-q:focus-within { border-left-color: var(--accent); box-shadow: 4px 4px 0 var(--accent-soft); }
  .kv-q-filled { border-left-color: var(--ok); }
  .kv-q-num {
    font-family: inherit; font-weight: 800; font-size: 30px; line-height: 1;
    color: var(--accent); opacity: 0.22; min-width: 44px; padding-top: 2px;
    font-variant-numeric: tabular-nums;
  }
  .kv-q-body { flex: 1; min-width: 0; }
  .kv-q-label { display: block; font-size: 15px; font-weight: 600; line-height: 1.5; color: var(--ink); }
  .kv-q textarea {
    width: 100%; margin-top: 12px; padding: 12px 14px;
    font: inherit; font-size: 15px; line-height: 1.55; color: var(--ink);
    background: var(--paper); border: 1px solid var(--line); border-radius: 0;
    resize: vertical; min-height: 96px;
  }
  .kv-q textarea:focus { outline: none; border-color: var(--accent); background: #fff; }
  .kv-q textarea::placeholder { color: var(--ink-faint); }
  .kv-q-status {
    margin-top: 6px; font-size: 10px; letter-spacing: 0.14em;
    color: var(--ok); opacity: 0; transition: opacity 0.25s;
    font-family: ui-monospace, monospace;
  }
  .kv-q-status.on { opacity: 1; }

  .kv-confirm {
    margin-top: 24px; background: #fff8ec; border: 1.5px solid #d99a2b;
    padding: 16px 18px; font-size: 14.5px; line-height: 1.6; color: var(--ink);
  }
  .kv-confirm-btns { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  .kv-btn-ghost, .kv-btn-solid {
    font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
    padding: 10px 18px; border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  }
  .kv-btn-solid { background: var(--ink); color: var(--paper); }
  .kv-btn-ghost:hover { background: rgba(28,36,48,0.06); }
  .kv-btn-solid:hover { opacity: 0.9; }

  .kv-submit {
    margin-top: 26px; width: 100%; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    background: var(--accent); color: #fff; border: none;
    padding: 18px 20px; font-size: 14px; letter-spacing: 0.12em;
    box-shadow: 5px 5px 0 rgba(28,36,48,0.18);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .kv-submit:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 rgba(28,36,48,0.22); }
  .kv-submit:active:not(:disabled) { transform: translate(0, 0); box-shadow: 3px 3px 0 rgba(28,36,48,0.18); }
  .kv-submit:disabled { opacity: 0.55; cursor: default; }
  .kv-submit-arrow { font-size: 18px; transition: transform 0.2s; }
  .kv-submit:hover:not(:disabled) .kv-submit-arrow { transform: translateX(4px); }

  .kv-footer { text-align: center; margin-top: 34px; font-size: 10px; letter-spacing: 0.16em; color: var(--ink-faint); }
`;
