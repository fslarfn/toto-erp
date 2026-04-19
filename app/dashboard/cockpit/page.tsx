"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import CockpitHeader from "../../../components/cockpit/CockpitHeader";
import BalanceCard from "../../../components/cockpit/BalanceCard";
import AgingCard from "../../../components/cockpit/AgingCard";
import CashForecastCard from "../../../components/cockpit/CashForecastCard";
import TopDebtorsCard from "../../../components/cockpit/TopDebtorsCard";
import StuckOrdersCard from "../../../components/cockpit/StuckOrdersCard";
import ProfitTargetCard from "../../../components/cockpit/ProfitTargetCard";
import LoadingCockpit from "./loading";

/**
 * Executive Cockpit Page
 * Restricted to: owner | manager
 */
export default function CockpitPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== 'owner' && user.username !== 'faisal') {
        // Redirect to dashboard if not owner/manager
        router.replace("/dashboard");
      } else {
        setAuthorized(true);
      }
    }
  }, [user, loading, router]);

  if (loading || !authorized) {
    return <LoadingCockpit />;
  }

  return (
    <div className="page-content min-h-screen bg-[#FDF8F6] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <CockpitHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Row 1: Key Metrics */}
          <BalanceCard />
          <AgingCard />
          <ProfitTargetCard />

          {/* Row 2: Trends & Details */}
          <div className="lg:col-span-2">
            <CashForecastCard />
          </div>
          <TopDebtorsCard />

          {/* Row 3: Operational */}
          <div className="lg:col-span-1">
             <StuckOrdersCard />
          </div>
        </div>
      </div>
    </div>
  );
}
