-- Woref Logística (estilo Andreani): envíos de paquetes locales e interurbanos con número de seguimiento, bultos, etiquetas,
-- sucursales/centros, tarifas por zona y peso, clientes con cuenta (CRM), retiros, hojas de ruta, incidencias y rendición de
-- contra reembolso. Convive con la mensajería en el día (delivery_envios), que no se toca.
-- Escritura: solo por funciones del servidor (siguiente migración). Lectura: administración todo; cada comercio, lo suyo.

create or replace function public.log_es_admin() returns boolean
language sql stable security definer set search_path to 'public' as $$ select coalesce(public.has_role(auth.uid(), 'admin'::app_role), false) $$;

-- Sucursales, centros de distribución y puntos de retiro ---------------------------------------------------------------------
create table if not exists public.log_sucursales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{2,8}$'),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  tipo text not null default 'sucursal' check (tipo in ('centro', 'sucursal', 'punto')),
  direccion text not null check (char_length(direccion) between 3 and 200),
  ciudad text not null check (char_length(ciudad) between 2 and 80),
  provincia text not null check (char_length(provincia) between 2 and 60),
  cp integer not null check (cp between 1000 and 9999),
  lat numeric, lng numeric,
  telefono text check (telefono is null or char_length(telefono) <= 30),
  horario text check (horario is null or char_length(horario) <= 120),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- Zonas tarifarias por código postal (la primera que contiene el CP, por orden) -------------------------------------------
create table if not exists public.log_zonas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(btrim(nombre)) between 2 and 60),
  cps int4multirange not null,
  express boolean not null default false,
  orden integer not null default 100,
  created_at timestamptz not null default now()
);

-- Tarifarios: precio por servicio, zona de origen, zona de destino y franja de peso -----------------------------------------
create table if not exists public.log_tarifarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  por_defecto boolean not null default false,
  kg_extra numeric(12,2) not null default 0 check (kg_extra >= 0),
  seguro_pct numeric(5,2) not null default 1 check (seguro_pct between 0 and 20),
  reembolso_pct numeric(5,2) not null default 2 check (reembolso_pct between 0 and 20),
  retiro_precio numeric(12,2) not null default 0 check (retiro_precio >= 0),
  divisor_volumetrico integer not null default 4000 check (divisor_volumetrico between 1000 and 10000),
  dias_estandar integer not null default 4 check (dias_estandar between 1 and 30),
  dias_prioritario integer not null default 2 check (dias_prioritario between 1 and 30),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists log_tarifarios_defecto_idx on public.log_tarifarios (por_defecto) where por_defecto;

create table if not exists public.log_tarifas (
  id uuid primary key default gen_random_uuid(),
  tarifario_id uuid not null references public.log_tarifarios (id) on delete cascade,
  servicio text not null check (servicio in ('express', 'estandar', 'prioritario')),
  zona_origen uuid not null references public.log_zonas (id) on delete cascade,
  zona_destino uuid not null references public.log_zonas (id) on delete cascade,
  hasta_kg numeric(8,2) not null check (hasta_kg > 0 and hasta_kg <= 1000),
  precio numeric(12,2) not null check (precio >= 0),
  unique (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg)
);
create index if not exists log_tarifas_busqueda_idx on public.log_tarifas (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg);

