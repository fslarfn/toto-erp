"use client";

// ============================================================
// LAYER DATA
// Semua halaman mengakses data lewat hook useDB() di file ini.
// Saat ini datanya disimpan di localStorage browser (mode demo,
// langsung jalan tanpa backend).
//
// UNTUK SAMBUNG KE SUPABASE:
// 1. Jalankan supabase/schema.sql di project Supabase kamu.
// 2. Buat lib/supabase.ts berisi client Supabase.
// 3. Ganti implementasi fungsi insert/update/remove di bawah
//    dengan panggilan supabase.from(...) — bentuk datanya sudah
//    1:1 dengan skema SQL yang disediakan.
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Database, CollectionKey } from "./types";
import { seed } from "./seed";

const STORAGE_KEY = "alucurv-erp-db-v1";

type Row = { id: string };

interface StoreApi {
  db: Database;
  ready: boolean;
  insert: <K extends CollectionKey>(key: K, row: Database[K][number]) => void;
  update: <K extends CollectionKey>(key: K, id: string, patch: Partial<Database[K][number]>) => void;
  remove: (key: CollectionKey, id: string) => void;
  resetToSeed: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(seed);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Database>;
        // gabungkan dengan seed agar koleksi baru tetap ada
        setDb({ ...seed, ...parsed });
      }
    } catch {
      // data korup -> pakai seed
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }, [db, ready]);

  const insert = useCallback(<K extends CollectionKey>(key: K, row: Database[K][number]) => {
    setDb((d) => ({ ...d, [key]: [row, ...(d[key] as Row[])] }));
  }, []);

  const update = useCallback(<K extends CollectionKey>(key: K, id: string, patch: Partial<Database[K][number]>) => {
    setDb((d) => ({
      ...d,
      [key]: (d[key] as Row[]).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const remove = useCallback((key: CollectionKey, id: string) => {
    setDb((d) => ({ ...d, [key]: (d[key] as Row[]).filter((r) => r.id !== id) }));
  }, []);

  const resetToSeed = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDb(seed);
  }, []);

  return (
    <StoreContext.Provider value={{ db, ready, insert, update, remove, resetToSeed }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useDB(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDB harus dipakai di dalam <StoreProvider>");
  return ctx;
}
