// ============================================================
// lib/alucurv/transaksi.ts
// Aturan bersama transaksi keuangan Alucurv — dipakai halaman
// Keuangan, Dashboard, dan Laporan agar definisinya SATU:
//   - Mutasi antar akun (transfer_group terisi) = uang pindah kas,
//     BUKAN pemasukan/pengeluaran operasional → dikecualikan dari
//     total masuk/keluar/laba (tapi tetap menggerakkan saldo akun).
// ============================================================

export interface AluTxLike {
    type: string;
    amount: number | null;
    transfer_group?: string | null;
}

/** Apakah transaksi ini mutasi antar akun (bukan omzet/biaya riil)? */
export function isAluTransfer(t: Pick<AluTxLike, "transfer_group">): boolean {
    return !!t.transfer_group;
}

/** Total Pemasukan/Pengeluaran/Laba operasional — mutasi dikecualikan. */
export function computeAluTotals(rows: AluTxLike[]): { masuk: number; keluar: number; laba: number } {
    let masuk = 0;
    let keluar = 0;
    for (const t of rows) {
        if (isAluTransfer(t)) continue;
        const n = Number(t.amount || 0);
        if (t.type === "Pemasukan") masuk += n;
        else if (t.type === "Pengeluaran") keluar += n;
    }
    return { masuk, keluar, laba: masuk - keluar };
}
