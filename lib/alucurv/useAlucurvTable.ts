"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";

export function useAlucurvTable<T extends { id: string }>(table: string, orderBy?: string) {
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        let query = supabase.from(table).select("*");
        if (orderBy) query = query.order(orderBy, { ascending: false });
        const { data, error: err } = await query;
        if (err) setError(err.message);
        else {
            setError(null);
            setRows((data ?? []) as T[]);
        }
        setLoading(false);
    }, [table, orderBy]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const insertRow = async (row: Record<string, unknown>) => {
        const payload = { id: crypto.randomUUID(), ...row };
        const { error: err } = await supabase.from(table).insert(payload);
        if (!err) await refresh();
        return err;
    };

    const insertRows = async (newRows: Record<string, unknown>[]) => {
        const payload = newRows.map((r) => ({ id: r.id || crypto.randomUUID(), ...r }));
        const { error: err } = await supabase.from(table).insert(payload);
        if (!err) await refresh();
        return err;
    };

    const updateRow = async (id: string, patch: Record<string, unknown>) => {
        const { error: err } = await supabase.from(table).update(patch).eq("id", id);
        if (!err) await refresh();
        return err;
    };

    const deleteRow = async (id: string) => {
        const { error: err } = await supabase.from(table).delete().eq("id", id);
        if (!err) await refresh();
        return err;
    };

    return { rows, loading, error, refresh, insertRow, insertRows, updateRow, deleteRow };
}
