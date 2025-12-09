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
import { Plus, Search, AlertTriangle, FileWarning, Car, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Incident {
  id: number;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  type: "multa" | "incidente" | "observacao";
  description: string;
  date: string;
  severity: "baixa" | "media" | "alta";
}

const initialIncidents: Incident[] = [
  { id: 1, vehiclePlate: "ABC-1234", vehicleModel: "Fiat Strada", driverName: "João Silva", type: "multa", description: "Multa por excesso de velocidade na BR-101", date: "2024-12-05", severity: "media" },
  { id: 2, vehiclePlate: "DEF-5678", vehicleModel: "VW Saveiro", driverName: "Maria Santos", type: "incidente", description: "Pequeno amassado na porta traseira direita", date: "2024-12-03", severity: "baixa" },
  { id: 3, vehiclePlate: "GHI-9012", vehicleModel: "Toyota Hilux", driverName: "Pedro Costa", type: "incidente", description: "Colisão traseira leve em estacionamento", date: "2024-11-28", severity: "alta" },
  { id: 4, vehiclePlate: "JKL-3456", vehicleModel: "Ford Ranger", driverName: "Ana Lima", type: "observacao", description: "Barulho estranho ao acelerar - verificar motor", date: "2024-12-07", severity: "media" },
];

const typeConfig = {
  multa: { label: "Multa", icon: FileWarning, color: "text-destructive" },
  incidente: { label: "Incidente", icon: AlertTriangle, color: "text-warning" },
  observacao: { label: "Observação", icon: Car, color: "text-primary" },
};

const severityConfig = {
  baixa: { label: "Baixa", className: "status-available" },
  media: { label: "Média", className: "status-maintenance" },
  alta: { label: "Alta", className: "status-in-use" },
};

const Incidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehiclePlate: "",
    vehicleModel: "",
    driverName: "",
    type: "observacao" as Incident["type"],
    description: "",
    date: "",
    severity: "baixa" as Incident["severity"],
  });

  const filteredIncidents = incidents.filter((i) => {
    const matchesSearch =
      i.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || i.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newIncident: Incident = {
      id: Date.now(),
      ...formData,
    };
    setIncidents([newIncident, ...incidents]);
    toast({ title: "Ocorrência registrada com sucesso!" });
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vehiclePlate: "",
      vehicleModel: "",
      driverName: "",
      type: "observacao",
      description: "",
      date: "",
      severity: "baixa",
    });
    setIsDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Ocorrências</h1>
        <p className="text-muted-foreground">Registro de multas, incidentes e observações</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ocorrências..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="multa">Multas</SelectItem>
            <SelectItem value="incidente">Incidentes</SelectItem>
            <SelectItem value="observacao">Observações</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Ocorrência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Ocorrência</DialogTitle>
              <DialogDescription>Preencha os detalhes da ocorrência</DialogDescription>
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
                  <Label htmlFor="driverName">Motorista</Label>
                  <Input
                    id="driverName"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    placeholder="Nome do motorista"
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
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: Incident["type"]) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multa">Multa</SelectItem>
                      <SelectItem value="incidente">Incidente</SelectItem>
                      <SelectItem value="observacao">Observação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Gravidade</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value: Incident["severity"]) => setFormData({ ...formData, severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
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
                  placeholder="Descreva a ocorrência em detalhes..."
                  rows={3}
                  required
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

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
        {filteredIncidents.map((incident) => {
          const typeInfo = typeConfig[incident.type];
          const TypeIcon = typeInfo.icon;
          const severity = severityConfig[incident.severity];

          return (
            <div key={incident.id} className="bg-card rounded-xl border border-border p-5 card-hover">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-muted", typeInfo.color)}>
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{typeInfo.label}</h4>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", severity.className)}>
                        {severity.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {incident.vehicleModel} • {incident.vehiclePlate}
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-foreground mb-4">{incident.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-border text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {incident.driverName}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(incident.date).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredIncidents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma ocorrência encontrada
        </div>
      )}
    </MainLayout>
  );
};

export default Incidents;
