import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FleetChart } from "@/components/dashboard/FleetChart";
import { VehicleStatusChart } from "@/components/dashboard/VehicleStatusChart";
import { RecentMaintenance } from "@/components/dashboard/RecentMaintenance";
import { Car, Wrench, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { data: vehicleStats } = useQuery({
    queryKey: ["dashboard_vehicle_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("status");
      if (error) throw error;
      
      const total = data.length;
      const inMaintenance = data.filter(v => v.status === "manutencao" || v.status === "oficina").length;
      return { total, inMaintenance };
    },
  });

  const { data: driverCount } = useQuery({
    queryKey: ["dashboard_driver_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("drivers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: pendingAlerts } = useQuery({
    queryKey: ["dashboard_pending_alerts"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("maintenance_records")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente");
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do controle de frotas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total de Veículos"
          value={vehicleStats?.total ?? 0}
          icon={Car}
          variant="primary"
        />
        <StatsCard
          title="Em Manutenção/Oficina"
          value={vehicleStats?.inMaintenance ?? 0}
          icon={Wrench}
          variant="warning"
        />
        <StatsCard
          title="Motoristas Ativos"
          value={driverCount ?? 0}
          icon={Users}
          variant="success"
        />
        <StatsCard
          title="Manutenções Pendentes"
          value={pendingAlerts ?? 0}
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FleetChart />
        <VehicleStatusChart />
      </div>

      {/* Recent Maintenance */}
      <RecentMaintenance />
    </MainLayout>
  );
};

export default Dashboard;