-- Cuentas de clientes (CRM): comercios de Woref, empresas o particulares ---------------------------------------------------
create table if not exists public.log_cuentas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 10001) unique,
  tipo text not null default 'empresa' check (tipo in ('comercio', 'empresa', 'particular')),
  comercio_id uuid unique references public.delivery_comercios (id) on delete set null,
  razon_social text not null check (char_length(btrim(razon_social)) between 2 and 120),
  nombre_fantasia text check (nombre_fantasia is null or char_length(nombre_fantasia) <= 120),
  cuit text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  condicion_iva text check (condicion_iva is null or condicion_iva in ('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final')),
  contacto_nombre text check (contacto_nombre is null or char_length(contacto_nombre) <= 80),
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  telefono text check (telefono is null or char_length(telefono) <= 30),
  direccion_retiro text check (direccion_retiro is null or char_length(direccion_retiro) <= 200),
  ciudad text check (ciudad is null or char_length(ciudad) <= 80),
  provincia text check (provincia is null or char_length(provincia) <= 60),
  cp integer check (cp is null or cp between 1000 and 9999),
  lat numeric, lng numeric,
  tarifario_id uuid references public.log_tarifarios (id) on delete set null,
  condicion_pago text not null default 'contado' check (condicion_pago in ('contado', 'cuenta_corriente')),
  limite_credito numeric(14,2) not null default 0 check (limite_credito >= 0),
  estado text not null default 'activa' check (estado in ('prospecto', 'activa', 'suspendida')),
  ejecutivo_id uuid references auth.users (id) on delete set null,
  etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 10),
  notas text check (notas is null or char_length(notas) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists log_cuentas_texto_idx on public.log_cuentas (lower(razon_social));

create table if not exists public.log_actividades (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.log_cuentas (id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'llamada', 'email', 'reunion', 'tarea', 'whatsapp')),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 120),
  detalle text check (detalle is null or char_length(detalle) <= 2000),
  vence_at timestamptz, completada_at timestamptz,
  autor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists log_actividades_cuenta_idx on public.log_actividades (cuenta_id, created_at desc);

-- Retiros a domicilio ------------------------------------------------------------------------------------------------------
create table if not exists public.log_retiros (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.log_cuentas (id) on delete cascade,
  direccion text not null check (char_length(direccion) between 3 and 200),
  ciudad text, cp integer check (cp is null or cp between 1000 and 9999), lat numeric, lng numeric,
  contacto text, telefono text,
  fecha date not null,
  franja text not null default 'manana' check (franja in ('manana', 'tarde')),
  estado text not null default 'solicitado' check (estado in ('solicitado', 'asignado', 'realizado', 'fallido', 'cancelado')),
  repartidor_id uuid references auth.users (id) on delete set null,
  notas text check (notas is null or char_length(notas) <= 300),
  motivo text check (motivo is null or char_length(motivo) <= 200),
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  realizado_at timestamptz
);
create index if not exists log_retiros_fecha_idx on public.log_retiros (fecha, estado);

-- Hojas de ruta (última milla) ---------------------------------------------------------------------------------------------
create table if not exists public.log_hojas_ruta (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 1001) unique,
  repartidor_id uuid not null references auth.users (id),
  sucursal_id uuid references public.log_sucursales (id),
  fecha date not null default current_date,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);
create index if not exists log_hojas_repartidor_idx on public.log_hojas_ruta (repartidor_id, estado);

