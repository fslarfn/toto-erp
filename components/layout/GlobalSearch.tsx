"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isRowFilled, usePesanan } from "@/lib/pesanan-store";
import styles from "./GlobalSearch.module.css";

export type GlobalSearchMenuItem = {
    href: string;
    label: string;
    section: string;
};

type Props = {
    menuItems: GlobalSearchMenuItem[];
    workspace: "toto" | "alucurv" | "gabungan";
};

type SearchResult = {
    key: string;
    type: "menu" | "order";
    title: string;
    subtitle: string;
    meta?: string;
    href: string;
    score: number;
};

const MENU_KEYWORDS: Record<string, string> = {
    "/dashboard": "ringkasan beranda omzet laba saldo",
    "/dashboard/pesanan": "order input pesanan penjualan",
    "/dashboard/status-barang": "status order produksi warna siap kirim bayar",
    "/dashboard/kalender": "kalender agenda jadwal libur nasional cuti bersama thr payroll family gathering maintenance rapat operasional",
    "/dashboard/crm": "customer pelanggan whatsapp piutang",
    "/dashboard/penawaran": "quotation harga penawaran",
    "/dashboard/keuangan": "kas bank uang masuk keluar transaksi mutasi rekonsiliasi",
    "/dashboard/invoice": "faktur nota penjualan",
    "/dashboard/tagihan": "piutang lunas pembayaran invoice",
    "/dashboard/tagihan-bahan": "supplier pembelian bahan baku",
    "/dashboard/hpp": "harga pokok produksi modal margin",
    "/dashboard/laporan": "laba rugi neraca arus kas akuntansi",
    "/dashboard/pajak": "akuntansi jurnal coretax pajak",
    "/dashboard/stok-bahan": "persediaan aluminium bahan gudang",
    "/dashboard/produksi": "finishing gudang kirim alur",
    "/dashboard/surat-jalan": "sj pengiriman",
    "/dashboard/karyawan": "pegawai payroll gaji",
    "/dashboard/absensi": "kehadiran karyawan",
    "/dashboard/alucurv": "ringkasan beranda alucurv",
    "/dashboard/alucurv/order": "pesanan customer alucurv",
    "/dashboard/alucurv/hpp": "harga pokok produk komponen margin",
    "/dashboard/alucurv/stok": "persediaan barang gudang",
    "/dashboard/alucurv/pengadaan": "supplier pembelian bahan baku",
};

function normalize(value: string): string {
    return value
        .toLocaleLowerCase("id-ID")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function orderHref(date: string, invoice: string, customer: string): string {
    const isoDate = /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : "";
    const year = isoDate ? isoDate.slice(0, 4) : String(new Date().getFullYear());
    const month = isoDate ? String(Number(isoDate.slice(5, 7))) : String(new Date().getMonth() + 1);
    const search = invoice.trim() || customer.trim();
    return `/dashboard/status-barang?year=${year}&month=${month}&search=${encodeURIComponent(search)}`;
}

function SearchIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.4-3.4" />
        </svg>
    );
}

