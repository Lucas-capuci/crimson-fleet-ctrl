import { useState, useMemo, useRef } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Plus, Search, Edit, Trash2, Car, Wrench, Clock, CheckCircle, 
  Calendar, LogOut, ChevronsUpDown, Check, Building, User, Phone,
  Upload, X, FileText, Image, Video, Download, Eye, Paperclip, BarChart3,
  FileWarning
} from "lucide-react";
import { FleetIndicatorsTab } from "@/components/fleet/FleetIndicatorsTab";
import { LaudosTrackingTab } from "@/components/fleet/LaudosTrackingTab";
import { ExportButton } from "@/components/ExportButton";
import { CsvColumn, formatDateTime } from "@/lib/exportCsv";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInHours, differenceInDays } from "date-fns";

// ==================== VEHICLES TYPES ====================
type VehicleStatus = "ativo" | "manutencao" | "reserva" | "oficina" | "mobilizar";

type GerenciaType = "C&M" | "STC Comercial" | "STC Emergencial" | "STC Corte e religa" | "Perdas" | "Âncora Comercial";

const GERENCIAS: GerenciaType[] = [
  "C&M",
  "STC Comercial",
  "STC Emergencial",
  "STC Corte e religa",
  "Perdas",
  "Âncora Comercial",
];

interface VehicleAttachment {
  id: string;
  vehicle_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  status: VehicleStatus;
  team_id: string | null;
  gerencia: string | null;
  laudo_eletrico: string | null;
  laudo_acustico: string | null;
  laudo_liner: string | null;
  laudo_tacografo: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
}

const vehicleStatusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-green-500/20 text-green-700" },
  manutencao: { label: "Em Manutenção", className: "bg-yellow-500/20 text-yellow-700" },
  reserva: { label: "Reserva", className: "bg-blue-500/20 text-blue-700" },
  oficina: { label: "Oficina", className: "bg-orange-500/20 text-orange-700" },
  mobilizar: { label: "Mobilizar", className: "bg-purple-500/20 text-purple-700" },
};

// ==================== WORKSHOP TYPES ====================
type MaintenanceStatus = "pendente" | "em_andamento" | "concluida";

type ReasonType = "Implemento" | "Mecânico" | "Elétrico";

const REASON_TYPES: ReasonType[] = ["Implemento", "Mecânico", "Elétrico"];

const WORKSHOP_NAMES = [
  "HidrauAgri",
  "HidrauWetec",
  "SETEC",
  "POLINOX",
  "Flach",
  "Centro Oeste",
  "Rio Preto",
  "Dois Irmãos",
  "Delta Diesel",
  "BM Suspensões",
  "Alternativa Pneus",
  "E-Force",
  "JJMT",
  "TECMARQUES",
];

