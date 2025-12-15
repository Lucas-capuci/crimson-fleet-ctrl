import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FleetChart } from "@/components/dashboard/FleetChart";
import { VehicleStatusChart } from "@/components/dashboard/VehicleStatusChart";
import { DeparturesOverview } from "@/components/dashboard/DeparturesOverview";
import { Car, Wrench, Users, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

  const { data: departureStats } = useQuery({
    queryKey: ["dashboard_departures_count"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("departures")
        .select("departed")
        .eq("date", today);
      if (error) throw error;
      
      const departed = data.filter(d => d.departed).length;
      return { total: data.length, departed };
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
          title="Saídas Hoje"
          value={`${departureStats?.departed ?? 0}/${departureStats?.total ?? 0}`}
          icon={LogIn}
          variant="success"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <FleetChart />
        <VehicleStatusChart />
      </div>

      {/* Departures Overview */}
      <DeparturesOverview />
    </MainLayout>
  );
};

export default Dashboard;
