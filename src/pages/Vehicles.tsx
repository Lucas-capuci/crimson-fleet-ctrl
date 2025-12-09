import { useState } from "react";
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

interface Vehicle {
  id: number;
  plate: string;
  model: string;
  year: number;
  supervisor: string;
  status: "ativo" | "manutencao" | "reserva";
}

const initialVehicles: Vehicle[] = [
  { id: 1, plate: "ABC-1234", model: "Fiat Strada", year: 2022, supervisor: "João Silva", status: "ativo" },
  { id: 2, plate: "DEF-5678", model: "VW Saveiro", year: 2021, supervisor: "Maria Santos", status: "ativo" },
  { id: 3, plate: "GHI-9012", model: "Toyota Hilux", year: 2023, supervisor: "Pedro Costa", status: "manutencao" },
  { id: 4, plate: "JKL-3456", model: "Ford Ranger", year: 2022, supervisor: "Ana Lima", status: "ativo" },
  { id: 5, plate: "MNO-7890", model: "Chevrolet S10", year: 2020, supervisor: "Carlos Oliveira", status: "reserva" },
];

const statusConfig = {
  ativo: { label: "Ativo", className: "status-available" },
  manutencao: { label: "Em Manutenção", className: "status-maintenance" },
  reserva: { label: "Reserva", className: "status-in-use" },
};

const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    plate: "",
    model: "",
    year: "",
    supervisor: "",
    status: "ativo" as Vehicle["status"],
  });

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.supervisor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingVehicle) {
      setVehicles(vehicles.map(v => 
        v.id === editingVehicle.id 
          ? { ...v, ...formData, year: parseInt(formData.year) }
          : v
      ));
      toast({ title: "Veículo atualizado com sucesso!" });
    } else {
      const newVehicle: Vehicle = {
        id: Date.now(),
        plate: formData.plate,
        model: formData.model,
        year: parseInt(formData.year),
        supervisor: formData.supervisor,
        status: formData.status,
      };
      setVehicles([...vehicles, newVehicle]);
      toast({ title: "Veículo cadastrado com sucesso!" });
    }
    
    resetForm();
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      model: vehicle.model,
      year: vehicle.year.toString(),
      supervisor: vehicle.supervisor,
      status: vehicle.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setVehicles(vehicles.filter(v => v.id !== id));
    toast({ title: "Veículo removido com sucesso!" });
  };

  const resetForm = () => {
    setFormData({ plate: "", model: "", year: "", supervisor: "", status: "ativo" });
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
            placeholder="Buscar por placa, modelo ou supervisor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2024"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Vehicle["status"]) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="reserva">Reserva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={formData.supervisor}
                  onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                  placeholder="Nome do supervisor"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingVehicle ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Placa</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVehicles.map((vehicle) => {
              const status = statusConfig[vehicle.status];
              return (
                <TableRow key={vehicle.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      {vehicle.plate}
                    </div>
                  </TableCell>
                  <TableCell>{vehicle.model}</TableCell>
                  <TableCell>{vehicle.year}</TableCell>
                  <TableCell>{vehicle.supervisor}</TableCell>
                  <TableCell>
                    <span className={cn("px-3 py-1 rounded-full text-xs font-medium", status.className)}>
                      {status.label}
                    </span>
                  </TableCell>
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredVehicles.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum veículo encontrado
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Vehicles;
