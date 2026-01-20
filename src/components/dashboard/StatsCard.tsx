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

const variantStyles = {
  default: "bg-card border border-border",
  primary: "gradient-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const iconVariantStyles = {
  default: "bg-primary/10 text-primary",
  primary: "bg-primary-foreground/20 text-primary-foreground",
  success: "bg-success-foreground/20 text-success-foreground",
  warning: "bg-warning-foreground/20 text-warning-foreground",
  destructive: "bg-destructive-foreground/20 text-destructive-foreground",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  onClick,
}: StatsCardProps) {
  const isColored = variant !== "default";
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl p-4 sm:p-6 card-hover animate-fade-in touch-target",
        variantStyles[variant],
        isClickable && "cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
          <p
            className={cn(
              "text-xs sm:text-sm font-medium truncate",
              isColored ? "opacity-90" : "text-muted-foreground"
            )}
          >
            {title}
          </p>
          <p className="text-xl sm:text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs sm:text-sm flex items-center gap-1",
                isColored ? "opacity-80" : "",
                !isColored && (trend.isPositive ? "text-success" : "text-destructive")
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              <span className="opacity-70 hidden sm:inline">vs mês anterior</span>
            </p>
          )}
        </div>
        <div
          className={cn(
            "p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0",
            iconVariantStyles[variant]
          )}
        >
          <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}