-- Rendiciones de contra reembolso y pagos de cuenta corriente ---------------------------------------------------------------
create table if not exists public.log_rendiciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 501) unique,
  cuenta_id uuid not null references public.log_cuentas (id) on delete cascade,
  monto numeric(14,2) not null check (monto >= 0),
  cantidad integer not null check (cantidad > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  referencia text check (referencia is null or char_length(referencia) <= 120),
  created_at timestamptz not null default now(),
  pagada_at timestamptz
);
create table if not exists public.log_pagos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.log_cuentas (id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  medio text not null check (medio in ('transferencia', 'efectivo', 'mercadopago', 'cheque', 'otro')),
  referencia text check (referencia is null or char_length(referencia) <= 120),
  fecha date not null default current_date,
  registrado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Envíos -------------------------------------------------------------------------------------------------------------------
create sequence if not exists public.log_envio_seq start with 1000001;
create table if not exists public.log_envios (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('WR' || lpad(nextval('public.log_envio_seq')::text, 10, '0')),
  clave uuid unique,
  cuenta_id uuid not null references public.log_cuentas (id),
  comercio_id uuid references public.delivery_comercios (id) on delete set null,
  pedido_id uuid references public.delivery_pedidos (id) on delete set null,
  referencia text check (referencia is null or char_length(referencia) <= 40),
  servicio text not null check (servicio in ('express', 'estandar', 'prioritario')),
  origen_modo text not null default 'retiro' check (origen_modo in ('retiro', 'sucursal')),
  entrega_modo text not null default 'domicilio' check (entrega_modo in ('domicilio', 'sucursal')),
  rem_nombre text not null check (char_length(btrim(rem_nombre)) between 2 and 120),
  rem_telefono text check (rem_telefono is null or char_length(rem_telefono) <= 30),
  rem_direccion text check (rem_direccion is null or char_length(rem_direccion) <= 200),
  rem_ciudad text, rem_provincia text, rem_cp integer not null check (rem_cp between 1000 and 9999),
  sucursal_origen_id uuid references public.log_sucursales (id),
  des_nombre text not null check (char_length(btrim(des_nombre)) between 2 and 120),
  des_telefono text not null check (char_length(des_telefono) between 6 and 30),
  des_email text check (des_email is null or (char_length(des_email) <= 160 and des_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  des_dni text check (des_dni is null or des_dni ~ '^[0-9]{6,9}$'),
  des_direccion text check (des_direccion is null or char_length(des_direccion) <= 200),
  des_ciudad text not null check (char_length(des_ciudad) between 2 and 80),
  des_provincia text not null check (char_length(des_provincia) between 2 and 60),
  des_cp integer not null check (des_cp between 1000 and 9999),
  des_notas text check (des_notas is null or char_length(des_notas) <= 300),
  des_lat numeric, des_lng numeric,
  sucursal_destino_id uuid references public.log_sucursales (id),
  zona_origen_id uuid references public.log_zonas (id), zona_destino_id uuid references public.log_zonas (id),
  bultos integer not null check (bultos between 1 and 50),
  peso_kg numeric(8,2) not null check (peso_kg > 0),
  peso_vol_kg numeric(8,2) not null default 0,
  peso_facturable numeric(8,2) not null,
  valor_declarado numeric(12,2) not null default 0 check (valor_declarado >= 0),
  contenido text check (contenido is null or char_length(contenido) <= 120),
  reembolso numeric(12,2) not null default 0 check (reembolso >= 0),
  precio_flete numeric(12,2) not null default 0, precio_seguro numeric(12,2) not null default 0,
  precio_reembolso numeric(12,2) not null default 0, precio_retiro numeric(12,2) not null default 0,
  precio_total numeric(12,2) not null default 0,
  estado text not null default 'creado' check (estado in ('creado', 'admitido', 'en_centro', 'en_transito', 'en_sucursal', 'en_distribucion', 'visita_fallida', 'entregado', 'en_devolucion', 'devuelto', 'cancelado', 'siniestrado')),
  sucursal_actual_id uuid references public.log_sucursales (id),
  intentos integer not null default 0,
  fecha_estimada date,
  retiro_id uuid references public.log_retiros (id) on delete set null,
  hoja_ruta_id uuid references public.log_hojas_ruta (id) on delete set null,
  receptor_nombre text check (receptor_nombre is null or char_length(receptor_nombre) <= 120),
  receptor_dni text check (receptor_dni is null or receptor_dni ~ '^[0-9]{6,9}$'),
  entregado_at timestamptz,
  reembolso_cobrado boolean not null default false,
  rendicion_id uuid references public.log_rendiciones (id) on delete set null,
  motivo_cancelacion text,
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists log_envios_cuenta_idx on public.log_envios (cuenta_id, created_at desc);
create index if not exists log_envios_comercio_idx on public.log_envios (comercio_id, created_at desc) where comercio_id is not null;
create index if not exists log_envios_estado_idx on public.log_envios (estado, created_at desc);
create index if not exists log_envios_hoja_idx on public.log_envios (hoja_ruta_id) where hoja_ruta_id is not null;
create index if not exists log_envios_retiro_idx on public.log_envios (retiro_id) where retiro_id is not null;

create table if not exists public.log_bultos (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.log_envios (id) on delete cascade,
  nro integer not null check (nro between 1 and 50),
  codigo text not null unique,
  peso_kg numeric(8,2) not null check (peso_kg > 0 and peso_kg <= 1000),
  alto_cm numeric(6,1) check (alto_cm is null or alto_cm between 0 and 400),
  ancho_cm numeric(6,1) check (ancho_cm is null or ancho_cm between 0 and 400),
  largo_cm numeric(6,1) check (largo_cm is null or largo_cm between 0 and 400),
  unique (envio_id, nro)
);

-- Línea de tiempo del envío (no se modifica: solo se agregan eventos) ------------------------------------------------------
create table if not exists public.log_eventos (
  id bigint generated always as identity primary key,
  envio_id uuid not null references public.log_envios (id) on delete cascade,
  estado text not null,
  descripcion text not null,
  sucursal_id uuid references public.log_sucursales (id),
  detalle text,
  visible boolean not null default true,
  usuario_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists log_eventos_envio_idx on public.log_eventos (envio_id, created_at);

-- Incidencias / reclamos --------------------------------------------------------------------------------------------------
create table if not exists public.log_incidencias (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 2001) unique,
  envio_id uuid not null references public.log_envios (id) on delete cascade,
  cuenta_id uuid not null references public.log_cuentas (id) on delete cascade,
  tipo text not null check (tipo in ('demora', 'danio', 'extravio', 'direccion', 'ausente', 'rechazo', 'reembolso', 'otro')),
  estado text not null default 'abierta' check (estado in ('abierta', 'en_gestion', 'resuelta')),
  descripcion text not null check (char_length(btrim(descripcion)) between 5 and 2000),
  resolucion text check (resolucion is null or char_length(resolucion) <= 2000),
  abierta_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resuelta_at timestamptz
);
create index if not exists log_incidencias_estado_idx on public.log_incidencias (estado, created_at desc);

-- Permisos: lectura por políticas; escritura solo por funciones del servidor ------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['log_sucursales','log_zonas','log_tarifarios','log_tarifas','log_cuentas','log_actividades','log_retiros','log_hojas_ruta','log_rendiciones','log_pagos','log_envios','log_bultos','log_eventos','log_incidencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.log_sucursales to anon, authenticated;
grant select on public.log_zonas, public.log_tarifarios, public.log_tarifas, public.log_actividades, public.log_hojas_ruta to authenticated;
grant select on public.log_cuentas, public.log_retiros, public.log_rendiciones, public.log_pagos, public.log_envios, public.log_bultos, public.log_eventos, public.log_incidencias to authenticated;

create policy "Sucursales activas visibles" on public.log_sucursales for select to anon, authenticated using (activa or public.log_es_admin());
create policy "Zonas para administración" on public.log_zonas for select to authenticated using (public.log_es_admin());
create policy "Tarifarios para administración" on public.log_tarifarios for select to authenticated using (public.log_es_admin());
create policy "Tarifas para administración" on public.log_tarifas for select to authenticated using (public.log_es_admin());
create policy "Actividades para administración" on public.log_actividades for select to authenticated using (public.log_es_admin());
create policy "Hojas de ruta para administración" on public.log_hojas_ruta for select to authenticated using (public.log_es_admin() or repartidor_id = (select auth.uid()));
create policy "Cuenta visible para su comercio" on public.log_cuentas for select to authenticated
  using (public.log_es_admin() or (comercio_id is not null and public.delivery_permiso(comercio_id, 'pedidos')));
create policy "Retiros de la cuenta" on public.log_retiros for select to authenticated
  using (public.log_es_admin() or exists (select 1 from public.log_cuentas c where c.id = cuenta_id and c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'pedidos')));
create policy "Rendiciones de la cuenta" on public.log_rendiciones for select to authenticated
  using (public.log_es_admin() or exists (select 1 from public.log_cuentas c where c.id = cuenta_id and c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'finanzas')));
create policy "Pagos de la cuenta" on public.log_pagos for select to authenticated
  using (public.log_es_admin() or exists (select 1 from public.log_cuentas c where c.id = cuenta_id and c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'finanzas')));
create policy "Envíos de la cuenta" on public.log_envios for select to authenticated
  using (public.log_es_admin() or (comercio_id is not null and public.delivery_permiso(comercio_id, 'pedidos')));
create policy "Bultos de la cuenta" on public.log_bultos for select to authenticated
  using (exists (select 1 from public.log_envios e where e.id = envio_id and (public.log_es_admin() or (e.comercio_id is not null and public.delivery_permiso(e.comercio_id, 'pedidos')))));
create policy "Eventos de la cuenta" on public.log_eventos for select to authenticated
  using (exists (select 1 from public.log_envios e where e.id = envio_id and (public.log_es_admin() or (visible and e.comercio_id is not null and public.delivery_permiso(e.comercio_id, 'pedidos')))));
create policy "Incidencias de la cuenta" on public.log_incidencias for select to authenticated
  using (public.log_es_admin() or exists (select 1 from public.log_cuentas c where c.id = cuenta_id and c.comercio_id is not null and public.delivery_permiso(c.comercio_id, 'pedidos')));

-- Configuración inicial (de ejemplo, editable en Administración → Logística): una sucursal central, zonas por código
-- postal y un tarifario por defecto con precios de referencia que el dueño tiene que revisar.
insert into public.log_sucursales (codigo, nombre, tipo, direccion, ciudad, provincia, cp, horario)
  values ('LIN', 'Centro Lincoln', 'centro', 'A definir', 'Lincoln', 'Buenos Aires', 6070, 'Lunes a viernes de 9 a 18')
  on conflict (codigo) do nothing;
insert into public.log_zonas (nombre, cps, express, orden) values
  ('Local (Lincoln y zona)', int4multirange(int4range(6070, 6080)), true, 10),
  ('CABA', int4multirange(int4range(1000, 1500)), true, 20),
  ('Provincia de Buenos Aires', int4multirange(int4range(1500, 2000), int4range(2700, 3000), int4range(6000, 6800), int4range(6900, 8200)), false, 30),
  ('Resto del país', int4multirange(int4range(1000, 10000)), false, 90)
  on conflict (nombre) do nothing;
insert into public.log_tarifarios (nombre, por_defecto, kg_extra, seguro_pct, reembolso_pct, retiro_precio, dias_estandar, dias_prioritario)
  select 'General', true, 450, 1, 2, 1500, 4, 2 where not exists (select 1 from public.log_tarifarios where por_defecto);
do $$
declare t uuid := (select id from public.log_tarifarios where por_defecto); z record; d record; base numeric; banda record;
begin
  if exists (select 1 from public.log_tarifas where tarifario_id = t) then return; end if;
  for z in select id, orden from public.log_zonas loop
    for d in select id, orden from public.log_zonas loop
      base := case when z.id = d.id and z.orden = 10 then 2500 when z.orden <= 20 and d.orden <= 20 then 5200 when d.orden = 30 or z.orden = 30 then 6800 else 9500 end;
      for banda in select * from (values (1::numeric, 1.0), (5, 1.35), (10, 1.8), (20, 2.6), (30, 3.4)) v(kg, f) loop
        insert into public.log_tarifas (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg, precio) values
          (t, 'estandar', z.id, d.id, banda.kg, round(base * banda.f, -1)),
          (t, 'prioritario', z.id, d.id, banda.kg, round(base * banda.f * 1.45, -1));
        if z.id = d.id and z.orden <= 20 then
          insert into public.log_tarifas (tarifario_id, servicio, zona_origen, zona_destino, hasta_kg, precio) values (t, 'express', z.id, d.id, banda.kg, round(base * banda.f * 1.25, -1));
        end if;
      end loop;
    end loop;
  end loop;
end $$;
