import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

type AnimationType = 
  | "fade-in" 
  | "fade-in-up" 
  | "slide-in-left" 
  | "slide-in-right" 
  | "slide-in-up" 
  | "scale-in" 
  | "scale-in-center";

interface AnimatedContainerProps extends HTMLAttributes<HTMLDivElement> {
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  children: React.ReactNode;
}

const AnimatedContainer = forwardRef<HTMLDivElement, AnimatedContainerProps>(
  ({ animation = "fade-in", delay = 0, duration, className, style, children, ...props }, ref) => {
    const animationClass = `animate-${animation}`;
    
    return (
      <div
        ref={ref}
        className={cn("opacity-0", animationClass, className)}
        style={{
          animationDelay: `${delay}ms`,
          ...(duration && { animationDuration: `${duration}ms` }),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AnimatedContainer.displayName = "AnimatedContainer";

export { AnimatedContainer };
export type { AnimationType };
