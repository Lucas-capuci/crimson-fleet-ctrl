import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Edit, Trash2, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type VehicleStatus = "ativo" | "manutencao" | "reserva" | "oficina" | "mobilizar";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  status: VehicleStatus;
  team_id: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
}

const statusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-green-500/20 text-green-700" },
  manutencao: { label: "Em Manutenção", className: "bg-yellow-500/20 text-yellow-700" },
  reserva: { label: "Reserva", className: "bg-blue-500/20 text-blue-700" },
  oficina: { label: "Oficina", className: "bg-orange-500/20 text-orange-700" },
  mobilizar: { label: "Mobilizar", className: "bg-purple-500/20 text-purple-700" },
};

const Vehicles = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    plate: "",
    model: "",
    team_id: "",
    status: "ativo" as VehicleStatus,
  });

  // Fetch vehicles from Supabase
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, model, status, team_id")
        .order("plate");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  // Fetch teams for dropdown
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  // Fetch supervisor_teams to get supervisor for each team
  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supervisor_teams").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles to get supervisor names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const createVehicle = useMutation({
    mutationFn: async (data: { plate: string; model: string; team_id: string; status: VehicleStatus }) => {
      const { error } = await supabase
        .from("vehicles")
        .insert({ 
          plate: data.plate, 
          model: data.model, 
          status: data.status,
          team_id: data.team_id || null 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Veículo cadastrado com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao cadastrar veículo", description: error.message, variant: "destructive" });
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { plate: string; model: string; team_id: string; status: VehicleStatus } }) => {
      const { error } = await supabase
        .from("vehicles")
        .update({ 
          plate: data.plate, 
          model: data.model, 
          status: data.status,
          team_id: data.team_id || null 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Veículo atualizado com sucesso!" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar veículo", description: error.message, variant: "destructive" });
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Veículo removido com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover veículo", description: error.message, variant: "destructive" });
    },
  });

  // Helper to get team name
  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    const team = teams.find((t) => t.id === teamId);
    return team?.name || null;
  };

  // Helper to get supervisor name for a team
  const getSupervisorName = (teamId: string | null) => {
    if (!teamId) return null;
    const assignment = supervisorTeams.find((st) => st.team_id === teamId);
    if (!assignment) return null;
    const profile = profiles.find((p) => p.id === assignment.supervisor_id);
    return profile?.name || null;
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = 
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (getTeamName(v.team_id)?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesStatus = filterStatus === "all" || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicle) {
      updateVehicle.mutate({ id: editingVehicle.id, data: formData });
    } else {
      createVehicle.mutate(formData);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      model: vehicle.model,
      team_id: vehicle.team_id || "",
      status: vehicle.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este veículo?")) {
      deleteVehicle.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ plate: "", model: "", team_id: "", status: "ativo" });
    setEditingVehicle(null);
    setIsDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Veículos</h1>
        <p className="text-muted-foreground">Gerencie todos os veículos da frota</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, modelo ou equipe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="manutencao">Em Manutenção</SelectItem>
            <SelectItem value="reserva">Reserva</SelectItem>
            <SelectItem value="oficina">Oficina</SelectItem>
            <SelectItem value="mobilizar">Mobilizar</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Veículo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
                <DialogDescription>
                  {editingVehicle ? "Atualize os dados do veículo" : "Preencha os dados para cadastrar um novo veículo"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plate">Placa</Label>
                    <Input
                      id="plate"
                      value={formData.plate}
                      onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                      placeholder="ABC-1234"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Fiat Strada"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Equipe</Label>
                  <Select
                    value={formData.team_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, team_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: VehicleStatus) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="reserva">Reserva</SelectItem>
                      <SelectItem value="oficina">Oficina</SelectItem>
                      <SelectItem value="mobilizar">Mobilizar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createVehicle.isPending || updateVehicle.isPending}>
                    {editingVehicle ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVehicles.map((vehicle) => {
              const status = statusConfig[vehicle.status] || { label: vehicle.status, className: "bg-gray-500/20 text-gray-700" };
              return (
                <TableRow key={vehicle.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      {vehicle.plate}
                    </div>
                  </TableCell>
                  <TableCell>{vehicle.model}</TableCell>
                  <TableCell>
                    {getTeamName(vehicle.team_id) || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {getSupervisorName(vehicle.team_id) || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", status.className)}>
                      {status.label}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(vehicle)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(vehicle.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        )}
        {!isLoading && filteredVehicles.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum veículo encontrado
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Vehicles;