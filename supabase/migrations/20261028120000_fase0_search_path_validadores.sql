-- FASE 0 (3/3): fija el search_path de los validadores (aviso del analizador de Supabase). Sin cambio de comportamiento.
alter function public._ts_txt(jsonb, text, int) set search_path = public, pg_temp;
alter function public._ts_url(jsonb, text, int) set search_path = public, pg_temp;
alter function public._ts_enum(jsonb, text, text[], text) set search_path = public, pg_temp;
alter function public._ts_int(jsonb, text, int, int, int) set search_path = public, pg_temp;
alter function public._ts_color(jsonb, text) set search_path = public, pg_temp;
alter function public._ts_bloque(jsonb, int) set search_path = public, pg_temp;
alter function public._ts_diseno(jsonb) set search_path = public, pg_temp;
alter function public.delivery_campana_texto_valido(text) set search_path = public, pg_temp;
