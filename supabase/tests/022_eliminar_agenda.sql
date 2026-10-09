-- Eliminar servicios y profesionales de la agenda: sin turnos se borra, con turnos pasados se archiva, con turnos por venir
-- se bloquea, y otro local no puede. Se deshace sola (termina con una excepción que informa el resultado).
do $$ declare d uuid := '99999999-eeee-4eee-8eee-000000000001'; o uuid := '99999999-eeee-4eee-8eee-000000000002'; loc uuid := '99999999-eeee-4eee-8eee-0000000000c1';
  s1 uuid; s2 uuid; s3 uuid; p1 uuid; r text := ''; v jsonb; m text;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x, 'authenticated','authenticated', 'qa-ag-'||right(x::text,1)||'@example.com','',now(),'{}','{}',now(),now() from unnest(array[d,o]) x;
  insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values (loc,'QA Agenda','qa-agenda','comida','x',d,true,true);
  insert into servicios (comercio_id, nombre, duracion_min, precio) values (loc,'Sin turnos',30,0) returning id into s1;
  insert into servicios (comercio_id, nombre, duracion_min, precio) values (loc,'Con pasado',30,0) returning id into s2;
  insert into servicios (comercio_id, nombre, duracion_min, precio) values (loc,'Con futuro',30,0) returning id into s3;
  insert into profesionales (comercio_id, nombre) values (loc,'Pía') returning id into p1;
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, estado, ocupa_desde, ocupa_hasta) values (loc, s2, p1, d, now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 'completado', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes');
  insert into turnos (comercio_id, servicio_id, profesional_id, cliente_id, inicio, fin, estado, ocupa_desde, ocupa_hasta) values (loc, s3, p1, d, now() + interval '3 days', now() + interval '3 days' + interval '30 minutes', 'confirmado', now() + interval '3 days', now() + interval '3 days' + interval '30 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true); set local role authenticated;
  begin perform agenda_eliminar('servicio', s1); r := r || 'FALLA otro local eliminó; '; exception when others then r := r || 'ok otro local bloqueado; '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',d,'role','authenticated')::text, true); set local role authenticated;
  v := agenda_eliminar('servicio', s1); r := r || case when v->>'resultado'='eliminado' then 'ok sin turnos se borra; ' else 'FALLA s1; ' end;
  v := agenda_eliminar('servicio', s2); r := r || case when v->>'resultado'='archivado' then 'ok con pasado se archiva; ' else 'FALLA s2; ' end;
  begin perform agenda_eliminar('servicio', s3); r := r || 'FALLA futuro no bloqueó; '; exception when others then m := sqlerrm; r := r || 'ok futuro bloquea ('||m||'); '; end;
  begin perform agenda_eliminar('profesional', p1); r := r || 'FALLA profesional con futuro no bloqueó; '; exception when others then r := r || 'ok profesional con futuro bloquea; '; end;
  reset role;
  r := r || case when (select count(*) from turnos where comercio_id = loc) = 2 then 'ok historial intacto' else 'FALLA historial' end;
  r := r || case when (select eliminado_at is not null and not activo from servicios where id = s2) then '; ok s2 oculto' else '; FALLA s2 visible' end;
  raise exception 'RESULTADO: %', r;
end $$;
