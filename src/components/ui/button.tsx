import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botones de Woref (sistema de diseño 2026-10): planos, esquinas de 8 px, foco visible con halo azul.
 *  - default (azul marino de marca): la acción principal de la pantalla.
 *  - accent (amarillo de marca): lo que conviene destacar (promos, "nuevo", publicar).
 *  - ink (tinta): acción secundaria fuerte, sobria.
 *  - outline / secondary / ghost / link: acciones secundarias y terciarias.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,filter] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:m-0 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(222_50%_10%/0.18)] hover:bg-primary/90",
        accent: "bg-brand-yellow text-brand-yellow-foreground shadow-[0_1px_2px_hsl(40_60%_15%/0.15)] hover:brightness-95",
        ink: "bg-ink text-ink-foreground shadow-[0_1px_2px_hsl(222_50%_6%/0.25)] hover:bg-ink/90",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_1px_2px_hsl(354_60%_20%/0.2)] hover:bg-destructive/90",
        outline: "border border-input bg-card text-foreground shadow-[0_1px_2px_hsl(220_30%_12%/0.05)] hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** Las pantallas que pedían botones "píldora" (rounded-full) reciben la forma del sistema: esquinas de 8 px. */
const sinPildora = (className?: string) => className?.replace(/(^|\s)rounded-full(?=\s|$)/g, "$1rounded-lg");

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className: sinPildora(className) }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
