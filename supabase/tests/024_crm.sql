-- CRM: contactos automáticos, segmentos, ficha con línea de tiempo, actividades y tareas, unificación y aislamiento.
-- Se deshace sola (termina con una excepción que informa el resultado).
do $t$
declare dueno uuid := gen_random_uuid(); cli uuid := gen_random_uuid(); cli2 uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); oper uuid := gen_random_uuid();
  loc uuid; loc2 uuid; sv uuid; pa uuid; t1 uuid; t2 uuid; t3 uuid; ped uuid; c_cli uuid; c_walk uuid; c_walk2 uuid; c_man uuid; act uuid;
  v jsonb; n int; fallos text := ''; tz constant text := 'America/Argentina/Buenos_Aires'; cat delivery_categoria;
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.m, '', now(), '{}', jsonb_build_object('full_name', x.nom), now(), now()
      from (values (dueno, 'qa-crm-d@example.com', 'Dueña'), (cli, 'qa-crm-c@example.com', 'Carla Cliente'), (cli2, 'qa-crm-c2@example.com', 'Carla Cliente'),
                   (otro, 'qa-crm-o@example.com', 'Otro Dueño'), (oper, 'qa-crm-op@example.com', 'Operador')) as x(id, m, nom);
  update perfiles set nombre = 'Carla Cliente' where id in (cli, cli2);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo, esta_abierto, acepta_retiro) values ('QA CRM', 'qa-crm-1', cat, 'x', dueno, true, true, true, true) returning id into loc;
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA CRM 2', 'qa-crm-2', cat, 'x', otro, true, true) returning id into loc2;
  insert into delivery_comercio_equipo (comercio_id, user_id, email, rol, estado) values (loc, oper, 'qa-crm-op@example.com', 'operador', 'activo');
  insert into servicios (comercio_id, nombre, duracion_min, precio) values (loc, 'Corte', 30, 5000) returning id into sv;
  insert into profesionales (comercio_id, nombre) values (loc, 'Ana') returning id into pa;

  -- Turnos: con cuenta, y dos sin cuenta con el mismo teléfono escrito distinto (deben quedar en un solo contacto).
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, estado, precio, telefono, ocupa_desde, ocupa_hasta)
    values (loc, sv, pa, cli, now() - interval '5 days', now() - interval '5 days' + interval '30 minutes', 'completado', 5000, '2355 111-222', now() - interval '5 days', now() - interval '5 days' + interval '30 minutes') returning id into t1;
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_nombre, inicio, fin, estado, precio, telefono, ocupa_desde, ocupa_hasta)
    values (loc, sv, pa, 'Marta Mostrador', now() - interval '4 days', now() - interval '4 days' + interval '30 minutes', 'completado', 5000, '(2355) 999-888', now() - interval '4 days', now() - interval '4 days' + interval '30 minutes') returning id into t2;
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_nombre, inicio, fin, estado, precio, telefono, ocupa_desde, ocupa_hasta)
    values (loc, sv, pa, 'Marta M.', now() + interval '2 days', now() + interval '2 days' + interval '30 minutes', 'confirmado', 5000, '2355999888', now() + interval '2 days', now() + interval '2 days' + interval '30 minutes') returning id into t3;
  select contacto_id into c_cli from turnos where id = t1;
  select contacto_id into c_walk from turnos where id = t2;
  if c_cli is null or c_walk is null then fallos := fallos || E'- los turnos no crearon contactos\n'; end if;
  if (select contacto_id from turnos where id = t3) is distinct from c_walk then fallos := fallos || E'- el mismo teléfono creó dos contactos sin cuenta\n'; end if;

  -- Pedido del cliente con cuenta: mismo contacto que su turno.
  alter table delivery_pedidos disable trigger delivery_pedidos_fsm;
  insert into delivery_pedidos (cliente_id, comercio_id, direccion_entrega, subtotal, total, estado, telefono_contacto) values (cli, loc, 'x', 8000, 8000, 'entregado', '2355 111222') returning id into ped;
  alter table delivery_pedidos enable trigger delivery_pedidos_fsm;
  if (select count(*) from crm_contactos where comercio_id = loc and cliente_id = cli) <> 1 then fallos := fallos || E'- el pedido duplicó el contacto del cliente\n'; end if;

  -- Lectura como dueña.
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v := crm_clientes(loc);
  if (v->>'total')::int <> 2 then fallos := fallos || format(E'- el listado debería tener 2 contactos, tiene %s\n', v->>'total'); end if;
  v := crm_clientes(loc, null, null, null, 'gasto', 50, 0, c_cli)->'items'->0;
  if (v->>'pedidos')::int <> 1 or (v->>'turnos')::int <> 1 or (v->>'gastado')::numeric <> 13000 then fallos := fallos || format(E'- métricas del cliente mal: %s\n', v); end if;
  if v->>'segmento' not in ('nuevo') then fallos := fallos || format(E'- segmento esperado "nuevo", fue %s\n', v->>'segmento'); end if;
  if (crm_clientes(loc, '999888')->>'total')::int <> 1 then fallos := fallos || E'- la búsqueda por teléfono no encontró al contacto\n'; end if;
  if (crm_clientes(loc, '%')->>'total')::int <> 0 then fallos := fallos || E'- el comodín se buscó como patrón\n'; end if;

  -- Contacto manual (mismo nombre que el de mostrador) y actividades.
  c_man := crm_contacto_guardar(loc, null, '{"nombre":"Marta Mostrador","email":"MARTA@Example.com","etiquetas":["VIP ", "vip", "Cumple"],"acepta_marketing":true}');
  perform set_config('role', 'postgres', true);
  if (select etiquetas from crm_contactos where id = c_man) <> '{cumple,vip}' then fallos := fallos || E'- las etiquetas no se normalizaron\n'; end if;
  perform set_config('role', 'authenticated', true);
  begin perform crm_contacto_guardar(loc, null, '{"nombre":"X","email":"no-es-email"}'); fallos := fallos || E'- aceptó un email inválido\n'; exception when others then null; end;
  act := crm_actividad_guardar(c_cli, null, jsonb_build_object('tipo', 'tarea', 'titulo', 'Llamar para ofrecer promo', 'vence_at', now() - interval '1 hour'));
  perform crm_actividad_guardar(c_cli, null, '{"tipo":"llamada","titulo":"Le gustó el servicio"}');
  begin perform crm_actividad_guardar(c_cli, null, '{"tipo":"tarea","titulo":"Sin fecha"}'); fallos := fallos || E'- aceptó una tarea sin vencimiento\n'; exception when others then null; end;
  if jsonb_array_length(crm_tareas(loc, 'vencidas')) <> 1 then fallos := fallos || E'- la tarea vencida no aparece en seguimientos\n'; end if;
  v := crm_resumen(loc);
  if (v->>'tareas_vencidas')::int <> 1 or (v->>'total')::int <> 3 then fallos := fallos || format(E'- resumen incorrecto: %s\n', v); end if;
  perform crm_actividad_estado(act, true);
  if jsonb_array_length(crm_tareas(loc, 'pendientes')) <> 0 then fallos := fallos || E'- la tarea completada sigue pendiente\n'; end if;

  -- Ficha: línea de tiempo con pedido, turno y actividades; duplicado sugerido por nombre.
  v := crm_ficha(c_cli);
  if (select count(*) from jsonb_array_elements(v->'linea') e where e->>'tipo' in ('pedido', 'turno', 'tarea', 'llamada')) <> 4 then fallos := fallos || format(E'- la línea de tiempo no reúne todo: %s\n', v->'linea'); end if;
  v := crm_ficha(c_walk);
  if not exists (select 1 from jsonb_array_elements(v->'duplicados') d where (d->>'id')::uuid = c_man) then fallos := fallos || E'- no sugirió el duplicado con el mismo nombre\n'; end if;

  -- Unificar: los turnos pasan al destino, el origen queda redirigido.
  perform crm_fusionar(c_walk, c_man);
  perform set_config('role', 'postgres', true);
  if (select count(*) from turnos where contacto_id = c_man) <> 2 then fallos := fallos || E'- los turnos no pasaron al contacto unificado\n'; end if;
  perform set_config('role', 'authenticated', true);
  if (crm_ficha(c_walk)->>'fusionado_en')::uuid is distinct from c_man then fallos := fallos || E'- el contacto de origen no redirige al unificado\n'; end if;
  perform set_config('role', 'postgres', true);
  if (select telefono_norm from crm_contactos where id = c_man) <> '2355999888' then fallos := fallos || E'- el teléfono no se completó al unificar\n'; end if;
  -- Dos cuentas distintas de Woref no se unifican.
  perform set_config('role', 'postgres', true);
  c_walk2 := crm_asegurar_contacto(loc, cli2, null, null, null, 'pedido');
  perform set_config('role', 'authenticated', true);
  begin perform crm_fusionar(c_walk2, c_cli); fallos := fallos || E'- unificó dos cuentas distintas\n'; exception when others then null; end;

  -- Aislamiento: otro comercio y un operador sin permiso de clientes.
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  begin perform crm_clientes(loc); fallos := fallos || E'- otro comercio lista los clientes\n'; exception when others then null; end;
  begin perform crm_ficha(c_cli); fallos := fallos || E'- otro comercio abre una ficha ajena\n'; exception when others then null; end;
  begin perform crm_actividad_guardar(c_cli, null, '{"tipo":"nota","titulo":"intruso"}'); fallos := fallos || E'- otro comercio registra actividades ajenas\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', oper, 'role', 'authenticated')::text, true);
  begin perform crm_clientes(loc); fallos := fallos || E'- un operador sin permiso ve el CRM\n'; exception when others then null; end;
  begin select count(*) into n from crm_contactos; fallos := fallos || E'- se puede leer la tabla de contactos directo\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  begin perform crm_clientes(loc); fallos := fallos || E'- anon ejecuta el CRM\n'; exception when others then null; end;
  perform set_config('role', 'postgres', true);

  if fallos <> '' then raise exception E'CRM: FALLARON\n%', fallos; end if;
  raise exception 'CRM: TODAS PASARON';
end $t$;
