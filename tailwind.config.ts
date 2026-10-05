import tailwindcssAnimate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Pila del sistema: cero descargas de fuentes (carga inmediata) y lectura nítida en catálogos largos.
        sans: ["Figtree Variable", "Helvetica Neue", "Helvetica", "Arial", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Figtree Variable", "Helvetica Neue", "Helvetica", "Arial", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        brand: ["Figtree Variable", "Helvetica Neue", "Helvetica", "Arial", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      backgroundImage: {
        "gradient-ember": "var(--gradient-ember)",
        "gradient-ink": "var(--gradient-ink)",
        "gradient-cream": "var(--gradient-cream)",
      },
      boxShadow: {
        ember: "var(--shadow-ember)",
        soft: "var(--shadow-soft)",
        pop: "var(--shadow-pop)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        stage: {
          prospect: "hsl(var(--stage-prospect))",
          qualified: "hsl(var(--stage-qualified))",
          proposal: "hsl(var(--stage-proposal))",
          negotiation: "hsl(var(--stage-negotiation))",
          won: "hsl(var(--stage-won))",
          lost: "hsl(var(--stage-lost))",
        },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        info: "hsl(var(--info))",
        "brand-deep": "hsl(var(--brand-deep))",
        "brand-cream": "hsl(var(--brand-cream))",
        "brand-orange": "hsl(var(--brand-orange))",
        "surface-mint": {
          DEFAULT: "hsl(var(--surface-mint))",
          strong: "hsl(var(--surface-mint-strong))",
        },
        "teal-data": "hsl(var(--teal-data))",
        "teal-dark": "hsl(var(--teal-dark))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "ride": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pop-in": "pop-in 0.35s cubic-bezier(.2,.9,.3,1.3)",
        ride: "ride 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
