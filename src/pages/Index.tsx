import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FleetChart } from "@/components/dashboard/FleetChart";
import { VehicleStatusChart } from "@/components/dashboard/VehicleStatusChart";
import { RecentMaintenance } from "@/components/dashboard/RecentMaintenance";
import { Car, Wrench, Users, AlertTriangle } from "lucide-react";

const Dashboard = () => {
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
          value={25}
          icon={Car}
          variant="primary"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Em Manutenção"
          value={4}
          icon={Wrench}
          variant="warning"
        />
        <StatsCard
          title="Motoristas Ativos"
          value={18}
          icon={Users}
          variant="success"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Alertas Pendentes"
          value={3}
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
