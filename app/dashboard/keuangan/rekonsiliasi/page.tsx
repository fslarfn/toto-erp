import { Suspense } from "react";
import PaymentReconciliation from "@/components/payments/PaymentReconciliation";

export default function PaymentReconciliationPage() {
  return <Suspense fallback={<div className="page-content">Memuat rekonsiliasi pembayaran...</div>}><PaymentReconciliation /></Suspense>;
}
