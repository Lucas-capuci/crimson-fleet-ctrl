import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Search, Trash2, Save, Check, ChevronsUpDown, CalendarIcon, Users, BarChart3, X, MapPin, Pencil, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Team {
  id: string;
  name: string;
}

interface ServiceCatalog {
  id: string;
  up: string;
  service_number: string;
  description: string;
  unit: string;
  gross_price: number;
}

interface OSETrip {
  id: string;
  ose_id: string;
  team_id: string;
  date: string;
  team?: Team;
  items?: OSEItem[];
}

interface OSE {
  id: string;
  ose_number: string;
  description: string | null;
  status: string;
  total_value: number;
  created_by: string;
  created_at: string;
  trips?: OSETrip[];
}

interface OSEItem {
  id: string;
  ose_id: string;
  trip_id: string | null;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  service?: ServiceCatalog;
}

interface AnalyticItem {
  up: string;
  description: string;
  unit: string;
  totalQuantity: number;
  unitPrice: number;
  totalValue: number;
}

// Cart item for trips
interface TripCartItem {
  team: Team;
  date: Date;
  services: { service: ServiceCatalog; quantity: number }[];
}

export default function Budget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("oses");
  const [isNewOseDialogOpen, setIsNewOseDialogOpen] = useState(false);
  const [isAddTripDialogOpen, setIsAddTripDialogOpen] = useState(false);
  const [selectedOse, setSelectedOse] = useState<OSE | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<OSETrip | null>(null);
  const [oseFilter, setOseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(undefined);
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(undefined);
  
  // New OSE form
  const [newOseNumber, setNewOseNumber] = useState("");
  const [newOseDescription, setNewOseDescription] = useState("");
  
  // Trip cart for new OSE
  const [tripCart, setTripCart] = useState<TripCartItem[]>([]);
  const [currentTripTeam, setCurrentTripTeam] = useState<Team | null>(null);
  const [currentTripDate, setCurrentTripDate] = useState<Date | undefined>(undefined);
  const [currentTripServices, setCurrentTripServices] = useState<{ service: ServiceCatalog; quantity: number }[]>([]);
  const [teamSearchOpen, setTeamSearchOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
  // Add trip to existing OSE
  const [newTripTeam, setNewTripTeam] = useState<Team | null>(null);
  const [newTripDate, setNewTripDate] = useState<Date | undefined>(undefined);
  const [newTripServices, setNewTripServices] = useState<{ service: ServiceCatalog; quantity: number }[]>([]);
  
  // Add service form
  const [serviceSearchOpen, setServiceSearchOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCatalog | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [upSearch, setUpSearch] = useState("");
  
  // Edit OSE
  const [isEditOseDialogOpen, setIsEditOseDialogOpen] = useState(false);
  const [editOseNumber, setEditOseNumber] = useState("");
  const [editOseDescription, setEditOseDescription] = useState("");
  const [editOseStatus, setEditOseStatus] = useState("");
  
  // Import catalog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState("");

  // Fetch services catalog
  const { data: services = [] } = useQuery({
    queryKey: ["service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_catalog")
        .select("*")
        .order("up");
      if (error) throw error;
      return data as ServiceCatalog[];
    },
  });

  // Fetch teams
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

  // Fetch OSEs with trips
  const { data: oses = [] } = useQuery({
    queryKey: ["oses"],
    queryFn: async () => {
      const { data: osesData, error } = await supabase
        .from("oses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch trips for each OSE
      const osesWithTrips = await Promise.all(
        (osesData || []).map(async (ose) => {
          const { data: tripsData } = await supabase
            .from("ose_trips")
            .select("*, teams:team_id(id, name)")
            .eq("ose_id", ose.id)
            .order("date");

          return {
            ...ose,
            trips: (tripsData || []).map((t: any) => ({
              ...t,
              team: t.teams,
            })),
          } as OSE;
        })
      );

      return osesWithTrips;
    },
  });

  // Fetch items for selected OSE (grouped by trip)
  const { data: oseTripsWithItems = [] } = useQuery({
    queryKey: ["ose-trips-items", selectedOse?.id],
    queryFn: async () => {
      if (!selectedOse) return [];
      
      const { data: trips } = await supabase
        .from("ose_trips")
        .select("*, teams:team_id(id, name)")
        .eq("ose_id", selectedOse.id)
        .order("date");

      if (!trips) return [];

      const tripsWithItems = await Promise.all(
        trips.map(async (trip: any) => {
          const { data: items } = await supabase
            .from("ose_items")
            .select("*, service:service_id(*)")
            .eq("trip_id", trip.id);

          return {
            ...trip,
            team: trip.teams,
            items: items || [],
          } as OSETrip;
        })
      );

      return tripsWithItems;
    },
    enabled: !!selectedOse,
  });

  // Fetch all items for analytics
  const { data: allOseItems = [] } = useQuery({
    queryKey: ["all-ose-items-analytics", teamFilter, dateFromFilter, dateToFilter],
    queryFn: async () => {
      let query = supabase
        .from("ose_items")
        .select("*, service:service_id(*), trip:trip_id(*, teams:team_id(id, name))");

      const { data, error } = await query;
      if (error) throw error;

      // Filter by team and date
      return (data || []).filter((item: any) => {
        if (!item.trip) return false;
        
        if (teamFilter !== "all" && item.trip.team_id !== teamFilter) return false;
        
        if (dateFromFilter || dateToFilter) {
          const tripDate = new Date(item.trip.date);
          if (dateFromFilter && tripDate < dateFromFilter) return false;
          if (dateToFilter && tripDate > dateToFilter) return false;
        }
        
        return true;
      });
    },
    enabled: activeTab === "analitico",
  });

  // Filtered services for search
  const filteredServices = useMemo(() => {
    if (!upSearch) return services.slice(0, 50);
    return services.filter(
      (s) =>
        s.up.toLowerCase().includes(upSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(upSearch.toLowerCase())
    ).slice(0, 50);
  }, [services, upSearch]);

  // Filtered OSEs
  const filteredOses = useMemo(() => {
    return oses.filter((ose) => {
      const matchesSearch = ose.ose_number.toLowerCase().includes(oseFilter.toLowerCase()) ||
        (ose.description?.toLowerCase().includes(oseFilter.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === "all" || ose.status === statusFilter;
      
      let matchesTeam = teamFilter === "all";
      let matchesDate = !dateFromFilter && !dateToFilter;
      
      if (ose.trips) {
        if (teamFilter !== "all") {
          matchesTeam = ose.trips.some(t => t.team_id === teamFilter);
        }
        
        if (dateFromFilter || dateToFilter) {
          matchesDate = ose.trips.some(trip => {
            const d = new Date(trip.date);
            if (dateFromFilter && d < dateFromFilter) return false;
            if (dateToFilter && d > dateToFilter) return false;
            return true;
          });
        }
      }
      
      return matchesSearch && matchesStatus && matchesTeam && matchesDate;
    });
  }, [oses, oseFilter, statusFilter, teamFilter, dateFromFilter, dateToFilter]);

  // Analytics data
  const analyticsData = useMemo((): AnalyticItem[] => {
    const grouped: Record<string, AnalyticItem> = {};

    allOseItems.forEach((item: any) => {
      const service = item.service;
      if (!service) return;

      if (!grouped[service.up]) {
        grouped[service.up] = {
          up: service.up,
          description: service.description,
          unit: service.unit,
          totalQuantity: 0,
          unitPrice: service.gross_price,
          totalValue: 0,
        };
      }

      grouped[service.up].totalQuantity += item.quantity;
      grouped[service.up].totalValue += item.total_price;
    });

    return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
  }, [allOseItems]);

  const analyticsTotals = useMemo(() => {
    return analyticsData.reduce(
      (acc, item) => ({
        quantity: acc.quantity + item.totalQuantity,
        value: acc.value + item.totalValue,
      }),
      { quantity: 0, value: 0 }
    );
  }, [analyticsData]);

  // Create OSE mutation
  const createOse = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!newOseNumber) throw new Error("Número da OSE é obrigatório");
      if (tripCart.length === 0) throw new Error("Adicione pelo menos uma ida");

      const totalValue = tripCart.reduce(
        (sum, trip) => sum + trip.services.reduce((s, item) => s + item.service.gross_price * item.quantity, 0),
        0
      );

      // Create OSE
      const { data: ose, error: oseError } = await supabase
        .from("oses")
        .insert({
          ose_number: newOseNumber,
          description: newOseDescription || null,
          created_by: user.id,
          total_value: totalValue,
        })
        .select()
        .single();

      if (oseError) throw oseError;

      // Create trips and their items
      for (const trip of tripCart) {
        const { data: tripData, error: tripError } = await supabase
          .from("ose_trips")
          .insert({
            ose_id: ose.id,
            team_id: trip.team.id,
            date: format(trip.date, "yyyy-MM-dd"),
          })
          .select()
          .single();

        if (tripError) throw tripError;

        // Create items for this trip
        const items = trip.services.map((item) => ({
          ose_id: ose.id,
          trip_id: tripData.id,
          service_id: item.service.id,
          quantity: item.quantity,
          unit_price: item.service.gross_price,
          total_price: item.service.gross_price * item.quantity,
        }));

        const { error: itemsError } = await supabase.from("ose_items").insert(items);
        if (itemsError) throw itemsError;
      }

      return ose;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      setIsNewOseDialogOpen(false);
      resetNewOseForm();
      toast({ title: "OSE criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar OSE", description: error.message, variant: "destructive" });
    },
  });

  // Add trip to existing OSE
  const addTripToOse = useMutation({
    mutationFn: async () => {
      if (!selectedOse || !newTripTeam || !newTripDate || newTripServices.length === 0) {
        throw new Error("Dados incompletos");
      }

      const tripTotal = newTripServices.reduce(
        (sum, item) => sum + item.service.gross_price * item.quantity,
        0
      );

      // Create trip
      const { data: tripData, error: tripError } = await supabase
        .from("ose_trips")
        .insert({
          ose_id: selectedOse.id,
          team_id: newTripTeam.id,
          date: format(newTripDate, "yyyy-MM-dd"),
        })
        .select()
        .single();

      if (tripError) throw tripError;

      // Create items
      const items = newTripServices.map((item) => ({
        ose_id: selectedOse.id,
        trip_id: tripData.id,
        service_id: item.service.id,
        quantity: item.quantity,
        unit_price: item.service.gross_price,
        total_price: item.service.gross_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("ose_items").insert(items);
      if (itemsError) throw itemsError;

      // Update OSE total
      await supabase
        .from("oses")
        .update({ total_value: selectedOse.total_value + tripTotal })
        .eq("id", selectedOse.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      queryClient.invalidateQueries({ queryKey: ["ose-trips-items", selectedOse?.id] });
      setIsAddTripDialogOpen(false);
      setNewTripTeam(null);
      setNewTripDate(undefined);
      setNewTripServices([]);
      toast({ title: "Ida adicionada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar ida", description: error.message, variant: "destructive" });
    },
  });

  // Delete trip
  const deleteTrip = useMutation({
    mutationFn: async (tripId: string) => {
      const trip = oseTripsWithItems.find(t => t.id === tripId);
      if (!trip || !selectedOse) return;

      const tripTotal = (trip.items || []).reduce((sum, item) => sum + item.total_price, 0);

      await supabase.from("ose_items").delete().eq("trip_id", tripId);
      await supabase.from("ose_trips").delete().eq("id", tripId);
      
      await supabase
        .from("oses")
        .update({ total_value: selectedOse.total_value - tripTotal })
        .eq("id", selectedOse.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      queryClient.invalidateQueries({ queryKey: ["ose-trips-items", selectedOse?.id] });
      toast({ title: "Ida removida!" });
    },
  });

  // Delete OSE
  const deleteOse = useMutation({
    mutationFn: async (oseId: string) => {
      // Delete items first
      await supabase.from("ose_items").delete().eq("ose_id", oseId);
      // Delete trips
      await supabase.from("ose_trips").delete().eq("ose_id", oseId);
      // Delete OSE
      const { error } = await supabase.from("oses").delete().eq("id", oseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      setSelectedOse(null);
      toast({ title: "OSE excluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir OSE", description: error.message, variant: "destructive" });
    },
  });

  // Update OSE
  const updateOse = useMutation({
    mutationFn: async () => {
      if (!selectedOse) throw new Error("Nenhuma OSE selecionada");
      
      const { error } = await supabase
        .from("oses")
        .update({
          ose_number: editOseNumber,
          description: editOseDescription || null,
          status: editOseStatus,
        })
        .eq("id", selectedOse.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      setIsEditOseDialogOpen(false);
      toast({ title: "OSE atualizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar OSE", description: error.message, variant: "destructive" });
    },
  });

  // Import services catalog
  const importCatalog = useMutation({
    mutationFn: async () => {
      if (!importData.trim()) throw new Error("Dados vazios");
      
      const lines = importData.trim().split("\n");
      const services: { up: string; service_number: string; description: string; unit: string; gross_price: number }[] = [];
      
      for (const line of lines) {
        // Expected format: UP;Número;Descrição;Unidade;Preço
        const parts = line.split(";").map(p => p.trim());
        if (parts.length >= 5) {
          const price = parseFloat(parts[4].replace(",", ".").replace(/[^\d.]/g, ""));
          if (!isNaN(price)) {
            services.push({
              up: parts[0],
              service_number: parts[1],
              description: parts[2],
              unit: parts[3],
              gross_price: price,
            });
          }
        }
      }
      
      if (services.length === 0) throw new Error("Nenhum serviço válido encontrado");
      
      const { error } = await supabase.from("service_catalog").insert(services);
      if (error) throw error;
      
      return services.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["service-catalog"] });
      setIsImportDialogOpen(false);
      setImportData("");
      toast({ title: `${count} serviços importados com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
    },
  });

  // Open edit dialog
  const openEditDialog = () => {
    if (selectedOse) {
      setEditOseNumber(selectedOse.ose_number);
      setEditOseDescription(selectedOse.description || "");
      setEditOseStatus(selectedOse.status);
      setIsEditOseDialogOpen(true);
    }
  };

  // Helper functions
  const resetNewOseForm = () => {
    setNewOseNumber("");
    setNewOseDescription("");
    setTripCart([]);
    setCurrentTripTeam(null);
    setCurrentTripDate(undefined);
    setCurrentTripServices([]);
  };

  const addServiceToCurrentTrip = () => {
    if (!selectedService) return;
    setCurrentTripServices([...currentTripServices, { service: selectedService, quantity }]);
    setSelectedService(null);
    setQuantity(1);
    setUpSearch("");
  };

  const removeServiceFromCurrentTrip = (index: number) => {
    setCurrentTripServices(currentTripServices.filter((_, i) => i !== index));
  };

  const addTripToCart = () => {
    if (!currentTripTeam || !currentTripDate || currentTripServices.length === 0) {
      toast({ title: "Preencha todos os campos da ida", variant: "destructive" });
      return;
    }
    setTripCart([...tripCart, { team: currentTripTeam, date: currentTripDate, services: currentTripServices }]);
    setCurrentTripTeam(null);
    setCurrentTripDate(undefined);
    setCurrentTripServices([]);
  };

  const removeTripFromCart = (index: number) => {
    setTripCart(tripCart.filter((_, i) => i !== index));
  };

  const addServiceToNewTrip = () => {
    if (!selectedService) return;
    setNewTripServices([...newTripServices, { service: selectedService, quantity }]);
    setSelectedService(null);
    setQuantity(1);
    setUpSearch("");
  };

  const removeServiceFromNewTrip = (index: number) => {
    setNewTripServices(newTripServices.filter((_, i) => i !== index));
  };

  const cartTotal = tripCart.reduce(
    (sum, trip) => sum + trip.services.reduce((s, item) => s + item.service.gross_price * item.quantity, 0),
    0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const clearFilters = () => {
    setOseFilter("");
    setStatusFilter("all");
    setTeamFilter("all");
    setDateFromFilter(undefined);
    setDateToFilter(undefined);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Orçamento</h1>
            <p className="text-muted-foreground">Gerencie OSEs e orçamentos de serviços</p>
          </div>
          <Dialog open={isNewOseDialogOpen} onOpenChange={setIsNewOseDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova OSE
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova OSE</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* OSE Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="oseNumber">Número da OSE *</Label>
                    <Input
                      id="oseNumber"
                      value={newOseNumber}
                      onChange={(e) => setNewOseNumber(e.target.value)}
                      placeholder="Ex: OSE-2024-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oseDescription">Descrição</Label>
                    <Input
                      id="oseDescription"
                      value={newOseDescription}
                      onChange={(e) => setNewOseDescription(e.target.value)}
                      placeholder="Descrição da OSE"
                    />
                  </div>
                </div>

                {/* Add Trip Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Adicionar Ida
                    </CardTitle>
                    <CardDescription>Cada ida representa uma equipe em uma data específica</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Team Select */}
                      <div className="space-y-2">
                        <Label>Equipe *</Label>
                        <Popover open={teamSearchOpen} onOpenChange={setTeamSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                              {currentTripTeam?.name || "Selecione a equipe..."}
                              <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Pesquisar equipe..." />
                              <CommandList>
                                <CommandEmpty>Nenhuma equipe encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {teams.map((team) => (
                                    <CommandItem
                                      key={team.id}
                                      value={team.name}
                                      onSelect={() => {
                                        setCurrentTripTeam(team);
                                        setTeamSearchOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          currentTripTeam?.id === team.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {team.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Date Select */}
                      <div className="space-y-2">
                        <Label>Data *</Label>
                        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {currentTripDate ? format(currentTripDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={currentTripDate}
                              onSelect={(date) => {
                                setCurrentTripDate(date);
                                setDatePopoverOpen(false);
                              }}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Add Service to Trip */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Serviço</Label>
                        <Popover open={serviceSearchOpen} onOpenChange={setServiceSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between">
                              {selectedService
                                ? `${selectedService.up} - ${selectedService.description.slice(0, 30)}...`
                                : "Selecione um serviço..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[500px] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Pesquisar por UP ou descrição..."
                                value={upSearch}
                                onValueChange={setUpSearch}
                              />
                              <CommandList>
                                <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {filteredServices.map((service) => (
                                    <CommandItem
                                      key={service.id}
                                      value={service.up}
                                      onSelect={() => {
                                        setSelectedService(service);
                                        setServiceSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex-1">
                                        <div className="font-medium">{service.up}</div>
                                        <div className="text-sm text-muted-foreground truncate">
                                          {service.description}
                                        </div>
                                      </div>
                                      <div className="text-sm font-medium">
                                        {formatCurrency(service.gross_price)}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                          />
                          <Button onClick={addServiceToCurrentTrip} disabled={!selectedService}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Services in current trip */}
                    {currentTripServices.length > 0 && (
                      <div className="border rounded-lg p-3 space-y-2">
                        <Label className="text-sm text-muted-foreground">Serviços desta ida:</Label>
                        {currentTripServices.map((item, index) => (
                          <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                            <span className="text-sm">
                              {item.service.up} - {item.quantity}x {formatCurrency(item.service.gross_price)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(item.service.gross_price * item.quantity)}</span>
                              <Button variant="ghost" size="icon" onClick={() => removeServiceFromCurrentTrip(index)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-medium">Subtotal da ida:</span>
                          <span className="font-bold">
                            {formatCurrency(currentTripServices.reduce((s, i) => s + i.service.gross_price * i.quantity, 0))}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={addTripToCart}
                      disabled={!currentTripTeam || !currentTripDate || currentTripServices.length === 0}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Ida à OSE
                    </Button>
                  </CardContent>
                </Card>

                {/* Trip Cart */}
                {tripCart.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Idas Adicionadas ({tripCart.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="multiple" className="w-full">
                        {tripCart.map((trip, tripIndex) => (
                          <AccordionItem key={tripIndex} value={`trip-${tripIndex}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">{trip.team.name}</Badge>
                                  <span className="text-muted-foreground">
                                    {format(trip.date, "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                </div>
                                <span className="font-bold">
                                  {formatCurrency(trip.services.reduce((s, i) => s + i.service.gross_price * i.quantity, 0))}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pt-2">
                                {trip.services.map((item, itemIndex) => (
                                  <div key={itemIndex} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                                    <span>{item.service.up} - {item.quantity}x</span>
                                    <span>{formatCurrency(item.service.gross_price * item.quantity)}</span>
                                  </div>
                                ))}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeTripFromCart(tripIndex)}
                                  className="w-full mt-2"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover Ida
                                </Button>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-lg font-semibold">Total da OSE:</span>
                        <span className="text-2xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewOseDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => createOse.mutate()} disabled={createOse.isPending || tripCart.length === 0}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar OSE
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="oses">OSEs</TabsTrigger>
            <TabsTrigger value="analitico">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analítico
            </TabsTrigger>
            <TabsTrigger value="catalog">Catálogo de Serviços</TabsTrigger>
          </TabsList>

          <TabsContent value="oses" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Filtrar por número ou descrição..."
                        value={oseFilter}
                        onChange={(e) => setOseFilter(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="finalizada">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Equipes</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[130px]", dateFromFilter && "text-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFromFilter ? format(dateFromFilter, "dd/MM/yy") : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFromFilter}
                        onSelect={setDateFromFilter}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[130px]", dateToFilter && "text-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateToFilter ? format(dateToFilter, "dd/MM/yy") : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateToFilter}
                        onSelect={setDateToFilter}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {(oseFilter || statusFilter !== "all" || teamFilter !== "all" || dateFromFilter || dateToFilter) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* OSE List */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOses.map((ose) => (
                <Card
                  key={ose.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedOse?.id === ose.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedOse(ose)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{ose.ose_number}</CardTitle>
                      <Badge
                        variant={
                          ose.status === "aberta"
                            ? "default"
                            : ose.status === "em_andamento"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {ose.status === "aberta" ? "Aberta" : ose.status === "em_andamento" ? "Em Andamento" : "Finalizada"}
                      </Badge>
                    </div>
                    {ose.description && (
                      <CardDescription className="line-clamp-1">{ose.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ose.trips && ose.trips.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ose.trips.slice(0, 3).map((trip, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {trip.team?.name} - {format(new Date(trip.date), "dd/MM")}
                            </Badge>
                          ))}
                          {ose.trips.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{ose.trips.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-muted-foreground">
                          {ose.trips?.length || 0} ida(s)
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(ose.total_value)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected OSE Details */}
            {selectedOse && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedOse.ose_number}</CardTitle>
                      <CardDescription>{selectedOse.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {/* Edit OSE Dialog */}
                      <Dialog open={isEditOseDialogOpen} onOpenChange={setIsEditOseDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" onClick={openEditDialog}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar OSE</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Número da OSE</Label>
                              <Input
                                value={editOseNumber}
                                onChange={(e) => setEditOseNumber(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Descrição</Label>
                              <Input
                                value={editOseDescription}
                                onChange={(e) => setEditOseDescription(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select value={editOseStatus} onValueChange={setEditOseStatus}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="aberta">Aberta</SelectItem>
                                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                                  <SelectItem value="finalizada">Finalizada</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setIsEditOseDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button onClick={() => updateOse.mutate()} disabled={updateOse.isPending}>
                                Salvar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Delete OSE */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir OSE?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Todas as idas e itens serão excluídos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOse.mutate(selectedOse.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Dialog open={isAddTripDialogOpen} onOpenChange={setIsAddTripDialogOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Ida
                          </Button>
                        </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Adicionar Ida à {selectedOse.ose_number}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Equipe *</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-between">
                                    {newTripTeam?.name || "Selecione..."}
                                    <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Pesquisar..." />
                                    <CommandList>
                                      <CommandEmpty>Nenhuma equipe.</CommandEmpty>
                                      <CommandGroup>
                                        {teams.map((team) => (
                                          <CommandItem
                                            key={team.id}
                                            value={team.name}
                                            onSelect={() => setNewTripTeam(team)}
                                          >
                                            {team.name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label>Data *</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newTripDate ? format(newTripDate, "dd/MM/yyyy") : "Selecione..."}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={newTripDate}
                                    onSelect={setNewTripDate}
                                    locale={ptBR}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                              <Label>Serviço</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-between">
                                    {selectedService ? `${selectedService.up}` : "Selecione..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                  <Command>
                                    <CommandInput
                                      placeholder="Pesquisar..."
                                      value={upSearch}
                                      onValueChange={setUpSearch}
                                    />
                                    <CommandList>
                                      <CommandEmpty>Nenhum serviço.</CommandEmpty>
                                      <CommandGroup>
                                        {filteredServices.map((service) => (
                                          <CommandItem
                                            key={service.id}
                                            value={service.up}
                                            onSelect={() => setSelectedService(service)}
                                          >
                                            <div className="flex-1">
                                              <div className="font-medium">{service.up}</div>
                                              <div className="text-xs text-muted-foreground truncate">
                                                {service.description}
                                              </div>
                                            </div>
                                            <span className="text-sm">{formatCurrency(service.gross_price)}</span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label>Qtd</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={1}
                                  value={quantity}
                                  onChange={(e) => setQuantity(Number(e.target.value))}
                                />
                                <Button onClick={addServiceToNewTrip} disabled={!selectedService}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {newTripServices.length > 0 && (
                            <div className="border rounded-lg p-3 space-y-2">
                              {newTripServices.map((item, index) => (
                                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                                  <span className="text-sm">{item.service.up} - {item.quantity}x</span>
                                  <div className="flex items-center gap-2">
                                    <span>{formatCurrency(item.service.gross_price * item.quantity)}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removeServiceFromNewTrip(index)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-between pt-2 border-t font-medium">
                                <span>Total:</span>
                                <span>{formatCurrency(newTripServices.reduce((s, i) => s + i.service.gross_price * i.quantity, 0))}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddTripDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => addTripToOse.mutate()}
                              disabled={!newTripTeam || !newTripDate || newTripServices.length === 0 || addTripToOse.isPending}
                            >
                              Adicionar Ida
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {oseTripsWithItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma ida cadastrada nesta OSE.
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {oseTripsWithItems.map((trip) => (
                        <AccordionItem key={trip.id} value={trip.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary">{trip.team?.name}</Badge>
                                <span>{format(new Date(trip.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                              </div>
                              <span className="font-bold">
                                {formatCurrency((trip.items || []).reduce((s, i) => s + i.total_price, 0))}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>UP</TableHead>
                                  <TableHead>Descrição</TableHead>
                                  <TableHead className="text-right">Qtd</TableHead>
                                  <TableHead className="text-right">Unit.</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(trip.items || []).map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.service?.up}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{item.service?.description}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(item.total_price)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="flex justify-end mt-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteTrip.mutate(trip.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover Ida
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <span className="text-muted-foreground">Total da OSE:</span>
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {formatCurrency(selectedOse.total_value)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analitico" className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Equipes</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[150px]", dateFromFilter && "text-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFromFilter ? format(dateFromFilter, "dd/MM/yyyy") : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFromFilter}
                        onSelect={setDateFromFilter}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[150px]", dateToFilter && "text-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateToFilter ? format(dateToFilter, "dd/MM/yyyy") : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateToFilter}
                        onSelect={setDateToFilter}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {(teamFilter !== "all" || dateFromFilter || dateToFilter) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total de Serviços</CardDescription>
                  <CardTitle className="text-3xl">{analyticsData.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Quantidade Total</CardDescription>
                  <CardTitle className="text-3xl">{analyticsTotals.quantity.toLocaleString("pt-BR")}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Valor Total</CardDescription>
                  <CardTitle className="text-3xl text-primary">{formatCurrency(analyticsTotals.value)}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Serviços Agrupados por UP</CardTitle>
                <CardDescription>Quantidade e valor somados de todas as OSEs filtradas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UP</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Qtd Total</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.map((item) => (
                      <TableRow key={item.up}>
                        <TableCell className="font-medium">{item.up}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{item.description}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.totalQuantity.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(item.totalValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {analyticsData.length > 0 && (
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <span className="text-muted-foreground">Total Geral:</span>
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {formatCurrency(analyticsTotals.value)}
                      </span>
                    </div>
                  </div>
                )}
                {analyticsData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado encontrado para os filtros selecionados.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Catálogo de Serviços</CardTitle>
                    <CardDescription>Lista de todos os serviços disponíveis ({services.length} serviços)</CardDescription>
                  </div>
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar Catálogo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Importar Catálogo de Serviços</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Cole os dados do catálogo (separados por ponto e vírgula)</Label>
                          <p className="text-sm text-muted-foreground">
                            Formato: UP;Número do Serviço;Descrição;Unidade;Preço
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Exemplo: UP001;12345;Instalação de poste;UN;150,00
                          </p>
                          <Textarea
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder="Cole os dados aqui, um serviço por linha..."
                            rows={15}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {importData.split("\n").filter(l => l.trim()).length} linhas
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button 
                              onClick={() => importCatalog.mutate()} 
                              disabled={importCatalog.isPending || !importData.trim()}
                            >
                              {importCatalog.isPending ? "Importando..." : "Importar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar por UP ou descrição..."
                      value={upSearch}
                      onChange={(e) => setUpSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UP</TableHead>
                      <TableHead>Nº Serviço</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Preço Bruto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.up}</TableCell>
                        <TableCell>{service.service_number}</TableCell>
                        <TableCell className="max-w-[400px]">{service.description}</TableCell>
                        <TableCell>{service.unit}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(service.gross_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