interface WorkshopAttachment {
  id: string;
  workshop_entry_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface WorkshopEntry {
  id: string;
  vehicle_id: string;
  entry_date: string;
  exit_date: string | null;
  predicted_exit_date: string | null;
  reason: string;
  reason_type: string | null;
  workshop_name: string | null;
  maintenance_cost: number | null;
  status: MaintenanceStatus;
  notes: string | null;
  vehicles?: {
    plate: string;
    model: string;
    team_id: string | null;
  };
}

const workshopStatusConfig = {
  pendente: { label: "Pendente", icon: Clock, className: "status-maintenance" },
  em_andamento: { label: "Em Andamento", icon: Wrench, className: "status-in-use" },
  concluida: { label: "Concluída", icon: CheckCircle, className: "status-available" },
};

// ==================== DRIVERS TYPES ====================
interface Driver {
  id: string;
  name: string;
  matricula: string;
  funcao: string;
  team_id: string | null;
  contato: string | null;
}

const FleetManagement = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // ==================== VEHICLES STATE ====================
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    plate: "",
    model: "",
    team_id: "",
    status: "ativo" as VehicleStatus,
    gerencia: "",
    laudo_eletrico: "",
    laudo_acustico: "",
    laudo_liner: "",
    laudo_tacografo: "",
  });
  const [vehicleFiles, setVehicleFiles] = useState<File[]>([]);
  const [existingVehicleAttachments, setExistingVehicleAttachments] = useState<VehicleAttachment[]>([]);
  const [isUploadingVehicleFiles, setIsUploadingVehicleFiles] = useState(false);
  const vehicleFileInputRef = useRef<HTMLInputElement>(null);
  const [isViewAttachmentsOpen, setIsViewAttachmentsOpen] = useState(false);
  const [viewingVehicleAttachments, setViewingVehicleAttachments] = useState<VehicleAttachment[]>([]);
  const [viewingVehiclePlate, setViewingVehiclePlate] = useState("");
  
  // Import vehicles state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importCsvData, setImportCsvData] = useState("");
  const [importPreview, setImportPreview] = useState<{ valid: Array<{plate: string; model: string; year?: number; status: VehicleStatus; gerencia?: string}>; errors: string[] }>({ valid: [], errors: [] });
  const [isImporting, setIsImporting] = useState(false);

  // ==================== WORKSHOP STATE ====================
  const [workshopSearchTerm, setWorkshopSearchTerm] = useState("");
  const [isWorkshopDialogOpen, setIsWorkshopDialogOpen] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkshopEntry | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [exitMaintenanceCost, setExitMaintenanceCost] = useState("");
  const [plateSearchOpen, setPlateSearchOpen] = useState(false);
  const [plateSearch, setPlateSearch] = useState("");
  const [workshopFormData, setWorkshopFormData] = useState({
    vehicle_id: "",
    entry_date: new Date().toISOString().split("T")[0],
    predicted_exit_date: "",
    reason: "",
    reason_type: "",
    workshop_name: "",
    maintenance_cost: "",
    notes: "",
  });
  const [editFormData, setEditFormData] = useState({
    entry_date: "",
    predicted_exit_date: "",
    reason: "",
    reason_type: "",
    workshop_name: "",
    maintenance_cost: "",
    notes: "",
    status: "em_andamento" as MaintenanceStatus,
  });
  const [workshopFiles, setWorkshopFiles] = useState<File[]>([]);
  const [existingWorkshopAttachments, setExistingWorkshopAttachments] = useState<WorkshopAttachment[]>([]);
  const [isUploadingWorkshopFiles, setIsUploadingWorkshopFiles] = useState(false);
  const workshopFileInputRef = useRef<HTMLInputElement>(null);
  const [isViewWorkshopAttachmentsOpen, setIsViewWorkshopAttachmentsOpen] = useState(false);
  const [viewingWorkshopAttachments, setViewingWorkshopAttachments] = useState<WorkshopAttachment[]>([]);
  const [viewingWorkshopVehicle, setViewingWorkshopVehicle] = useState("");

  // ==================== DRIVERS STATE ====================
  const [driverSearchTerm, setDriverSearchTerm] = useState("");
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [driverFormData, setDriverFormData] = useState({
    name: "",
    matricula: "",
    funcao: "",
    team_id: "",
    contato: "",
  });

  // ==================== SHARED QUERIES ====================
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, model, status, team_id, gerencia, laudo_eletrico, laudo_acustico, laudo_liner, laudo_tacografo")
        .order("plate");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

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

  const { data: supervisorTeams = [] } = useQuery({
    queryKey: ["supervisor_teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supervisor_teams").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: teamsMap = {} } = useQuery({
    queryKey: ["teams_map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name");
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach(t => { map[t.id] = t.name; });
      return map;
    },
  });

  // ==================== WORKSHOP QUERIES ====================
  const { data: workshopEntries = [], isLoading: isLoadingWorkshop } = useQuery({
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

  // ==================== DRIVERS QUERIES ====================
  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, matricula, funcao, team_id, contato")
        .order("name");
      if (error) throw error;
      return data as Driver[];
    },
  });

  // ==================== FILE UPLOAD HELPERS ====================
  const uploadVehicleFiles = async (vehicleId: string, files: File[]) => {
    const uploadedAttachments: { file_url: string; file_name: string; file_type: string }[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vehicleId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fleet-files')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('fleet-files').getPublicUrl(fileName);
      
      uploadedAttachments.push({
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
      });
    }
    
    return uploadedAttachments;
  };

  const handleVehicleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = vehicleFiles.length + existingVehicleAttachments.length + files.length;
    
    if (totalFiles > 4) {
      toast({
        title: "Limite de arquivos excedido",
        description: "Você pode anexar no máximo 4 documentos por veículo.",
        variant: "destructive",
      });
      return;
    }
    
    setVehicleFiles(prev => [...prev, ...files]);
    if (vehicleFileInputRef.current) {
      vehicleFileInputRef.current.value = '';
    }
  };

  const removeVehicleFile = (index: number) => {
    setVehicleFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingVehicleAttachment = async (attachment: VehicleAttachment) => {
    try {
      const { error } = await supabase
        .from("vehicle_attachments")
        .delete()
        .eq("id", attachment.id);
      
      if (error) throw error;
      
      setExistingVehicleAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast({ title: "Arquivo removido com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao remover arquivo", description: error.message, variant: "destructive" });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const openViewAttachments = async (vehicle: Vehicle) => {
    const { data: attachments } = await supabase
      .from("vehicle_attachments")
      .select("*")
      .eq("vehicle_id", vehicle.id);
    
    setViewingVehicleAttachments(attachments || []);
    setViewingVehiclePlate(vehicle.plate);
    setIsViewAttachmentsOpen(true);
  };

  const handleDownloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewFile = (url: string) => {
    window.open(url, '_blank');
  };

  // ==================== WORKSHOP FILE HELPERS ====================
  const uploadWorkshopFiles = async (workshopEntryId: string, files: File[]) => {
    const uploadedAttachments: { file_url: string; file_name: string; file_type: string }[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `workshop/${workshopEntryId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('fleet-files')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from('fleet-files').getPublicUrl(fileName);
      
      uploadedAttachments.push({
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
      });
    }
    
    return uploadedAttachments;
  };

  const handleWorkshopFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = workshopFiles.length + existingWorkshopAttachments.length + files.length;
    
    if (totalFiles > 4) {
      toast({
        title: "Limite de arquivos excedido",
        description: "Você pode anexar no máximo 4 documentos por entrada.",
        variant: "destructive",
      });
      return;
    }
    
    setWorkshopFiles(prev => [...prev, ...files]);
    if (workshopFileInputRef.current) {
      workshopFileInputRef.current.value = '';
    }
  };

  const removeWorkshopFile = (index: number) => {
    setWorkshopFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingWorkshopAttachment = async (attachment: WorkshopAttachment) => {
    try {
      const { error } = await supabase
        .from("workshop_attachments")
        .delete()
        .eq("id", attachment.id);
      
      if (error) throw error;
      
      setExistingWorkshopAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast({ title: "Arquivo removido com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao remover arquivo", description: error.message, variant: "destructive" });
    }
  };

  const openViewWorkshopAttachments = async (entry: WorkshopEntry) => {
    const { data: attachments } = await supabase
      .from("workshop_attachments")
      .select("*")
      .eq("workshop_entry_id", entry.id);
    
    setViewingWorkshopAttachments(attachments || []);
    setViewingWorkshopVehicle(entry.vehicles?.plate || "");
    setIsViewWorkshopAttachmentsOpen(true);
  };

  // ==================== VEHICLE MUTATIONS ====================
  const createVehicle = useMutation({
    mutationFn: async (data: typeof vehicleFormData) => {
      setIsUploadingVehicleFiles(true);
      
      const { data: vehicleData, error } = await supabase
        .from("vehicles")
        .insert({ 
          plate: data.plate, 
          model: data.model, 
          status: data.status,
          team_id: data.team_id || null,
          gerencia: data.gerencia || null,
          laudo_eletrico: data.laudo_eletrico || null,
          laudo_acustico: data.laudo_acustico || null,
          laudo_liner: data.laudo_liner || null,
          laudo_tacografo: data.laudo_tacografo || null,
        })
        .select()
        .single();
      if (error) throw error;
      
      // Upload files if any
      if (vehicleFiles.length > 0) {
        const attachments = await uploadVehicleFiles(vehicleData.id, vehicleFiles);
        for (const attachment of attachments) {
          await supabase.from("vehicle_attachments").insert({
            vehicle_id: vehicleData.id,
            ...attachment,
          });
        }
      }
      
      setIsUploadingVehicleFiles(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Veículo cadastrado com sucesso!" });
      resetVehicleForm();
    },
    onError: (error) => {
      setIsUploadingVehicleFiles(false);
      toast({ title: "Erro ao cadastrar veículo", description: error.message, variant: "destructive" });
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof vehicleFormData }) => {
      setIsUploadingVehicleFiles(true);
      
      const { error } = await supabase
        .from("vehicles")
        .update({ 
          plate: data.plate, 
          model: data.model, 
          status: data.status,
          team_id: data.team_id || null,
          gerencia: data.gerencia || null,
          laudo_eletrico: data.laudo_eletrico || null,
          laudo_acustico: data.laudo_acustico || null,
          laudo_liner: data.laudo_liner || null,
          laudo_tacografo: data.laudo_tacografo || null,
        })
        .eq("id", id);
      if (error) throw error;
      
      // Upload new files if any
      if (vehicleFiles.length > 0) {
        const attachments = await uploadVehicleFiles(id, vehicleFiles);
        for (const attachment of attachments) {
          await supabase.from("vehicle_attachments").insert({
            vehicle_id: id,
            ...attachment,
          });
        }
      }
      
      setIsUploadingVehicleFiles(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Veículo atualizado com sucesso!" });
      resetVehicleForm();
    },
    onError: (error) => {
      setIsUploadingVehicleFiles(false);
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

  const importVehicles = useMutation({
    mutationFn: async (vehiclesToImport: Array<{plate: string; model: string; year?: number; status: VehicleStatus; gerencia?: string}>) => {
      setIsImporting(true);
      const { error } = await supabase
        .from("vehicles")
        .upsert(
          vehiclesToImport.map(v => ({
            plate: v.plate,
            model: v.model,
            status: v.status,
            gerencia: v.gerencia || null,
          })),
          { onConflict: "plate" }
        );
      if (error) throw error;
      return vehiclesToImport.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: `${count} veículo(s) importado(s) com sucesso!` });
      setIsImportDialogOpen(false);
      setImportCsvData("");
      setImportPreview({ valid: [], errors: [] });
      setIsImporting(false);
    },
    onError: (error) => {
      setIsImporting(false);
      toast({ title: "Erro ao importar veículos", description: error.message, variant: "destructive" });
    },
  });

  // ==================== WORKSHOP MUTATIONS ====================
  const createWorkshopEntry = useMutation({
    mutationFn: async (data: typeof workshopFormData) => {
      if (!data.vehicle_id) throw new Error("Veículo não selecionado");
      if (!data.reason_type) throw new Error("Tipo de motivo é obrigatório");
      if (!data.workshop_name) throw new Error("Oficina é obrigatória");
      
      setIsUploadingWorkshopFiles(true);
      
      const { data: entryData, error } = await supabase.from("workshop_entries").insert({
        vehicle_id: data.vehicle_id,
        entry_date: new Date(data.entry_date).toISOString(),
        predicted_exit_date: data.predicted_exit_date ? new Date(data.predicted_exit_date).toISOString() : null,
        reason: data.reason,
        reason_type: data.reason_type,
        workshop_name: data.workshop_name,
        maintenance_cost: data.maintenance_cost ? parseFloat(data.maintenance_cost) : null,
        notes: data.notes || null,
        status: "em_andamento" as MaintenanceStatus,
      }).select().single();
      if (error) throw error;
      
      // Upload files if any
      if (workshopFiles.length > 0) {
        const attachments = await uploadWorkshopFiles(entryData.id, workshopFiles);
        for (const attachment of attachments) {
          await supabase.from("workshop_attachments").insert({
            workshop_entry_id: entryData.id,
            ...attachment,
          });
        }
      }
      
      await supabase.from("vehicles").update({ status: "oficina" }).eq("id", data.vehicle_id);
      setIsUploadingWorkshopFiles(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop_entries"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Entrada na oficina registrada!" });
      resetWorkshopForm();
    },
    onError: (error) => {
      setIsUploadingWorkshopFiles(false);
      toast({ title: "Erro ao registrar entrada", description: error.message, variant: "destructive" });
    },
  });

  const updateWorkshopEntry = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editFormData }) => {
      setIsUploadingWorkshopFiles(true);
      
      const { error } = await supabase
        .from("workshop_entries")
        .update({
          entry_date: new Date(data.entry_date).toISOString(),
          predicted_exit_date: data.predicted_exit_date ? new Date(data.predicted_exit_date).toISOString() : null,
          reason: data.reason,
          reason_type: data.reason_type || null,
          workshop_name: data.workshop_name || null,
          maintenance_cost: data.maintenance_cost ? parseFloat(data.maintenance_cost) : null,
          notes: data.notes || null,
          status: data.status,
        })
        .eq("id", id);
      if (error) throw error;
      
      // Upload new files if any
      if (workshopFiles.length > 0) {
        const attachments = await uploadWorkshopFiles(id, workshopFiles);
        for (const attachment of attachments) {
          await supabase.from("workshop_attachments").insert({
            workshop_entry_id: id,
            ...attachment,
          });
        }
      }
      
      setIsUploadingWorkshopFiles(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop_entries"] });
      toast({ title: "Entrada atualizada!" });
      setIsEditDialogOpen(false);
      setSelectedEntry(null);
      setWorkshopFiles([]);
      setExistingWorkshopAttachments([]);
    },
    onError: (error) => {
      setIsUploadingWorkshopFiles(false);
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const registerExit = useMutation({
    mutationFn: async ({ entry, exitDate, maintenanceCost }: { entry: WorkshopEntry; exitDate: string; maintenanceCost: number }) => {
      const { error } = await supabase
        .from("workshop_entries")
        .update({ 
          status: "concluida" as MaintenanceStatus, 
          exit_date: new Date(exitDate).toISOString(),
          maintenance_cost: maintenanceCost,
        })
        .eq("id", entry.id);
      if (error) throw error;
      
      await supabase.from("vehicles").update({ status: "ativo" }).eq("id", entry.vehicle_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop_entries"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Saída da oficina registrada!" });
      setIsExitDialogOpen(false);
      setSelectedEntry(null);
      setExitDate("");
      setExitMaintenanceCost("");
    },
    onError: (error) => {
      toast({ title: "Erro ao registrar saída", description: error.message, variant: "destructive" });
    },
  });

  // ==================== DRIVER MUTATIONS ====================
  const createDriver = useMutation({
    mutationFn: async (data: typeof driverFormData) => {
      const { error } = await supabase
        .from("drivers")
        .insert({ 
          name: data.name,
          matricula: data.matricula,
          funcao: data.funcao,
          team_id: data.team_id || null,
          contato: data.contato || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast({ title: "Motorista cadastrado com sucesso!" });
      resetDriverForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao cadastrar motorista", description: error.message, variant: "destructive" });
    },
  });

  const updateDriver = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof driverFormData }) => {
      const { error } = await supabase
        .from("drivers")
        .update({ 
          name: data.name,
          matricula: data.matricula,
          funcao: data.funcao,
          team_id: data.team_id || null,
          contato: data.contato || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast({ title: "Motorista atualizado com sucesso!" });
      resetDriverForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar motorista", description: error.message, variant: "destructive" });
    },
  });

  const deleteDriver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast({ title: "Motorista removido com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover motorista", description: error.message, variant: "destructive" });
    },
  });

  // ==================== HELPERS ====================
  const getTeamName = (teamId: string | null) => {
    if (!teamId) return null;
    return teamsMap[teamId] || null;
  };

  const getSupervisorName = (teamId: string | null) => {
    if (!teamId) return null;
    const assignment = supervisorTeams.find((st) => st.team_id === teamId);
    if (!assignment) return null;
    const profile = profiles.find((p) => p.id === assignment.supervisor_id);
    return profile?.name || null;
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

  // ==================== FILTERED DATA ====================
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = 
      v.plate.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
      (getTeamName(v.team_id)?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) || false);
    const matchesStatus = filterStatus === "all" || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredWorkshopVehicles = useMemo(() => {
    if (!plateSearch) return vehicles;
    return vehicles.filter(v => 
      v.plate.toLowerCase().includes(plateSearch.toLowerCase()) ||
      v.model.toLowerCase().includes(plateSearch.toLowerCase())
    );
  }, [vehicles, plateSearch]);

  const selectedVehicle = vehicles.find(v => v.id === workshopFormData.vehicle_id);

  const activeEntries = workshopEntries.filter((e) => e.status !== "concluida");
  const completedEntries = workshopEntries.filter((e) => e.status === "concluida");

  const filteredDrivers = drivers.filter((d) =>
    d.name.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
    d.matricula.includes(driverSearchTerm) ||
    (getTeamName(d.team_id)?.toLowerCase().includes(driverSearchTerm.toLowerCase()) || false)
  );

  // ==================== CSV COLUMNS ====================
  const vehicleCsvColumns: CsvColumn[] = [
    { key: "plate", header: "Placa" },
    { key: "model", header: "Modelo" },
    { key: "gerencia", header: "Gerência", format: (v) => v || "-" },
    { key: "status", header: "Status", format: (v) => vehicleStatusConfig[v as VehicleStatus]?.label || v },
    { key: "team_id", header: "Equipe", format: (v) => getTeamName(v) || "-" },
    { key: "team_id", header: "Supervisor", format: (v) => getSupervisorName(v) || "-" },
  ];

  const workshopCsvColumns: CsvColumn[] = [
    { key: "vehicles", header: "Placa", format: (v) => v?.plate || "-" },
    { key: "vehicles", header: "Modelo", format: (v) => v?.model || "-" },
    { key: "vehicles", header: "Equipe", format: (v) => getTeamName(v?.team_id || null) || "-" },
    { key: "reason", header: "Motivo" },
    { key: "entry_date", header: "Entrada", format: (v) => formatDateTime(v) },
    { key: "predicted_exit_date", header: "Previsão Saída", format: (v) => formatDateTime(v) },
    { key: "exit_date", header: "Saída", format: (v) => formatDateTime(v) },
    { key: "status", header: "Status", format: (v) => workshopStatusConfig[v as MaintenanceStatus]?.label || v },
    { key: "notes", header: "Observações", format: (v) => v || "-" },
  ];

  const driversCsvColumns: CsvColumn[] = [
    { key: "name", header: "Nome" },
    { key: "matricula", header: "Matrícula" },
    { key: "funcao", header: "Função" },
    { key: "team_id", header: "Equipe", format: (v) => getTeamName(v) || "-" },
    { key: "contato", header: "Contato", format: (v) => v || "-" },
  ];

  // ==================== HANDLERS ====================
  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicle) {
      updateVehicle.mutate({ id: editingVehicle.id, data: vehicleFormData });
    } else {
      createVehicle.mutate(vehicleFormData);
    }
  };

  const handleEditVehicle = async (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      plate: vehicle.plate,
      model: vehicle.model,
      team_id: vehicle.team_id || "",
      status: vehicle.status,
      gerencia: vehicle.gerencia || "",
      laudo_eletrico: vehicle.laudo_eletrico || "",
      laudo_acustico: vehicle.laudo_acustico || "",
      laudo_liner: vehicle.laudo_liner || "",
      laudo_tacografo: vehicle.laudo_tacografo || "",
    });
    // Load existing attachments
    const { data: attachments } = await supabase
      .from("vehicle_attachments")
      .select("*")
      .eq("vehicle_id", vehicle.id);
    setExistingVehicleAttachments(attachments || []);
    setVehicleFiles([]);
    setIsVehicleDialogOpen(true);
  };

  const handleDeleteVehicle = (id: string) => {
    if (confirm("Tem certeza que deseja remover este veículo?")) {
      deleteVehicle.mutate(id);
    }
  };

  // ==================== IMPORT CSV HANDLERS ====================
  const parseImportCsv = (csvText: string) => {
    const lines = csvText.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      setImportPreview({ valid: [], errors: ["Arquivo deve conter cabeçalho e ao menos uma linha de dados."] });
      return;
    }

    const validStatuses: VehicleStatus[] = ["ativo", "manutencao", "reserva", "oficina", "mobilizar"];
    const validGerencias = ["C&M", "STC Comercial", "STC Emergencial", "STC Corte e religa", "Perdas", "Âncora Comercial"];
    
    const valid: Array<{plate: string; model: string; year?: number; status: VehicleStatus; gerencia?: string}> = [];
    const errors: string[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";").map(c => c.trim());
      const [plate, model, yearStr, statusStr, gerencia] = cols;
      
      if (!plate || !model) {
        errors.push(`Linha ${i + 1}: Placa e Modelo são obrigatórios.`);
        continue;
      }

      const status = (statusStr?.toLowerCase() || "ativo") as VehicleStatus;
      if (!validStatuses.includes(status)) {
        errors.push(`Linha ${i + 1}: Status "${statusStr}" inválido. Use: ativo, manutencao, reserva, oficina ou mobilizar.`);
        continue;
      }

      if (gerencia && !validGerencias.includes(gerencia)) {
        errors.push(`Linha ${i + 1}: Gerência "${gerencia}" inválida.`);
        continue;
      }

      const year = yearStr ? parseInt(yearStr, 10) : undefined;
      if (yearStr && (isNaN(year!) || year! < 1900 || year! > new Date().getFullYear() + 1)) {
        errors.push(`Linha ${i + 1}: Ano "${yearStr}" inválido.`);
        continue;
      }

      valid.push({ plate: plate.toUpperCase(), model, year, status, gerencia: gerencia || undefined });
    }

    setImportPreview({ valid, errors });
  };

  const handleImportCsvChange = (value: string) => {
    setImportCsvData(value);
    if (value.trim()) {
      parseImportCsv(value);
    } else {
      setImportPreview({ valid: [], errors: [] });
    }
  };

  const handleImportSubmit = () => {
    if (importPreview.valid.length === 0) {
      toast({ title: "Nenhum veículo válido para importar", variant: "destructive" });
      return;
    }
    importVehicles.mutate(importPreview.valid);
  };

  const downloadCsvTemplate = () => {
    const template = "Placa;Modelo;Ano;Status;Gerência\nABC-1234;FIAT STRADA;2023;ativo;C&M\nXYZ-5678;VW SAVEIRO;2022;reserva;STC Comercial";
    // Add BOM for UTF-8 encoding (Excel compatibility)
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao_veiculos.csv";
    link.click();
  };

  const resetVehicleForm = () => {
    setVehicleFormData({ 
      plate: "", 
      model: "", 
      team_id: "", 
      status: "ativo", 
      gerencia: "",
      laudo_eletrico: "",
      laudo_acustico: "",
      laudo_liner: "",
      laudo_tacografo: "",
    });
    setEditingVehicle(null);
    setVehicleFiles([]);
    setExistingVehicleAttachments([]);
    setIsVehicleDialogOpen(false);
  };

  const handleWorkshopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWorkshopEntry.mutate(workshopFormData);
  };

  const handleExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitMaintenanceCost || parseFloat(exitMaintenanceCost) < 0) {
      toast({
        title: "Valor da manutenção obrigatório",
        description: "É necessário informar o valor da manutenção para registrar a saída do veículo.",
        variant: "destructive",
      });
      return;
    }
    if (selectedEntry && exitDate) {
      registerExit.mutate({ 
        entry: selectedEntry, 
        exitDate, 
        maintenanceCost: parseFloat(exitMaintenanceCost) 
      });
    }
  };

  const openExitDialog = (entry: WorkshopEntry) => {
    setSelectedEntry(entry);
    setExitDate(new Date().toISOString().split("T")[0]);
    setExitMaintenanceCost(entry.maintenance_cost?.toString() || "");
    setIsExitDialogOpen(true);
  };

  const openEditDialog = async (entry: WorkshopEntry) => {
    setSelectedEntry(entry);
    setEditFormData({
      entry_date: new Date(entry.entry_date).toISOString().split("T")[0],
      predicted_exit_date: entry.predicted_exit_date ? new Date(entry.predicted_exit_date).toISOString().split("T")[0] : "",
      reason: entry.reason,
      reason_type: entry.reason_type || "",
      workshop_name: entry.workshop_name || "",
      maintenance_cost: entry.maintenance_cost?.toString() || "",
      notes: entry.notes || "",
      status: entry.status,
    });
    // Load existing attachments
    const { data: attachments } = await supabase
      .from("workshop_attachments")
      .select("*")
      .eq("workshop_entry_id", entry.id);
    setExistingWorkshopAttachments(attachments || []);
    setWorkshopFiles([]);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntry) {
      updateWorkshopEntry.mutate({ id: selectedEntry.id, data: editFormData });
    }
  };

  const resetWorkshopForm = () => {
    setWorkshopFormData({ 
      vehicle_id: "", 
      entry_date: new Date().toISOString().split("T")[0],
      predicted_exit_date: "",
      reason: "",
      reason_type: "",
      workshop_name: "",
      maintenance_cost: "",
      notes: "",
    });
    setWorkshopFiles([]);
    setExistingWorkshopAttachments([]);
    setPlateSearch("");
    setIsWorkshopDialogOpen(false);
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDriver) {
      updateDriver.mutate({ id: editingDriver.id, data: driverFormData });
    } else {
      createDriver.mutate(driverFormData);
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver);
    setDriverFormData({
      name: driver.name,
      matricula: driver.matricula,
      funcao: driver.funcao,
      team_id: driver.team_id || "",
      contato: driver.contato || "",
    });
    setIsDriverDialogOpen(true);
  };

  const handleDeleteDriver = (id: string) => {
    if (confirm("Tem certeza que deseja remover este motorista?")) {
      deleteDriver.mutate(id);
    }
  };

  const resetDriverForm = () => {
    setDriverFormData({ name: "", matricula: "", funcao: "", team_id: "", contato: "" });
    setEditingDriver(null);
    setIsDriverDialogOpen(false);
  };

  // ==================== WORKSHOP ENTRY CARD ====================
  const EntryCard = ({ entry }: { entry: WorkshopEntry }) => {
    const status = workshopStatusConfig[entry.status];
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
                {getTeamName(entry.vehicles?.team_id || null) || "Sem equipe"}
              </p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium", status.className)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>
        
        {/* Reason Type and Workshop badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {entry.reason_type && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-700">
              {entry.reason_type}
            </span>
          )}
          {entry.workshop_name && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-700">
              {entry.workshop_name}
            </span>
          )}
        </div>
        
        <p className="text-sm text-foreground mb-2">{entry.reason}</p>
        {entry.notes && (
          <p className="text-sm text-muted-foreground mb-3">{entry.notes}</p>
        )}
        
        {entry.maintenance_cost !== null && entry.maintenance_cost > 0 && (
          <p className="text-sm font-medium text-green-600 mb-3">
            Valor: R$ {entry.maintenance_cost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
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
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => openViewWorkshopAttachments(entry)} title="Ver anexos">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEditDialog(entry)} className="gap-1">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            </div>
            {entry.status !== "concluida" && (
              <Button size="sm" onClick={() => openExitDialog(entry)} className="gap-1">
                <LogOut className="h-4 w-4" />
                Registrar Saída
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Frotas</h1>
        <p className="text-muted-foreground">Gerencie veículos, oficina e motoristas</p>
      </div>

      <Tabs defaultValue="vehicles" className="animate-fade-in">
        <TabsList className="mb-6">
          <TabsTrigger value="vehicles" className="gap-2">
            <Car className="h-4 w-4" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="workshop" className="gap-2">
            <Building className="h-4 w-4" />
            Oficina
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-2">
            <User className="h-4 w-4" />
            Motoristas
          </TabsTrigger>
          <TabsTrigger value="indicators" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Indicadores de Frotas
          </TabsTrigger>
          <TabsTrigger value="laudos" className="gap-2">
            <FileWarning className="h-4 w-4" />
            Acompanhamento de Laudos
          </TabsTrigger>
        </TabsList>

        {/* ==================== VEHICLES TAB ==================== */}
        <TabsContent value="vehicles">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa, modelo ou equipe..."
                value={vehicleSearchTerm}
                onChange={(e) => setVehicleSearchTerm(e.target.value)}
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
            <ExportButton
              data={filteredVehicles}
              filename={`veiculos-${new Date().toISOString().split('T')[0]}`}
              columns={vehicleCsvColumns}
            />
            {isAdmin && (
              <>
                {/* Import Dialog */}
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Importar Veículos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Importar Veículos via CSV</DialogTitle>
                      <DialogDescription>
                        Cole os dados do CSV abaixo ou faça upload de um arquivo. O separador deve ser ponto e vírgula (;).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Formato esperado:</Label>
                        <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-1">
                          <Download className="h-4 w-4" />
                          Baixar Modelo
                        </Button>
                      </div>
                      <div className="bg-muted p-3 rounded-lg text-sm font-mono">
                        Placa;Modelo;Ano;Status;Gerência
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="importCsv">Dados CSV</Label>
                        <Textarea
                          id="importCsv"
                          value={importCsvData}
                          onChange={(e) => handleImportCsvChange(e.target.value)}
                          placeholder="Cole os dados do CSV aqui..."
                          className="min-h-[150px] font-mono text-sm"
                        />
                      </div>
                      
                      {/* Preview Section */}
                      {(importPreview.valid.length > 0 || importPreview.errors.length > 0) && (
                        <div className="space-y-3">
                          {importPreview.valid.length > 0 && (
                            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <p className="text-sm font-medium text-green-700 mb-2">
                                ✓ {importPreview.valid.length} veículo(s) válido(s) para importação
                              </p>
                              <div className="max-h-[120px] overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="py-1 text-xs">Placa</TableHead>
                                      <TableHead className="py-1 text-xs">Modelo</TableHead>
                                      <TableHead className="py-1 text-xs">Status</TableHead>
                                      <TableHead className="py-1 text-xs">Gerência</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {importPreview.valid.slice(0, 5).map((v, i) => (
                                      <TableRow key={i}>
                                        <TableCell className="py-1 text-xs">{v.plate}</TableCell>
                                        <TableCell className="py-1 text-xs">{v.model}</TableCell>
                                        <TableCell className="py-1 text-xs">{vehicleStatusConfig[v.status]?.label}</TableCell>
                                        <TableCell className="py-1 text-xs">{v.gerencia || "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                {importPreview.valid.length > 5 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    ... e mais {importPreview.valid.length - 5} veículo(s)
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {importPreview.errors.length > 0 && (
                            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                              <p className="text-sm font-medium text-destructive mb-2">
                                ✗ {importPreview.errors.length} erro(s) encontrado(s)
                              </p>
                              <ul className="text-xs text-destructive space-y-1 max-h-[80px] overflow-y-auto">
                                {importPreview.errors.map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => { setIsImportDialogOpen(false); setImportCsvData(""); setImportPreview({ valid: [], errors: [] }); }}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleImportSubmit} 
                          disabled={importPreview.valid.length === 0 || isImporting}
                          className="gap-2"
                        >
                          {isImporting ? "Importando..." : `Importar ${importPreview.valid.length} Veículo(s)`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Create Vehicle Dialog */}
                <Dialog open={isVehicleDialogOpen} onOpenChange={(open) => { if (!open) resetVehicleForm(); else setIsVehicleDialogOpen(true); }}>
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
                  <form onSubmit={handleVehicleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="plate">Placa</Label>
                        <Input
                          id="plate"
                          value={vehicleFormData.plate}
                          onChange={(e) => setVehicleFormData({ ...vehicleFormData, plate: e.target.value })}
                          placeholder="ABC-1234"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="model">Modelo</Label>
                        <Input
                          id="model"
                          value={vehicleFormData.model}
                          onChange={(e) => setVehicleFormData({ ...vehicleFormData, model: e.target.value })}
                          placeholder="Fiat Strada"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="team">Equipe</Label>
                        <Select
                          value={vehicleFormData.team_id || "none"}
                          onValueChange={(value) => setVehicleFormData({ ...vehicleFormData, team_id: value === "none" ? "" : value })}
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
                        <Label htmlFor="gerencia">Gerência</Label>
                        <Select
                          value={vehicleFormData.gerencia || "none"}
                          onValueChange={(value) => setVehicleFormData({ ...vehicleFormData, gerencia: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a gerência" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {GERENCIAS.map((gerencia) => (
                              <SelectItem key={gerencia} value={gerencia}>
                                {gerencia}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={vehicleFormData.status}
                        onValueChange={(value: VehicleStatus) => setVehicleFormData({ ...vehicleFormData, status: value })}
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
                    
                    {/* Laudo Date Fields */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-muted-foreground" />
                        Validade dos Laudos
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="laudo_eletrico" className="text-xs text-muted-foreground">Laudo Elétrico</Label>
                          <Input
                            id="laudo_eletrico"
                            type="date"
                            value={vehicleFormData.laudo_eletrico}
                            onChange={(e) => setVehicleFormData({ ...vehicleFormData, laudo_eletrico: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="laudo_acustico" className="text-xs text-muted-foreground">Laudo Acústico</Label>
                          <Input
                            id="laudo_acustico"
                            type="date"
                            value={vehicleFormData.laudo_acustico}
                            onChange={(e) => setVehicleFormData({ ...vehicleFormData, laudo_acustico: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="laudo_liner" className="text-xs text-muted-foreground">Laudo Liner</Label>
                          <Input
                            id="laudo_liner"
                            type="date"
                            value={vehicleFormData.laudo_liner}
                            onChange={(e) => setVehicleFormData({ ...vehicleFormData, laudo_liner: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="laudo_tacografo" className="text-xs text-muted-foreground">Laudo Tacógrafo</Label>
                          <Input
                            id="laudo_tacografo"
                            type="date"
                            value={vehicleFormData.laudo_tacografo}
                            onChange={(e) => setVehicleFormData({ ...vehicleFormData, laudo_tacografo: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* File Upload Section */}
                    <div className="space-y-2">
                      <Label>Documentos/Fotos/Vídeos (máx. 4)</Label>
                      <input
                        ref={vehicleFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        onChange={handleVehicleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => vehicleFileInputRef.current?.click()}
                        disabled={vehicleFiles.length + existingVehicleAttachments.length >= 4}
                      >
                        <Upload className="h-4 w-4" />
                        Anexar Arquivos ({vehicleFiles.length + existingVehicleAttachments.length}/4)
                      </Button>
                      
                      {/* Existing attachments */}
                      {existingVehicleAttachments.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <p className="text-xs text-muted-foreground">Arquivos existentes:</p>
                          {existingVehicleAttachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                {getFileIcon(attachment.file_type)}
                                <span className="text-sm truncate">{attachment.file_name}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleViewFile(attachment.file_url)}
                                  title="Visualizar"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleDownloadFile(attachment.file_url, attachment.file_name)}
                                  title="Baixar"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeExistingVehicleAttachment(attachment)}
                                  title="Remover"
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* New files to upload */}
                      {vehicleFiles.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <p className="text-xs text-muted-foreground">Novos arquivos:</p>
                          {vehicleFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                              <div className="flex items-center gap-2 overflow-hidden">
                                {getFileIcon(file.type)}
                                <span className="text-sm truncate">{file.name}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removeVehicleFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetVehicleForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={createVehicle.isPending || updateVehicle.isPending || isUploadingVehicleFiles}>
                        {isUploadingVehicleFiles ? "Enviando arquivos..." : editingVehicle ? "Atualizar" : "Cadastrar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Placa</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Gerência</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => {
                  const status = vehicleStatusConfig[vehicle.status] || { label: vehicle.status, className: "bg-gray-500/20 text-gray-700" };
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
                        {vehicle.gerencia || <span className="text-muted-foreground">-</span>}
                      </TableCell>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openViewAttachments(vehicle)} title="Ver anexos">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditVehicle(vehicle)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteVehicle(vehicle.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {isLoadingVehicles && (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            )}
            {!isLoadingVehicles && filteredVehicles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum veículo encontrado
              </div>
            )}
          </div>

          {/* View Attachments Dialog */}
          <Dialog open={isViewAttachmentsOpen} onOpenChange={setIsViewAttachmentsOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  Anexos - {viewingVehiclePlate}
                </DialogTitle>
                <DialogDescription>
                  Visualize e baixe os documentos anexados a este veículo
                </DialogDescription>
              </DialogHeader>
              {viewingVehicleAttachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum anexo encontrado para este veículo
                </div>
              ) : (
                <div className="space-y-3">
                  {viewingVehicleAttachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getFileIcon(attachment.file_type)}
                        </div>
                        <span className="text-sm font-medium truncate">{attachment.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleViewFile(attachment.file_url)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleDownloadFile(attachment.file_url, attachment.file_name)}
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ==================== WORKSHOP TAB ==================== */}
        <TabsContent value="workshop">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por veículo..."
                value={workshopSearchTerm}
                onChange={(e) => setWorkshopSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isWorkshopDialogOpen} onOpenChange={setIsWorkshopDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Entrada
                </Button>
              </DialogTrigger>
              <ExportButton
                data={workshopEntries}
                filename={`oficina-${new Date().toISOString().split('T')[0]}`}
                columns={workshopCsvColumns}
              />
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Entrada na Oficina</DialogTitle>
                  <DialogDescription>Selecione o veículo e informe os dados da entrada</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleWorkshopSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Placa do Veículo</Label>
                    <Popover open={plateSearchOpen} onOpenChange={setPlateSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={plateSearchOpen}
                          className="w-full justify-between"
                        >
                          {selectedVehicle 
                            ? `${selectedVehicle.plate} - ${selectedVehicle.model}`
                            : "Buscar por placa..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Digite a placa..." 
                            value={plateSearch}
                            onValueChange={setPlateSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                            <CommandGroup>
                              {filteredWorkshopVehicles.map((vehicle) => (
                                <CommandItem
                                  key={vehicle.id}
                                  value={vehicle.plate}
                                  onSelect={() => {
                                    setWorkshopFormData({ ...workshopFormData, vehicle_id: vehicle.id });
                                    setPlateSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      workshopFormData.vehicle_id === vehicle.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {vehicle.plate} - {vehicle.model}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entry_date">Data de Entrada</Label>
                      <Input
                        id="entry_date"
                        type="date"
                        value={workshopFormData.entry_date}
                        onChange={(e) => setWorkshopFormData({ ...workshopFormData, entry_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="predicted_exit_date">Previsão de Saída</Label>
                      <Input
                        id="predicted_exit_date"
                        type="date"
                        value={workshopFormData.predicted_exit_date}
                        onChange={(e) => setWorkshopFormData({ ...workshopFormData, predicted_exit_date: e.target.value })}
                        min={workshopFormData.entry_date}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reason_type">Tipo de Motivo *</Label>
                      <Select
                        value={workshopFormData.reason_type}
                        onValueChange={(value) => setWorkshopFormData({ ...workshopFormData, reason_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {REASON_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workshop_name">Oficina *</Label>
                      <Select
                        value={workshopFormData.workshop_name}
                        onValueChange={(value) => setWorkshopFormData({ ...workshopFormData, workshop_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSHOP_NAMES.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Descrição do Problema</Label>
                    <Input
                      id="reason"
                      value={workshopFormData.reason}
                      onChange={(e) => setWorkshopFormData({ ...workshopFormData, reason: e.target.value })}
                      placeholder="Descreva o problema..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance_cost">Valor da Manutenção (opcional)</Label>
                    <Input
                      id="maintenance_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={workshopFormData.maintenance_cost}
                      onChange={(e) => setWorkshopFormData({ ...workshopFormData, maintenance_cost: e.target.value })}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea
                      id="notes"
                      value={workshopFormData.notes}
                      onChange={(e) => setWorkshopFormData({ ...workshopFormData, notes: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={2}
                    />
                  </div>
                  
                  {/* File Upload Section */}
                  <div className="space-y-2">
                    <Label>Anexos (máx. 4)</Label>
                    <input
                      ref={workshopFileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      onChange={handleWorkshopFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => workshopFileInputRef.current?.click()}
                      disabled={workshopFiles.length >= 4}
                    >
                      <Upload className="h-4 w-4" />
                      Anexar Arquivos ({workshopFiles.length}/4)
                    </Button>
                    
                    {workshopFiles.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {workshopFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                              {getFileIcon(file.type)}
                              <span className="text-sm truncate">{file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => removeWorkshopFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={resetWorkshopForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createWorkshopEntry.isPending || isUploadingWorkshopFiles || !workshopFormData.vehicle_id || !workshopFormData.reason_type || !workshopFormData.workshop_name}>
                      {isUploadingWorkshopFiles ? "Enviando..." : "Registrar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Entrada</DialogTitle>
                  <DialogDescription>
                    {selectedEntry && (
                      <>Veículo: {selectedEntry.vehicles?.plate} - {selectedEntry.vehicles?.model}</>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_entry_date">Data de Entrada</Label>
                      <Input
                        id="edit_entry_date"
                        type="date"
                        value={editFormData.entry_date}
                        onChange={(e) => setEditFormData({ ...editFormData, entry_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_predicted_exit_date">Previsão de Saída</Label>
                      <Input
                        id="edit_predicted_exit_date"
                        type="date"
                        value={editFormData.predicted_exit_date}
                        onChange={(e) => setEditFormData({ ...editFormData, predicted_exit_date: e.target.value })}
                        min={editFormData.entry_date}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_reason_type">Tipo de Motivo</Label>
                      <Select
                        value={editFormData.reason_type}
                        onValueChange={(value) => setEditFormData({ ...editFormData, reason_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {REASON_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_workshop_name">Oficina</Label>
                      <Select
                        value={editFormData.workshop_name}
                        onValueChange={(value) => setEditFormData({ ...editFormData, workshop_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKSHOP_NAMES.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_reason">Descrição do Problema</Label>
                    <Input
                      id="edit_reason"
                      value={editFormData.reason}
                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                      placeholder="Descreva o problema..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_maintenance_cost">Valor da Manutenção</Label>
                    <Input
                      id="edit_maintenance_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.maintenance_cost}
                      onChange={(e) => setEditFormData({ ...editFormData, maintenance_cost: e.target.value })}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_notes">Observações (opcional)</Label>
                    <Textarea
                      id="edit_notes"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={2}
                    />
                  </div>
                  
                  {/* File Upload Section */}
                  <div className="space-y-2">
                    <Label>Anexos (máx. 4)</Label>
                    <input
                      ref={workshopFileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      onChange={handleWorkshopFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => workshopFileInputRef.current?.click()}
                      disabled={workshopFiles.length + existingWorkshopAttachments.length >= 4}
                    >
                      <Upload className="h-4 w-4" />
                      Anexar Arquivos ({workshopFiles.length + existingWorkshopAttachments.length}/4)
                    </Button>
                    
                    {/* Existing attachments */}
                    {existingWorkshopAttachments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-muted-foreground">Arquivos existentes:</p>
                        {existingWorkshopAttachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                              {getFileIcon(attachment.file_type)}
                              <span className="text-sm truncate">{attachment.file_name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleViewFile(attachment.file_url)}
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDownloadFile(attachment.file_url, attachment.file_name)}
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeExistingWorkshopAttachment(attachment)}
                                title="Remover"
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* New files to upload */}
                    {workshopFiles.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-muted-foreground">Novos arquivos:</p>
                        {workshopFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                              {getFileIcon(file.type)}
                              <span className="text-sm truncate">{file.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => removeWorkshopFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={updateWorkshopEntry.isPending || isUploadingWorkshopFiles}>
                      {isUploadingWorkshopFiles ? "Enviando..." : "Salvar"}
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
                  <div className="space-y-2">
                    <Label htmlFor="exit_maintenance_cost">Valor da Manutenção *</Label>
                    <Input
                      id="exit_maintenance_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={exitMaintenanceCost}
                      onChange={(e) => setExitMaintenanceCost(e.target.value)}
                      placeholder="R$ 0,00"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      O valor da manutenção é obrigatório para registrar a saída
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsExitDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={registerExit.isPending || !exitDate || !exitMaintenanceCost}>
                      Confirmar Saída
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* View Workshop Attachments Dialog */}
            <Dialog open={isViewWorkshopAttachmentsOpen} onOpenChange={setIsViewWorkshopAttachmentsOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Anexos - {viewingWorkshopVehicle}
                  </DialogTitle>
                  <DialogDescription>
                    Visualize e baixe os documentos anexados a esta entrada
                  </DialogDescription>
                </DialogHeader>
                {viewingWorkshopAttachments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum anexo encontrado para esta entrada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {viewingWorkshopAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-primary/10">
                            {getFileIcon(attachment.file_type)}
                          </div>
                          <span className="text-sm font-medium truncate">{attachment.file_name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleViewFile(attachment.file_url)}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleDownloadFile(attachment.file_url, attachment.file_name)}
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Workshop Sub-tabs */}
          <Tabs defaultValue="active">
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
        </TabsContent>

        {/* ==================== DRIVERS TAB ==================== */}
        <TabsContent value="drivers">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, matrícula ou equipe..."
                value={driverSearchTerm}
                onChange={(e) => setDriverSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ExportButton
              data={filteredDrivers}
              filename={`motoristas-${new Date().toISOString().split('T')[0]}`}
              columns={driversCsvColumns}
            />
            {isAdmin && (
              <Dialog open={isDriverDialogOpen} onOpenChange={(open) => { if (!open) resetDriverForm(); else setIsDriverDialogOpen(true); }}>
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
                  <form onSubmit={handleDriverSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="driver_name">Nome</Label>
                        <Input
                          id="driver_name"
                          value={driverFormData.name}
                          onChange={(e) => setDriverFormData({ ...driverFormData, name: e.target.value })}
                          placeholder="Nome completo"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver_matricula">Matrícula</Label>
                        <Input
                          id="driver_matricula"
                          value={driverFormData.matricula}
                          onChange={(e) => setDriverFormData({ ...driverFormData, matricula: e.target.value })}
                          placeholder="001234"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="driver_funcao">Função</Label>
                        <Input
                          id="driver_funcao"
                          value={driverFormData.funcao}
                          onChange={(e) => setDriverFormData({ ...driverFormData, funcao: e.target.value })}
                          placeholder="Motorista"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="driver_team">Equipe</Label>
                        <Select
                          value={driverFormData.team_id || "none"}
                          onValueChange={(value) => setDriverFormData({ ...driverFormData, team_id: value === "none" ? "" : value })}
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver_contato">Contato</Label>
                      <Input
                        id="driver_contato"
                        value={driverFormData.contato}
                        onChange={(e) => setDriverFormData({ ...driverFormData, contato: e.target.value })}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetDriverForm}>Cancelar</Button>
                      <Button type="submit" disabled={createDriver.isPending || updateDriver.isPending}>
                        {editingDriver ? "Atualizar" : "Cadastrar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
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
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
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
                    <TableCell>
                      {getTeamName(driver.team_id) || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {driver.contato ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {driver.contato}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditDriver(driver)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteDriver(driver.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isLoadingDrivers && (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            )}
            {!isLoadingDrivers && filteredDrivers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum motorista encontrado
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== INDICATORS TAB ==================== */}
        <TabsContent value="indicators">
          <FleetIndicatorsTab />
        </TabsContent>

        {/* ==================== LAUDOS TAB ==================== */}
        <TabsContent value="laudos">
          <LaudosTrackingTab />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
};

export default FleetManagement;
