import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { KaryawanProvider } from "@/lib/karyawan-store";
import { AbsensiProvider } from "@/lib/absensi-store";
import { LicenseProvider } from "@/lib/license-store";
import { LicenseGuard } from "@/components/license-guard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "CV TOTO ALUMINIUM MANUFACTURE - Sistem Informasi Manufaktur",
    description: "Platform manajemen produksi, pesanan, dan keuangan terpadu untuk Totobaru",
    manifest: "/manifest.json?v=3",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Toto ERP",
    },
    icons: {
        apple: "/apple-touch-icon.png",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="id">
            <body className={inter.className}>
                <AuthProvider>
                    <StoreProvider>
                        <KaryawanProvider>
                            <AbsensiProvider>
                                <LicenseProvider>
                                    <LicenseGuard>
                                        {children}
                                    </LicenseGuard>
                                </LicenseProvider>
                            </AbsensiProvider>
                        </KaryawanProvider>
                    </StoreProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
