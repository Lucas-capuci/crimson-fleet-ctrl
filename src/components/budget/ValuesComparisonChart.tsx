import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OSE {
  id: string;
  ose_number: string;
  total_value: number;
  validated_value?: number | null;
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

export function ValuesComparisonChart({ oses, dateFromFilter, dateToFilter }: ValuesComparisonChartProps) {
  const chartData = useMemo(() => {
    // Get date range from filters or use current month
    const startDate = dateFromFilter || startOfMonth(new Date());
    const endDate = dateToFilter || endOfMonth(new Date());
    
    // Create a map of dates to values
    const dateValues: Record<string, { realized: number; validated: number }> = {};
    
    // Initialize all days with 0
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    allDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      dateValues[dateKey] = { realized: 0, validated: 0 };
    });
    
    // Aggregate OSE values by trip dates
    oses.forEach(ose => {
      if (!ose.trips || ose.trips.length === 0) return;
      
      // Distribute the OSE value across its trip dates
      const tripDates = ose.trips.map(t => t.date).filter(Boolean);
      if (tripDates.length === 0) return;
      
      // Calculate value per trip
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
    
    // Convert to array and accumulate values
    let accumulatedRealized = 0;
    let accumulatedValidated = 0;
    
    return Object.entries(dateValues)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => {
        accumulatedRealized += values.realized;
        accumulatedValidated += values.validated;
        
        return {
          date,
          dateLabel: format(parseISO(date), "dd/MM", { locale: ptBR }),
          realizado: Math.round(accumulatedRealized * 100) / 100,
          validado: Math.round(accumulatedValidated * 100) / 100,
          realizadoDia: Math.round(values.realized * 100) / 100,
          validadoDia: Math.round(values.validated * 100) / 100,
        };
      });
  }, [oses, dateFromFilter, dateToFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const realized = oses.reduce((sum, ose) => sum + (ose.total_value || 0), 0);
    const validated = oses.reduce((sum, ose) => sum + (ose.validated_value || 0), 0);
    const difference = realized - validated;
    const percentage = realized > 0 ? ((validated / realized) * 100) : 0;
    
    return { realized, validated, difference, percentage };
  }, [oses]);

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
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Comparativo Realizado vs Validado</CardTitle>
            <CardDescription>Evolução acumulada dos valores no período</CardDescription>
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
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  name === "realizado" ? "Realizado (acumulado)" : "Validado (acumulado)"
                ]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend 
                formatter={(value) => value === "realizado" ? "Realizado" : "Validado EQTL"}
              />
              <Line
                type="monotone"
                dataKey="realizado"
                stroke="hsl(25, 95%, 53%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name="realizado"
              />
              <Line
                type="monotone"
                dataKey="validado"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                name="validado"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
