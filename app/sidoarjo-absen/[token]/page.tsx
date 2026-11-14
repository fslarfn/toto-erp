"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

type Attendance = { jam_masuk: string; jam_keluar: string; is_telat: boolean; selisih_menit: number; total_jam_kerja: string; overtime_hours: number };
type Employee = { nama: string; jabatan: string | null; divisi: string | null };

function wibNow() { const now = new Date(); return new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 7 * 3_600_000); }
function clock(date: Date) { return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`; }

export default function SidoarjoAttendanceKioskPage() {
    const { token } = useParams<{ token: string }>();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [now, setNow] = useState(wibNow());
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
        const response = await fetch(`/api/sidoarjo/absensi/${token}`, { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) setError(json.error || "Link absensi tidak valid.");
        else { setEmployee(json.employee); setAttendance(json.attendance); }
        setLoading(false);
    }, [token]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { void load(); }, [load]);
    useEffect(() => { const timer = window.setInterval(() => setNow(wibNow()), 1000); return () => window.clearInterval(timer); }, []);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { if (!loading && employee && mode !== "selesai" && !photo) void startCamera(); return stopCamera; }, [loading, employee, mode, photo, startCamera]);

    function capture() {
        const video = videoRef.current; const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth) return;
        const scale = Math.min(720 / video.videoWidth, 720 / video.videoHeight, 1);
        canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d"); if (!context) return;
        context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.75)); stopCamera();
    }
    async function submit() {
        if (!photo || mode === "selesai") return;
        setSending(true); setError("");
        const response = await fetch(`/api/sidoarjo/absensi/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: mode, selfie: photo }) });
        const json = await response.json(); setSending(false);
        if (!response.ok) { setError(json.error || "Absensi gagal disimpan."); return; }
        setAttendance(json.attendance); setPhoto(null);
    }

    const accent = mode === "pulang" ? "#6B4423" : "#A67B5B";
    return <main style={{ minHeight: "100vh", background: "linear-gradient(145deg,#FFF8EF,#F5E6D3)", padding: "24px 16px", fontFamily: "Arial,sans-serif", color: "#3C2F2F" }}>
        <section style={{ maxWidth: 470, margin: "0 auto", background: "white", border: "1px solid #E8DCCF", borderRadius: 20, boxShadow: "0 18px 48px rgba(107,68,35,.12)", padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 30 }}>◒</div><h1 style={{ margin: "6px 0", fontSize: 23 }}>Absensi Toto Sidoarjo</h1><p style={{ margin: 0, color: "#8B5E3C", fontSize: 13 }}>Selfie masuk & pulang karyawan cabang</p></div>
            {loading ? <p style={{ textAlign: "center" }}>Memuat link absensi…</p> : !employee ? <p style={{ color: "#DC2626", textAlign: "center" }}>{error || "Link tidak ditemukan."}</p> : <>
                <div style={{ borderRadius: 12, background: "#FFF8EF", padding: 14, marginBottom: 14 }}><b>{employee.nama}</b><div style={{ fontSize: 12, marginTop: 4, color: "#8B5E3C" }}>{employee.jabatan || employee.divisi || "Karyawan Toto Sidoarjo"}</div></div>
                {mode === "selesai" ? <div style={{ textAlign: "center", padding: 22, background: "#ECFDF5", borderRadius: 12 }}><div style={{ fontSize: 36 }}>✓</div><h2 style={{ fontSize: 18 }}>Absensi lengkap</h2><p style={{ fontSize: 13 }}>Masuk {attendance?.jam_masuk} WIB · Pulang {attendance?.jam_keluar} WIB</p><p style={{ fontSize: 12 }}>Total kerja: {attendance?.total_jam_kerja || "-"}</p></div> : <>
                    <div style={{ textAlign: "center", border: `1px solid ${accent}`, color: accent, borderRadius: 12, padding: 12, marginBottom: 14 }}><div style={{ fontSize: 12 }}>Waktu WIB</div><b style={{ fontSize: 32 }}>{clock(now)}</b><div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Absen {mode === "masuk" ? "Masuk" : "Pulang"}</div></div>
                    {!photo ? <div style={{ overflow: "hidden", borderRadius: 14, background: "#3C2F2F" }}><video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", transform: "scaleX(-1)", minHeight: 280, objectFit: "cover" }} /><button onClick={capture} style={button(accent)}>📷 Ambil selfie</button></div> : <div><img alt="Preview selfie" src={photo} style={{ width: "100%", borderRadius: 14, display: "block" }} /><div style={{ display: "flex", gap: 8, marginTop: 12 }}><button onClick={() => { setPhoto(null); void startCamera(); }} style={secondary}>Ambil ulang</button><button disabled={sending} onClick={submit} style={{ ...button(accent), flex: 1 }}>{sending ? "Menyimpan…" : `Kirim absen ${mode}`}</button></div></div>}
                </>}
                {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
            </>}
            <canvas ref={canvasRef} hidden />
        </section>
    </main>;
}

const button = (color: string): React.CSSProperties => ({ marginTop: 12, width: "100%", border: 0, borderRadius: 10, padding: "13px 16px", background: color, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14 });
const secondary: React.CSSProperties = { flex: 1, border: "1px solid #E8DCCF", borderRadius: 10, padding: "13px 16px", background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" };
