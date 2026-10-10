-- Woref Logística: circuito completo y permisos.
-- cotizar → crear (idempotente) → retiro → admisión → centro → hoja de ruta → entrega con contra reembolso → seguimiento público
-- → rendición; cancelación, visita fallida, cierre de hoja e incidencias; accesos cruzados prohibidos.
-- Se autodescarta: termina con una excepción que muestra el resultado y revierte todo.
do $$
declare
  adm uuid := '78787878-aaaa-4aaa-8aaa-000000000001'; com uuid := '78787878-aaaa-4aaa-8aaa-000000000002';
  rep uuid := '78787878-aaaa-4aaa-8aaa-000000000003'; otro uuid := '78787878-aaaa-4aaa-8aaa-000000000004';
  c uuid; suc uuid := (select id from log_sucursales where codigo = 'LIN'); r text := ''; q jsonb; v jsonb; e1 uuid; e2 uuid; e3 uuid; n1 text; ret uuid; h jsonb; n int; k uuid := gen_random_uuid(); inc uuid;
  base jsonb;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x, 'authenticated', 'authenticated', 'qa-029-' || right(x::text, 1) || '@example.com', '', now(), '{}', '{}', now(), now() from unnest(array[adm, com, rep, otro]) x;
  insert into user_roles (user_id, role) values (adm, 'admin');
  insert into delivery_repartidores (perfil_id, activo) values (rep, true) on conflict (perfil_id) do update set activo = true;
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado, propietario_id) values ('QA 029', 'qa-029', 'tiendas', 'Calle 1', true, true, com) returning id into c;

  -- Cotizador público
  perform set_config('request.jwt.claims', '', true); set local role anon;
  q := log_cotizar(null, null, 'estandar', 6070, 1425, '[{"peso_kg": 2.5}]'::jsonb, 10000, 0, true);
  if not (q ->> 'ok')::boolean or (q ->> 'total')::numeric <= 0 then r := r || 'FALLA cotizar: ' || q::text || '; '; end if;
  q := log_cotizar(null, null, 'express', 6070, 1425, '[{"peso_kg": 1}]'::jsonb);
  if (q ->> 'ok')::boolean then r := r || 'FALLA express interurbano aceptado; '; end if;
  q := log_cotizar(null, null, 'estandar', 6070, 6075, '[{"peso_kg": 1, "alto_cm": 50, "ancho_cm": 50, "largo_cm": 50}]'::jsonb);
  if (q ->> 'peso_facturable')::numeric <> 31.25 then r := r || 'FALLA peso volumétrico: ' || (q ->> 'peso_facturable') || '; '; end if;
  begin perform log_crear_envio('{}'::jsonb); r := r || 'FALLA anon crea envío; '; exception when others then null; end;
  reset role;

  -- Comercio: crea envío (idempotente) y no ve lo ajeno
  base := jsonb_build_object('clave', k, 'comercio_id', c, 'servicio', 'estandar', 'origen_modo', 'retiro', 'rem_direccion', 'Calle 1', 'rem_cp', '6070',
    'des_nombre', 'Ana Pérez', 'des_telefono', '1155550000', 'des_direccion', 'Av. Siempreviva 742', 'des_ciudad', 'CABA', 'des_provincia', 'CABA', 'des_cp', '1425',
    'bultos', '[{"peso_kg": 1.2}, {"peso_kg": 3}]'::jsonb, 'reembolso', 5000, 'valor_declarado', 20000);
  perform set_config('request.jwt.claims', json_build_object('sub', com, 'role', 'authenticated')::text, true); set local role authenticated;
  v := log_crear_envio(base); e1 := (v ->> 'id')::uuid; n1 := v ->> 'numero';
  if (log_crear_envio(base) ->> 'id')::uuid <> e1 then r := r || 'FALLA idempotencia; '; end if;
  begin perform log_crear_envio(base || jsonb_build_object('clave', gen_random_uuid(), 'des_cp', '12')); r := r || 'FALLA CP inválido aceptado; '; exception when others then null; end;
  begin perform log_crear_envio(base || jsonb_build_object('clave', gen_random_uuid(), 'servicio', 'express')); r := r || 'FALLA express interurbano creado; '; exception when others then null; end;
  e2 := (log_crear_envio(base || jsonb_build_object('clave', gen_random_uuid(), 'reembolso', 0)) ->> 'id')::uuid;
  e3 := (log_crear_envio(base || jsonb_build_object('clave', gen_random_uuid(), 'reembolso', 0)) ->> 'id')::uuid;
  ret := log_solicitar_retiro(c, null, log_sumar_habiles(log_hoy(), 1), 'manana', array[e1, e3]);
  perform log_cancelar(e2, 'Ya no lo mando');
  begin perform log_avanzar(e1, 'admitido'); r := r || 'FALLA comercio opera estados; '; exception when others then null; end;
  reset role;
  if (select count(*) from log_bultos where envio_id = e1) <> 2 or (select precio_total from log_envios where id = e1) <= 0 then r := r || 'FALLA bultos o precio; '; end if;
  if (select estado from log_envios where id = e2) <> 'cancelado' then r := r || 'FALLA cancelar; '; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from log_envios where comercio_id = c;
  if n <> 0 then r := r || 'FALLA ajeno ve envíos: ' || n || '; '; end if;
  begin perform log_cancelar(e3, 'x'); r := r || 'FALLA ajeno cancela; '; exception when others then null; end;
  begin perform log_crear_envio(base || jsonb_build_object('clave', gen_random_uuid())); r := r || 'FALLA ajeno crea en comercio ajeno; '; exception when others then null; end;
  begin perform log_tablero(); r := r || 'FALLA ajeno ve el tablero; '; exception when others then null; end;
  reset role;

  -- Operación (administración)
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); set local role authenticated;
  perform log_retiro_actualizar(ret, 'asignado', rep);
  perform log_retiro_actualizar(ret, 'realizado');
  if (select estado from log_envios where id = e1) <> 'admitido' then r := r || 'FALLA retiro no admitió; '; end if;
  v := log_escanear(array[n1 || '-01', n1 || '-02', 'WR9999999999'], 'en_centro', suc);
  if (v -> 0 ->> 'ok')::boolean is not true or (v -> 2 ->> 'ok')::boolean is not false then r := r || 'FALLA escaneo: ' || v::text || '; '; end if;
  v := log_escanear(array[n1], 'devuelto', null);
  if (v -> 0 ->> 'ok')::boolean then r := r || 'FALLA transición inválida aceptada; '; end if;
  perform log_avanzar(e3, 'en_centro', suc);
  h := log_hoja_crear(rep, suc, array[n1, (select numero from log_envios where id = e3)]);
  if (h ->> 'cargados')::int <> 2 then r := r || 'FALLA hoja: ' || h::text || '; '; end if;
  reset role;

  -- Repartidor
  perform set_config('request.jwt.claims', json_build_object('sub', rep, 'role', 'authenticated')::text, true); set local role authenticated;
  if jsonb_array_length(log_mis_entregas()) <> 2 then r := r || 'FALLA mis entregas; '; end if;
  begin perform log_entrega(e1, 'entregado', 'Ana Pérez', '30111222', null, false); r := r || 'FALLA entrega sin cobrar reembolso; '; exception when others then null; end;
  begin perform log_entrega(e1, 'entregado', 'Ana Pérez', '30.111.222', null, true); r := r || 'FALLA DNI con puntos; '; exception when others then null; end;
  perform log_entrega(e1, 'entregado', 'Ana Pérez', '30111222', null, true);
  perform log_entrega(e3, 'fallida', null, null, 'No había nadie', false);
  begin perform log_entrega(e3, 'entregado', 'X Y', '30111222'); r := r || 'FALLA entrega dos veces; '; exception when others then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform log_entrega(e1, 'fallida', null, null, 'x'); r := r || 'FALLA otro resuelve entregas; '; exception when others then null; end;
  reset role;
  if (select estado from log_envios where id = e1) <> 'entregado' or not (select reembolso_cobrado from log_envios where id = e1) then r := r || 'FALLA estado entregado; '; end if;
  if (select intentos from log_envios where id = e3) <> 1 then r := r || 'FALLA intentos; '; end if;

  -- Seguimiento público: sin nombres completos ni teléfonos
  perform set_config('request.jwt.claims', '', true); set local role anon;
  v := log_seguimiento(n1 || '-02');
  if v ->> 'estado' <> 'entregado' or v ->> 'receptor' <> 'Ana' or v::text like '%1155550000%' or v::text like '%Siempreviva%' or jsonb_array_length(v -> 'eventos') < 5 then r := r || 'FALLA seguimiento: ' || left(v::text, 200) || '; '; end if;
  begin perform 1 from log_envios limit 1; r := r || 'FALLA anon lee envíos; '; exception when others then null; end;
  reset role;

  -- Dinero e incidencias
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); set local role authenticated;
  perform log_rendicion_generar((select cuenta_id from log_envios where id = e1));
  if (select monto from log_rendiciones where cuenta_id = (select cuenta_id from log_envios where id = e1)) <> 5000 then r := r || 'FALLA rendición; '; end if;
  perform log_hoja_cerrar((h ->> 'id')::uuid);
  reset role;
  if (select estado from log_hojas_ruta where id = (h ->> 'id')::uuid) <> 'cerrada' then r := r || 'FALLA cerrar hoja; '; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', com, 'role', 'authenticated')::text, true); set local role authenticated;
  inc := log_incidencia_abrir(e3, 'demora', 'Todavía no llegó y el cliente reclama');
  begin perform log_incidencia_actualizar(inc, 'resuelta', 'me lo resuelvo solo'); r := r || 'FALLA comercio resuelve incidencias; '; exception when others then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true); set local role authenticated;
  perform log_incidencia_actualizar(inc, 'resuelta', 'Se reprogramó la entrega para mañana');
  reset role;
  if (select estado from log_incidencias where id = inc) <> 'resuelta' then r := r || 'FALLA incidencia; '; end if;
  if (select count(*) from log_eventos where envio_id = e1) < 6 then r := r || 'FALLA línea de tiempo; '; end if;

  raise exception '%', case when r = '' then 'LOGÍSTICA: TODAS PASARON' else r end;
end $$;
