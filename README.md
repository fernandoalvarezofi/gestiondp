# Woref

Plataforma digital en construcción: **tiendas online, marketplace, delivery, mensajería, movilidad y red de prestadores** sobre una infraestructura común. Hoy funciona como plataforma de delivery multi-comercio con constructor de tiendas online.

- Producción: <https://woref.vercel.app>
- Documentación de diseño: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (arquitectura actual y objetivo) y [`ROADMAP.md`](./ROADMAP.md) (fases de transformación).

## Stack

React 18 · TypeScript · Vite · Tailwind · shadcn/ui (Radix) · React Router · React Query · Leaflet · PWA (`vite-plugin-pwa`) · Capacitor (app Android del repartidor) · **Supabase** (Postgres + RLS + Auth + Storage + Edge Functions) · Vercel · Mercado Pago.

## Estructura

```
src/            pages/ components/ contexts/ hooks/ lib/ services/ integrations/
supabase/
  migrations/   migraciones de la base de Woref (ver su README: reglas y correspondencia)
  legacy/       migraciones heredadas de otro proyecto — NO se aplican
  functions/    Edge Functions (push, Mercado Pago, rutas)
  admin-db/     esquema y función de la base de administración separada (consola del dueño)
  tests/        pruebas SQL (exposición de datos)
api/            función serverless de Vercel (Open Graph de tiendas)
android/        proyecto Capacitor
```

## Desarrollo

```sh
npm install
npm run dev          # servidor de desarrollo de Vite
npm run typecheck    # tipos
npm run lint
npm test             # pruebas unitarias (Vitest)
npm run build        # genera el sitemap y compila
```

Variables de entorno (en `.env`, nunca se suben): `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (clave **publicable**; las claves secretas viven solo en Supabase y Vercel).

## Base de datos y seguridad

- Dos proyectos Supabase: **`woref-delivery`** (usuarios y negocio) y **`woref-admin`** (auditoría, errores y métricas del dueño; login y 2FA propios en `/consola`).
- **RLS en todas las tablas.** La lógica crítica (pedidos, stock, cupones, liquidaciones, libro contable) vive en funciones SQL; el front las consume.
- `perfiles.telefono` y `delivery_comercios.comision_pct` **no son legibles por la API**: el teléfono propio se obtiene con `delivery_mi_perfil()` (ver `src/services/profile.ts`) y los comercios se leen con la lista de columnas públicas `COMERCIO_COLS` (`src/lib/delivery.ts`). Toda columna nueva y pública de esas tablas necesita su propio `GRANT SELECT`.
- Los tipos (`src/integrations/supabase/types.ts`) se **regeneran desde la base real** cuando cambia el esquema.
- Antes de cambiar permisos o políticas, correr `supabase/tests/001_exposicion.sql`.

## Reglas de trabajo

1. Migraciones **aditivas** y compatibles; nada destructivo sin aprobación y copia previa. No renombrar `delivery_*` (se construye el Core por encima).
2. El nombre de cada archivo de migración coincide con el aplicado en Supabase.
3. La lógica de negocio crítica va en el backend (SQL/Edge), no en componentes React; el acceso a datos nuevo va en `src/services/`.
4. Antes de un feature nuevo, responder la lista del `ROADMAP.md` (módulo, reutilización del Core, seguridad, pagos, estados, mobile).
