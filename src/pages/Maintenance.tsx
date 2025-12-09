import { useState } from "react";
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
import { Plus, Search, Wrench, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Maintenance {
  id: number;
  vehiclePlate: string;
  vehicleModel: string;
  type: string;
  description: string;
  date: string;
  cost: number;
  status: "completed" | "pending" | "overdue";
}

const initialMaintenances: Maintenance[] = [
  { id: 1, vehiclePlate: "ABC-1234", vehicleModel: "Fiat Strada", type: "Troca de óleo", description: "Troca de óleo e filtro", date: "2024-12-05", cost: 350, status: "completed" },
  { id: 2, vehiclePlate: "DEF-5678", vehicleModel: "VW Saveiro", type: "Revisão geral", description: "Revisão dos 40.000km", date: "2024-12-08", cost: 1200, status: "pending" },
  { id: 3, vehiclePlate: "GHI-9012", vehicleModel: "Toyota Hilux", type: "Alinhamento", description: "Alinhamento e balanceamento", date: "2024-12-01", cost: 180, status: "overdue" },
  { id: 4, vehiclePlate: "JKL-3456", vehicleModel: "Ford Ranger", type: "Troca de pneus", description: "4 pneus novos", date: "2024-12-10", cost: 2400, status: "pending" },
  { id: 5, vehiclePlate: "MNO-7890", vehicleModel: "Chevrolet S10", type: "Freios", description: "Pastilhas e discos dianteiros", date: "2024-11-28", cost: 800, status: "completed" },
];

const statusConfig = {
  completed: { icon: CheckCircle, label: "Concluída", className: "status-available" },
  pending: { icon: Wrench, label: "Pendente", className: "status-maintenance" },
  overdue: { icon: AlertCircle, label: "Atrasada", className: "status-in-use" },
};

const Maintenance = () => {
  const [maintenances, setMaintenances] = useState<Maintenance[]>(initialMaintenances);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehiclePlate: "",
    vehicleModel: "",
    type: "",
    description: "",
    date: "",
    cost: "",
    status: "pending" as Maintenance["status"],
  });

  const completedMaintenances = maintenances.filter(m => m.status === "completed");
  const upcomingMaintenances = maintenances.filter(m => m.status !== "completed");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMaintenance: Maintenance = {
      id: Date.now(),
      vehiclePlate: formData.vehiclePlate,
      vehicleModel: formData.vehicleModel,
      type: formData.type,
      description: formData.description,
      date: formData.date,
      cost: parseFloat(formData.cost),
      status: formData.status,
    };
    setMaintenances([...maintenances, newMaintenance]);
    toast({ title: "Manutenção registrada com sucesso!" });
    resetForm();
  };

  const resetForm = () => {
    setFormData({ vehiclePlate: "", vehicleModel: "", type: "", description: "", date: "", cost: "", status: "pending" });
    setIsDialogOpen(false);
  };

  const markAsCompleted = (id: number) => {
    setMaintenances(maintenances.map(m => 
      m.id === id ? { ...m, status: "completed" as const } : m
    ));
    toast({ title: "Manutenção marcada como concluída!" });
  };

  const MaintenanceCard = ({ maintenance }: { maintenance: Maintenance }) => {
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
                {maintenance.vehicleModel} • {maintenance.vehiclePlate}
              </p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", status.className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{maintenance.description}</p>
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(maintenance.date).toLocaleDateString("pt-BR")}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-primary">
              R$ {maintenance.cost.toLocaleString("pt-BR")}
            </span>
            {maintenance.status !== "completed" && (
              <Button size="sm" variant="outline" onClick={() => markAsCompleted(maintenance.id)}>
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Manutenção</DialogTitle>
              <DialogDescription>Preencha os dados da manutenção</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate">Placa</Label>
                  <Input
                    id="vehiclePlate"
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    placeholder="ABC-1234"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Modelo</Label>
                  <Input
                    id="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    placeholder="Fiat Strada"
                    required
                  />
                </div>
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
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Maintenance["status"]) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
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
                  placeholder="Descreva a manutenção realizada..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit">Registrar</Button>
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
