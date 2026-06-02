alter table public.proyectos
add column if not exists tagline text;

update public.proyectos
set tagline = nullif(split_part(coalesce(descripcion, ''), E'\n', 1), '')
where tagline is null;