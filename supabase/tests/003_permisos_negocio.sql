-- PRUEBAS DE PERMISOS POR ROL DE NEGOCIO (Fase 1, paso 2). Transacción que se deshace sola (termina con una excepción a propósito).
-- Crea un dueño, cuatro integrantes (admin, manager, operator, seller) y un ajeno; verifica la matriz de permisos, el alta por invitación,
-- las políticas de catálogo (RLS), el acceso de panel y que nadie salvo el dueño gestione el equipo.
do $t$
declare
  dueno uuid := gen_random_uuid(); ad uuid := gen_random_uuid(); mg uuid := gen_random_uuid(); op uuid := gen_random_uuid(); sl uuid := gen_random_uuid(); ajeno uuid := gen_random_uuid();
  cat delivery_categoria; c1 uuid; neg uuid; fallos text := ''; permisos text[] := array['pedidos','catalogo','promociones','opiniones','estadisticas','ajustes','finanzas','equipo'];
  quien record; perm text; esperado boolean; real boolean; v jsonb; n int;
  esperados jsonb := jsonb_build_object(
    'dueno',  '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes","finanzas","equipo"]'::jsonb,
    'ad',     '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes","finanzas","equipo"]'::jsonb,
    'mg',     '["pedidos","catalogo","promociones","opiniones","estadisticas","ajustes"]'::jsonb,
    'op',     '["pedidos"]'::jsonb,
    'sl',     '["pedidos","catalogo"]'::jsonb,
    'ajeno',  '[]'::jsonb);
