import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Alucurv ERP",
  description: "ERP mini Alucurv: keuangan, order, HPP, stok, bending, dan payroll.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* Font Archivo dimuat via CDN (opsional). Bila offline, otomatis fallback ke font sistem. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <StoreProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
