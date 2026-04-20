"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import CockpitHeader from "../../../components/cockpit/CockpitHeader";
import BalanceCard from "../../../components/cockpit/BalanceCard";
import AgingCard from "../../../components/cockpit/AgingCard";
import ProfitTargetCard from "../../../components/cockpit/ProfitTargetCard";
import CashForecastCard from "../../../components/cockpit/CashForecastCard";
import TopDebtorsCard from "../../../components/cockpit/TopDebtorsCard";
import StuckOrdersCard from "../../../components/cockpit/StuckOrdersCard";

export default function CockpitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  // Auth protection
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== 'owner' && user.username !== 'faisal') {
        router.replace("/dashboard");
      } else {
        setAuthorized(true);
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || !authorized) {
    return (
      <div className="min-h-screen bg-[#F5EBDD] flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A67B5B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#F5EBDD] text-[#3E2C23] font-sans">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      
      <div className="p-4 md:p-8 xl:p-10 max-w-[1600px] mx-auto">
        
        {/* HEADER SECTION */}
        <CockpitHeader />

        {/* GRID WRAPPER */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          
          <BalanceCard />
          <AgingCard />
          <ProfitTargetCard />
          
          <CashForecastCard />
          <TopDebtorsCard />
          
          <StuckOrdersCard />

        </div>

        {/* FOOTER ACCENT */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8B6B52] opacity-30">
            Internal Management Cockpit · CV TOTO ALUMINIUM
          </p>
        </div>
      </div>
    </div>
  );
}
