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
import { Plus, Search, Wrench, Clock, CheckCircle, Calendar, LogOut } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatDateTime } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { differenceInHours, differenceInDays } from "date-fns";

type MaintenanceStatus = "pendente" | "em_andamento" | "concluida";

interface WorkshopEntry {
  id: string;
  vehicle_id: string;
  entry_date: string;
  exit_date: string | null;
  predicted_exit_date: string | null;
  reason: string;
  status: MaintenanceStatus;
  notes: string | null;
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
  pendente: { label: "Pendente", icon: Clock, className: "status-maintenance" },
  em_andamento: { label: "Em Andamento", icon: Wrench, className: "status-in-use" },
  concluida: { label: "Concluída", icon: CheckCircle, className: "status-available" },
};

const Workshop = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkshopEntry | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [formData, setFormData] = useState({
    team_id: "",
    entry_date: new Date().toISOString().split("T")[0],
    predicted_exit_date: "",
    reason: "",
    notes: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["workshop_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshop_entries")
        .select(`
          *,
          vehicles (
            plate,
            model,
            team_id
          )
        `)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as WorkshopEntry[];
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

  const createEntry = useMutation({
    mutationFn: async (data: typeof formData) => {
      const team = teams.find(t => t.id === data.team_id);
      if (!team?.vehicles) throw new Error("Equipe sem veículo vinculado");
      
      const { error } = await supabase.from("workshop_entries").insert({
        vehicle_id: team.vehicles.id,
        entry_date: new Date(data.entry_date).toISOString(),
        predicted_exit_date: data.predicted_exit_date ? new Date(data.predicted_exit_date).toISOString() : null,
        reason: data.reason,
        notes: data.notes || null,
        status: "em_andamento" as MaintenanceStatus,
      });
      if (error) throw error;
      
      // Update vehicle status to oficina
      await supabase.from("vehicles").update({ status: "oficina" }).eq("id", team.vehicles.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop_entries"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Entrada na oficina registrada!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar entrada", description: error.message, variant: "destructive" });
    },
  });

  const registerExit = useMutation({
    mutationFn: async ({ entry, exitDate }: { entry: WorkshopEntry; exitDate: string }) => {
      const { error } = await supabase
        .from("workshop_entries")
        .update({ 
          status: "concluida" as MaintenanceStatus, 
          exit_date: new Date(exitDate).toISOString() 
        })
        .eq("id", entry.id);
      if (error) throw error;
      
      // Update vehicle status back to ativo
      await supabase.from("vehicles").update({ status: "ativo" }).eq("id", entry.vehicle_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop_entries"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Saída da oficina registrada!" });
      setIsExitDialogOpen(false);
      setSelectedEntry(null);
      setExitDate("");
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar saída", description: error.message, variant: "destructive" });
    },
  });

  const activeEntries = entries.filter((e) => e.status !== "concluida");
  const completedEntries = entries.filter((e) => e.status === "concluida");

  // CSV columns
  const csvColumns: CsvColumn[] = [
    { key: "vehicles", header: "Placa", format: (v) => v?.plate || "-" },
    { key: "vehicles", header: "Modelo", format: (v) => v?.model || "-" },
    { key: "vehicles", header: "Equipe", format: (v) => getTeamName(v?.team_id || null) },
    { key: "reason", header: "Motivo" },
    { key: "entry_date", header: "Entrada", format: (v) => formatDateTime(v) },
    { key: "predicted_exit_date", header: "Previsão Saída", format: (v) => formatDateTime(v) },
    { key: "exit_date", header: "Saída", format: (v) => formatDateTime(v) },
    { key: "status", header: "Status", format: (v) => statusConfig[v as MaintenanceStatus]?.label || v },
    { key: "notes", header: "Observações", format: (v) => v || "-" },
  ];

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "Sem equipe";
    return teamsMap[teamId] || "Sem equipe";
  };

  const calculateDowntime = (entryDate: string, exitDate: string | null) => {
    const start = new Date(entryDate);
    const end = exitDate ? new Date(exitDate) : new Date();
    const hours = differenceInHours(end, start);
    const days = differenceInDays(end, start);
    
    if (days >= 1) {
      return `${days} dia${days > 1 ? "s" : ""} e ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntry.mutate(formData);
  };

  const handleExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntry && exitDate) {
      registerExit.mutate({ entry: selectedEntry, exitDate });
    }
  };

  const openExitDialog = (entry: WorkshopEntry) => {
    setSelectedEntry(entry);
    setExitDate(new Date().toISOString().split("T")[0]);
    setIsExitDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      team_id: "", 
      entry_date: new Date().toISOString().split("T")[0],
      predicted_exit_date: "",
      reason: "", 
      notes: "" 
    });
    setIsDialogOpen(false);
  };

  const teamsWithVehicles = teams.filter(t => t.vehicles);

  const EntryCard = ({ entry }: { entry: WorkshopEntry }) => {
    const status = statusConfig[entry.status];
    const StatusIcon = status.icon;
    const downtime = calculateDowntime(entry.entry_date, entry.exit_date);

    return (
      <div className="bg-card rounded-xl border border-border p-5 card-hover">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">
                {entry.vehicles?.plate} - {entry.vehicles?.model}
              </h4>
              <p className="text-sm text-muted-foreground">
                {getTeamName(entry.vehicles?.team_id || null)}
              </p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", status.className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>
        
        <p className="text-sm text-foreground mb-4">{entry.reason}</p>
        {entry.notes && (
          <p className="text-sm text-muted-foreground mb-4">{entry.notes}</p>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Entrada: {new Date(entry.entry_date).toLocaleDateString("pt-BR")}
            </div>
            {entry.predicted_exit_date && !entry.exit_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Previsão: {new Date(entry.predicted_exit_date).toLocaleDateString("pt-BR")}
              </div>
            )}
            {entry.exit_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LogOut className="h-4 w-4" />
                Saída: {new Date(entry.exit_date).toLocaleDateString("pt-BR")}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Tempo parado: {downtime}</span>
            </div>
          </div>
          {entry.status !== "concluida" && (
            <Button size="sm" onClick={() => openExitDialog(entry)} className="gap-2">
              <LogOut className="h-4 w-4" />
              Registrar Saída
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Oficina</h1>
        <p className="text-muted-foreground">Controle de entrada e saída de veículos</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por veículo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
            <Plus className="h-4 w-4" />
              Registrar Entrada
            </Button>
          </DialogTrigger>
          <ExportButton
            data={entries}
            filename={`oficina-${new Date().toISOString().split('T')[0]}`}
            columns={csvColumns}
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Entrada na Oficina</DialogTitle>
              <DialogDescription>Selecione a equipe e informe a data de entrada</DialogDescription>
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
                  <Label htmlFor="entry_date">Data de Entrada</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="predicted_exit_date">Previsão de Saída</Label>
                  <Input
                    id="predicted_exit_date"
                    type="date"
                    value={formData.predicted_exit_date}
                    onChange={(e) => setFormData({ ...formData, predicted_exit_date: e.target.value })}
                    min={formData.entry_date}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da Entrada</Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Descreva o motivo..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createEntry.isPending || !formData.team_id}>
                  Registrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Exit Dialog */}
        <Dialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Saída da Oficina</DialogTitle>
              <DialogDescription>
                {selectedEntry && (
                  <>Veículo: {selectedEntry.vehicles?.plate} - {selectedEntry.vehicles?.model}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleExitSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exit_date">Data de Saída</Label>
                <Input
                  id="exit_date"
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsExitDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={registerExit.isPending || !exitDate}>
                  Confirmar Saída
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="animate-fade-in">
        <TabsList className="mb-6">
          <TabsTrigger value="active" className="gap-2">
            <Wrench className="h-4 w-4" />
            Na Oficina ({activeEntries.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Concluídas ({completedEntries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
          {activeEntries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum veículo na oficina
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
          {completedEntries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma entrada concluída
            </div>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Workshop;
