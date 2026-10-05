-- FASE 4, paso 2b: asignación inicial de categorías del Market a productos que todavía no tienen (solo donde categoria_id es null).
-- Se deduce del rubro del comercio y de la sección del menú; el comercio puede corregirla desde el editor de producto.
-- Revertir: update delivery_productos set categoria_id = null where categoria_id is not null (solo si nadie la cambió a mano).
with mapa as (
  select p.id,
    case c.categoria::text
      when 'comida' then case
        when pc ~ 'pizza' then 'comida-y-bebidas-pizzerias'
        when pc ~ 'hamburg|burger' then 'comida-y-bebidas-hamburguesas'
        when pc ~ 'cafe|brunch|tostad' then 'comida-y-bebidas-cafe'
        when pc ~ 'dulce|salado|dona|panader|postre' then 'comida-y-bebidas-panaderia-y-pasteleria'
        when pc ~ 'cerveza|bebida' then 'comida-y-bebidas-bebidas'
        when pc ~ 'ensalada|bowl|saludable' then 'comida-y-bebidas-comida-saludable'
        else 'comida-y-bebidas-restaurantes' end
      when 'supermercado' then case
        when pc ~ 'fruta|verdura' then 'supermercado-y-almacen-frutas-y-verduras'
        when pc ~ 'lacteo|fiambre' then 'supermercado-y-almacen-lacteos-y-fiambres'
        when pc ~ 'snack|golosina|kiosco' then 'supermercado-y-almacen-kiosco'
        else 'supermercado-y-almacen-almacen' end
      when 'farmacia' then case
        when pc ~ 'dermo|piel' then 'salud-y-belleza-cuidado-de-la-piel'
        when pc ~ 'cuidado personal|higiene' then 'salud-y-belleza-cuidado-personal'
        else 'salud-y-belleza-farmacia' end
      else 'otros'
    end as slug
  from public.delivery_productos p
  join public.delivery_comercios c on c.id = p.comercio_id
  cross join lateral (select public.f_unaccent(lower(coalesce(p.categoria, ''))) as pc) x
  where p.categoria_id is null
)
update public.delivery_productos p set categoria_id = k.id
  from mapa m join public.categorias k on k.slug = m.slug
 where p.id = m.id;
