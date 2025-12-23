import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DeparturesOverview } from "@/components/dashboard/DeparturesOverview";
import { WorkshopVehiclesModal } from "@/components/dashboard/WorkshopVehiclesModal";
import { Car, Wrench, Users, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const Dashboard = () => {
  const [workshopModalOpen, setWorkshopModalOpen] = useState(false);
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
      const dayOfWeek = new Date().getDay();
      
      // Get teams scheduled to work today from team_schedules
      const { data: scheduledTeams, error: scheduleError } = await supabase
        .from("team_schedules")
        .select("team_id")
        .eq("date", today)
        .eq("is_working", true);
      
      // Get teams that should show in departures
      const { data: teamsWithDepartures, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("show_in_departures", true);
      
      if (teamsError) throw teamsError;
      
      // If there's schedule data for today, use it; otherwise count all teams with show_in_departures
      let scheduledCount = 0;
      if (scheduledTeams && scheduledTeams.length > 0) {
        // Filter scheduled teams to only those with show_in_departures
        const scheduledTeamIds = scheduledTeams.map(s => s.team_id);
        const teamsWithDeparturesIds = teamsWithDepartures?.map(t => t.id) || [];
        scheduledCount = scheduledTeamIds.filter(id => teamsWithDeparturesIds.includes(id)).length;
      } else {
        // No schedule for today, assume all teams with show_in_departures are scheduled
        scheduledCount = teamsWithDepartures?.length || 0;
      }
      
      // Get actual departures for today
      const { data: departures, error: depError } = await supabase
        .from("departures")
        .select("departed")
        .eq("date", today);
      if (depError) throw depError;
      
      const departed = departures?.filter(d => d.departed).length || 0;
      return { total: scheduledCount, departed };
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
          onClick={() => setWorkshopModalOpen(true)}
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

      {/* Departures Overview with KPIs */}
      <DeparturesOverview />

      {/* Workshop Vehicles Modal */}
      <WorkshopVehiclesModal
        open={workshopModalOpen}
        onOpenChange={setWorkshopModalOpen}
      />
    </MainLayout>
  );
};

export default Dashboard;
