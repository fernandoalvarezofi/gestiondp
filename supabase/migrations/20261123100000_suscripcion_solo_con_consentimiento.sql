-- La suscripción por email de las tiendas exige consentimiento explícito.
-- La versión de 2 parámetros (sin consentimiento) quedó de una etapa anterior y permitía anotar un email sin aceptación.
-- La app ya usa la de 3 parámetros; se le quita el permiso de ejecución a la vieja (reversible: volver a hacer GRANT).
revoke execute on function public.delivery_tienda_suscribir(uuid, text) from public, anon, authenticated;
