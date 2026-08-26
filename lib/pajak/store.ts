import { supabase } from "@/lib/supabase-client";
import type { PtkpStatus } from "./pph21";
import { monthEndDate } from "./reconciliation";
import type { SalesHppRecognitionRow } from "@/lib/hpp/store";

export type TaxEntityRow = {
  id?: string; workspace: string; legal_name: string; npwp: string; nitku: string;
  legal_form: string; business_type: string; address: string; pkp_status: boolean;
  tax_regime: string;
};

export type EmployeeTaxProfileRow = {
  id?: string; karyawan_id: number; nik: string; npwp: string; ptkp_status: PtkpStatus;
  tax_method: "gross" | "gross_up" | "net"; effective_from: string; is_active: boolean;
};

export type PayrollTaxPeriodRow = {
  id?: string; karyawan_id: number; tax_year: number; tax_month: number; ptkp_status: PtkpStatus;
  ter_category: string; gross_income: number; employee_bpjs: number; ter_rate: number;
  tax_withheld: number; annual_tax: number | null; prior_withholding: number;
  status: "draft" | "locked"; calculation_snapshot: Record<string, unknown>;
  locked_at?: string | null; locked_by?: string | null;
};

export type TaxTransactionRow = {
  id?: string; workspace: string; source_type: "cash_flow" | "invoice" | "manual"; source_id?: string | null;
  transaction_date: string; tax_period: string; flow_type: "income" | "expense"; category: string;
  description: string; counterparty_name: string; document_number: string;
  tax_code: "non_tax" | "ppn" | "pph21" | "pph23" | "pph_final" | "other";
  tax_direction: "none" | "output" | "input" | "withheld_by_us" | "withheld_from_us" | "borne_by_company";
  gross_amount: number; dpp_amount: number; tax_rate: number; tax_amount: number;
  status: "reviewed" | "locked"; notes: string; reviewed_by: string; reviewed_at?: string;
  locked_by?: string | null; locked_at?: string | null;
};

export type AccountingAccountRow = { id:string; workspace:string; code:string; name:string; account_type:"asset"|"liability"|"equity"|"revenue"|"expense"; is_active:boolean };
export type AccountingMappingRow = { id:string; workspace:string; flow_type:"income"|"expense"; source_category:string; account_id:string };
export type JournalLineInput = { account_id:string; description:string; debit:number; credit:number; line_no:number };
export type JournalEntryRow = {
  id:string; workspace:string; entry_date:string; reference:string; description:string;
  source_type:"manual"|"cash_flow"|"payroll"|"tax"|"hpp"; source_id?:string|null;
  status:"draft"|"locked"; created_by:string; locked_by?:string|null; locked_at?:string|null;
  journal_lines?: Array<JournalLineInput & {id:string; accounting_accounts?:{code:string;name:string}|null}>;
};
export type FiscalAdjustmentRow={id?:string;workspace:string;tax_year:number;direction:"positive"|"negative";category:string;description:string;amount:number;legal_basis:string;is_temporary:boolean;created_by:string};
export type CorporateTaxReturnRow={id?:string;workspace:string;tax_year:number;turnover:number;commercial_profit:number;positive_corrections:number;negative_corrections:number;taxable_income:number;facility_taxable_income:number;standard_taxable_income:number;tax_due:number;credit_pph22:number;credit_pph23:number;credit_pph25:number;credit_other:number;tax_balance:number;status:"draft"|"locked";calculation_snapshot:Record<string,unknown>;created_by:string;locked_by?:string|null;locked_at?:string|null};
export type TaxComplianceRow={id?:string;workspace:string;tax_period:string;tax_code:"pph21"|"pph23"|"ppn"|"pph_badan";amount:number;payment_due_date:string|null;filing_due_date:string|null;payment_status:"pending"|"paid"|"not_applicable";filing_status:"pending"|"filed"|"not_applicable";payment_reference:string;filing_reference:string;notes:string;paid_at?:string|null;filed_at?:string|null;updated_by:string};
export type TaxClosingChecklistRow={id?:string;workspace:string;tax_period:string;task_key:string;completed:boolean;completed_by:string;completed_at:string|null;notes:string;updated_at?:string};

export function isMissingTaxSchema(error: unknown) {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "42P01" || e?.code === "PGRST205" || e?.message?.includes("schema cache") === true;
}