export default function GlobalSearch({ menuItems, workspace }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const { rows } = usePesanan();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((value) => !value);
            } else if (event.key === "Escape") {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open]);

    const results = useMemo<SearchResult[]>(() => {
        const q = normalize(query);
        const menuResults = menuItems
            .reduce<SearchResult[]>((matches, item) => {
                const label = normalize(item.label);
                const haystack = `${label} ${normalize(item.section)} ${MENU_KEYWORDS[item.href] || ""}`;
                if (q && !haystack.includes(q)) return matches;
                const score = !q ? 20 : label === q ? 0 : label.startsWith(q) ? 2 : haystack.includes(` ${q}`) ? 5 : 8;
                matches.push({
                    key: `menu:${item.href}`,
                    type: "menu",
                    title: item.label,
                    subtitle: item.section,
                    href: item.href,
                    score,
                });
                return matches;
            }, [])
            .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "id"))
            .slice(0, q ? 6 : 7);

        if (workspace !== "toto" || q.length < 2) return menuResults;

        const grouped = new Map<string, SearchResult>();
        for (const row of rows) {
            if (!isRowFilled(row)) continue;
            const invoice = (row.no_inv || "").trim();
            const customer = (row.customer || "").trim();
            const description = (row.deskripsi || "").trim();
            const invoiceNormalized = normalize(invoice);
            const customerNormalized = normalize(customer);
            const descriptionNormalized = normalize(description);
            const haystack = `${invoiceNormalized} ${customerNormalized} ${descriptionNormalized}`;
            if (!haystack.includes(q)) continue;

            const key = invoice ? `order:${invoiceNormalized}` : `row:${row.id}`;
            const score = invoiceNormalized === q
                ? 0
                : invoiceNormalized.startsWith(q)
                    ? 1
                    : customerNormalized === q
                        ? 2
                        : customerNormalized.startsWith(q)
                            ? 3
                            : 7;
            const existing = grouped.get(key);
            if (!existing || score < existing.score) {
                grouped.set(key, {
                    key,
                    type: "order",
                    title: customer || "Tanpa nama customer",
                    subtitle: description || "Pesanan tanpa deskripsi",
                    meta: `${invoice ? `INV ${invoice}` : `Baris ${row.id}`}${row.tanggal ? ` · ${row.tanggal}` : ""}`,
                    href: orderHref(row.tanggal || "", invoice, customer),
                    score,
                });
            }
        }

        return [
            ...menuResults,
            ...Array.from(grouped.values())
                .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "id"))
                .slice(0, 8),
        ];
    }, [menuItems, query, rows, workspace]);

    const close = () => {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
    };

    const openResult = (result: SearchResult) => {
        close();
        if (result.type === "order" && pathname === "/dashboard/status-barang") {
            window.location.assign(result.href);
            return;
        }
        router.push(result.href);
    };

    const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter" && results[Math.min(activeIndex, results.length - 1)]) {
            event.preventDefault();
            openResult(results[Math.min(activeIndex, results.length - 1)]);
        }
    };

    return (
        <>
            <button type="button" className={styles.trigger} onClick={() => setOpen(true)} title="Cari apa pun (Ctrl+K)" aria-label="Buka pencarian global">
                <SearchIcon size={18} />
                <span className={styles.triggerLabel}>Cari apa pun</span>
                <kbd className={styles.shortcut}>Ctrl K</kbd>
            </button>

            {open && (
                <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
                    <section className={styles.palette} role="dialog" aria-modal="true" aria-label="Pencarian global">
                        <div className={styles.searchBox}>
                            <SearchIcon size={21} />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                                onKeyDown={onInputKeyDown}
                                placeholder={workspace === "toto" ? "Cari menu, customer, invoice, atau barang…" : "Cari menu atau fitur…"}
                                aria-label="Kata kunci pencarian"
                                autoComplete="off"
                            />
                            <button type="button" onClick={close} className={styles.closeButton} aria-label="Tutup pencarian">Esc</button>
                        </div>

                        <div className={styles.resultArea} role="listbox" aria-label="Hasil pencarian">
                            {results.length === 0 ? (
                                <div className={styles.empty}>
                                    <SearchIcon size={24} />
                                    <strong>Tidak ada hasil</strong>
                                    <span>Coba nama customer, nomor invoice, barang, atau nama menu.</span>
                                </div>
                            ) : (
                                <>
                                    {!query.trim() && <div className={styles.groupLabel}>Akses cepat</div>}
                                    {query.trim() && results.some((result) => result.type === "menu") && <div className={styles.groupLabel}>Menu & fitur</div>}
                                    {results.map((result, index) => {
                                        const showOrderLabel = query.trim() && result.type === "order" && (index === 0 || results[index - 1]?.type !== "order");
                                        return (
                                            <div key={result.key}>
                                                {showOrderLabel && <div className={styles.groupLabel}>Pesanan & invoice</div>}
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={index === Math.min(activeIndex, results.length - 1)}
                                                    className={`${styles.result} ${index === Math.min(activeIndex, results.length - 1) ? styles.active : ""}`}
                                                    onMouseEnter={() => setActiveIndex(index)}
                                                    onClick={() => openResult(result)}
                                                >
                                                    <span className={`${styles.resultIcon} ${result.type === "order" ? styles.orderIcon : ""}`}>
                                                        {result.type === "menu" ? "↗" : "#"}
                                                    </span>
                                                    <span className={styles.resultCopy}>
                                                        <strong>{result.title}</strong>
                                                        <span>{result.subtitle}</span>
                                                    </span>
                                                    {result.meta && <span className={styles.meta}>{result.meta}</span>}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        <footer className={styles.footer}>
                            <span><kbd>↑</kbd><kbd>↓</kbd> pilih</span>
                            <span><kbd>Enter</kbd> buka</span>
                            <span>Data dicari dari ERP yang sudah dimuat</span>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
}
