"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";

export type NotifRecord = {
  id: number;
  title: string;
  body: string;
  url: string;
  notification_type: string;
  created_at: string;
};

const STORAGE_KEY = "toto_notif_read";

function getReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch { return new Set(); }
}

function persistReadIds(ids: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {}
}

export function useNotificationHistory() {
  const [items, setItems] = useState<NotifRecord[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => { setReadIds(getReadIds()); }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, url, notification_type, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setItems(data as NotifRecord[]);
    } catch { /* tabel belum ada → tampilkan kosong */ }
    finally { setLoading(false); }
  }, []);

  const markRead = useCallback((id: number) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback((ids?: number[]) => {
    setReadIds(prev => {
      const next = new Set(prev);
      (ids ?? []).forEach(id => next.add(id));
      persistReadIds(next);
      return next;
    });
  }, []);

  const unreadCount = items.filter(i => !readIds.has(i.id)).length;

  return { items, readIds, loading, unreadCount, markRead, markAllRead, refetch };
}
