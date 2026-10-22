"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Attendance = { jam_masuk: string; jam_keluar: string; is_telat: boolean; selisih_menit: number; total_jam_kerja: string; overtime_hours: number };
type Employee = { name: string; role: string | null; division: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
function wibNow() { const n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60_000 + 7 * 3_600_000); }
function prettyDate(date: Date) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date); }

export default function AlucurvAbsenKiosk() {
  const { token } = useParams<{ token: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [clock, setClock] = useState(wibNow());
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const mode = !attendance?.jam_masuk ? "masuk" : !attendance.jam_keluar ? "pulang" : "selesai";

  const stopCamera = () => streamRef.current?.getTracks().forEach((track) => track.stop());
  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setError("");
    } catch { setError("Kamera tidak dapat diakses. Aktifkan izin kamera lalu coba kembali."); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/alucurv/absensi/${token}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) setError(json.error || "Link absensi tidak valid.");
    else { setEmployee(json.employee); setAttendance(json.attendance); }
    setLoading(false);
  }, [token]);

  // Fetch dijalankan setelah render pertama; state diperbarui dari respons async.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setClock(wibNow()), 1000); return () => window.clearInterval(timer); }, []);
  // Kamera adalah sinkronisasi perangkat eksternal, bukan state turunan UI.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!loading && employee && mode !== "selesai" && !photo) void startCamera(); return stopCamera; }, [loading, employee, mode, photo, startCamera]);

  function capture() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const size = Math.min(720 / video.videoWidth, 720 / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * size); canvas.height = Math.round(video.videoHeight * size);
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.75)); stopCamera();
  }

  async function submit() {
    if (!photo || mode === "selesai") return;
    setSending(true); setError("");
    const response = await fetch(`/api/alucurv/absensi/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: mode, selfie: photo }) });
    const json = await response.json();
    setSending(false);
    if (!response.ok) { setError(json.error || "Absensi gagal disimpan."); return; }
    setAttendance(json.attendance); setPhoto(null);
  }

  const hour = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const accent = mode === "pulang" ? "#0f766e" : "#14b8a6";
  return <main style={{ minHeight: "100vh", background: "linear-gradient(145deg,#ecfeff,#f0fdfa)", padding: "24px 16px", fontFamily: "Arial,sans-serif", color: "#134e4a" }}>
    <section style={{ maxWidth: 470, margin: "0 auto", background: "white", border: "1px solid #99f6e4", borderRadius: 20, boxShadow: "0 18px 48px rgba(13,148,136,.12)", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 30 }}>◒</div><h1 style={{ margin: "6px 0", fontSize: 23 }}>Absensi Alucurv</h1><p style={{ margin: 0, color: "#0f766e", fontSize: 13 }}>Selfie masuk & pulang karyawan</p></div>
      {loading ? <p style={{ textAlign: "center" }}>Memuat link absensi…</p> : !employee ? <p style={{ color: "#dc2626", textAlign: "center" }}>{error || "Link tidak ditemukan."}</p> : <>
        <div style={{ borderRadius: 12, background: "#f0fdfa", padding: 14, marginBottom: 14 }}><b>{employee.name}</b><div style={{ fontSize: 12, marginTop: 4, color: "#0f766e" }}>{employee.role || employee.division || "Karyawan Alucurv"}</div><div style={{ fontSize: 12, marginTop: 8 }}>{prettyDate(clock)}</div></div>
        {mode === "selesai" ? <div style={{ textAlign: "center", padding: 22, background: "#ecfdf5", borderRadius: 12 }}><div style={{ fontSize: 36 }}>✓</div><h2 style={{ fontSize: 18 }}>Absensi lengkap</h2><p style={{ fontSize: 13 }}>Masuk {attendance?.jam_masuk} WIB · Pulang {attendance?.jam_keluar} WIB</p><p style={{ fontSize: 12 }}>Total kerja: {attendance?.total_jam_kerja || "-"}</p></div> : <>
          <div style={{ textAlign: "center", border: `1px solid ${accent}`, color: accent, borderRadius: 12, padding: 12, marginBottom: 14 }}><div style={{ fontSize: 12 }}>Waktu WIB</div><b style={{ fontSize: 32 }}>{hour}</b><div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Absen {mode === "masuk" ? "Masuk" : "Pulang"}</div></div>
          {!photo ? <div style={{ overflow: "hidden", borderRadius: 14, background: "#134e4a", position: "relative" }}><video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", transform: "scaleX(-1)", minHeight: 280, objectFit: "cover" }} /><button onClick={capture} style={button(accent)}>📷 Ambil selfie</button></div> : <div><img alt="Preview selfie" src={photo} style={{ width: "100%", borderRadius: 14, display: "block" }} /><div style={{ display: "flex", gap: 8, marginTop: 12 }}><button onClick={() => { setPhoto(null); startCamera(); }} style={secondary}>Ambil ulang</button><button disabled={sending} onClick={submit} style={{ ...button(accent), flex: 1 }}>{sending ? "Menyimpan…" : `Kirim absen ${mode}`}</button></div></div>}
        </>}
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
      </>}
      <canvas ref={canvasRef} hidden />
    </section>
  </main>;
}

const button = (color: string): React.CSSProperties => ({ marginTop: 12, width: "100%", border: 0, borderRadius: 10, padding: "13px 16px", background: color, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14 });
const secondary: React.CSSProperties = { flex: 1, border: "1px solid #99f6e4", borderRadius: 10, padding: "13px 16px", background: "white", color: "#0f766e", fontWeight: 700, cursor: "pointer" };
