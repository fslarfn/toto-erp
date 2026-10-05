"use client";
import { useEffect } from "react";
import { startAutoRefresh } from "./auto-refresh";

export function usePaymentDataRefresh(
    fetchFilter: (year: number, month: number | "all") => Promise<void>,
    year: number,
    month: number | "all",
) {
    useEffect(() => startAutoRefresh(
        () => fetchFilter(year, month),
        window,
        document,
        () => document.visibilityState === "visible" && navigator.onLine,
    ), [fetchFilter, year, month]);
}
