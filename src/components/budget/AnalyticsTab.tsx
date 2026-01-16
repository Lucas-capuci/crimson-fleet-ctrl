import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, X, TrendingUp, Users, Scissors, Target, FileText, DollarSign, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface AnalyticItem {
  up: string;
  description: string;
  unit: string;
  totalQuantity: number;
  unitPrice: number;
  totalValue: number;
}

interface TeamAnalytic {
  teamId: string;
  teamName: string;
  totalTrips: number;
  totalServices: number;
  totalQuantity: number;
  totalValue: number;
  podasCount: number;
  espacadoresCount: number;
}

interface OSEAnalytic {
  oseId: string;
  oseNumber: string;
  description: string | null;
  status: string;
  totalTrips: number;
  totalValue: number;
  teamsInvolved: string[];
}

interface AnalyticsTabProps {
  allOseItems: any[];
  teams: Team[];
  teamFilter: string;
  setTeamFilter: (value: string) => void;
  dateFromFilter: Date | undefined;
  setDateFromFilter: (date: Date | undefined) => void;
  dateToFilter: Date | undefined;
  setDateToFilter: (date: Date | undefined) => void;
  clearFilters: () => void;
  oses: any[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function AnalyticsTab({
  allOseItems,
  teams,
  teamFilter,
  setTeamFilter,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
  clearFilters,
  oses,
}: AnalyticsTabProps) {
  // Analytics by service (UP)
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

  // Analytics by team
  const teamAnalytics = useMemo((): TeamAnalytic[] => {
    const grouped: Record<string, TeamAnalytic> = {};
    const tripsByTeam: Record<string, Set<string>> = {};

    allOseItems.forEach((item: any) => {
      if (!item.trip) return;
      
      const teamId = item.trip.team_id;
      const teamName = item.trip.teams?.name || "Desconhecida";
      const tripId = item.trip.id;
      const service = item.service;

      if (!grouped[teamId]) {
        grouped[teamId] = {
          teamId,
          teamName,
          totalTrips: 0,
          totalServices: 0,
          totalQuantity: 0,
          totalValue: 0,
          podasCount: 0,
          espacadoresCount: 0,
        };
        tripsByTeam[teamId] = new Set();
      }

      tripsByTeam[teamId].add(tripId);
      grouped[teamId].totalServices += 1;
      grouped[teamId].totalQuantity += item.quantity;
      grouped[teamId].totalValue += item.total_price;

      // Count podas (pruning) - check if UP contains "poda" or similar
      if (service?.description?.toLowerCase().includes("poda") || 
          service?.up?.toLowerCase().includes("poda")) {
        grouped[teamId].podasCount += item.quantity;
      }

      // Count espaçadores (spacers)
      if (service?.description?.toLowerCase().includes("espaçador") || 
          service?.description?.toLowerCase().includes("espacador") ||
          service?.up?.toLowerCase().includes("esp")) {
        grouped[teamId].espacadoresCount += item.quantity;
      }
    });

    // Set total trips from unique trip IDs
    Object.keys(grouped).forEach(teamId => {
      grouped[teamId].totalTrips = tripsByTeam[teamId]?.size || 0;
    });

    return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
  }, [allOseItems]);

  // OSE analytics
  const oseAnalytics = useMemo((): OSEAnalytic[] => {
    const grouped: Record<string, OSEAnalytic> = {};
    const teamsByOse: Record<string, Set<string>> = {};
    const tripsByOse: Record<string, Set<string>> = {};

    allOseItems.forEach((item: any) => {
      if (!item.trip) return;
      
      const oseId = item.trip.ose_id;
      const tripId = item.trip.id;
      const teamName = item.trip.teams?.name;

      // Find the OSE data
      const ose = oses.find(o => o.id === oseId);
      if (!ose) return;

      if (!grouped[oseId]) {
        grouped[oseId] = {
          oseId,
          oseNumber: ose.ose_number,
          description: ose.description,
          status: ose.status,
          totalTrips: 0,
          totalValue: 0,
          teamsInvolved: [],
        };
        teamsByOse[oseId] = new Set();
        tripsByOse[oseId] = new Set();
      }

      tripsByOse[oseId].add(tripId);
      grouped[oseId].totalValue += item.total_price;
      
      if (teamName) {
        teamsByOse[oseId].add(teamName);
      }
    });

    // Set total trips and teams
    Object.keys(grouped).forEach(oseId => {
      grouped[oseId].totalTrips = tripsByOse[oseId]?.size || 0;
      grouped[oseId].teamsInvolved = Array.from(teamsByOse[oseId] || []);
    });

    return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
  }, [allOseItems, oses]);

  // Special categories analytics
  const specialCategories = useMemo(() => {
    let podasTotal = 0;
    let podasQty = 0;
    let espacadoresTotal = 0;
    let espacadoresQty = 0;
    let substituicaoTotal = 0;
    let substituicaoQty = 0;
    let instalacaoTotal = 0;
    let instalacaoQty = 0;
    let manutencaoTotal = 0;
    let manutencaoQty = 0;

    allOseItems.forEach((item: any) => {
      const service = item.service;
      if (!service) return;
      const desc = service.description?.toLowerCase() || "";
      const up = service.up?.toLowerCase() || "";

      if (desc.includes("poda") || up.includes("poda")) {
        podasTotal += item.total_price;
        podasQty += item.quantity;
      }
      if (desc.includes("espaçador") || desc.includes("espacador") || up.includes("esp")) {
        espacadoresTotal += item.total_price;
        espacadoresQty += item.quantity;
      }
      if (desc.includes("substituição") || desc.includes("substituicao") || desc.includes("troca")) {
        substituicaoTotal += item.total_price;
        substituicaoQty += item.quantity;
      }
      if (desc.includes("instalação") || desc.includes("instalacao") || desc.includes("instalar")) {
        instalacaoTotal += item.total_price;
        instalacaoQty += item.quantity;
      }
      if (desc.includes("manutenção") || desc.includes("manutencao") || desc.includes("reparo") || desc.includes("reparar")) {
        manutencaoTotal += item.total_price;
        manutencaoQty += item.quantity;
      }
    });

    return {
      podas: { total: podasTotal, qty: podasQty },
      espacadores: { total: espacadoresTotal, qty: espacadoresQty },
      substituicao: { total: substituicaoTotal, qty: substituicaoQty },
      instalacao: { total: instalacaoTotal, qty: instalacaoQty },
      manutencao: { total: manutencaoTotal, qty: manutencaoQty },
    };
  }, [allOseItems]);

  // General totals
  const analyticsTotals = useMemo(() => {
    const totalValue = analyticsData.reduce((acc, item) => acc + item.totalValue, 0);
    const totalQuantity = analyticsData.reduce((acc, item) => acc + item.totalQuantity, 0);
    const totalTrips = new Set(allOseItems.map((item: any) => item.trip?.id).filter(Boolean)).size;
    const totalOses = new Set(allOseItems.map((item: any) => item.trip?.ose_id).filter(Boolean)).size;
    const totalTeams = teamAnalytics.length;
    
    return {
      value: totalValue,
      quantity: totalQuantity,
      trips: totalTrips,
      oses: totalOses,
      teams: totalTeams,
      services: analyticsData.length,
    };
  }, [analyticsData, allOseItems, teamAnalytics]);

  // Get max value for progress bars
  const maxTeamValue = useMemo(() => {
    return Math.max(...teamAnalytics.map(t => t.totalValue), 1);
  }, [teamAnalytics]);

  return (
    <div className="space-y-4">
      {/* Filters */}
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

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Valor Total
            </CardDescription>
            <CardTitle className="text-2xl text-primary">{formatCurrency(analyticsTotals.value)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Qtd Total
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsTotals.quantity.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              OSEs
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsTotals.oses}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Idas
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsTotals.trips}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Equipes
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsTotals.teams}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Serviços
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsTotals.services}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Special Categories Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-green-600">
              <Scissors className="h-3 w-3" />
              Podas
            </CardDescription>
            <CardTitle className="text-xl">{specialCategories.podas.qty.toLocaleString("pt-BR")}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCurrency(specialCategories.podas.total)}</p>
          </CardHeader>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-blue-600">
              <Target className="h-3 w-3" />
              Espaçadores
            </CardDescription>
            <CardTitle className="text-xl">{specialCategories.espacadores.qty.toLocaleString("pt-BR")}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCurrency(specialCategories.espacadores.total)}</p>
          </CardHeader>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-orange-600">
              <Package className="h-3 w-3" />
              Substituições
            </CardDescription>
            <CardTitle className="text-xl">{specialCategories.substituicao.qty.toLocaleString("pt-BR")}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCurrency(specialCategories.substituicao.total)}</p>
          </CardHeader>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-purple-600">
              <TrendingUp className="h-3 w-3" />
              Instalações
            </CardDescription>
            <CardTitle className="text-xl">{specialCategories.instalacao.qty.toLocaleString("pt-BR")}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCurrency(specialCategories.instalacao.total)}</p>
          </CardHeader>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-yellow-600">
              <FileText className="h-3 w-3" />
              Manutenções
            </CardDescription>
            <CardTitle className="text-xl">{specialCategories.manutencao.qty.toLocaleString("pt-BR")}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCurrency(specialCategories.manutencao.total)}</p>
          </CardHeader>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="teams" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="teams">Por Equipe</TabsTrigger>
              <TabsTrigger value="services">Por Serviço</TabsTrigger>
              <TabsTrigger value="oses">Por OSE</TabsTrigger>
            </TabsList>

            {/* By Team */}
            <TabsContent value="teams" className="space-y-4 mt-4">
              {teamAnalytics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="space-y-3">
                  {teamAnalytics.map((team) => (
                    <div key={team.teamId} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-sm font-medium">
                            {team.teamName}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {team.totalTrips} ida{team.totalTrips !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(team.totalValue)}
                        </span>
                      </div>
                      <Progress value={(team.totalValue / maxTeamValue) * 100} className="h-2" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Serviços:</span>{" "}
                          <span className="font-medium">{team.totalServices}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quantidade:</span>{" "}
                          <span className="font-medium">{team.totalQuantity.toLocaleString("pt-BR")}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-green-600">Podas:</span>{" "}
                          <span className="font-medium">{team.podasCount.toLocaleString("pt-BR")}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-blue-600">Espaçadores:</span>{" "}
                          <span className="font-medium">{team.espacadoresCount.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <span className="text-muted-foreground">Total Geral:</span>
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {formatCurrency(analyticsTotals.value)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* By Service */}
            <TabsContent value="services" className="mt-4">
              {analyticsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado encontrado para os filtros selecionados.
                </div>
              ) : (
                <>
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
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <span className="text-muted-foreground">Total Geral:</span>
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {formatCurrency(analyticsTotals.value)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* By OSE */}
            <TabsContent value="oses" className="mt-4">
              {oseAnalytics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado encontrado para os filtros selecionados.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº OSE</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Equipes</TableHead>
                        <TableHead className="text-right">Idas</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oseAnalytics.map((ose) => (
                        <TableRow key={ose.oseId}>
                          <TableCell className="font-medium">{ose.oseNumber}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{ose.description || "-"}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={ose.status === "aprovada" ? "default" : ose.status === "pendente" ? "secondary" : "outline"}
                            >
                              {ose.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ose.teamsInvolved.slice(0, 2).map((team) => (
                                <Badge key={team} variant="outline" className="text-xs">
                                  {team}
                                </Badge>
                              ))}
                              {ose.teamsInvolved.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{ose.teamsInvolved.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{ose.totalTrips}</TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatCurrency(ose.totalValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <span className="text-muted-foreground">Total Geral:</span>
                      <span className="ml-2 text-2xl font-bold text-primary">
                        {formatCurrency(analyticsTotals.value)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
