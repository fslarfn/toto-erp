"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    useEffect(() => { setMounted(true); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const ok = await login(username, password);
        setLoading(false);
        if (ok) {
            router.push("/dashboard");
        } else {
            setError("Username atau password salah.");
        }
    };

    return (
        <div style={styles.page}>
            {/* Animated Background */}
            <div style={styles.bgGrid} />
            <div style={styles.bgGlow1} />
            <div style={styles.bgGlow2} />

            <div style={{
                ...styles.container,
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>
                {/* Left Panel — Branding */}
                <div style={styles.leftPanel}>
                    <div style={styles.leftContent}>
                        {/* Logo */}
                        <div style={styles.logoWrapper}>
                            <div style={styles.logoIcon}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                        </div>

                        <h1 style={styles.brandTitle}>ERP TOTO</h1>
                        <p style={styles.brandSub}>Sistem Informasi Manufaktur</p>
                        <div style={styles.divider} />
                        <p style={styles.companyName}>CV Toto Aluminium Manufacture</p>

                        {/* Feature Tags */}
                        <div style={styles.tagContainer}>
                            {[
                                { icon: "📦", text: "Pesanan" },
                                { icon: "🏭", text: "Produksi" },
                                { icon: "💰", text: "Keuangan" },
                                { icon: "📊", text: "Inventaris" },
                                { icon: "👥", text: "SDM" },
                            ].map(f => (
                                <span key={f.text} style={styles.tag}>{f.icon} {f.text}</span>
                            ))}
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div style={styles.decoCircle1} />
                    <div style={styles.decoCircle2} />
                    <div style={styles.decoCircle3} />
                </div>

                {/* Right Panel — Login Form */}
                <div style={styles.rightPanel}>
                    {/* Mobile Logo */}
                    <div style={styles.mobileLogo}>
                        <div style={styles.mobileLogoIcon}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <span style={styles.mobileLogoText}>ERP TOTO</span>
                    </div>

                    <h2 style={styles.formTitle}>Selamat Datang 👋</h2>
                    <p style={styles.formSubtitle}>Masuk ke dashboard untuk mengelola bisnis Anda</p>

                    <form onSubmit={handleSubmit}>
                        {/* Username */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Username</label>
                            <div style={styles.inputWrapper}>
                                <span style={styles.inputIcon}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Masukkan username"
                                    autoComplete="username"
                                    required
                                    style={styles.input}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Password</label>
                            <div style={styles.inputWrapper}>
                                <span style={styles.inputIcon}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" />
                                    </svg>
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    autoComplete="current-password"
                                    required
                                    style={styles.input}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={styles.eyeBtn}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={styles.errorBox}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={loading} style={{
                            ...styles.submitBtn,
                            opacity: loading ? 0.7 : 1,
                            transform: loading ? "scale(0.98)" : "scale(1)",
                        }}>
                            {loading ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                    <span style={styles.spinner} />
                                    Memproses...
                                </span>
                            ) : "Masuk"}
                        </button>
                    </form>

                    {/* Demo hint */}
                    <div style={styles.demoBox}>
                        <div style={styles.demoTitle}>💡 Akun Demo</div>
                        <div style={styles.demoGrid}>
                            {["owner", "finance", "sales", "produksi", "barang"].map(u => (
                                <button
                                    key={u}
                                    type="button"
                                    onClick={() => { setUsername(u); setPassword("toto2025"); setError(""); }}
                                    style={styles.demoChip}
                                >
                                    {u}
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
                            Klik salah satu → password otomatis terisi
                        </div>
                    </div>

                    <p style={{ textAlign: "center", fontSize: 12, color: "#CBD5E1", marginTop: 20 }}>
                        © {new Date().getFullYear()} CV Toto Aluminium Manufacture
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    .login-left-panel { display: none !important; }
                }
            `}</style>
        </div>
    );
}

/* ──────── STYLES ──────── */
const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A",
        padding: 20,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflow: "hidden",
    },
    bgGrid: {
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
    },
    bgGlow1: {
        position: "absolute",
        top: "-20%",
        right: "-10%",
        width: 500,
        height: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(163, 121, 76, 0.15) 0%, transparent 70%)",
        animation: "pulse-glow 6s ease-in-out infinite",
    },
    bgGlow2: {
        position: "absolute",
        bottom: "-15%",
        left: "-10%",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
        animation: "pulse-glow 8s ease-in-out infinite 3s",
    },
    container: {
        display: "flex",
        width: "100%",
        maxWidth: 960,
        minHeight: 580,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        position: "relative",
        zIndex: 1,
    },
    /* LEFT PANEL */
    leftPanel: {
        width: "45%",
        background: "linear-gradient(160deg, #7C5A3C 0%, #A67B5B 40%, #C9A882 100%)",
        padding: "48px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
    },
    leftContent: {
        position: "relative",
        zIndex: 2,
        textAlign: "center",
    },
    logoWrapper: {
        marginBottom: 24,
    },
    logoIcon: {
        width: 72,
        height: 72,
        borderRadius: 20,
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(12px)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(255,255,255,0.2)",
    },
    brandTitle: {
        fontSize: 42,
        fontWeight: 800,
        color: "white",
        margin: "0 0 6px",
        letterSpacing: "-1px",
    },
    brandSub: {
        fontSize: 16,
        color: "rgba(255,255,255,0.8)",
        fontWeight: 300,
        margin: 0,
    },
    divider: {
        width: 48,
        height: 3,
        borderRadius: 2,
        background: "rgba(255,255,255,0.3)",
        margin: "20px auto",
    },
    companyName: {
        fontSize: 14,
        color: "rgba(255,255,255,0.9)",
        fontWeight: 600,
        margin: 0,
        letterSpacing: "0.5px",
    },
    tagContainer: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        marginTop: 28,
    },
    tag: {
        padding: "6px 14px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(8px)",
        color: "white",
        fontSize: 12,
        fontWeight: 500,
        border: "1px solid rgba(255,255,255,0.1)",
    },
    decoCircle1: {
        position: "absolute",
        bottom: -60,
        left: -60,
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.05)",
    },
    decoCircle2: {
        position: "absolute",
        top: -40,
        right: -40,
        width: 150,
        height: 150,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
    },
    decoCircle3: {
        position: "absolute",
        top: "50%",
        right: -20,
        width: 80,
        height: 80,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
    },
    /* RIGHT PANEL */
    rightPanel: {
        flex: 1,
        background: "white",
        padding: "44px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
    mobileLogo: {
        display: "none",
        alignItems: "center",
        gap: 10,
        marginBottom: 24,
        justifyContent: "center",
    },
    mobileLogoIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        background: "linear-gradient(135deg, #7C5A3C, #A67B5B)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    mobileLogoText: {
        fontSize: 20,
        fontWeight: 800,
        color: "#5C4033",
    },
    formTitle: {
        fontSize: 26,
        fontWeight: 700,
        color: "#1E293B",
        margin: "0 0 6px",
    },
    formSubtitle: {
        fontSize: 14,
        color: "#94A3B8",
        margin: "0 0 28px",
    },
    fieldGroup: {
        marginBottom: 18,
    },
    label: {
        display: "block",
        fontSize: 13,
        fontWeight: 600,
        color: "#475569",
        marginBottom: 6,
    },
    inputWrapper: {
        position: "relative",
        display: "flex",
        alignItems: "center",
    },
    inputIcon: {
        position: "absolute",
        left: 14,
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
    },
    input: {
        width: "100%",
        padding: "12px 14px 12px 44px",
        borderRadius: 12,
        border: "1.5px solid #E2E8F0",
        fontSize: 14,
        color: "#1E293B",
        background: "#F8FAFC",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.2s, box-shadow 0.2s",
    },
    eyeBtn: {
        position: "absolute",
        right: 12,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 4,
        display: "flex",
        alignItems: "center",
    },
    errorBox: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        color: "#DC2626",
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 16,
    },
    submitBtn: {
        width: "100%",
        padding: "13px 0",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg, #7C5A3C 0%, #A67B5B 100%)",
        color: "white",
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s",
        marginTop: 4,
        boxShadow: "0 4px 12px rgba(124, 90, 60, 0.3)",
    },
    spinner: {
        display: "inline-block",
        width: 16,
        height: 16,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
    },
    demoBox: {
        marginTop: 24,
        padding: "14px 16px",
        borderRadius: 14,
        background: "#F8FAFC",
        border: "1.5px solid #E2E8F0",
    },
    demoTitle: {
        fontSize: 13,
        fontWeight: 600,
        color: "#64748B",
        marginBottom: 10,
    },
    demoGrid: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
    },
    demoChip: {
        padding: "5px 14px",
        borderRadius: 20,
        border: "1.5px solid #E2E8F0",
        background: "white",
        color: "#64748B",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
    },
};
