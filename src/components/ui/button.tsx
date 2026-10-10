import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botones de Woref. Tres colores con roles claros:
 *  - default (verde de marca): la acción principal de la pantalla.
 *  - accent (amarillo de marca): lo que conviene destacar (promos, "nuevo", publicar).
 *  - ink (azul tinta): acción secundaria fuerte, sobria.
 * Relieve sutil (brillo arriba + sombra de color), elevación al pasar y leve hundimiento al apretar.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.005em] ring-offset-background transition-[transform,box-shadow,background-color,border-color,color,filter] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:ring-offset-1 active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:m-0 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,hsl(163_50%_45%),hsl(163_58%_35%))] text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.22),0_1px_2px_hsl(163_60%_18%/0.3),0_6px_16px_-6px_hsl(163_56%_30%/0.55)] hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25),0_2px_4px_hsl(163_60%_18%/0.25),0_12px_24px_-10px_hsl(163_56%_30%/0.6)]",
        accent:
          "bg-[linear-gradient(180deg,hsl(46_100%_56%),hsl(43_100%_47%))] text-brand-yellow-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.45),0_1px_2px_hsl(40_80%_25%/0.25),0_6px_16px_-6px_hsl(43_100%_40%/0.55)] hover:-translate-y-px hover:brightness-[1.04]",
        ink:
          "bg-[linear-gradient(180deg,hsl(222_40%_24%),hsl(222_47%_14%))] text-ink-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14),0_1px_2px_hsl(222_47%_8%/0.35),0_6px_16px_-6px_hsl(222_47%_12%/0.5)] hover:-translate-y-px hover:brightness-[1.15]",
        destructive:
          "bg-[linear-gradient(180deg,hsl(354_75%_55%),hsl(354_78%_46%))] text-destructive-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2),0_1px_2px_hsl(354_70%_25%/0.3),0_6px_16px_-6px_hsl(354_78%_40%/0.5)] hover:-translate-y-px hover:brightness-[1.05]",
        outline:
          "border border-[hsl(220_13%_86%)] bg-white/90 text-foreground shadow-[0_1px_2px_hsl(222_30%_20%/0.06),inset_0_1px_0_hsl(0_0%_100%)] backdrop-blur hover:-translate-y-px hover:border-[hsl(220_13%_76%)] hover:bg-white hover:shadow-[0_4px_12px_-4px_hsl(222_30%_20%/0.14)] dark:border-input dark:bg-background dark:hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)] hover:bg-secondary/80",
        ghost: "hover:bg-foreground/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
