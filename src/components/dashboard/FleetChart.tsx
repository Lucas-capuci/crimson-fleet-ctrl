import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", manutencoes: 4, custos: 2400 },
  { month: "Fev", manutencoes: 3, custos: 1800 },
  { month: "Mar", manutencoes: 6, custos: 3200 },
  { month: "Abr", manutencoes: 2, custos: 1200 },
  { month: "Mai", manutencoes: 5, custos: 2800 },
  { month: "Jun", manutencoes: 4, custos: 2100 },
];

export function FleetChart() {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Manutenções por Mês
        </h3>
        <p className="text-sm text-muted-foreground">
          Acompanhamento de manutenções realizadas
        </p>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorManutencoes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 76%, 28%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 76%, 28%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 10%, 88%)" />
            <XAxis
              dataKey="month"
              stroke="hsl(0, 0%, 45%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(0, 0%, 45%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(0, 10%, 88%)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Area
              type="monotone"
              dataKey="manutencoes"
              stroke="hsl(0, 76%, 28%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorManutencoes)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
