import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Wrench, Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatDate, formatCurrency } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MaintenanceStatus = "pendente" | "em_andamento" | "concluida";

interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  type: string;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  cost: number | null;
  status: MaintenanceStatus;
  vehicles?: {
    plate: string;
    model: string;
    team_id: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  vehicles: {
    id: string;
    plate: string;
    model: string;
  } | null;
}

const statusConfig = {
  concluida: { icon: CheckCircle, label: "Concluída", className: "status-available" },
  pendente: { icon: Clock, label: "Pendente", className: "status-maintenance" },
  em_andamento: { icon: Wrench, label: "Em Andamento", className: "status-in-use" },
};

const Maintenance = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    team_id: "",
    type: "",
    description: "",
    scheduled_date: "",
    cost: "",
    status: "pendente" as MaintenanceStatus,
  });

  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ["maintenance_records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select(`
          *,
          vehicles (
            plate,
            model,
            team_id
          )
        `)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as MaintenanceRecord[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams_with_vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          vehicles (
            id,
            plate,
            model
          )
        `)
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const { data: teamsMap = {} } = useQuery({
    queryKey: ["teams_map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name");
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach(t => { map[t.id] = t.name; });
      return map;
    },
  });

  const createMaintenance = useMutation({
    mutationFn: async (data: typeof formData) => {
      const team = teams.find(t => t.id === data.team_id);
      if (!team?.vehicles) throw new Error("Equipe sem veículo vinculado");
      
      const { error } = await supabase.from("maintenance_records").insert({
        vehicle_id: team.vehicles.id,
        type: data.type,
        description: data.description || null,
        scheduled_date: data.scheduled_date || null,
        cost: data.cost ? parseFloat(data.cost) : null,
        status: data.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_records"] });
      toast({ title: "Manutenção registrada com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar manutenção", description: error.message, variant: "destructive" });
    },
  });

  const markAsCompleted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_records")
        .update({ status: "concluida" as MaintenanceStatus, completed_date: new Date().toISOString().split('T')[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_records"] });
      toast({ title: "Manutenção marcada como concluída!" });
    },
  });

  const completedMaintenances = maintenances.filter(m => m.status === "concluida");
  const upcomingMaintenances = maintenances.filter(m => m.status !== "concluida");

  // CSV columns
  const csvColumns: CsvColumn[] = [
    { key: "vehicles", header: "Placa", format: (v) => v?.plate || "-" },
    { key: "vehicles", header: "Modelo", format: (v) => v?.model || "-" },
    { key: "vehicles", header: "Equipe", format: (v) => getTeamName(v?.team_id || null) },
    { key: "type", header: "Tipo" },
    { key: "status", header: "Status", format: (v) => statusConfig[v as MaintenanceStatus]?.label || v },
    { key: "scheduled_date", header: "Data Prevista", format: (v) => formatDate(v) },
    { key: "cost", header: "Custo", format: (v) => formatCurrency(v) },
    { key: "description", header: "Descrição", format: (v) => v || "-" },
  ];

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "Sem equipe";
    return teamsMap[teamId] || "Sem equipe";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMaintenance.mutate(formData);
  };

  const resetForm = () => {
    setFormData({ team_id: "", type: "", description: "", scheduled_date: "", cost: "", status: "pendente" });
    setIsDialogOpen(false);
  };

  const teamsWithVehicles = teams.filter(t => t.vehicles);

  const MaintenanceCard = ({ maintenance }: { maintenance: MaintenanceRecord }) => {
    const status = statusConfig[maintenance.status];
    const StatusIcon = status.icon;
    
    return (
      <div className="bg-card rounded-xl border border-border p-5 card-hover">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{maintenance.type}</h4>
              <p className="text-sm text-muted-foreground">
                {maintenance.vehicles?.model} • {maintenance.vehicles?.plate}
              </p>
              <p className="text-xs text-muted-foreground">
                {getTeamName(maintenance.vehicles?.team_id || null)}
              </p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", status.className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>
        {maintenance.description && (
          <p className="text-sm text-muted-foreground mb-4">{maintenance.description}</p>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {maintenance.scheduled_date 
              ? new Date(maintenance.scheduled_date).toLocaleDateString("pt-BR")
              : "Sem data"
            }
          </div>
          <div className="flex items-center gap-3">
            {maintenance.cost && (
              <span className="text-lg font-bold text-primary">
                R$ {maintenance.cost.toLocaleString("pt-BR")}
              </span>
            )}
            {maintenance.status !== "concluida" && (
              <Button size="sm" variant="outline" onClick={() => markAsCompleted.mutate(maintenance.id)}>
                Concluir
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Manutenção</h1>
        <p className="text-muted-foreground">Controle de manutenções realizadas e agendadas</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar manutenções..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
            <Plus className="h-4 w-4" />
              Nova Manutenção
            </Button>
          </DialogTrigger>
          <ExportButton
            data={maintenances}
            filename={`manutencoes-${new Date().toISOString().split('T')[0]}`}
            columns={csvColumns}
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Manutenção</DialogTitle>
              <DialogDescription>Selecione a equipe para vincular ao veículo</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team">Equipe</Label>
                <Select
                  value={formData.team_id}
                  onValueChange={(value) => setFormData({ ...formData, team_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsWithVehicles.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} ({team.vehicles?.plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Input
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Troca de óleo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled_date">Data Prevista</Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Custo (R$)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="350.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: MaintenanceStatus) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a manutenção..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={createMaintenance.isPending || !formData.team_id}>
                  Registrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="animate-fade-in">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" />
            Próximas ({upcomingMaintenances.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Realizadas ({completedMaintenances.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMaintenances.map((m) => (
              <MaintenanceCard key={m.id} maintenance={m} />
            ))}
          </div>
          {upcomingMaintenances.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma manutenção pendente
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedMaintenances.map((m) => (
              <MaintenanceCard key={m.id} maintenance={m} />
            ))}
          </div>
          {completedMaintenances.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma manutenção realizada
            </div>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Maintenance;
