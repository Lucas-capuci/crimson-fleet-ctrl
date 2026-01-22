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
  default: "bg-primary/10",
  primary: "bg-primary/10",
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
        "stats-card p-5 sm:p-6 animate-fade-in",
        isClickable && "cursor-pointer"
      )}
    >
      {/* Accent bar */}
      <div className={cn("stats-card-accent rounded-t-2xl", accentColors[variant])} />
      
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-sm flex items-center gap-1.5 font-medium",
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