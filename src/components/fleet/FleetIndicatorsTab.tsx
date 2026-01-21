import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { 
  Clock, DollarSign, Building, Wrench, Car, Users, 
  TrendingUp, BarChart3, PieChart 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInHours } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface WorkshopEntry {
  id: string;
  vehicle_id: string;
  entry_date: string;
  exit_date: string | null;
  reason_type: string | null;
  workshop_name: string | null;
  maintenance_cost: number | null;
  status: string;
  vehicles?: {
    plate: string;
    model: string;
    team_id: string | null;
    gerencia: string | null;
  };
}

interface Team {
  id: string;
  name: string;
}

const REASON_COLORS: Record<string, string> = {
  "Implemento": "#3b82f6",
  "Mecânico": "#f59e0b",
  "Elétrico": "#10b981",
};

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#f43f5e", "#22c55e"
];

export const FleetIndicatorsTab = () => {
  const { data: workshopEntries = [], isLoading: isLoadingWorkshop } = useQuery({
    queryKey: ["workshop_entries_indicators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_entries")
        .select(`
          *,
          vehicles (
            plate,
            model,
            team_id,
            gerencia
          )
        `)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as WorkshopEntry[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams_indicators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const teamsMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [teams]);

  // Calculate metrics
  const metrics = useMemo(() => {
    // 1. Tempo médio de parada (in hours)
    const completedEntries = workshopEntries.filter(e => e.exit_date);
    let totalDowntimeHours = 0;
    completedEntries.forEach(entry => {
      const hours = differenceInHours(new Date(entry.exit_date!), new Date(entry.entry_date));
      totalDowntimeHours += hours;
    });
    const avgDowntimeHours = completedEntries.length > 0 
      ? totalDowntimeHours / completedEntries.length 
      : 0;
    const avgDowntimeDays = Math.floor(avgDowntimeHours / 24);
    const avgDowntimeRemainingHours = Math.round(avgDowntimeHours % 24);

    // 2. Valor gasto por placa/equipe
    const costByPlate: Record<string, { plate: string; team: string; cost: number }> = {};
    workshopEntries.forEach(entry => {
      if (entry.maintenance_cost && entry.vehicles) {
        const plate = entry.vehicles.plate;
        if (!costByPlate[plate]) {
          costByPlate[plate] = { 
            plate, 
            team: entry.vehicles.team_id ? (teamsMap[entry.vehicles.team_id] || "Sem equipe") : "Sem equipe",
            cost: 0 
          };
        }
        costByPlate[plate].cost += entry.maintenance_cost;
      }
    });
    const costByPlateArray = Object.values(costByPlate).sort((a, b) => b.cost - a.cost);

    // Cost by team
    const costByTeam: Record<string, number> = {};
    workshopEntries.forEach(entry => {
      if (entry.maintenance_cost && entry.vehicles?.team_id) {
        const teamName = teamsMap[entry.vehicles.team_id] || "Sem equipe";
        costByTeam[teamName] = (costByTeam[teamName] || 0) + entry.maintenance_cost;
      } else if (entry.maintenance_cost) {
        costByTeam["Sem equipe"] = (costByTeam["Sem equipe"] || 0) + entry.maintenance_cost;
      }
    });
    const costByTeamArray = Object.entries(costByTeam)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Valor gasto por gerência
    const costByGerencia: Record<string, number> = {};
    workshopEntries.forEach(entry => {
      if (entry.maintenance_cost && entry.vehicles?.gerencia) {
        costByGerencia[entry.vehicles.gerencia] = (costByGerencia[entry.vehicles.gerencia] || 0) + entry.maintenance_cost;
      } else if (entry.maintenance_cost) {
        costByGerencia["Sem gerência"] = (costByGerencia["Sem gerência"] || 0) + entry.maintenance_cost;
      }
    });
    const costByGerenciaArray = Object.entries(costByGerencia)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 4. Valor gasto por oficina
    const costByWorkshop: Record<string, number> = {};
    workshopEntries.forEach(entry => {
      if (entry.maintenance_cost && entry.workshop_name) {
        costByWorkshop[entry.workshop_name] = (costByWorkshop[entry.workshop_name] || 0) + entry.maintenance_cost;
      } else if (entry.maintenance_cost) {
        costByWorkshop["Não informada"] = (costByWorkshop["Não informada"] || 0) + entry.maintenance_cost;
      }
    });
    const costByWorkshopArray = Object.entries(costByWorkshop)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 5. Ranking de motivos de entrada
    const reasonCount: Record<string, number> = {
      "Implemento": 0,
      "Mecânico": 0,
      "Elétrico": 0,
    };
    workshopEntries.forEach(entry => {
      if (entry.reason_type && reasonCount[entry.reason_type] !== undefined) {
        reasonCount[entry.reason_type]++;
      }
    });
    const reasonRanking = Object.entries(reasonCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Total values
    const totalMaintenanceCost = workshopEntries.reduce((sum, e) => sum + (e.maintenance_cost || 0), 0);

    return {
      avgDowntimeDays,
      avgDowntimeRemainingHours,
      avgDowntimeHours,
      totalEntries: workshopEntries.length,
      completedEntries: completedEntries.length,
      totalMaintenanceCost,
      costByPlateArray,
      costByTeamArray,
      costByGerenciaArray,
      costByWorkshopArray,
      reasonRanking,
    };
  }, [workshopEntries, teamsMap]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  if (isLoadingWorkshop) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando indicadores...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tempo Médio de Parada</p>
              <p className="text-2xl font-bold text-foreground">
                {metrics.avgDowntimeDays > 0 
                  ? `${metrics.avgDowntimeDays}d ${metrics.avgDowntimeRemainingHours}h`
                  : `${Math.round(metrics.avgDowntimeHours)}h`
                }
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/10">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Custo Total de Manutenção</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(metrics.totalMaintenanceCost)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <Wrench className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Entradas</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalEntries}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Car className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saídas Registradas</p>
              <p className="text-2xl font-bold text-foreground">{metrics.completedEntries}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Motivos de Entrada */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Ranking de Motivos de Entrada</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={metrics.reasonRanking}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.reasonRanking.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={REASON_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} entradas`, 'Quantidade']} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Valor Gasto por Oficina */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Valor Gasto por Oficina</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.costByWorkshopArray.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Valor Gasto por Gerência */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Valor Gasto por Gerência</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.costByGerenciaArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Valor Gasto por Equipe */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Valor Gasto por Equipe</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.costByTeamArray.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Valor Gasto por Placa (Table) */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Valor Gasto por Placa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Posição</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Placa</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Equipe</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {metrics.costByPlateArray.slice(0, 15).map((item, index) => (
                <tr key={item.plate} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                      index === 1 ? 'bg-gray-400/20 text-gray-600' :
                      index === 2 ? 'bg-orange-500/20 text-orange-600' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium">{item.plate}</td>
                  <td className="py-3 px-4 text-muted-foreground">{item.team}</td>
                  <td className="py-3 px-4 text-right font-semibold text-green-600">
                    {formatCurrency(item.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {metrics.costByPlateArray.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
