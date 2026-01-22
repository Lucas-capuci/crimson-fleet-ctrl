import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Plus,
  Trophy,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
  Trash2,
  Edit,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { ExportButton } from "@/components/ExportButton";
import { ScoringRulesExplainer } from "@/components/reports/ScoringRulesExplainer";
import {
  calculateAllDailyScores,
  calculateAggregatedScores,
  calculateRankingForPeriod,
  type ReportEntry,
  type DailyScore,
  type AggregatedScore,
} from "@/lib/scoringCalculations";

type ReportStatus = "NO_HORARIO" | "FORA_DO_HORARIO" | "ESQUECEU_ERRO";

interface ReportConfig {
  id: string;
  tipo_relatorio: string;
  pontos_no_horario: number;
  pontos_esqueceu_ou_erro: number;
  pontos_fora_do_horario: number;
  horario_limite: string;
  responsaveis: string[];
}

interface ControleDiario {
  id: string;
  data: string;
  tipo_relatorio: string;
  responsavel: string;
  horario_envio: string | null;
  status: ReportStatus;
  pontos_calculados: number;
  observacao: string | null;
}

// RankingPontos interface removed - using normalized scoring instead

export default function Reports() {
  const { userRole } = useAuth();
  const { canViewPage, getUserProfileName } = usePermissions();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("registro");
  const [filterStartDate, setFilterStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterEndDate, setFilterEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterResponsavel, setFilterResponsavel] = useState<string>("all");
  const [filterTipoRelatorio, setFilterTipoRelatorio] = useState<string>("all");
  const [rankingPeriod, setRankingPeriod] = useState<"week" | "month" | "all">("month");
  
  // Form state
  const [formData, setFormData] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    tipo_relatorio: "",
    responsavel: "",
    status: "NO_HORARIO" as ReportStatus,
  });
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReportConfig | null>(null);
  const [configFormData, setConfigFormData] = useState({
    tipo_relatorio: "",
    pontos_no_horario: 20,
    pontos_esqueceu_ou_erro: -40,
    pontos_fora_do_horario: -10,
    horario_limite: "ATÉ 09:00",
    responsaveis: "",
  });

  // Check access - only admins, gestores, and "Programação" profile
  const isAdmin = userRole === "admin" || userRole === "gestor";
  const profileName = getUserProfileName();
  const isProgramacao = profileName === "Programação";
  
  if (!isAdmin && !isProgramacao) {
    return <Navigate to="/" replace />;
  }

  // Fetch report configs
  const { data: configs = [] } = useQuery<ReportConfig[]>({
    queryKey: ["report-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_config")
        .select("*")
        .order("tipo_relatorio");
      if (error) throw error;
      return data as ReportConfig[];
    },
  });

  // Fetch controle diario
  const { data: controleDiario = [], isLoading } = useQuery<ControleDiario[]>({
    queryKey: ["controle-diario", filterStartDate, filterEndDate, filterResponsavel, filterTipoRelatorio],
    queryFn: async () => {
      let query = supabase
        .from("controle_diario")
        .select("*")
        .gte("data", filterStartDate)
        .lte("data", filterEndDate)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      
      if (filterResponsavel !== "all") {
        query = query.eq("responsavel", filterResponsavel);
      }
      if (filterTipoRelatorio !== "all") {
        query = query.eq("tipo_relatorio", filterTipoRelatorio);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ControleDiario[];
    },
  });

  // Fetch ALL entries for normalized ranking calculation
  const { data: allEntries = [] } = useQuery<ReportEntry[]>({
    queryKey: ["all-controle-diario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_diario")
        .select("responsavel, data, tipo_relatorio, status, pontos_calculados")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as ReportEntry[];
    },
  });

  // Calculate normalized rankings based on selected period
  const normalizedRanking = useMemo((): AggregatedScore[] => {
    if (allEntries.length === 0 || configs.length === 0) return [];
    
    const today = new Date();
    let startDate: string | undefined;
    
    if (rankingPeriod === "week") {
      startDate = format(startOfWeek(today, { locale: ptBR }), "yyyy-MM-dd");
    } else if (rankingPeriod === "month") {
      startDate = format(startOfMonth(today), "yyyy-MM-dd");
    }
    
    return calculateRankingForPeriod(allEntries, configs, startDate);
  }, [allEntries, configs, rankingPeriod]);

  // Calculate daily scores for chart
  const dailyScoresForChart = useMemo((): DailyScore[] => {
    if (allEntries.length === 0 || configs.length === 0) return [];
    
    const today = new Date();
    const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
    const filteredEntries = allEntries.filter(e => e.data >= thirtyDaysAgo);
    
    return calculateAllDailyScores(filteredEntries, configs);
  }, [allEntries, configs]);

  // Get all unique responsaveis from configs
  const allResponsaveis = useMemo(() => {
    const set = new Set<string>();
    configs.forEach((c) => c.responsaveis?.forEach((r) => set.add(r)));
    return Array.from(set).sort();
  }, [configs]);

  // Create entry mutation - uses new scoring model
  const createEntryMutation = useMutation({
    mutationFn: async (data: {
      data: string;
      tipo_relatorio: string;
      responsavel: string;
      status: ReportStatus;
    }) => {
      // Get total reports this person is responsible for
      const totalReports = configs.filter(c => 
        c.responsaveis?.includes(data.responsavel)
      ).length;
      
      if (totalReports === 0) throw new Error("Responsável não configurado em nenhum relatório");
      
      // Calculate base points: 20 / total_reports
      const basePoints = 20 / totalReports;
      
      // Calculate points based on new model
      let pontos = 0;
      if (data.status === "NO_HORARIO") {
        pontos = basePoints; // gains full base
      } else if (data.status === "FORA_DO_HORARIO") {
        pontos = -(basePoints / 2); // loses half
      } else {
        pontos = -basePoints; // loses full
      }
      
      // Round to 2 decimal places
      pontos = Math.round(pontos * 100) / 100;
      
      const { error } = await supabase.from("controle_diario").insert({
        data: data.data,
        tipo_relatorio: data.tipo_relatorio,
        responsavel: data.responsavel,
        horario_envio: null,
        status: data.status,
        pontos_calculados: pontos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controle-diario"] });
      queryClient.invalidateQueries({ queryKey: ["all-controle-diario"] });
      toast.success("Registro salvo com sucesso!");
      setFormData({
        data: format(new Date(), "yyyy-MM-dd"),
        tipo_relatorio: "",
        responsavel: "",
        status: "NO_HORARIO",
      });
    },
    onError: (error: Error) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Já existe um registro para este responsável nesta data e relatório.");
      } else {
        toast.error("Erro ao salvar registro");
      }
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("controle_diario").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controle-diario"] });
      queryClient.invalidateQueries({ queryKey: ["ranking-pontos"] });
      toast.success("Registro excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir registro");
    },
  });

  // Config mutations
  const saveConfigMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      tipo_relatorio: string;
      pontos_no_horario: number;
      pontos_esqueceu_ou_erro: number;
      pontos_fora_do_horario: number;
      horario_limite: string;
      responsaveis: string[];
    }) => {
      if (data.id) {
        const { error } = await supabase
          .from("report_config")
          .update({
            tipo_relatorio: data.tipo_relatorio,
            pontos_no_horario: data.pontos_no_horario,
            pontos_esqueceu_ou_erro: data.pontos_esqueceu_ou_erro,
            pontos_fora_do_horario: data.pontos_fora_do_horario,
            horario_limite: data.horario_limite,
            responsaveis: data.responsaveis,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("report_config").insert({
          tipo_relatorio: data.tipo_relatorio,
          pontos_no_horario: data.pontos_no_horario,
          pontos_esqueceu_ou_erro: data.pontos_esqueceu_ou_erro,
          pontos_fora_do_horario: data.pontos_fora_do_horario,
          horario_limite: data.horario_limite,
          responsaveis: data.responsaveis,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-configs"] });
      toast.success("Configuração salva!");
      setConfigDialogOpen(false);
      setEditingConfig(null);
      setConfigFormData({
        tipo_relatorio: "",
        pontos_no_horario: 20,
        pontos_esqueceu_ou_erro: -40,
        pontos_fora_do_horario: -10,
        horario_limite: "ATÉ 09:00",
        responsaveis: "",
      });
    },
    onError: (error: Error) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Já existe um relatório com este nome.");
      } else {
        toast.error("Erro ao salvar configuração");
      }
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-configs"] });
      toast.success("Configuração excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir configuração");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tipo_relatorio || !formData.responsavel) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createEntryMutation.mutate({
      data: formData.data,
      tipo_relatorio: formData.tipo_relatorio,
      responsavel: formData.responsavel,
      status: formData.status,
    });
  };

  const handleSaveConfig = () => {
    const responsaveisArray = configFormData.responsaveis
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    
    saveConfigMutation.mutate({
      id: editingConfig?.id,
      tipo_relatorio: configFormData.tipo_relatorio,
      pontos_no_horario: configFormData.pontos_no_horario,
      pontos_esqueceu_ou_erro: configFormData.pontos_esqueceu_ou_erro,
      pontos_fora_do_horario: configFormData.pontos_fora_do_horario,
      horario_limite: configFormData.horario_limite,
      responsaveis: responsaveisArray,
    });
  };

  const openEditConfig = (config: ReportConfig) => {
    setEditingConfig(config);
    setConfigFormData({
      tipo_relatorio: config.tipo_relatorio,
      pontos_no_horario: config.pontos_no_horario,
      pontos_esqueceu_ou_erro: config.pontos_esqueceu_ou_erro,
      pontos_fora_do_horario: config.pontos_fora_do_horario,
      horario_limite: config.horario_limite,
      responsaveis: config.responsaveis?.join(", ") || "",
    });
    setConfigDialogOpen(true);
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case "NO_HORARIO":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> No Horário</Badge>;
      case "FORA_DO_HORARIO":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Clock className="h-3 w-3 mr-1" /> Fora do Horário</Badge>;
      case "ESQUECEU_ERRO":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Esqueceu/Erro</Badge>;
    }
  };

  const chartData = normalizedRanking.map((r) => ({
    name: r.responsavel,
    pontos: r.totalNormalizedScore,
    media: r.averageDailyScore,
  }));

  const controleCsvColumns = [
    { key: "data", header: "Data" },
    { key: "tipo_relatorio", header: "Tipo Relatório" },
    { key: "responsavel", header: "Responsável" },
    { key: "status", header: "Status" },
    { key: "pontos_calculados", header: "Pontos" },
  ];

  // Get responsaveis for selected report type
  const selectedConfig = configs.find((c) => c.tipo_relatorio === formData.tipo_relatorio);
  const availableResponsaveis = selectedConfig?.responsaveis || [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Controle de Relatórios
            </h1>
            <p className="text-muted-foreground">
              Gerencie envios de relatórios e pontuações
            </p>
          </div>
          
          {isAdmin && (
            <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingConfig(null);
                    setConfigFormData({
                      tipo_relatorio: "",
                      pontos_no_horario: 20,
                      pontos_esqueceu_ou_erro: -40,
                      pontos_fora_do_horario: -10,
                      horario_limite: "ATÉ 09:00",
                      responsaveis: "",
                    });
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurações
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingConfig ? "Editar Configuração" : "Nova Configuração de Relatório"}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo do Relatório</Label>
                      <Input
                        value={configFormData.tipo_relatorio}
                        onChange={(e) =>
                          setConfigFormData({ ...configFormData, tipo_relatorio: e.target.value })
                        }
                        placeholder="Ex: Relatório Diário"
                      />
                    </div>
                    <div>
                      <Label>Horário Limite</Label>
                      <Input
                        value={configFormData.horario_limite}
                        onChange={(e) =>
                          setConfigFormData({ ...configFormData, horario_limite: e.target.value })
                        }
                        placeholder="Ex: ATÉ 09:00"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Pontos No Horário</Label>
                      <Input
                        type="number"
                        value={configFormData.pontos_no_horario}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            pontos_no_horario: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Pontos Fora do Horário</Label>
                      <Input
                        type="number"
                        value={configFormData.pontos_fora_do_horario}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            pontos_fora_do_horario: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Pontos Esqueceu/Erro</Label>
                      <Input
                        type="number"
                        value={configFormData.pontos_esqueceu_ou_erro}
                        onChange={(e) =>
                          setConfigFormData({
                            ...configFormData,
                            pontos_esqueceu_ou_erro: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Responsáveis (separados por vírgula)</Label>
                    <Input
                      value={configFormData.responsaveis}
                      onChange={(e) =>
                        setConfigFormData({ ...configFormData, responsaveis: e.target.value })
                      }
                      placeholder="Ex: Guilherme, Wander, Cadu, Jonas"
                    />
                  </div>
                  
                  <Button onClick={handleSaveConfig} className="w-full">
                    {editingConfig ? "Salvar Alterações" : "Criar Configuração"}
                  </Button>
                </div>
                
                {/* List existing configs */}
                {configs.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="font-medium mb-3">Configurações Existentes</h4>
                    <div className="space-y-2">
                      {configs.map((config) => (
                        <div
                          key={config.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <span className="font-medium">{config.tipo_relatorio}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({config.horario_limite})
                            </span>
                            <div className="text-xs text-muted-foreground">
                              +{config.pontos_no_horario} / {config.pontos_fora_do_horario} / {config.pontos_esqueceu_ou_erro}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditConfig(config)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteConfigMutation.mutate(config.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="registro">Registrar Envio</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          {/* Tab Registro */}
          <TabsContent value="registro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Registrar Envio de Relatório
                </CardTitle>
              </CardHeader>
              <CardContent>
                {configs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma configuração de relatório encontrada.</p>
                    <p className="text-sm">Configure os tipos de relatório primeiro.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={formData.data}
                          onChange={(e) =>
                            setFormData({ ...formData, data: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label>Tipo de Relatório</Label>
                        <Select
                          value={formData.tipo_relatorio}
                          onValueChange={(v) =>
                            setFormData({ ...formData, tipo_relatorio: v, responsavel: "" })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {configs.map((c) => (
                              <SelectItem key={c.id} value={c.tipo_relatorio}>
                                {c.tipo_relatorio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Responsável</Label>
                        <Select
                          value={formData.responsavel}
                          onValueChange={(v) =>
                            setFormData({ ...formData, responsavel: v })
                          }
                          disabled={!formData.tipo_relatorio}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableResponsaveis.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(v) =>
                            setFormData({ ...formData, status: v as ReportStatus })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NO_HORARIO">No Horário</SelectItem>
                            <SelectItem value="FORA_DO_HORARIO">Fora do Horário</SelectItem>
                            <SelectItem value="ESQUECEU_ERRO">Esqueceu/Erro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    
                    <Button type="submit" disabled={createEntryMutation.isPending}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Registrar
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Histórico de Envios
                  </span>
                  <ExportButton
                    data={controleDiario}
                    filename={`controle-relatorios-${filterStartDate}-a-${filterEndDate}`}
                    columns={controleCsvColumns}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4">
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-44 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-44 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                      <SelectTrigger className="w-44 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {allResponsaveis.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo Relatório</Label>
                    <Select value={filterTipoRelatorio} onValueChange={setFilterTipoRelatorio}>
                      <SelectTrigger className="w-44 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {configs.map((c) => (
                          <SelectItem key={c.id} value={c.tipo_relatorio}>
                            {c.tipo_relatorio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isLoading ? (
                  <p>Carregando...</p>
                ) : controleDiario.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum registro encontrado para o período.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Pontos</TableHead>
                          {isAdmin && <TableHead className="w-12"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controleDiario.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {format(new Date(item.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{item.tipo_relatorio}</TableCell>
                            <TableCell>{item.responsavel}</TableCell>
                            <TableCell>{getStatusBadge(item.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              <span className={item.pontos_calculados >= 0 ? "text-green-600" : "text-red-600"}>
                                {item.pontos_calculados > 0 ? "+" : ""}{item.pontos_calculados}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEntryMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking">
            {/* Scoring Rules Explainer */}
            <div className="mb-6">
              <ScoringRulesExplainer />
            </div>

            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Período:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={rankingPeriod === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankingPeriod("week")}
                >
                  Esta Semana
                </Button>
                <Button
                  variant={rankingPeriod === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankingPeriod("month")}
                >
                  Este Mês
                </Button>
                <Button
                  variant={rankingPeriod === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankingPeriod("all")}
                >
                  Todo Período
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Ranking Normalizado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {normalizedRanking.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado disponível ainda.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead className="text-center">No Horário</TableHead>
                            <TableHead className="text-center">Fora</TableHead>
                            <TableHead className="text-center">Erros</TableHead>
                            <TableHead className="text-center">Dias</TableHead>
                            <TableHead className="text-right">Média/Dia</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {normalizedRanking.map((r, index) => (
                            <TableRow key={r.responsavel}>
                              <TableCell>
                                {index === 0 && "🥇"}
                                {index === 1 && "🥈"}
                                {index === 2 && "🥉"}
                                {index > 2 && index + 1}
                              </TableCell>
                              <TableCell className="font-medium">{r.responsavel}</TableCell>
                              <TableCell className="text-center text-green-600">
                                {r.totalOnTime}
                              </TableCell>
                              <TableCell className="text-center text-yellow-600">
                                {r.totalLate}
                              </TableCell>
                              <TableCell className="text-center text-red-600">
                                {r.totalErrors}
                              </TableCell>
                              <TableCell className="text-center">
                                {r.totalDays}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={r.averageDailyScore >= 0 ? "text-green-600" : "text-red-600"}>
                                  {r.averageDailyScore > 0 ? "+" : ""}{r.averageDailyScore.toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                <span className={r.totalNormalizedScore >= 0 ? "text-green-600" : "text-red-600"}>
                                  {r.totalNormalizedScore > 0 ? "+" : ""}{r.totalNormalizedScore.toFixed(2)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Gráfico de Pontuação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {normalizedRanking.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado disponível ainda.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                        <XAxis type="number" domain={['auto', 'auto']} />
                        <YAxis type="category" dataKey="name" width={80} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            value.toFixed(2),
                            name === "pontos" ? "Total" : "Média/Dia"
                          ]}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="pontos" name="Total" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.pontos >= 0 ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily Evolution Chart */}
            {dailyScoresForChart.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Evolução Diária (Últimos 30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={dailyScoresForChart
                        .sort((a, b) => a.data.localeCompare(b.data))
                        .slice(-30)}
                      margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="data" 
                        tickFormatter={(value) => format(new Date(value + "T12:00:00"), "dd/MM")}
                        fontSize={12}
                      />
                      <YAxis domain={[-20, 20]} />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value + "T12:00:00"), "dd/MM/yyyy")}
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(2)} pts`,
                          name
                        ]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="normalizedScore"
                        name="Pontuação"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
