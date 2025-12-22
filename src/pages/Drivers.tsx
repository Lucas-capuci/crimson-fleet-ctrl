import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, User, Car, Clock, Phone } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Driver {
  id: number;
  name: string;
  matricula: string;
  funcao: string;
  equipe: string;
  contato: string;
}

interface Allocation {
  id: number;
  driverId: number;
  driverName: string;
  vehiclePlate: string;
  vehicleModel: string;
  checkoutDate: string;
  expectedReturn: string;
  status: "em_uso" | "disponivel";
}

const initialDrivers: Driver[] = [
  { id: 1, name: "João Silva", matricula: "001234", funcao: "Motorista", equipe: "Operações A", contato: "(11) 99999-1111" },
  { id: 2, name: "Maria Santos", matricula: "001235", funcao: "Motorista Senior", equipe: "Operações B", contato: "(11) 99999-2222" },
  { id: 3, name: "Pedro Costa", matricula: "001236", funcao: "Motorista", equipe: "Logística", contato: "(11) 99999-3333" },
  { id: 4, name: "Ana Lima", matricula: "001237", funcao: "Motorista", equipe: "Operações A", contato: "(11) 99999-4444" },
  { id: 5, name: "Carlos Oliveira", matricula: "001238", funcao: "Motorista Senior", equipe: "Operações B", contato: "(11) 99999-5555" },
];

const initialAllocations: Allocation[] = [
  { id: 1, driverId: 1, driverName: "João Silva", vehiclePlate: "ABC-1234", vehicleModel: "Fiat Strada", checkoutDate: "2024-12-09 08:00", expectedReturn: "2024-12-09 18:00", status: "em_uso" },
  { id: 2, driverId: 2, driverName: "Maria Santos", vehiclePlate: "DEF-5678", vehicleModel: "VW Saveiro", checkoutDate: "2024-12-09 07:30", expectedReturn: "2024-12-09 17:00", status: "em_uso" },
  { id: 3, driverId: 3, driverName: "Pedro Costa", vehiclePlate: "JKL-3456", vehicleModel: "Ford Ranger", checkoutDate: "2024-12-08 14:00", expectedReturn: "2024-12-08 22:00", status: "disponivel" },
];

const Drivers = () => {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [allocations, setAllocations] = useState<Allocation[]>(initialAllocations);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    matricula: "",
    funcao: "",
    equipe: "",
    contato: "",
  });

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.matricula.includes(searchTerm) ||
      d.equipe.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // CSV columns for drivers
  const driversCsvColumns: CsvColumn[] = [
    { key: "name", header: "Nome" },
    { key: "matricula", header: "Matrícula" },
    { key: "funcao", header: "Função" },
    { key: "equipe", header: "Equipe" },
    { key: "contato", header: "Contato" },
  ];

  // CSV columns for allocations
  const allocationsCsvColumns: CsvColumn[] = [
    { key: "driverName", header: "Motorista" },
    { key: "vehicleModel", header: "Veículo" },
    { key: "vehiclePlate", header: "Placa" },
    { key: "checkoutDate", header: "Retirada" },
    { key: "expectedReturn", header: "Previsão Retorno" },
    { key: "status", header: "Status", format: (v) => v === "em_uso" ? "Em Uso" : "Disponível" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingDriver) {
      setDrivers(drivers.map(d => 
        d.id === editingDriver.id ? { ...d, ...formData } : d
      ));
      toast({ title: "Motorista atualizado com sucesso!" });
    } else {
      const newDriver: Driver = {
        id: Date.now(),
        ...formData,
      };
      setDrivers([...drivers, newDriver]);
      toast({ title: "Motorista cadastrado com sucesso!" });
    }
    
    resetForm();
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      matricula: driver.matricula,
      funcao: driver.funcao,
      equipe: driver.equipe,
      contato: driver.contato,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDrivers(drivers.filter(d => d.id !== id));
    toast({ title: "Motorista removido com sucesso!" });
  };

  const resetForm = () => {
    setFormData({ name: "", matricula: "", funcao: "", equipe: "", contato: "" });
    setEditingDriver(null);
    setIsDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Motoristas</h1>
        <p className="text-muted-foreground">Gerencie motoristas e alocações de veículos</p>
      </div>

      <Tabs defaultValue="drivers" className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="drivers" className="gap-2">
              <User className="h-4 w-4" />
              Motoristas ({drivers.length})
            </TabsTrigger>
            <TabsTrigger value="allocations" className="gap-2">
              <Car className="h-4 w-4" />
              Alocações ({allocations.length})
            </TabsTrigger>
          </TabsList>
          <ExportButton
            data={filteredDrivers}
            filename={`motoristas-${new Date().toISOString().split('T')[0]}`}
            columns={driversCsvColumns}
          />
        </div>

        <TabsContent value="drivers">
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, matrícula ou equipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Motorista
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDriver ? "Editar Motorista" : "Novo Motorista"}</DialogTitle>
                  <DialogDescription>
                    {editingDriver ? "Atualize os dados do motorista" : "Preencha os dados do novo motorista"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome completo"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="matricula">Matrícula</Label>
                      <Input
                        id="matricula"
                        value={formData.matricula}
                        onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                        placeholder="001234"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="funcao">Função</Label>
                      <Input
                        id="funcao"
                        value={formData.funcao}
                        onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                        placeholder="Motorista"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equipe">Equipe</Label>
                      <Input
                        id="equipe"
                        value={formData.equipe}
                        onChange={(e) => setFormData({ ...formData, equipe: e.target.value })}
                        placeholder="Operações A"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contato">Contato</Label>
                    <Input
                      id="contato"
                      value={formData.contato}
                      onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                    <Button type="submit">{editingDriver ? "Atualizar" : "Cadastrar"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Drivers Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        {driver.name}
                      </div>
                    </TableCell>
                    <TableCell>{driver.matricula}</TableCell>
                    <TableCell>{driver.funcao}</TableCell>
                    <TableCell>{driver.equipe}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {driver.contato}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(driver)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(driver.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="allocations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allocations.map((allocation) => (
              <div 
                key={allocation.id} 
                className="bg-card rounded-xl border border-border p-5 card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{allocation.driverName}</h4>
                      <p className="text-sm text-muted-foreground">{allocation.vehicleModel}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    allocation.status === "em_uso" ? "status-in-use" : "status-available"
                  )}>
                    {allocation.status === "em_uso" ? "Em Uso" : "Disponível"}
                  </span>
                </div>
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Veículo:</span>
                    <span className="font-medium">{allocation.vehiclePlate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Retirada:</span>
                    <span>{allocation.checkoutDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Previsão:</span>
                    <span>{allocation.expectedReturn}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default Drivers;
