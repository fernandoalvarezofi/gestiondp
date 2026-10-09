-- Prueba de la tienda como plataforma: borrador, publicación validada, versiones, páginas, dominio, cupones con alcance,
-- preparación, analítica y aislamiento entre comercios. Corre en una transacción y se deshace.
begin;
create temp table t_res(caso text, ok boolean, detalle text) on commit drop;
grant all on t_res to authenticated, anon;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(), now(), now(), '{}', '{}'::jsonb
from (values ('66666666-ffff-4fff-8fff-000000000001'::uuid, 'qa-tie-dueno@example.com'), ('66666666-ffff-4fff-8fff-000000000002'::uuid, 'qa-tie-otro@example.com')) as u(id, email);
insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, aprobado, activo) values
  ('66666666-ffff-4fff-8fff-0000000000c1', 'QA Tienda Plataforma', 'qa-tienda-plataforma', 'comida', 'Lincoln', '66666666-ffff-4fff-8fff-000000000001', true, true);
insert into delivery_productos (id, comercio_id, nombre, categoria, precio) values
  ('66666666-ffff-4fff-8fff-0000000000a1', '66666666-ffff-4fff-8fff-0000000000c1', 'Taza', 'Cocina', 1000),
  ('66666666-ffff-4fff-8fff-0000000000a2', '66666666-ffff-4fff-8fff-0000000000c1', 'Mate', 'Infusiones', 3000);
insert into delivery_cupones (codigo, descripcion, tipo, valor, comercio_id, aplica_a, secciones, minimo) values ('QAMATE20', '20% en infusiones', 'porcentaje', 20, '66666666-ffff-4fff-8fff-0000000000c1', 'secciones', '{Infusiones}', 0);
create or replace function pg_temp.como(p uuid) returns void language sql as $$ select set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, true); $$;
do $$
declare d uuid := '66666666-ffff-4fff-8fff-000000000001'; o uuid := '66666666-ffff-4fff-8fff-000000000002'; loc uuid := '66666666-ffff-4fff-8fff-0000000000c1';
  v jsonb; n int; pid uuid; ver uuid;
