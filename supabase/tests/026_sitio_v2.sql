-- Mi tienda v2: estilo de sección, borradores por página, publicación y versiones del sitio completo, secciones guardadas y permisos.
-- Se autodescarta: termina con una excepción que muestra el resultado y revierte todo (crea sus propios usuarios y comercio).
do $$
declare
  duenio uuid := '77777777-aaaa-4aaa-8aaa-000000000001'; otro uuid := '77777777-aaaa-4aaa-8aaa-000000000002';
  c uuid; r text := ''; pid uuid; pid2 uuid; v jsonb; n int; ver uuid; b jsonb;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', duenio, 'authenticated', 'authenticated', 'qa-026-a@example.com', '', now(), '{}', '{}', now(), now()),
         ('00000000-0000-0000-0000-000000000000', otro, 'authenticated', 'authenticated', 'qa-026-b@example.com', '', now(), '{}', '{}', now(), now());
  insert into delivery_comercios (nombre, slug, categoria, direccion, activo, aprobado, propietario_id)
    values ('QA 026', 'qa-sitio-026', 'tiendas', 'Calle 1', true, true, duenio) returning id into c;

  -- Validación del contrato
  b := public._ts_bloque('{"tipo":"contenido","titulo":"x","botones":[{"texto":"A","destino":{"tipo":"url","valor":"javascript:1"}},{"texto":"B","destino":{"tipo":"ancla","valor":"promo"}}],"est":{"fondo":"imagen","imagen":"https://a.com/x.jpg","capa":500,"ver":"todos"}}'::jsonb, 1);
  if jsonb_array_length(b->'botones') <> 1 or (b->'est'->>'capa')::int <> 80 or b->'est' ? 'ver' then r := r || 'FALLA contrato contenido/est; '; end if;
  if public._ts_bloque('{"tipo":"faq","items":[{"p":"a","r":"b"}],"est":{"fondo":"color","color":"verde"}}'::jsonb, 1) ? 'est' then r := r || 'FALLA color inválido aceptado; '; end if;

  -- Como el dueño
  perform set_config('request.jwt.claims', json_build_object('sub', duenio, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v := tienda_pagina_borrador_guardar(c, null, '{"titulo":"Nosotros","slug":"nosotros","estado":"publicada","bloques":[{"tipo":"faq","items":[{"p":"¿Envían?","r":"Sí"}],"est":{"fondo":"suave"}},{"tipo":"catalogo"}]}'::jsonb);
  pid := (v->>'id')::uuid;
  begin perform tienda_pagina_borrador_guardar(c, null, '{"titulo":"Otra","slug":"nosotros"}'::jsonb); r := r || 'FALLA slug repetido; '; exception when others then null; end;
  begin perform tienda_pagina_borrador_guardar(c, null, '{"titulo":"X","slug":"Mal Slug"}'::jsonb); r := r || 'FALLA slug inválido; '; exception when others then null; end;
  perform tienda_borrador_guardar(c, '{"plantilla":"urbano","bloques":[{"tipo":"contenido","id":"c1","titulo":"Hola","est":{"ancla":"hola"}}],"cabecera":{"fija":false,"transparente":true},"pie_columnas":[{"titulo":"Ayuda","enlaces":[{"texto":"Nosotros","tipo":"pagina","destino":"nosotros"}]}]}'::jsonb);
  perform tienda_publicar(c, null, 'primera');
  reset role;

  select count(*) into n from delivery_tienda_paginas where id = pid and estado = 'publicada' and borrador is null and jsonb_array_length(bloques) = 1 and bloques->0->'est'->>'fondo' = 'suave';
  if n <> 1 then r := r || 'FALLA página publicada (sin catálogo, con estilo); '; end if;
  select tienda_tema into v from delivery_comercios where id = c;
  if v->'cabecera'->>'transparente' <> 'true' or jsonb_array_length(v->'pie_columnas') <> 1 or v->'bloques'->0->'est'->>'ancla' <> 'hola' then r := r || 'FALLA tema publicado: ' || left(v::text, 120) || '; '; end if;
  if not exists (select 1 from jsonb_array_elements(v->'bloques') x where x->>'tipo' = 'catalogo') then r := r || 'FALLA inicio sin catálogo; '; end if;
  select id into ver from delivery_tienda_versiones where comercio_id = c order by created_at desc limit 1;
  if (select jsonb_array_length(paginas) from delivery_tienda_versiones where id = ver) <> 1 then r := r || 'FALLA versión sin páginas; '; end if;

  -- Cambios en borrador no se ven en línea; restaurar la versión los vuelve a borrador
  perform set_config('request.jwt.claims', json_build_object('sub', duenio, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform tienda_pagina_borrador_guardar(c, pid, '{"titulo":"Nosotros 2","slug":"nosotros","estado":"publicada","bloques":[]}'::jsonb);
  v := tienda_pagina_borrador_guardar(c, null, '{"titulo":"Promo","slug":"promo","estado":"publicada"}'::jsonb);
  pid2 := (v->>'id')::uuid;
  reset role;
  if (select titulo from delivery_tienda_paginas where id = pid) <> 'Nosotros' then r := r || 'FALLA el borrador cambió lo publicado; '; end if;
  if (select estado from delivery_tienda_paginas where id = pid2) <> 'borrador' then r := r || 'FALLA página nueva visible antes de publicar; '; end if;

  -- El público no lee borradores (permiso de columna)
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin perform borrador from delivery_tienda_paginas limit 1; r := r || 'FALLA anon lee el borrador; '; exception when others then null; end;
  begin perform tienda_paginas_editor(c); r := r || 'FALLA anon usa el RPC del editor; '; exception when others then null; end;
  select count(*) into n from delivery_tienda_paginas where comercio_id = c;
  if n <> 1 then r := r || 'FALLA anon ve páginas ocultas: ' || n || '; '; end if;
  reset role;

  -- Otro usuario no toca la tienda ajena
  perform set_config('request.jwt.claims', json_build_object('sub', otro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform tienda_pagina_borrador_guardar(c, pid, '{"titulo":"Hack","slug":"hack"}'::jsonb); r := r || 'FALLA ajeno guarda borrador; '; exception when others then null; end;
  begin perform tienda_publicar(c, null, null); r := r || 'FALLA ajeno publica; '; exception when others then null; end;
  begin perform tienda_seccion_guardar(c, 'Robada', '{"tipo":"texto","titulo":"x"}'::jsonb); r := r || 'FALLA ajeno guarda sección; '; exception when others then null; end;
  begin perform tienda_restaurar_version(ver); r := r || 'FALLA ajeno restaura versión; '; exception when others then null; end;
  begin perform tienda_paginas_editor(c); r := r || 'FALLA ajeno lee borradores; '; exception when others then null; end;
  reset role;

  -- Secciones guardadas (dueño): valida, no admite catálogo y respeta permisos de borrado
  perform set_config('request.jwt.claims', json_build_object('sub', duenio, 'role', 'authenticated')::text, true);
  set local role authenticated;
  pid2 := tienda_seccion_guardar(c, 'Banda promo', '{"tipo":"contenido","titulo":"Promo","est":{"fondo":"acento","nombre":"Banda"}}'::jsonb);
  begin perform tienda_seccion_guardar(c, 'Cat', '{"tipo":"catalogo"}'::jsonb); r := r || 'FALLA guarda catálogo; '; exception when others then null; end;
  select count(*) into n from delivery_tienda_secciones where comercio_id = c and bloque->'est'->>'fondo' = 'acento';
  if n <> 1 then r := r || 'FALLA sección guardada; '; end if;
  perform tienda_restaurar_version(ver);
  reset role;
  if (select borrador->>'titulo' from delivery_tienda_paginas where id = pid) <> 'Nosotros' then r := r || 'FALLA restaurar no repuso la página; '; end if;
  -- Una página nueva que nunca se publicó no es parte de ninguna versión: su borrador queda como estaba.
  if (select borrador->>'titulo' from delivery_tienda_paginas where slug = 'promo' and comercio_id = c) is distinct from 'Promo' then r := r || 'FALLA restaurar tocó la página nueva no publicada; '; end if;

  raise exception '%', case when r = '' then 'SITIO V2: TODAS PASARON' else r end;
end $$;
