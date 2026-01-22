import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

const accentColors = {
  default: "bg-primary",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const iconBgColors = {
  default: "bg-primary/8",
  primary: "bg-primary/8",
  success: "bg-success/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
};

const iconColors = {
  default: "text-primary",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
}: StatsCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-border p-6 relative overflow-hidden",
        "shadow-premium transition-all duration-200 ease-in-out",
        "hover:shadow-premium-hover hover:-translate-y-0.5",
        isClickable && "cursor-pointer"
      )}
    >
      {/* Accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-2xl", accentColors[variant])} />
      
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-caption font-medium text-muted-foreground truncate">
            {title}
          </p>
          <p className="text-kpi-sm tracking-tight text-foreground">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-caption flex items-center gap-1.5 font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}
            >
              <span className="text-xs">
                {trend.isPositive ? "↑" : "↓"}
              </span>
              {Math.abs(trend.value)}%
              <span className="text-muted-foreground font-normal hidden sm:inline">
                vs mês anterior
              </span>
            </p>
          )}
        </div>
        <div
          className={cn(
            "p-3 rounded-xl flex-shrink-0",
            iconBgColors[variant]
          )}
        >
          <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", iconColors[variant])} />
        </div>
      </div>
    </div>
  );
}