export async function loadTaxWorkspace(year: number) {
  const [entityResult, profileResult, periodResult] = await Promise.all([
    supabase.from("tax_entities").select("*").eq("workspace", "toto").maybeSingle(),
    supabase.from("employee_tax_profiles").select("*").eq("is_active", true).order("effective_from", { ascending: false }),
    supabase.from("payroll_tax_periods").select("*").eq("tax_year", year),
  ]);
  const error = entityResult.error || profileResult.error || periodResult.error;
  if (error) throw error;
  const latestProfiles = new Map<number, EmployeeTaxProfileRow>();
  for (const row of (profileResult.data ?? []) as EmployeeTaxProfileRow[]) {
    if (!latestProfiles.has(row.karyawan_id)) latestProfiles.set(row.karyawan_id, row);
  }
  return {
    entity: entityResult.data as TaxEntityRow | null,
    profiles: Array.from(latestProfiles.values()),
    periods: (periodResult.data ?? []) as PayrollTaxPeriodRow[],
  };
}

export async function saveTaxEntity(row: TaxEntityRow) {
  const { data, error } = await supabase.from("tax_entities").upsert(row, { onConflict: "workspace" }).select().single();
  if (error) throw error;
  return data as TaxEntityRow;
}

export async function saveEmployeeTaxProfiles(rows: EmployeeTaxProfileRow[]) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from("employee_tax_profiles")
    .upsert(rows, { onConflict: "karyawan_id,effective_from" }).select();
  if (error) throw error;
  return data as EmployeeTaxProfileRow[];
}

export async function savePayrollTaxPeriods(rows: PayrollTaxPeriodRow[]) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from("payroll_tax_periods")
    .upsert(rows, { onConflict: "karyawan_id,tax_year,tax_month" }).select();
  if (error) throw error;
  return data as PayrollTaxPeriodRow[];
}