begin
  select categoria into cat from delivery_comercios limit 1;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', x.mail, 'x', now(), '{}', '{}', now(), now(), '', '', '', ''
      from (values (dueno, 'qa-dueno@example.com'), (ad, 'qa-admin@example.com'), (mg, 'qa-manager@example.com'), (op, 'qa-operator@example.com'), (sl, 'qa-seller@example.com'), (ajeno, 'qa-ajeno@example.com')) as x(id, mail);
  insert into delivery_comercios (nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values ('QA Permisos', 'qa-permisos', cat, 'x', dueno, true, true) returning id, business_id into c1, neg;

  -- el dueño invita (como authenticated)
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform core_agregar_integrante(neg, 'qa-admin@example.com', 'admin');
  perform core_agregar_integrante(neg, 'qa-manager@example.com', 'manager');
  perform core_agregar_integrante(neg, 'qa-operator@example.com', 'operator');
  perform core_agregar_integrante(neg, 'qa-seller@example.com', 'seller');
  begin perform core_agregar_integrante(neg, 'nadie-con-cuenta@example.com', 'manager'); exception when others then fallos := fallos || E'- invitar a un email sin cuenta debería responder igual (sin revelar nada)\n'; end;
  begin perform core_agregar_integrante(neg, 'qa-ajeno@example.com', 'owner'); fallos := fallos || E'- se pudo invitar con rol owner\n'; exception when others then null; end;

  -- invitados todavía SIN permisos
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  if delivery_permiso(c1, 'pedidos') then fallos := fallos || E'- un invitado (sin aceptar) ya tiene permisos\n'; end if;
  select jsonb_array_length(core_mis_invitaciones()) into n; if n <> 1 then fallos := fallos || E'- el invitado no ve su invitación\n'; end if;

  -- aceptan
  perform core_responder_invitacion(neg, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ad, 'role', 'authenticated')::text, true); perform core_responder_invitacion(neg, true);
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true); perform core_responder_invitacion(neg, true);
  perform set_config('request.jwt.claims', json_build_object('sub', sl, 'role', 'authenticated')::text, true); perform core_responder_invitacion(neg, true);

  -- matriz de permisos
  for quien in select * from (values ('dueno', dueno), ('ad', ad), ('mg', mg), ('op', op), ('sl', sl), ('ajeno', ajeno)) as q(clave, uid) loop
    perform set_config('request.jwt.claims', json_build_object('sub', quien.uid, 'role', 'authenticated')::text, true);
    foreach perm in array permisos loop
      esperado := (esperados -> quien.clave) ? perm;
      real := delivery_permiso(c1, perm);
      if real is distinct from esperado then fallos := fallos || format(E'- %s / %s: esperado %s, dio %s\n', quien.clave, perm, esperado, real); end if;
    end loop;
  end loop;

  -- finanzas: solo dueño y admin del negocio
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  if delivery_puede_ver_finanzas(c1) then fallos := fallos || E'- un manager ve las finanzas\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ad, 'role', 'authenticated')::text, true);
  if not delivery_puede_ver_finanzas(c1) then fallos := fallos || E'- el admin del negocio no ve las finanzas\n'; end if;

  -- catálogo (RLS): manager y seller pueden crear productos; operator y ajeno no
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  begin insert into delivery_productos (comercio_id, nombre, precio, categoria) values (c1, 'QA producto manager', 10, 'QA'); exception when others then fallos := fallos || E'- el manager no pudo crear un producto\n'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', sl, 'role', 'authenticated')::text, true);
  begin insert into delivery_productos (comercio_id, nombre, precio, categoria) values (c1, 'QA producto seller', 10, 'QA'); exception when others then fallos := fallos || E'- el seller no pudo crear un producto\n'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true);
  begin insert into delivery_productos (comercio_id, nombre, precio, categoria) values (c1, 'QA producto operator', 10, 'QA'); fallos := fallos || E'- el operator pudo crear un producto\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  begin insert into delivery_productos (comercio_id, nombre, precio, categoria) values (c1, 'QA producto ajeno', 10, 'QA'); fallos := fallos || E'- un ajeno pudo crear un producto\n'; exception when others then null; end;

  -- panel: acceso y lista de tiendas
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  v := delivery_mi_acceso(c1);
  if v->>'rol' is distinct from 'encargado' or jsonb_array_length(v->'permisos') <> 6 then fallos := fallos || format(E'- mi_acceso del manager incorrecto: %s\n', v); end if;
  if jsonb_array_length(delivery_mis_comercios()) <> 1 then fallos := fallos || E'- el manager no ve la tienda en mis_comercios\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', sl, 'role', 'authenticated')::text, true);
  v := delivery_mi_acceso(c1);
  if v->>'rol' is distinct from 'vendedor' then fallos := fallos || format(E'- mi_acceso del seller incorrecto: %s\n', v); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ajeno, 'role', 'authenticated')::text, true);
  if delivery_mi_acceso(c1) <> 'null'::jsonb then fallos := fallos || E'- un ajeno tiene acceso de panel\n'; end if;

  -- solo el dueño gestiona el equipo
  perform set_config('request.jwt.claims', json_build_object('sub', ad, 'role', 'authenticated')::text, true);
  begin perform core_agregar_integrante(neg, 'qa-ajeno@example.com', 'manager'); fallos := fallos || E'- un admin pudo invitar\n'; exception when others then null; end;
  begin perform core_cambiar_rol(neg, mg, 'seller'); fallos := fallos || E'- un admin pudo cambiar roles\n'; exception when others then null; end;
  begin perform core_quitar_integrante(neg, mg); fallos := fallos || E'- un admin pudo quitar a otro\n'; exception when others then null; end;
  select jsonb_array_length(core_listar_integrantes(neg)) into n; if n <> 5 then fallos := fallos || format(E'- el admin debería ver 5 integrantes, ve %s\n', n); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true);
  begin perform core_listar_integrantes(neg); fallos := fallos || E'- un operator pudo listar integrantes\n'; exception when others then null; end;

  -- el dueño cambia un rol y quita a alguien; el dueño no se puede quitar
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform core_cambiar_rol(neg, op, 'manager');
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true);
  if not delivery_permiso(c1, 'catalogo') then fallos := fallos || E'- el cambio de rol no tuvo efecto\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  perform core_quitar_integrante(neg, op);
  perform set_config('request.jwt.claims', json_build_object('sub', op, 'role', 'authenticated')::text, true);
  if delivery_permiso(c1, 'pedidos') then fallos := fallos || E'- una persona quitada conserva permisos\n'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', dueno, 'role', 'authenticated')::text, true);
  begin perform core_quitar_integrante(neg, dueno); fallos := fallos || E'- se pudo quitar al dueño\n'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', mg, 'role', 'authenticated')::text, true);
  perform core_quitar_integrante(neg, mg); -- salir por cuenta propia
  if delivery_permiso(c1, 'pedidos') then fallos := fallos || E'- quien se fue conserva permisos\n'; end if;

  perform set_config('role', 'postgres', true);
  select count(*) into n from delivery_auditoria where accion like 'core.%' and entidad_id = neg::text;
  if n < 7 then fallos := fallos || format(E'- la auditoría registró %s eventos del equipo (se esperaban al menos 7)\n', n); end if;

  if fallos <> '' then raise exception E'PRUEBAS DE PERMISOS: FALLARON\n%', fallos; end if;
  raise exception 'PRUEBAS DE PERMISOS: TODAS PASARON (excepcion final solo para deshacer)';
end $t$;
