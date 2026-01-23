import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell } from "recharts";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface OSE {
  id: string;
  ose_number: string;
  total_value: number;
  validated_value?: number | null;
  description?: string | null;
  trips?: {
    date: string;
    team?: { name: string };
  }[];
}

interface ValuesComparisonChartProps {
  oses: OSE[];
  dateFromFilter?: Date;
  dateToFilter?: Date;
}

interface DayActivities {
  date: string;
  dateLabel: string;
  activities: {
    oseNumber: string;
    oseId: string;
    description?: string | null;
    teamName: string;
    valueContribution: number;
    validatedContribution: number;
  }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatCurrencyShort = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const formatLabelValue = (value: number) => {
  if (value === 0) return "";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

export function ValuesComparisonChart({ oses, dateFromFilter, dateToFilter }: ValuesComparisonChartProps) {
  const [selectedDay, setSelectedDay] = useState<DayActivities | null>(null);

  // Build activities map for each day
  const activitiesByDate = useMemo(() => {
    const map: Record<string, DayActivities["activities"]> = {};
    
    oses.forEach(ose => {
      if (!ose.trips || ose.trips.length === 0) return;
      
      const tripDates = ose.trips.filter(t => t.date);
      if (tripDates.length === 0) return;
      
      const valuePerTrip = ose.total_value / tripDates.length;
      const validatedPerTrip = (ose.validated_value || 0) / tripDates.length;
      
      tripDates.forEach(trip => {
        const dateKey = trip.date;
        if (!map[dateKey]) {
          map[dateKey] = [];
        }
        map[dateKey].push({
          oseNumber: ose.ose_number,
          oseId: ose.id,
          description: ose.description,
          teamName: trip.team?.name || "Sem equipe",
          valueContribution: valuePerTrip,
          validatedContribution: validatedPerTrip,
        });
      });
    });
    
    return map;
  }, [oses]);

  const chartData = useMemo(() => {
    const startDate = dateFromFilter || startOfMonth(new Date());
    const endDate = dateToFilter || endOfMonth(new Date());
    
    const dateValues: Record<string, { realized: number; validated: number }> = {};
    
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    allDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      dateValues[dateKey] = { realized: 0, validated: 0 };
    });
    
    oses.forEach(ose => {
      if (!ose.trips || ose.trips.length === 0) return;
      
      const tripDates = ose.trips.map(t => t.date).filter(Boolean);
      if (tripDates.length === 0) return;
      
      const valuePerTrip = ose.total_value / tripDates.length;
      const validatedPerTrip = (ose.validated_value || 0) / tripDates.length;
      
      tripDates.forEach(dateStr => {
        const tripDate = parseISO(dateStr);
        if (tripDate >= startDate && tripDate <= endDate) {
          const dateKey = format(tripDate, "yyyy-MM-dd");
          if (dateValues[dateKey]) {
            dateValues[dateKey].realized += valuePerTrip;
            dateValues[dateKey].validated += validatedPerTrip;
          }
        }
      });
    });
    
    return Object.entries(dateValues)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        dateLabel: format(parseISO(date), "dd/MM", { locale: ptBR }),
        realizado: Math.round(values.realized * 100) / 100,
        validado: Math.round(values.validated * 100) / 100,
      }));
  }, [oses, dateFromFilter, dateToFilter]);

  const totals = useMemo(() => {
    const realized = oses.reduce((sum, ose) => sum + (ose.total_value || 0), 0);
    const validated = oses.reduce((sum, ose) => sum + (ose.validated_value || 0), 0);
    const difference = realized - validated;
    const percentage = realized > 0 ? ((validated / realized) * 100) : 0;
    
    return { realized, validated, difference, percentage };
  }, [oses]);

  const handleBarClick = (data: { date: string; dateLabel: string }) => {
    const activities = activitiesByDate[data.date] || [];
    if (activities.length > 0) {
      setSelectedDay({
        date: data.date,
        dateLabel: data.dateLabel,
        activities,
      });
    }
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Comparativo Realizado vs Validado
          </CardTitle>
          <CardDescription>
            Selecione um período com dados para visualizar o gráfico
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Comparativo Realizado vs Validado</CardTitle>
              <CardDescription>Valores diários no período (clique em uma barra para ver detalhes)</CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-muted-foreground">Realizado:</span>
                <span className="font-bold">{formatCurrency(totals.realized)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-muted-foreground">Validado:</span>
                <span className="font-bold">{formatCurrency(totals.validated)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Diferença:</span>
                <span className={`font-bold ${totals.difference > 0 ? "text-warning" : "text-success"}`}>
                  {formatCurrency(Math.abs(totals.difference))}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]?.payload) {
                    handleBarClick(data.activePayload[0].payload);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="dateLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "realizado" ? "Realizado" : "Validado EQTL"
                  ]}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Legend 
                  formatter={(value) => value === "realizado" ? "Realizado" : "Validado EQTL"}
                />
                <Bar
                  dataKey="realizado"
                  fill="hsl(25, 95%, 53%)"
                  radius={[4, 4, 0, 0]}
                  name="realizado"
                >
                  <LabelList dataKey="realizado" position="top" formatter={formatLabelValue} fontSize={10} fill="hsl(25, 95%, 40%)" />
                </Bar>
                <Bar
                  dataKey="validado"
                  fill="hsl(142, 76%, 36%)"
                  radius={[4, 4, 0, 0]}
                  name="validado"
                >
                  <LabelList dataKey="validado" position="top" formatter={formatLabelValue} fontSize={10} fill="hsl(142, 76%, 30%)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Atividades do dia {selectedDay?.dateLabel}
              <Badge variant="outline">{selectedDay?.activities.length} registro(s)</Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {selectedDay?.activities.map((activity, idx) => (
                <div 
                  key={`${activity.oseId}-${idx}`}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="font-medium">{activity.oseNumber}</div>
                    <div className="text-sm text-muted-foreground">
                      {activity.teamName}
                    </div>
                    {activity.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {activity.description}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-warning">
                      {formatCurrency(activity.valueContribution)}
                    </div>
                    {activity.validatedContribution > 0 && (
                      <div className="text-xs text-success">
                        Validado: {formatCurrency(activity.validatedContribution)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total Realizado:</span>
              <span className="font-bold text-warning">
                {formatCurrency(selectedDay?.activities.reduce((sum, a) => sum + a.valueContribution, 0) || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="font-medium">Total Validado:</span>
              <span className="font-bold text-success">
                {formatCurrency(selectedDay?.activities.reduce((sum, a) => sum + a.validatedContribution, 0) || 0)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}