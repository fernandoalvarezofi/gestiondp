-- Separación real de los contextos Repartidor y Conductor en el servidor.
-- Antes había un único "disponible": quien tenía las dos habilitaciones recibía entregas y viajes a la vez,
-- aunque estuviera usando solo uno de los paneles. Ahora la persona conectada trabaja en UN modo:
--   'entregas' → pedidos de comercios y envíos de paquetes (panel de repartidor)
--   'viajes'   → remís (panel de conductor)
-- Es aditivo: la columna nueva arranca en 'entregas' (lo que hacía todo el mundo) y las funciones se
-- parchean con reemplazos exactos sobre su definición actual; si un texto esperado no está, la migración falla
-- en vez de dejar una función a medio cambiar.

alter table public.delivery_repartidores
  add column if not exists modo_trabajo text not null default 'entregas'
  constraint delivery_repartidores_modo_trabajo_chk check (modo_trabajo in ('entregas', 'viajes'));

comment on column public.delivery_repartidores.modo_trabajo is
  'Contexto en el que trabaja la persona conectada: entregas (panel de repartidor) o viajes (panel de conductor).';

do $$
declare
  cambios constant text[][] := array[
    -- Ofertas de pedidos: solo a quien trabaja en modo entregas.
    ['delivery_candidato_oferta',
     'WHERE l.activo AND l.verificado AND l.disponible',
     'WHERE l.activo AND l.verificado AND l.disponible AND l.modo_trabajo = ''entregas'''],
    ['delivery_ofertas_visibles',
     'FROM public.delivery_repartidores r WHERE r.activo AND r.verificado AND r.disponible',
     'FROM public.delivery_repartidores r WHERE r.activo AND r.verificado AND r.disponible AND r.modo_trabajo = ''entregas'''],
    ['delivery_tomar_pedido',
     'IF NOT r.disponible THEN RAISE EXCEPTION ''Conectate para tomar pedidos''; END IF;',
     'IF NOT r.disponible THEN RAISE EXCEPTION ''Conectate para tomar pedidos''; END IF;
  IF r.modo_trabajo <> ''entregas'' THEN RAISE EXCEPTION ''Estás conectado como conductor: pasá al panel de repartidor para tomar pedidos''; END IF;'],
    -- Envíos de paquetes: también son del modo entregas.
    ['delivery_envios_disponibles',
     'r.perfil_id = v_uid AND r.activo AND r.verificado AND r.disponible)',
     'r.perfil_id = v_uid AND r.activo AND r.verificado AND r.disponible AND r.modo_trabajo = ''entregas'')'],
    ['delivery_tomar_envio',
     'IF NOT r.disponible THEN RAISE EXCEPTION ''Conectate para tomar envíos''; END IF;',
     'IF NOT r.disponible THEN RAISE EXCEPTION ''Conectate para tomar envíos''; END IF;
  IF r.modo_trabajo <> ''entregas'' THEN RAISE EXCEPTION ''Estás conectado como conductor: pasá al panel de repartidor para tomar envíos''; END IF;'],
    -- Viajes de remís: solo en modo viajes.
    ['delivery_viajes_disponibles',
     'and r.remis_estado = ''aprobado'' and r.control_estado is null;',
     'and r.remis_estado = ''aprobado'' and r.control_estado is null and r.modo_trabajo = ''viajes'';'],
    ['delivery_tomar_viaje',
     'if not r.disponible then raise exception ''Conectate para tomar viajes''; end if;',
     'if not r.disponible then raise exception ''Conectate para tomar viajes''; end if;
  if r.modo_trabajo <> ''viajes'' then raise exception ''Estás conectado como repartidor: pasá al panel de conductor para tomar viajes''; end if;'],
    -- Despacho manual de administración: muestra por qué alguien no es elegible.
    ['despacho_motivo_no_elegible',
     'if not r.disponible then return ''Desconectado''; end if;',
     'if not r.disponible then return ''Desconectado''; end if;
  if p_origen_tipo = ''viaje'' and r.modo_trabajo <> ''viajes'' then return ''Conectado como repartidor''; end if;
  if p_origen_tipo <> ''viaje'' and r.modo_trabajo <> ''entregas'' then return ''Conectado como conductor''; end if;']
  ];
  i int;
  def text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = cambios[i][1];
    if def is null then raise exception 'No existe la función %', cambios[i][1]; end if;
    if position(cambios[i][3] in def) > 0 then continue; end if; -- ya aplicado
    if position(cambios[i][2] in def) = 0 then raise exception 'La función % cambió: no encuentro el texto esperado', cambios[i][1]; end if;
    execute replace(def, cambios[i][2], cambios[i][3]);
  end loop;
end $$;