export async function loadTaxTransactions(period: string) {
  const { data, error } = await supabase.from("tax_transactions").select("*")
    .eq("workspace", "toto").eq("tax_period", period).order("transaction_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaxTransactionRow[];
}

export async function saveTaxTransaction(row: TaxTransactionRow) {
  const query = row.id
    ? supabase.from("tax_transactions").update(row).eq("id", row.id)
    : supabase.from("tax_transactions").upsert(row, { onConflict: "workspace,source_type,source_id" });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as TaxTransactionRow;
}

export async function loadAccountingWorkspace(startDate:string,endDate:string){
  const [accountResult,journalResult,mappingResult]=await Promise.all([
    supabase.from("accounting_accounts").select("*").eq("workspace","toto").eq("is_active",true).order("code"),
    supabase.from("journal_entries").select("*,journal_lines(*,accounting_accounts(code,name))").eq("workspace","toto")
      .gte("entry_date",startDate).lte("entry_date",endDate).order("entry_date",{ascending:false}),
    supabase.from("accounting_mappings").select("*").eq("workspace","toto"),
  ]);
  const error=accountResult.error||journalResult.error||mappingResult.error;if(error)throw error;
  return {accounts:(accountResult.data??[]) as AccountingAccountRow[],journals:(journalResult.data??[]) as unknown as JournalEntryRow[],mappings:(mappingResult.data??[]) as AccountingMappingRow[]};
}

export async function createJournalEntry(input:{entry_date:string;reference:string;description:string;created_by:string;lines:JournalLineInput[];lock:boolean;source_type?:"manual"|"cash_flow"|"payroll"|"tax";source_id?:string|null}){
  const {data:entry,error:entryError}=await supabase.from("journal_entries").insert({workspace:"toto",entry_date:input.entry_date,reference:input.reference,description:input.description,source_type:input.source_type??"manual",source_id:input.source_id??null,status:"draft",created_by:input.created_by}).select().single();
  if(entryError)throw entryError;
  const entryId=(entry as {id:string}).id;
  const {error:lineError}=await supabase.from("journal_lines").insert(input.lines.map(line=>({...line,journal_entry_id:entryId})));
  if(lineError){await supabase.from("journal_entries").delete().eq("id",entryId);throw lineError;}
  if(input.lock){
    const {error:lockError}=await supabase.from("journal_entries").update({status:"locked",locked_by:input.created_by,locked_at:new Date().toISOString()}).eq("id",entryId);
    if(lockError)throw lockError;
  }
  return entryId;
}

export async function lockJournalEntry(id:string,username:string){
  const {error}=await supabase.from("journal_entries").update({status:"locked",locked_by:username,locked_at:new Date().toISOString()}).eq("id",id);
  if(error)throw error;
}

export async function isCashFlowJournalLocked(sourceId:string){
  const {data,error}=await supabase.from("journal_entries").select("id,status").eq("workspace","toto")
    .eq("source_type","cash_flow").eq("source_id",sourceId).maybeSingle();
  if(error){if(isMissingTaxSchema(error))return false;throw error;}
  return (data as {status?:string}|null)?.status==="locked";
}

export async function loadFiscalWorkspace(year:number){
 const [accounting,adjustments,returns]=await Promise.all([
  loadAccountingWorkspace(`${year}-01-01`,`${year}-12-31`),
  supabase.from("fiscal_adjustments").select("*").eq("workspace","toto").eq("tax_year",year).order("created_at",{ascending:false}),
  supabase.from("corporate_tax_returns").select("*").eq("workspace","toto").eq("tax_year",year).maybeSingle(),
 ]);
 const error=adjustments.error||returns.error;if(error)throw error;
 return{...accounting,adjustments:(adjustments.data??[]) as FiscalAdjustmentRow[],taxReturn:returns.data as CorporateTaxReturnRow|null};
}

export async function addFiscalAdjustment(row:FiscalAdjustmentRow){const{data,error}=await supabase.from("fiscal_adjustments").insert(row).select().single();if(error)throw error;return data as FiscalAdjustmentRow}
export async function removeFiscalAdjustment(id:string){const{error}=await supabase.from("fiscal_adjustments").delete().eq("id",id);if(error)throw error}
export async function saveCorporateTaxReturn(row:CorporateTaxReturnRow){const{data,error}=await supabase.from("corporate_tax_returns").upsert(row,{onConflict:"workspace,tax_year"}).select().single();if(error)throw error;return data as CorporateTaxReturnRow}

export async function loadTaxMonitoring(year:number,month:number){
 const period=`${year}-${String(month).padStart(2,"0")}`,end=monthEndDate(year,month);
 const [accounting,transactions,payroll,compliance,returns]=await Promise.all([
  loadAccountingWorkspace(`${period}-01`,end),
  supabase.from("tax_transactions").select("*").eq("workspace","toto").eq("tax_period",period),
  supabase.from("payroll_tax_periods").select("*").eq("tax_year",year).eq("tax_month",month),
  supabase.from("tax_compliance_items").select("*").eq("workspace","toto").eq("tax_period",period),
  supabase.from("corporate_tax_returns").select("*").eq("workspace","toto").eq("tax_year",year).maybeSingle(),
 ]);
 const error=transactions.error||payroll.error||compliance.error||returns.error;if(error)throw error;
 return{...accounting,transactions:(transactions.data??[]) as TaxTransactionRow[],payroll:(payroll.data??[]) as PayrollTaxPeriodRow[],compliance:(compliance.data??[]) as TaxComplianceRow[],taxReturn:returns.data as CorporateTaxReturnRow|null};
}

export async function saveTaxCompliance(row:TaxComplianceRow){const{data,error}=await supabase.from("tax_compliance_items").upsert(row,{onConflict:"workspace,tax_period,tax_code"}).select().single();if(error)throw error;return data as TaxComplianceRow}

export async function loadTaxClosingChecklist(period:string){const{data,error}=await supabase.from("tax_monthly_closing_checklists").select("*").eq("workspace","toto").eq("tax_period",period);if(error)throw error;return(data??[])as TaxClosingChecklistRow[]}
export async function saveTaxClosingChecklist(row:TaxClosingChecklistRow){const{data,error}=await supabase.from("tax_monthly_closing_checklists").upsert(row,{onConflict:"workspace,tax_period,task_key"}).select().single();if(error)throw error;return data as TaxClosingChecklistRow}

export async function loadTaxYearReports(year:number){
 const [fiscal,payroll,transactions,compliance,salesHpp]=await Promise.all([
  loadFiscalWorkspace(year),
  supabase.from("payroll_tax_periods").select("*").eq("tax_year",year).order("tax_month"),
  supabase.from("tax_transactions").select("*").eq("workspace","toto").gte("tax_period",`${year}-01`).lte("tax_period",`${year}-12`).order("transaction_date"),
  supabase.from("tax_compliance_items").select("*").eq("workspace","toto").gte("tax_period",`${year}-01`).lte("tax_period",`${year}-12`).order("tax_period"),
  supabase.from("sales_hpp_recognitions").select("*").eq("workspace","toto").eq("status","posted").gte("recognition_date",`${year}-01-01`).lte("recognition_date",`${year}-12-31`).order("recognition_date"),
 ]);
 const error=payroll.error||transactions.error||compliance.error||salesHpp.error;if(error)throw error;
 return{...fiscal,payroll:(payroll.data??[]) as PayrollTaxPeriodRow[],transactions:(transactions.data??[]) as TaxTransactionRow[],compliance:(compliance.data??[]) as TaxComplianceRow[],salesHpp:(salesHpp.data??[]) as SalesHppRecognitionRow[]};
}
