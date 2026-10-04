-- Foto de entrega: bucket privado, columna en el pedido y RPC para registrarla.
alter table public.delivery_pedidos add column if not exists foto_entrega_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Entregas: el repartidor sube la foto de su pedido" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'entregas'
  and exists (
    select 1 from public.delivery_pedidos p
    where p.id::text = (storage.foldername(name))[1]
      and p.repartidor_id = (select auth.uid())
      and p.estado = 'en_camino'
  )
);

create policy "Entregas: ven la foto quienes ven el pedido" on storage.objects
for select to authenticated
using (
  bucket_id = 'entregas'
  and exists (
    select 1 from public.delivery_pedidos p
    where p.id::text = (storage.foldername(name))[1]
  )
);

create or replace function public.delivery_registrar_foto_entrega(p_pedido uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Iniciá sesión';
  end if;
  if p_path is null or p_path !~ ('^' || p_pedido::text || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$') then
    raise exception 'Foto inválida';
  end if;
  update public.delivery_pedidos
     set foto_entrega_path = p_path
   where id = p_pedido
     and repartidor_id = (select auth.uid())
     and estado in ('en_camino', 'entregado');
  if not found then
    raise exception 'No podés agregar una foto a este pedido';
  end if;
end;
$$;

revoke all on function public.delivery_registrar_foto_entrega(uuid, text) from public, anon;
grant execute on function public.delivery_registrar_foto_entrega(uuid, text) to authenticated;
