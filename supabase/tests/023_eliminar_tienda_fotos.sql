-- Al eliminar una tienda sin historial se informan solo las fotos que no usa ningún otro comercio/producto
-- (las sucursales comparten fotos). Se deshace sola: termina con una excepción que muestra el resultado.
do $$ declare d uuid := '99999999-ffff-4fff-8fff-000000000001'; a uuid := '99999999-ffff-4fff-8fff-0000000000a1'; b uuid := '99999999-ffff-4fff-8fff-0000000000b1';
  base text := 'https://trramubtuzmwtnybudoj.supabase.co/storage/v1/object/public/delivery/'; v jsonb; esperado jsonb;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ('00000000-0000-0000-0000-000000000000', d, 'authenticated','authenticated','qa-fotos@example.com','',now(),'{}','{}',now(),now());
  insert into delivery_comercios (id, nombre, slug, categoria, direccion, propietario_id, imagen_url, logo_url) values
    (a,'QA Fotos A','qa-fotos-a','comida','x',d, base||d||'/comercios/portada-a.jpg', base||d||'/comercios/logo-compartido.jpg'),
    (b,'QA Fotos B','qa-fotos-b','comida','x',d, base||d||'/comercios/portada-b.jpg', base||d||'/comercios/logo-compartido.jpg');
  insert into delivery_productos (comercio_id, nombre, categoria, precio, imagen_url, imagenes) values
    (a,'Pan','x',100, base||d||'/productos/pan.jpg', array[base||d||'/productos/pan-2.jpg']),
    (b,'Pan','x',100, base||d||'/productos/pan.jpg', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub',d,'role','authenticated')::text, true); set local role authenticated;
  v := delivery_eliminar_tienda(a, 'QA Fotos A');
  reset role;
  esperado := jsonb_build_array(d||'/comercios/portada-a.jpg', d||'/productos/pan-2.jpg');
  if (select jsonb_agg(x order by x) from jsonb_array_elements_text(v->'archivos') x) = (select jsonb_agg(x order by x) from jsonb_array_elements_text(esperado) x)
    then raise exception 'RESULTADO: ok (solo las fotos exclusivas: %)', v->'archivos';
    else raise exception 'RESULTADO: FALLA, se informaron %', v->'archivos'; end if;
end $$;