begin
  perform pg_temp.como(d); set local role authenticated;
  perform tienda_borrador_guardar(loc, '{"plantilla":"estudio","titulo":"Borrador nuevo","menu":[{"texto":"Nosotros","tipo":"pagina","destino":"nosotros"},{"texto":"Malo","tipo":"url","destino":"javascript:alert(1)"}],"bloques":[{"tipo":"portada","estilo":"taller"},{"tipo":"servicios","titulo":"Turnos"},{"tipo":"script","x":1}]}');
  reset role;
  insert into t_res values ('borrador no cambia la tienda publicada', (select coalesce(tienda_tema->>'titulo','') <> 'Borrador nuevo' from delivery_comercios where id = loc), null);
  perform pg_temp.como(d); set local role authenticated;
  perform tienda_publicar(loc, null, 'Primera');
  reset role;
  select tienda_tema into v from delivery_comercios where id = loc;
  insert into t_res values ('publicar aplica y sanea', v->>'titulo' = 'Borrador nuevo' and v->>'plantilla' = 'estudio' and jsonb_array_length(v->'menu') = 1
     and not exists (select 1 from jsonb_array_elements(v->'bloques') b where b->>'tipo' = 'script') and exists (select 1 from jsonb_array_elements(v->'bloques') b where b->>'tipo' = 'catalogo'), v::text);
  insert into t_res values ('borrador eliminado y versión guardada', not exists (select 1 from delivery_tienda_borradores where comercio_id = loc) and exists (select 1 from delivery_tienda_versiones where comercio_id = loc and nota = 'Primera'), null);
  select id into ver from delivery_tienda_versiones where comercio_id = loc limit 1;
  perform pg_temp.como(d); set local role authenticated;
  perform tienda_publicar(loc, '{"plantilla":"taller","titulo":"Segunda"}', 'Segunda');
  perform tienda_restaurar_version(ver);
  insert into t_res values ('restaurar trae la versión al borrador', (select tema->>'titulo' from delivery_tienda_borradores where comercio_id = loc) = 'Borrador nuevo', null);
  pid := tienda_pagina_guardar(loc, null, '{"titulo":"Sobre nosotros","slug":"nosotros","clase":"nosotros","contenido":"Hola **mundo**","estado":"borrador"}');
  begin perform tienda_pagina_guardar(loc, null, '{"titulo":"Otra","slug":"nosotros"}'); insert into t_res values ('slug de página único', false, 'sin error');
  exception when others then insert into t_res values ('slug de página único', true, sqlerrm); end;
  begin perform tienda_pagina_guardar(loc, null, '{"titulo":"Mal","slug":"../x"}'); insert into t_res values ('slug inválido rechazado', false, 'sin error');
  exception when others then insert into t_res values ('slug inválido rechazado', true, sqlerrm); end;
  reset role;
  perform pg_temp.como(null); set local role anon;
  select count(*) into n from delivery_tienda_paginas where comercio_id = loc;
  insert into t_res values ('página en borrador oculta al público', n = 0, n::text);
  reset role;
  perform pg_temp.como(d); set local role authenticated;
  perform tienda_pagina_guardar(loc, pid, '{"titulo":"Sobre nosotros","slug":"nosotros","contenido":"Hola","estado":"publicada"}');
  reset role;
  perform pg_temp.como(null); set local role anon;
  select count(*) into n from delivery_tienda_paginas where comercio_id = loc;
  insert into t_res values ('página publicada visible', n = 1, n::text);
  reset role;
  perform pg_temp.como(o); set local role authenticated;
  begin perform tienda_publicar(loc, '{"titulo":"Hackeada"}'); insert into t_res values ('otro no publica', false, 'sin error');
  exception when others then insert into t_res values ('otro no publica', true, sqlerrm); end;
  select count(*) into n from delivery_tienda_versiones where comercio_id = loc;
  insert into t_res values ('otro no ve versiones', n = 0, n::text);
  begin perform tienda_dominio_solicitar(loc, 'hack.com'); insert into t_res values ('otro no pide dominio', false, 'sin error');
  exception when others then insert into t_res values ('otro no pide dominio', true, sqlerrm); end;
  v := delivery_validar_cupon('QAMATE20', loc, 4000, '[{"producto_id":"66666666-ffff-4fff-8fff-0000000000a1","cantidad":1},{"producto_id":"66666666-ffff-4fff-8fff-0000000000a2","cantidad":1}]');
  insert into t_res values ('cupón por sección descuenta solo lo alcanzado', (v->>'descuento')::numeric = 600, v::text);
  v := delivery_validar_cupon('QAMATE20', loc, 1000, '[{"producto_id":"66666666-ffff-4fff-8fff-0000000000a1","cantidad":1}]');
  insert into t_res values ('cupón sin productos alcanzados', not (v->>'valido')::boolean, v->>'mensaje');
  reset role;
  perform pg_temp.como(d); set local role authenticated;
  v := tienda_dominio_solicitar(loc, 'https://MiTienda.com.ar/inicio');
  insert into t_res values ('dominio normalizado y pendiente', v->>'dominio' = 'mitienda.com.ar' and v->>'estado' = 'pendiente', v::text);
  reset role;
  insert into t_res values ('dominio pendiente no resuelve', tienda_por_dominio('mitienda.com.ar') is null, null);
  update delivery_tienda_dominios set estado = 'activo' where comercio_id = loc;
  insert into t_res values ('dominio activo resuelve', tienda_por_dominio('www.mitienda.com.ar') = 'qa-tienda-plataforma', null);
  perform pg_temp.como(d); set local role authenticated;
  v := tienda_preparacion(loc);
  insert into t_res values ('preparación para publicar', jsonb_array_length(v) = 10, null);
  v := tienda_analitica(loc, current_date - 30, current_date);
  insert into t_res values ('analítica', (v->>'pedidos')::int = 0 and jsonb_array_length(v->'por_dia') = 31, null);
  reset role;
  insert into t_res values ('pedido usa cupón con ítems', position('v_subtotal, p_items)' in pg_get_functiondef('public.delivery_crear_pedido'::regproc)) > 0, null);
end $$;
select * from t_res;
rollback;
