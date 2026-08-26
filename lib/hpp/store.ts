import { supabase } from "@/lib/supabase-client";

export type HppProductRow = {
  id?: string;
  workspace: string;
  product_name: string;
  material_id: string | null;
  source_invoice_id: string | null;
  source_invoice_number: string;
  source_invoice_date: string | null;
  purchase_price: number;
  material_length: number;
  material_cost_per_meter: number;
  coloring_cost: number;
  labor_cost: number;
  production_cost: number;
  transport_cost: number;
  total_cost_per_meter: number;
  selling_price_per_meter: number;
  price_source: "invoice" | "manual";
  notes: string;
  updated_by: string;
  updated_at?: string;
};

export type SalesHppRecognitionRow = {
  id: string;
  pesanan_id: number;
  recognition_date: string;
  order_reference: string;
  customer_name: string;
  order_product_name: string;
  product_hpp_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  size_meter: number;
  total_meter: number;
  revenue_total: number;
  material_cost_total: number;
  total_hpp: number;
  margin_total: number;
  status: "pending_mapping" | "blocked" | "posted";
  notes: string;
  journal_entry_id: string | null;
};

export type HppMaterialRow = {
  id?: string;
  hpp_id?: string;
  material_name: string;
  material_id: string | null;
  source_invoice_id: string | null;
  quantity: number;
  unit_price: number;
  total_cost: number;
};

export type HppOrderRow = {
  id?: string;
  workspace: string;
  pesanan_id: number;
  order_date: string;
  order_reference: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  selling_price: number;
  material_cost: number;
  coloring_cost: number;
  labor_cost: number;
  production_cost: number;
  transport_cost: number;
  total_cost: number;
  notes: string;
  status: "draft" | "posted";
  journal_entry_id?: string | null;
  created_by: string;
  posted_by?: string | null;
  posted_at?: string | null;
  order_hpp_materials?: HppMaterialRow[];
};

export async function loadOrderHpp(period: string) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const { data, error } = await supabase
    .from("order_hpp")
    .select("*,order_hpp_materials(*)")
    .eq("workspace", "toto")
    .gte("order_date", `${period}-01`)
    .lte("order_date", `${period}-${String(lastDay).padStart(2, "0")}`)
    .order("order_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as HppOrderRow[];
}

export async function saveOrderHpp(row: HppOrderRow, materials: HppMaterialRow[]) {
  const { order_hpp_materials: nestedMaterials, ...header } = row;
  void nestedMaterials;
  const { data, error } = await supabase
    .from("order_hpp")
    .upsert(header, { onConflict: "workspace,pesanan_id" })
    .select()
    .single();

  if (error) throw error;
  const hpp = data as HppOrderRow;
  const { error: removeError } = await supabase.from("order_hpp_materials").delete().eq("hpp_id", hpp.id!);
  if (removeError) throw removeError;

  if (materials.length) {
    const { error: insertError } = await supabase.from("order_hpp_materials").insert(
      materials.map(({ id, hpp_id, ...material }) => {
        void id;
        void hpp_id;
        return { ...material, hpp_id: hpp.id };
      }),
    );
    if (insertError) throw insertError;
  }

  return { ...hpp, order_hpp_materials: materials };
}

export async function postOrderHpp(hppId: string, username: string) {
  const { data, error } = await supabase.rpc("post_order_hpp", {
    p_hpp_id: hppId,
    p_username: username,
  });
  if (error) throw error;
  return data as string;
}

export async function loadProductHpp() {
  const { data, error } = await supabase
    .from("product_hpp")
    .select("*")
    .eq("workspace", "toto")
    .order("product_name");
  if (error) throw error;
  return (data ?? []) as HppProductRow[];
}

export async function saveProductHpp(row: HppProductRow) {
  const { data, error } = await supabase
    .from("product_hpp")
    .upsert(row, { onConflict: "workspace,product_name" })
    .select()
    .single();
  if (error) throw error;
  return data as HppProductRow;
}

export async function loadSalesHppRecognitions() {
  const { data, error } = await supabase.from("sales_hpp_recognitions").select("*")
    .eq("workspace", "toto").order("recognition_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SalesHppRecognitionRow[];
}

export async function mapAndProcessSalesHpp(recognitionId: string, productId: string, alias: string, username: string) {
  const { data, error } = await supabase.rpc("map_and_process_sales_hpp", {
    p_recognition_id: recognitionId, p_product_id: productId, p_alias: alias, p_username: username,
  });
  if (error) throw error;
  return data as string;
}

export async function syncExistingShippedHpp(username: string) {
  const { data, error } = await supabase.rpc("sync_existing_shipped_hpp", { p_username: username });
  if (error) throw error;
  return data as { posted: number; pending: number; blocked: number };
}
