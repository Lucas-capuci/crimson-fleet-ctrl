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
import { Plus, Search, Trash2, Save, FileText, Check, ChevronsUpDown, Package, CalendarIcon, Users } from "lucide-react";
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

interface OSE {
  id: string;
  ose_number: string;
  description: string | null;
  status: string;
  total_value: number;
  created_by: string;
  created_at: string;
  team_id: string | null;
  date: string | null;
  team?: Team;
}

interface OSEItem {
  id: string;
  ose_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  service?: ServiceCatalog;
}

export default function Budget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("oses");
  const [isNewOseDialogOpen, setIsNewOseDialogOpen] = useState(false);
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false);
  const [selectedOse, setSelectedOse] = useState<OSE | null>(null);
  const [oseFilter, setOseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // New OSE form
  const [newOseNumber, setNewOseNumber] = useState("");
  const [newOseDescription, setNewOseDescription] = useState("");
  const [newOseTeamId, setNewOseTeamId] = useState<string | null>(null);
  const [newOseDate, setNewOseDate] = useState<Date | undefined>(undefined);
  const [teamSearchOpen, setTeamSearchOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  
  // Add service form
  const [serviceSearchOpen, setServiceSearchOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceCatalog | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [upSearch, setUpSearch] = useState("");
  
  // Cart for new OSE
  const [cart, setCart] = useState<{ service: ServiceCatalog; quantity: number }[]>([]);

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

  // Fetch OSEs
  const { data: oses = [] } = useQuery({
    queryKey: ["oses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oses")
        .select("*, teams:team_id(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((ose: any) => ({
        ...ose,
        team: ose.teams
      })) as OSE[];
    },
  });

  // Fetch OSE items for selected OSE
  const { data: oseItems = [] } = useQuery({
    queryKey: ["ose-items", selectedOse?.id],
    queryFn: async () => {
      if (!selectedOse) return [];
      const { data, error } = await supabase
        .from("ose_items")
        .select("*")
        .eq("ose_id", selectedOse.id)
        .order("created_at");
      if (error) throw error;
      
      // Fetch service details for each item
      const itemsWithServices = await Promise.all(
        data.map(async (item: OSEItem) => {
          const { data: service } = await supabase
            .from("service_catalog")
            .select("*")
            .eq("id", item.service_id)
            .single();
          return { ...item, service } as OSEItem;
        })
      );
      return itemsWithServices;
    },
    enabled: !!selectedOse,
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
      return matchesSearch && matchesStatus;
    });
  }, [oses, oseFilter, statusFilter]);

  // Create OSE mutation
  const createOse = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!newOseNumber) throw new Error("Número da OSE é obrigatório");
      if (cart.length === 0) throw new Error("Adicione pelo menos um serviço");

      const totalValue = cart.reduce((sum, item) => sum + item.service.gross_price * item.quantity, 0);

      // Create OSE
      const { data: ose, error: oseError } = await supabase
        .from("oses")
        .insert({
          ose_number: newOseNumber,
          description: newOseDescription || null,
          created_by: user.id,
          total_value: totalValue,
          team_id: newOseTeamId,
          date: newOseDate ? format(newOseDate, "yyyy-MM-dd") : null,
        })
        .select()
        .single();

      if (oseError) throw oseError;

      // Create OSE items
      const items = cart.map((item) => ({
        ose_id: ose.id,
        service_id: item.service.id,
        quantity: item.quantity,
        unit_price: item.service.gross_price,
        total_price: item.service.gross_price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("ose_items").insert(items);
      if (itemsError) throw itemsError;

      return ose;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      setIsNewOseDialogOpen(false);
      setNewOseNumber("");
      setNewOseDescription("");
      setNewOseTeamId(null);
      setNewOseDate(undefined);
      setCart([]);
      toast({ title: "OSE criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar OSE", description: error.message, variant: "destructive" });
    },
  });

  // Add item to existing OSE
  const addItemToOse = useMutation({
    mutationFn: async () => {
      if (!selectedOse || !selectedService) throw new Error("Dados incompletos");

      const totalPrice = selectedService.gross_price * quantity;

      const { error: itemError } = await supabase.from("ose_items").insert({
        ose_id: selectedOse.id,
        service_id: selectedService.id,
        quantity,
        unit_price: selectedService.gross_price,
        total_price: totalPrice,
      });

      if (itemError) throw itemError;

      // Update OSE total
      const { error: oseError } = await supabase
        .from("oses")
        .update({ total_value: selectedOse.total_value + totalPrice })
        .eq("id", selectedOse.id);

      if (oseError) throw oseError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ose-items", selectedOse?.id] });
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      setIsAddServiceDialogOpen(false);
      setSelectedService(null);
      setQuantity(1);
      setUpSearch("");
      toast({ title: "Serviço adicionado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar serviço", description: error.message, variant: "destructive" });
    },
  });

  // Remove item from OSE
  const removeItem = useMutation({
    mutationFn: async (item: OSEItem) => {
      const { error } = await supabase.from("ose_items").delete().eq("id", item.id);
      if (error) throw error;

      // Update OSE total
      if (selectedOse) {
        await supabase
          .from("oses")
          .update({ total_value: selectedOse.total_value - item.total_price })
          .eq("id", selectedOse.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ose-items", selectedOse?.id] });
      queryClient.invalidateQueries({ queryKey: ["oses"] });
      toast({ title: "Item removido!" });
    },
  });

  const addToCart = () => {
    if (!selectedService) return;
    setCart([...cart, { service: selectedService, quantity }]);
    setSelectedService(null);
    setQuantity(1);
    setUpSearch("");
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.service.gross_price * item.quantity, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

                {/* Team and Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Equipe</Label>
                    <Popover open={teamSearchOpen} onOpenChange={setTeamSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {newOseTeamId
                            ? teams.find((t) => t.id === newOseTeamId)?.name
                            : "Selecione uma equipe..."}
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
                                    setNewOseTeamId(team.id);
                                    setTeamSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newOseTeamId === team.id ? "opacity-100" : "opacity-0"
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
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newOseDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newOseDate ? format(newOseDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newOseDate}
                          onSelect={(date) => {
                            setNewOseDate(date);
                            setDatePopoverOpen(false);
                          }}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Add Service */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Adicionar Serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Pesquisar UP</Label>
                        <Popover open={serviceSearchOpen} onOpenChange={setServiceSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {selectedService
                                ? `${selectedService.up} - ${selectedService.description.slice(0, 40)}...`
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
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedService?.id === service.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
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
                        <Input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    {selectedService && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <span className="text-sm text-muted-foreground">Subtotal:</span>
                          <span className="ml-2 font-bold">
                            {formatCurrency(selectedService.gross_price * quantity)}
                          </span>
                        </div>
                        <Button onClick={addToCart}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cart */}
                {cart.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Serviços Adicionados ({cart.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>UP</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Unit.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cart.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.service.up}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {item.service.description}
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.service.gross_price)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(item.service.gross_price * item.quantity)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFromCart(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-lg font-semibold">Total:</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(cartTotal)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewOseDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => createOse.mutate()} disabled={createOse.isPending}>
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
            <TabsTrigger value="catalog">Catálogo de Serviços</TabsTrigger>
          </TabsList>

          <TabsContent value="oses" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex gap-4">
                  <div className="flex-1">
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
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="finalizada">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
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
                        {ose.status === "aberta"
                          ? "Aberta"
                          : ose.status === "em_andamento"
                          ? "Em Andamento"
                          : "Finalizada"}
                      </Badge>
                    </div>
                    {ose.description && (
                      <CardDescription>{ose.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ose.team && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{ose.team.name}</span>
                      </div>
                    )}
                    {ose.date && (
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(ose.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs text-muted-foreground">
                        Criada em {format(new Date(ose.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="font-bold text-primary">
                        {formatCurrency(ose.total_value)}
                      </span>
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
                      <CardTitle>Detalhes da OSE: {selectedOse.ose_number}</CardTitle>
                      <CardDescription>{selectedOse.description}</CardDescription>
                    </div>
                    <Dialog open={isAddServiceDialogOpen} onOpenChange={setIsAddServiceDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Serviço
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar Serviço à OSE</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Pesquisar UP</Label>
                            <Popover open={serviceSearchOpen} onOpenChange={setServiceSearchOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                >
                                  {selectedService
                                    ? `${selectedService.up} - ${selectedService.description.slice(0, 30)}...`
                                    : "Selecione um serviço..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
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
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              selectedService?.id === service.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium">{service.up}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                              {service.description}
                                            </div>
                                          </div>
                                          <div className="text-sm">
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
                            <Input
                              type="number"
                              min={1}
                              value={quantity}
                              onChange={(e) => setQuantity(Number(e.target.value))}
                            />
                          </div>
                          {selectedService && (
                            <div className="p-3 bg-muted rounded-lg">
                              <div className="flex justify-between">
                                <span>Preço unitário:</span>
                                <span>{formatCurrency(selectedService.gross_price)}</span>
                              </div>
                              <div className="flex justify-between font-bold mt-2">
                                <span>Total:</span>
                                <span>{formatCurrency(selectedService.gross_price * quantity)}</span>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddServiceDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button
                              onClick={() => addItemToOse.mutate()}
                              disabled={!selectedService || addItemToOse.isPending}
                            >
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>UP</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oseItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.service?.up}</TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {item.service?.description}
                          </TableCell>
                          <TableCell>{item.service?.unit}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.total_price)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem.mutate(item)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {oseItems.length > 0 && (
                    <div className="flex justify-end mt-4 pt-4 border-t">
                      <div className="text-right">
                        <span className="text-muted-foreground">Total da OSE:</span>
                        <span className="ml-4 text-2xl font-bold text-primary">
                          {formatCurrency(selectedOse.total_value)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Catálogo de Serviços
                </CardTitle>
                <CardDescription>
                  {services.length} serviços cadastrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por UP ou descrição..."
                    value={upSearch}
                    onChange={(e) => setUpSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border max-h-[500px] overflow-y-auto">
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
                          <TableCell className="max-w-[300px] truncate">
                            {service.description}
                          </TableCell>
                          <TableCell>{service.unit}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(service.gross_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
