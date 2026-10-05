// Tipos generados desde la base REAL de Woref (woref-delivery) el 2026-10-05 con la herramienta de Supabase.
// Regenerar cada vez que cambie el esquema. (Antes este archivo era de otra aplicación: ver ARCHITECTURE.md §S.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          clave: string
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          updated_at?: string
          valor: string
        }
        Update: {
          clave?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      core_business_members: {
        Row: {
          business_id: string
          created_at: string
          estado: string
          rol: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          estado?: string
          rol: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          estado?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "core_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      core_businesses: {
        Row: {
          created_at: string
          estado: string
          id: string
          nombre: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          nombre: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          nombre?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_ajustes: {
        Row: {
          ayuda: string | null
          clave: string
          etiqueta: string
          maximo: number
          minimo: number
          unidad: string
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          ayuda?: string | null
          clave: string
          etiqueta: string
          maximo: number
          minimo: number
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          ayuda?: string | null
          clave?: string
          etiqueta?: string
          maximo?: number
          minimo?: number
          unidad?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ajustes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_arrepentimientos: {
        Row: {
          codigo: string
          creado_en: string
          email: string
          estado: string
          id: string
          motivo: string | null
          nombre: string
          pedido_ref: string | null
          perfil_id: string | null
          resolucion: string | null
          resuelto_en: string | null
          resuelto_por: string | null
          telefono: string | null
          tipo: string
        }
        Insert: {
          codigo: string
          creado_en?: string
          email: string
          estado?: string
          id?: string
          motivo?: string | null
          nombre: string
          pedido_ref?: string | null
          perfil_id?: string | null
          resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          telefono?: string | null
          tipo: string
        }
        Update: {
          codigo?: string
          creado_en?: string
          email?: string
          estado?: string
          id?: string
          motivo?: string | null
          nombre?: string
          pedido_ref?: string | null
          perfil_id?: string | null
          resolucion?: string | null
          resuelto_en?: string | null
          resuelto_por?: string | null
          telefono?: string | null
          tipo?: string
        }
        Relationships: []
      }
      delivery_auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          created_at: string
          detalle: Json
          entidad: string
          entidad_id: string | null
          enviado_at: string | null
          id: number
          lote: number | null
          lote_at: string | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          entidad: string
          entidad_id?: string | null
          enviado_at?: string | null
          id?: never
          lote?: number | null
          lote_at?: string | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json
          entidad?: string
          entidad_id?: string | null
          enviado_at?: string | null
          id?: never
          lote?: number | null
          lote_at?: string | null
        }
        Relationships: []
      }
      delivery_campana_envios: {
        Row: {
          campana_id: string
          created_at: string
          perfil_id: string
        }
        Insert: {
          campana_id: string
          created_at?: string
          perfil_id: string
        }
        Update: {
          campana_id?: string
          created_at?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_campana_envios_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "delivery_campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_campanas: {
        Row: {
          autor_id: string
          comercio_id: string | null
          created_at: string
          cupon_codigo: string | null
          destinatarios: number
          enviada_at: string | null
          enviados: number
          estado: string
          id: string
          mensaje: string
          segmento: string
          titulo: string
        }
        Insert: {
          autor_id: string
          comercio_id?: string | null
          created_at?: string
          cupon_codigo?: string | null
          destinatarios?: number
          enviada_at?: string | null
          enviados?: number
          estado?: string
          id?: string
          mensaje: string
          segmento: string
          titulo: string
        }
        Update: {
          autor_id?: string
          comercio_id?: string | null
          created_at?: string
          cupon_codigo?: string | null
          destinatarios?: number
          enviada_at?: string | null
          enviados?: number
          estado?: string
          id?: string
          mensaje?: string
          segmento?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_campanas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_clientes_control: {
        Row: {
          bloqueado: boolean
          motivo: string | null
          nota: string | null
          perfil_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bloqueado?: boolean
          motivo?: string | null
          nota?: string | null
          perfil_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bloqueado?: boolean
          motivo?: string | null
          nota?: string | null
          perfil_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_clientes_control_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_club_premios: {
        Row: {
          activo: boolean
          descripcion: string | null
          id: string
          minimo: number
          nombre: string
          orden: number
          puntos: number
          tipo: string
          tope: number | null
          validez_dias: number
          valor: number
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          minimo?: number
          nombre: string
          orden?: number
          puntos: number
          tipo: string
          tope?: number | null
          validez_dias?: number
          valor?: number
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          minimo?: number
          nombre?: string
          orden?: number
          puntos?: number
          tipo?: string
          tope?: number | null
          validez_dias?: number
          valor?: number
        }
        Relationships: []
      }
      delivery_comercio_equipo: {
        Row: {
          comercio_id: string
          created_at: string
          email: string
          estado: string
          id: string
          invitado_por: string | null
          rol: string
          user_id: string | null
        }
        Insert: {
          comercio_id: string
          created_at?: string
          email: string
          estado?: string
          id?: string
          invitado_por?: string | null
          rol: string
          user_id?: string | null
        }
        Update: {
          comercio_id?: string
          created_at?: string
          email?: string
          estado?: string
          id?: string
          invitado_por?: string | null
          rol?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_comercio_equipo_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_comercio_legal: {
        Row: {
          comercio_id: string
          condicion_iva: string
          cuit: string
          razon_social: string
          updated_at: string
        }
        Insert: {
          comercio_id: string
          condicion_iva: string
          cuit: string
          razon_social: string
          updated_at?: string
        }
        Update: {
          comercio_id?: string
          condicion_iva?: string
          cuit?: string
          razon_social?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_comercio_legal_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: true
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_comercios: {
        Row: {
          acepta_programados: boolean
          acepta_retiro: boolean
          activo: boolean
          aprobado: boolean
          business_id: string | null
          categoria: Database["public"]["Enums"]["delivery_categoria"]
          comision_pct: number
          costo_envio: number
          costo_por_km: number
          created_at: string
          descripcion: string | null
          destacado: boolean
          direccion: string
          envio_gratis_desde: number | null
          esta_abierto: boolean
          horario: string
          horarios: Json | null
          id: string
          imagen_url: string | null
          latitud: number | null
          liquidacion_frecuencia: string
          logo_url: string | null
          longitud: number | null
          motivo_rechazo: string | null
          nombre: string
          parent_store_id: string | null
          pausado_hasta: string | null
          pedido_minimo: number
          promo_texto: string | null
          propietario_id: string | null
          radio_entrega_km: number
          rating: number
          rubro: string | null
          slug: string
          telefono: string | null
          tiempo_max: number
          tiempo_min: number
          tiempo_preparacion_min: number
          tienda_tema: Json
          total_resenas: number
          updated_at: string
        }
        Insert: {
          acepta_programados?: boolean
          acepta_retiro?: boolean
          activo?: boolean
          aprobado?: boolean
          business_id?: string | null
          categoria: Database["public"]["Enums"]["delivery_categoria"]
          comision_pct?: number
          costo_envio?: number
          costo_por_km?: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          direccion: string
          envio_gratis_desde?: number | null
          esta_abierto?: boolean
          horario?: string
          horarios?: Json | null
          id?: string
          imagen_url?: string | null
          latitud?: number | null
          liquidacion_frecuencia?: string
          logo_url?: string | null
          longitud?: number | null
          motivo_rechazo?: string | null
          nombre: string
          parent_store_id?: string | null
          pausado_hasta?: string | null
          pedido_minimo?: number
          promo_texto?: string | null
          propietario_id?: string | null
          radio_entrega_km?: number
          rating?: number
          rubro?: string | null
          slug: string
          telefono?: string | null
          tiempo_max?: number
          tiempo_min?: number
          tiempo_preparacion_min?: number
          tienda_tema?: Json
          total_resenas?: number
          updated_at?: string
        }
        Update: {
          acepta_programados?: boolean
          acepta_retiro?: boolean
          activo?: boolean
          aprobado?: boolean
          business_id?: string | null
          categoria?: Database["public"]["Enums"]["delivery_categoria"]
          comision_pct?: number
          costo_envio?: number
          costo_por_km?: number
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          direccion?: string
          envio_gratis_desde?: number | null
          esta_abierto?: boolean
          horario?: string
          horarios?: Json | null
          id?: string
          imagen_url?: string | null
          latitud?: number | null
          liquidacion_frecuencia?: string
          logo_url?: string | null
          longitud?: number | null
          motivo_rechazo?: string | null
          nombre?: string
          parent_store_id?: string | null
          pausado_hasta?: string | null
          pedido_minimo?: number
          promo_texto?: string | null
          propietario_id?: string | null
          radio_entrega_km?: number
          rating?: number
          rubro?: string | null
          slug?: string
          telefono?: string | null
          tiempo_max?: number
          tiempo_min?: number
          tiempo_preparacion_min?: number
          tienda_tema?: Json
          total_resenas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_comercios_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "core_businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_comercios_parent_store_id_fkey"
            columns: ["parent_store_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_comercios_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_conexiones: {
        Row: {
          desde: string
          hasta: string | null
          id: number
          repartidor_id: string
        }
        Insert: {
          desde?: string
          hasta?: string | null
          id?: never
          repartidor_id: string
        }
        Update: {
          desde?: string
          hasta?: string | null
          id?: never
          repartidor_id?: string
        }
        Relationships: []
      }
      delivery_cupones: {
        Row: {
          activo: boolean
          cliente_id: string | null
          codigo: string
          comercio_id: string | null
          created_at: string
          descripcion: string
          id: string
          minimo: number
          tipo: string
          tope: number | null
          un_uso_por_cliente: boolean
          usos: number
          usos_max: number | null
          valor: number
          vence_at: string | null
        }
        Insert: {
          activo?: boolean
          cliente_id?: string | null
          codigo: string
          comercio_id?: string | null
          created_at?: string
          descripcion: string
          id?: string
          minimo?: number
          tipo: string
          tope?: number | null
          un_uso_por_cliente?: boolean
          usos?: number
          usos_max?: number | null
          valor?: number
          vence_at?: string | null
        }
        Update: {
          activo?: boolean
          cliente_id?: string | null
          codigo?: string
          comercio_id?: string | null
          created_at?: string
          descripcion?: string
          id?: string
          minimo?: number
          tipo?: string
          tope?: number | null
          un_uso_por_cliente?: boolean
          usos?: number
          usos_max?: number | null
          valor?: number
          vence_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cupones_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_datos_cobro: {
        Row: {
          alias: string | null
          cbu: string | null
          cuit: string
          entidad: string
          entidad_id: string
          titular: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alias?: string | null
          cbu?: string | null
          cuit: string
          entidad: string
          entidad_id: string
          titular: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alias?: string | null
          cbu?: string | null
          cuit?: string
          entidad?: string
          entidad_id?: string
          titular?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      delivery_direcciones: {
        Row: {
          alias: string
          ciudad: string
          created_at: string
          detalle: string | null
          direccion: string
          id: string
          instrucciones: string | null
          latitud: number | null
          longitud: number | null
          perfil_id: string
          predeterminada: boolean
          updated_at: string
        }
        Insert: {
          alias?: string
          ciudad?: string
          created_at?: string
          detalle?: string | null
          direccion: string
          id?: string
          instrucciones?: string | null
          latitud?: number | null
          longitud?: number | null
          perfil_id: string
          predeterminada?: boolean
          updated_at?: string
        }
        Update: {
          alias?: string
          ciudad?: string
          created_at?: string
          detalle?: string | null
          direccion?: string
          id?: string
          instrucciones?: string | null
          latitud?: number | null
          longitud?: number | null
          perfil_id?: string
          predeterminada?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_direcciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_directorio: {
        Row: {
          comercio_id: string | null
          created_at: string
          direccion: string | null
          estado: string
          fuente: string
          horario: string | null
          id: string
          lat: number
          lng: number
          nombre: string
          nota: string | null
          osm_id: string | null
          rubro: string
          telefono: string | null
          updated_at: string
          web: string | null
        }
        Insert: {
          comercio_id?: string | null
          created_at?: string
          direccion?: string | null
          estado?: string
          fuente?: string
          horario?: string | null
          id?: string
          lat: number
          lng: number
          nombre: string
          nota?: string | null
          osm_id?: string | null
          rubro: string
          telefono?: string | null
          updated_at?: string
          web?: string | null
        }
        Update: {
          comercio_id?: string | null
          created_at?: string
          direccion?: string | null
          estado?: string
          fuente?: string
          horario?: string | null
          id?: string
          lat?: number
          lng?: number
          nombre?: string
          nota?: string | null
          osm_id?: string | null
          rubro?: string
          telefono?: string | null
          updated_at?: string
          web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_directorio_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_directorio_interes: {
        Row: {
          created_at: string
          directorio_id: string
          perfil_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          directorio_id: string
          perfil_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          directorio_id?: string
          perfil_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_directorio_interes_directorio_id_fkey"
            columns: ["directorio_id"]
            isOneToOne: false
            referencedRelation: "delivery_directorio"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_documentos: {
        Row: {
          created_at: string
          entidad: string
          entidad_id: string
          id: string
          path: string
          subido_por: string
          tipo: string
        }
        Insert: {
          created_at?: string
          entidad: string
          entidad_id: string
          id?: string
          path: string
          subido_por: string
          tipo: string
        }
        Update: {
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: string
          path?: string
          subido_por?: string
          tipo?: string
        }
        Relationships: []
      }
      delivery_envio_codigos: {
        Row: {
          codigo: string
          envio_id: string
        }
        Insert: {
          codigo: string
          envio_id: string
        }
        Update: {
          codigo?: string
          envio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_envio_codigos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: true
            referencedRelation: "delivery_envios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_envios: {
        Row: {
          asignado_at: string | null
          cancelado_at: string | null
          cliente_id: string
          comision_pct: number
          costo: number
          created_at: string
          descripcion: string
          destino_contacto: string
          destino_direccion: string
          destino_lat: number
          destino_lng: number
          destino_notas: string | null
          destino_telefono: string
          distancia_km: number
          entregado_at: string | null
          estado: string
          ganancia_repartidor: number
          id: string
          metodo_pago: string
          motivo_cancelacion: string | null
          origen_contacto: string
          origen_direccion: string
          origen_lat: number
          origen_lng: number
          origen_notas: string | null
          origen_telefono: string
          propina: number
          quien_paga: string
          repartidor_id: string | null
          retirado_at: string | null
          tamano: string
          total: number
          updated_at: string
        }
        Insert: {
          asignado_at?: string | null
          cancelado_at?: string | null
          cliente_id: string
          comision_pct: number
          costo: number
          created_at?: string
          descripcion: string
          destino_contacto: string
          destino_direccion: string
          destino_lat: number
          destino_lng: number
          destino_notas?: string | null
          destino_telefono: string
          distancia_km: number
          entregado_at?: string | null
          estado?: string
          ganancia_repartidor: number
          id?: string
          metodo_pago?: string
          motivo_cancelacion?: string | null
          origen_contacto: string
          origen_direccion: string
          origen_lat: number
          origen_lng: number
          origen_notas?: string | null
          origen_telefono: string
          propina?: number
          quien_paga: string
          repartidor_id?: string | null
          retirado_at?: string | null
          tamano: string
          total: number
          updated_at?: string
        }
        Update: {
          asignado_at?: string | null
          cancelado_at?: string | null
          cliente_id?: string
          comision_pct?: number
          costo?: number
          created_at?: string
          descripcion?: string
          destino_contacto?: string
          destino_direccion?: string
          destino_lat?: number
          destino_lng?: number
          destino_notas?: string | null
          destino_telefono?: string
          distancia_km?: number
          entregado_at?: string | null
          estado?: string
          ganancia_repartidor?: number
          id?: string
          metodo_pago?: string
          motivo_cancelacion?: string | null
          origen_contacto?: string
          origen_direccion?: string
          origen_lat?: number
          origen_lng?: number
          origen_notas?: string | null
          origen_telefono?: string
          propina?: number
          quien_paga?: string
          repartidor_id?: string | null
          retirado_at?: string | null
          tamano?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_envios_cliente_perfil_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_errores: {
        Row: {
          agente: string | null
          created_at: string
          enviado_at: string | null
          huella: string
          id: number
          lote: number | null
          lote_at: string | null
          mensaje: string
          stack: string | null
          url: string | null
          usuario_id: string | null
        }
        Insert: {
          agente?: string | null
          created_at?: string
          enviado_at?: string | null
          huella: string
          id?: never
          lote?: number | null
          lote_at?: string | null
          mensaje: string
          stack?: string | null
          url?: string | null
          usuario_id?: string | null
        }
        Update: {
          agente?: string | null
          created_at?: string
          enviado_at?: string | null
          huella?: string
          id?: never
          lote?: number | null
          lote_at?: string | null
          mensaje?: string
          stack?: string | null
          url?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      delivery_favoritos: {
        Row: {
          comercio_id: string
          created_at: string
          perfil_id: string
        }
        Insert: {
          comercio_id: string
          created_at?: string
          perfil_id: string
        }
        Update: {
          comercio_id?: string
          created_at?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_favoritos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_favoritos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_identidad: {
        Row: {
          controles: Json
          created_at: string
          desafio: string
          dni: string
          enviado_at: string | null
          estado: string
          fecha_nacimiento: string | null
          intentos: number
          motivo_rechazo: string | null
          nombre_legal: string
          perfil_id: string
          revisado_at: string | null
          revisado_por: string | null
          updated_at: string
          vence_at: string | null
        }
        Insert: {
          controles?: Json
          created_at?: string
          desafio: string
          dni: string
          enviado_at?: string | null
          estado?: string
          fecha_nacimiento?: string | null
          intentos?: number
          motivo_rechazo?: string | null
          nombre_legal: string
          perfil_id: string
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
          vence_at?: string | null
        }
        Update: {
          controles?: Json
          created_at?: string
          desafio?: string
          dni?: string
          enviado_at?: string | null
          estado?: string
          fecha_nacimiento?: string | null
          intentos?: number
          motivo_rechazo?: string | null
          nombre_legal?: string
          perfil_id?: string
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
          vence_at?: string | null
        }
        Relationships: []
      }
      delivery_libro: {
        Row: {
          cuenta: string
          detalle: Json | null
          fecha: string
          id: number
          monto: number
          pedido_id: string | null
          referencia: string | null
          tipo: string
          titular_id: string | null
          titular_tipo: string
        }
        Insert: {
          cuenta: string
          detalle?: Json | null
          fecha?: string
          id?: never
          monto: number
          pedido_id?: string | null
          referencia?: string | null
          tipo: string
          titular_id?: string | null
          titular_tipo: string
        }
        Update: {
          cuenta?: string
          detalle?: Json | null
          fecha?: string
          id?: never
          monto?: number
          pedido_id?: string | null
          referencia?: string | null
          tipo?: string
          titular_id?: string | null
          titular_tipo?: string
        }
        Relationships: []
      }
      delivery_liquidacion_items: {
        Row: {
          balance: number
          cobrado_directo: number
          comision: number
          descuento_comercio: number
          fecha: string
          liquidacion_id: string
          metodo_pago: string
          neto: number
          pedido_id: string
          tipo_entrega: string
          ventas: number
        }
        Insert: {
          balance: number
          cobrado_directo: number
          comision: number
          descuento_comercio: number
          fecha: string
          liquidacion_id: string
          metodo_pago: string
          neto: number
          pedido_id: string
          tipo_entrega: string
          ventas: number
        }
        Update: {
          balance?: number
          cobrado_directo?: number
          comision?: number
          descuento_comercio?: number
          fecha?: string
          liquidacion_id?: string
          metodo_pago?: string
          neto?: number
          pedido_id?: string
          tipo_entrega?: string
          ventas?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_liquidacion_items_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "delivery_liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_liquidacion_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_liquidaciones: {
        Row: {
          balance: number
          cobrado_directo: number
          comercio_id: string
          comision: number
          comision_pct: number
          creado_por: string | null
          created_at: string
          descuentos_comercio: number
          desde: string
          estado: string
          hasta: string
          id: string
          neto: number
          pagada_at: string | null
          pedidos: number
          referencia: string | null
          ventas: number
        }
        Insert: {
          balance: number
          cobrado_directo?: number
          comercio_id: string
          comision: number
          comision_pct: number
          creado_por?: string | null
          created_at?: string
          descuentos_comercio?: number
          desde: string
          estado?: string
          hasta: string
          id?: string
          neto: number
          pagada_at?: string | null
          pedidos: number
          referencia?: string | null
          ventas: number
        }
        Update: {
          balance?: number
          cobrado_directo?: number
          comercio_id?: string
          comision?: number
          comision_pct?: number
          creado_por?: string | null
          created_at?: string
          descuentos_comercio?: number
          desde?: string
          estado?: string
          hasta?: string
          id?: string
          neto?: number
          pagada_at?: string | null
          pedidos?: number
          referencia?: string | null
          ventas?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_liquidaciones_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_liquidaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_mensajes: {
        Row: {
          autor_id: string
          canal: string
          created_at: string
          id: string
          leido_at: string | null
          pedido_id: string
          texto: string
        }
        Insert: {
          autor_id: string
          canal: string
          created_at?: string
          id?: string
          leido_at?: string | null
          pedido_id: string
          texto: string
        }
        Update: {
          autor_id?: string
          canal?: string
          created_at?: string
          id?: string
          leido_at?: string | null
          pedido_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_mensajes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_mensajes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_metas: {
        Row: {
          activa: boolean
          bono: number
          created_at: string
          hora_desde: string | null
          hora_hasta: string | null
          id: string
          nombre: string
          objetivo: number
          periodo: string
        }
        Insert: {
          activa?: boolean
          bono: number
          created_at?: string
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          nombre: string
          objetivo: number
          periodo: string
        }
        Update: {
          activa?: boolean
          bono?: number
          created_at?: string
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          nombre?: string
          objetivo?: number
          periodo?: string
        }
        Relationships: []
      }
      delivery_metas_logradas: {
        Row: {
          bono: number
          created_at: string
          meta_id: string
          periodo_inicio: string
          repartidor_id: string
        }
        Insert: {
          bono: number
          created_at?: string
          meta_id: string
          periodo_inicio: string
          repartidor_id: string
        }
        Update: {
          bono?: number
          created_at?: string
          meta_id?: string
          periodo_inicio?: string
          repartidor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_metas_logradas_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "delivery_metas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_movimientos_repartidor: {
        Row: {
          creado_por: string | null
          created_at: string
          id: string
          monto: number
          nota: string | null
          repartidor_id: string
          tipo: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          id?: string
          monto: number
          nota?: string | null
          repartidor_id: string
          tipo: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          id?: string
          monto?: number
          nota?: string | null
          repartidor_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_movimientos_repartidor_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_movimientos_repartidor_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ofertas_rechazos: {
        Row: {
          created_at: string
          motivo: string | null
          pedido_id: string
          repartidor_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          motivo?: string | null
          pedido_id: string
          repartidor_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          motivo?: string | null
          pedido_id?: string
          repartidor_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ofertas_rechazos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ofertas_rechazos_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pedido_ajustes: {
        Row: {
          creado_por: string | null
          created_at: string
          estado: string
          id: string
          item_cantidad: number
          item_id: string | null
          item_nombre: string
          item_precio: number
          pedido_id: string
          reemplazo_nombre: string | null
          reemplazo_precio: number | null
          reemplazo_producto_id: string | null
          respondido_at: string | null
          tipo: string
          vence_at: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          item_cantidad: number
          item_id?: string | null
          item_nombre: string
          item_precio: number
          pedido_id: string
          reemplazo_nombre?: string | null
          reemplazo_precio?: number | null
          reemplazo_producto_id?: string | null
          respondido_at?: string | null
          tipo: string
          vence_at: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          estado?: string
          id?: string
          item_cantidad?: number
          item_id?: string | null
          item_nombre?: string
          item_precio?: number
          pedido_id?: string
          reemplazo_nombre?: string | null
          reemplazo_precio?: number | null
          reemplazo_producto_id?: string | null
          respondido_at?: string | null
          tipo?: string
          vence_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pedido_ajustes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pedido_codigos: {
        Row: {
          codigo: string
          pedido_id: string
        }
        Insert: {
          codigo: string
          pedido_id: string
        }
        Update: {
          codigo?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pedido_codigos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pedido_eventos: {
        Row: {
          actor_id: string | null
          actor_rol: string | null
          created_at: string
          detalle: Json | null
          estado_anterior: string | null
          estado_nuevo: string | null
          evento: string
          id: number
          pedido_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_rol?: string | null
          created_at?: string
          detalle?: Json | null
          estado_anterior?: string | null
          estado_nuevo?: string | null
          evento: string
          id?: never
          pedido_id: string
        }
        Update: {
          actor_id?: string | null
          actor_rol?: string | null
          created_at?: string
          detalle?: Json | null
          estado_anterior?: string | null
          estado_nuevo?: string | null
          evento?: string
          id?: never
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pedido_eventos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pedido_items: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          nombre: string
          notas: string | null
          opciones: Json
          pedido_id: string
          precio_unitario: number
          producto_id: string | null
          variante_id: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          nombre: string
          notas?: string | null
          opciones?: Json
          pedido_id: string
          precio_unitario: number
          producto_id?: string | null
          variante_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          opciones?: Json
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string | null
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "delivery_productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedido_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "delivery_producto_variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pedidos: {
        Row: {
          aceptado_en_seg: number | null
          asignado_at: string | null
          asignado_por: string | null
          calificado: boolean
          canal: string
          cancelado_at: string | null
          cliente_id: string
          comercio_id: string
          confirmado_at: string | null
          costo_envio: number
          created_at: string
          cupon_codigo: string | null
          demora_extra_min: number
          descuento: number
          direccion_entrega: string
          direccion_id: string | null
          distancia_km: number | null
          efectivo_paga_con: number | null
          en_camino_at: string | null
          entrega_estimada: string | null
          entregado_at: string | null
          estado: Database["public"]["Enums"]["delivery_estado_pedido"]
          foto_entrega_path: string | null
          ganancia_repartidor: number | null
          id: string
          latitud: number | null
          liquidacion_id: string | null
          listo_at: string | null
          llegada_cliente_at: string | null
          llegada_comercio_at: string | null
          longitud: number | null
          metodo_pago: string
          motivo_cancelacion: string | null
          notas: string | null
          pago_estado: string
          pago_id: string | null
          pago_preferencia: string | null
          preparacion_min: number | null
          preparando_at: string | null
          programado_para: string | null
          propina: number
          repartidor_id: string | null
          responder_antes_de: string | null
          saldo_usado: number
          subtotal: number
          tarifa_detalle: Json | null
          tarifa_servicio: number
          telefono_contacto: string | null
          tipo_entrega: string
          total: number
          updated_at: string
          visible_at: string | null
        }
        Insert: {
          aceptado_en_seg?: number | null
          asignado_at?: string | null
          asignado_por?: string | null
          calificado?: boolean
          canal?: string
          cancelado_at?: string | null
          cliente_id: string
          comercio_id: string
          confirmado_at?: string | null
          costo_envio?: number
          created_at?: string
          cupon_codigo?: string | null
          demora_extra_min?: number
          descuento?: number
          direccion_entrega: string
          direccion_id?: string | null
          distancia_km?: number | null
          efectivo_paga_con?: number | null
          en_camino_at?: string | null
          entrega_estimada?: string | null
          entregado_at?: string | null
          estado?: Database["public"]["Enums"]["delivery_estado_pedido"]
          foto_entrega_path?: string | null
          ganancia_repartidor?: number | null
          id?: string
          latitud?: number | null
          liquidacion_id?: string | null
          listo_at?: string | null
          llegada_cliente_at?: string | null
          llegada_comercio_at?: string | null
          longitud?: number | null
          metodo_pago?: string
          motivo_cancelacion?: string | null
          notas?: string | null
          pago_estado?: string
          pago_id?: string | null
          pago_preferencia?: string | null
          preparacion_min?: number | null
          preparando_at?: string | null
          programado_para?: string | null
          propina?: number
          repartidor_id?: string | null
          responder_antes_de?: string | null
          saldo_usado?: number
          subtotal?: number
          tarifa_detalle?: Json | null
          tarifa_servicio?: number
          telefono_contacto?: string | null
          tipo_entrega?: string
          total?: number
          updated_at?: string
          visible_at?: string | null
        }
        Update: {
          aceptado_en_seg?: number | null
          asignado_at?: string | null
          asignado_por?: string | null
          calificado?: boolean
          canal?: string
          cancelado_at?: string | null
          cliente_id?: string
          comercio_id?: string
          confirmado_at?: string | null
          costo_envio?: number
          created_at?: string
          cupon_codigo?: string | null
          demora_extra_min?: number
          descuento?: number
          direccion_entrega?: string
          direccion_id?: string | null
          distancia_km?: number | null
          efectivo_paga_con?: number | null
          en_camino_at?: string | null
          entrega_estimada?: string | null
          entregado_at?: string | null
          estado?: Database["public"]["Enums"]["delivery_estado_pedido"]
          foto_entrega_path?: string | null
          ganancia_repartidor?: number | null
          id?: string
          latitud?: number | null
          liquidacion_id?: string | null
          listo_at?: string | null
          llegada_cliente_at?: string | null
          llegada_comercio_at?: string | null
          longitud?: number | null
          metodo_pago?: string
          motivo_cancelacion?: string | null
          notas?: string | null
          pago_estado?: string
          pago_id?: string | null
          pago_preferencia?: string | null
          preparacion_min?: number | null
          preparando_at?: string | null
          programado_para?: string | null
          propina?: number
          repartidor_id?: string | null
          responder_antes_de?: string | null
          saldo_usado?: number
          subtotal?: number
          tarifa_detalle?: Json | null
          tarifa_servicio?: number
          telefono_contacto?: string | null
          tipo_entrega?: string
          total?: number
          updated_at?: string
          visible_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedidos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedidos_direccion_id_fkey"
            columns: ["direccion_id"]
            isOneToOne: false
            referencedRelation: "delivery_direcciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedidos_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "delivery_liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_pedidos_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_preferencias: {
        Row: {
          email_novedades: boolean
          entrega_instrucciones: string | null
          entrega_sin_contacto: boolean
          pago_preferido: string
          perfil_id: string
          propina_default: number
          push_mensajes: boolean
          push_promos: boolean
          updated_at: string
        }
        Insert: {
          email_novedades?: boolean
          entrega_instrucciones?: string | null
          entrega_sin_contacto?: boolean
          pago_preferido?: string
          perfil_id: string
          propina_default?: number
          push_mensajes?: boolean
          push_promos?: boolean
          updated_at?: string
        }
        Update: {
          email_novedades?: boolean
          entrega_instrucciones?: string | null
          entrega_sin_contacto?: boolean
          pago_preferido?: string
          perfil_id?: string
          propina_default?: number
          push_mensajes?: boolean
          push_promos?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_preferencias_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_producto_grupos: {
        Row: {
          created_at: string
          id: string
          maximo: number
          minimo: number
          nombre: string
          orden: number
          producto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          maximo?: number
          minimo?: number
          nombre: string
          orden?: number
          producto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          maximo?: number
          minimo?: number
          nombre?: string
          orden?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_producto_grupos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "delivery_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_producto_opciones: {
        Row: {
          created_at: string
          disponible: boolean
          grupo_id: string
          id: string
          nombre: string
          orden: number
          precio_extra: number
        }
        Insert: {
          created_at?: string
          disponible?: boolean
          grupo_id: string
          id?: string
          nombre: string
          orden?: number
          precio_extra?: number
        }
        Update: {
          created_at?: string
          disponible?: boolean
          grupo_id?: string
          id?: string
          nombre?: string
          orden?: number
          precio_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_producto_opciones_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "delivery_producto_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_producto_preguntas: {
        Row: {
          autor_id: string
          comercio_id: string
          created_at: string
          id: string
          pregunta: string
          producto_id: string
          respondida_at: string | null
          respondida_por: string | null
          respuesta: string | null
          visible: boolean
        }
        Insert: {
          autor_id: string
          comercio_id: string
          created_at?: string
          id?: string
          pregunta: string
          producto_id: string
          respondida_at?: string | null
          respondida_por?: string | null
          respuesta?: string | null
          visible?: boolean
        }
        Update: {
          autor_id?: string
          comercio_id?: string
          created_at?: string
          id?: string
          pregunta?: string
          producto_id?: string
          respondida_at?: string | null
          respondida_por?: string | null
          respuesta?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_producto_preguntas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_producto_preguntas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "delivery_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_producto_variantes: {
        Row: {
          created_at: string
          disponible: boolean
          id: string
          nombre: string
          orden: number
          precio: number | null
          producto_id: string
          sku: string | null
          stock: number | null
        }
        Insert: {
          created_at?: string
          disponible?: boolean
          id?: string
          nombre: string
          orden?: number
          precio?: number | null
          producto_id: string
          sku?: string | null
          stock?: number | null
        }
        Update: {
          created_at?: string
          disponible?: boolean
          id?: string
          nombre?: string
          orden?: number
          precio?: number | null
          producto_id?: string
          sku?: string | null
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_producto_variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "delivery_productos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_productos: {
        Row: {
          categoria: string
          comercio_id: string
          created_at: string
          descripcion: string | null
          destacado: boolean
          disponible: boolean
          etiquetas: string[]
          id: string
          imagen_url: string | null
          imagenes: string[]
          nombre: string
          orden: number
          precio: number
          precio_anterior: number | null
          stock: number | null
          updated_at: string
          usa_variantes: boolean
        }
        Insert: {
          categoria?: string
          comercio_id: string
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          disponible?: boolean
          etiquetas?: string[]
          id?: string
          imagen_url?: string | null
          imagenes?: string[]
          nombre: string
          orden?: number
          precio: number
          precio_anterior?: number | null
          stock?: number | null
          updated_at?: string
          usa_variantes?: boolean
        }
        Update: {
          categoria?: string
          comercio_id?: string
          created_at?: string
          descripcion?: string | null
          destacado?: boolean
          disponible?: boolean
          etiquetas?: string[]
          id?: string
          imagen_url?: string | null
          imagenes?: string[]
          nombre?: string
          orden?: number
          precio?: number
          precio_anterior?: number | null
          stock?: number | null
          updated_at?: string
          usa_variantes?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_productos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_puntos: {
        Row: {
          created_at: string
          envio_id: string | null
          id: string
          motivo: string
          nota: string | null
          pedido_id: string | null
          perfil_id: string
          puntos: number
        }
        Insert: {
          created_at?: string
          envio_id?: string | null
          id?: string
          motivo: string
          nota?: string | null
          pedido_id?: string | null
          perfil_id: string
          puntos: number
        }
        Update: {
          created_at?: string
          envio_id?: string | null
          id?: string
          motivo?: string
          nota?: string | null
          pedido_id?: string | null
          perfil_id?: string
          puntos?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_puntos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "delivery_envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_puntos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_puntos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_push_suscripciones: {
        Row: {
          auth: string
          created_at: string
          dispositivo: string | null
          endpoint: string
          id: string
          p256dh: string
          perfil_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          dispositivo?: string | null
          endpoint: string
          id?: string
          p256dh: string
          perfil_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          dispositivo?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_push_suscripciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_reclamo_mensajes: {
        Row: {
          autor_id: string | null
          autor_rol: string
          created_at: string
          id: number
          interna: boolean
          reclamo_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          autor_rol: string
          created_at?: string
          id?: never
          interna?: boolean
          reclamo_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          autor_rol?: string
          created_at?: string
          id?: never
          interna?: boolean
          reclamo_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_reclamo_mensajes_reclamo_id_fkey"
            columns: ["reclamo_id"]
            isOneToOne: false
            referencedRelation: "delivery_reclamos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_reclamos: {
        Row: {
          asignado_a: string | null
          cliente_id: string
          comercio_id: string | null
          created_at: string
          credito_codigo: string | null
          csat: number | null
          csat_comentario: string | null
          detalle: string
          estado: string
          id: string
          pedido_id: string | null
          primera_respuesta_at: string | null
          prioridad: string
          reembolso_monto: number
          resolucion: string | null
          resuelto_at: string | null
          resuelto_por: string | null
          tipo: string
          ultimo_autor: string
          ultimo_mensaje_at: string
        }
        Insert: {
          asignado_a?: string | null
          cliente_id: string
          comercio_id?: string | null
          created_at?: string
          credito_codigo?: string | null
          csat?: number | null
          csat_comentario?: string | null
          detalle: string
          estado?: string
          id?: string
          pedido_id?: string | null
          primera_respuesta_at?: string | null
          prioridad?: string
          reembolso_monto?: number
          resolucion?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          tipo: string
          ultimo_autor?: string
          ultimo_mensaje_at?: string
        }
        Update: {
          asignado_a?: string | null
          cliente_id?: string
          comercio_id?: string | null
          created_at?: string
          credito_codigo?: string | null
          csat?: number | null
          csat_comentario?: string | null
          detalle?: string
          estado?: string
          id?: string
          pedido_id?: string | null
          primera_respuesta_at?: string | null
          prioridad?: string
          reembolso_monto?: number
          resolucion?: string | null
          resuelto_at?: string | null
          resuelto_por?: string | null
          tipo?: string
          ultimo_autor?: string
          ultimo_mensaje_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_reclamos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_reclamos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_reclamos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_reclamos_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_referido_codigos: {
        Row: {
          codigo: string
          perfil_id: string
        }
        Insert: {
          codigo: string
          perfil_id: string
        }
        Update: {
          codigo?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_referido_codigos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_referidos: {
        Row: {
          created_at: string
          estado: string
          premiado_at: string | null
          referente_id: string
          referido_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          premiado_at?: string | null
          referente_id: string
          referido_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          premiado_at?: string | null
          referente_id?: string
          referido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_referidos_referente_id_fkey"
            columns: ["referente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_referidos_referido_id_fkey"
            columns: ["referido_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_repartidores: {
        Row: {
          acepta_remis: boolean
          aceptadas: number
          activo: boolean
          control_desafio: string | null
          control_estado: string | null
          control_motivo: string | null
          control_requerido_at: string | null
          created_at: string
          disponible: boolean
          dni: string | null
          motivo_rechazo: string | null
          patente: string | null
          perfil_id: string
          rechazadas: number
          remis_estado: string | null
          remis_motivo: string | null
          soltados: number
          telefono: string | null
          ultimo_control_at: string | null
          vehiculo: string
          verificado: boolean
          verificado_at: string | null
        }
        Insert: {
          acepta_remis?: boolean
          aceptadas?: number
          activo?: boolean
          control_desafio?: string | null
          control_estado?: string | null
          control_motivo?: string | null
          control_requerido_at?: string | null
          created_at?: string
          disponible?: boolean
          dni?: string | null
          motivo_rechazo?: string | null
          patente?: string | null
          perfil_id: string
          rechazadas?: number
          remis_estado?: string | null
          remis_motivo?: string | null
          soltados?: number
          telefono?: string | null
          ultimo_control_at?: string | null
          vehiculo?: string
          verificado?: boolean
          verificado_at?: string | null
        }
        Update: {
          acepta_remis?: boolean
          aceptadas?: number
          activo?: boolean
          control_desafio?: string | null
          control_estado?: string | null
          control_motivo?: string | null
          control_requerido_at?: string | null
          created_at?: string
          disponible?: boolean
          dni?: string | null
          motivo_rechazo?: string | null
          patente?: string | null
          perfil_id?: string
          rechazadas?: number
          remis_estado?: string | null
          remis_motivo?: string | null
          soltados?: number
          telefono?: string | null
          ultimo_control_at?: string | null
          vehiculo?: string
          verificado?: boolean
          verificado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_repartidores_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_resenas: {
        Row: {
          cliente_id: string
          comentario: string | null
          comercio_id: string
          created_at: string
          id: string
          pedido_id: string
          puntaje: number
          respuesta: string | null
        }
        Insert: {
          cliente_id: string
          comentario?: string | null
          comercio_id: string
          created_at?: string
          id?: string
          pedido_id: string
          puntaje: number
          respuesta?: string | null
        }
        Update: {
          cliente_id?: string
          comentario?: string | null
          comercio_id?: string
          created_at?: string
          id?: string
          pedido_id?: string
          puntaje?: number
          respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_resenas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_resenas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_resenas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "delivery_pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_rutas: {
        Row: {
          created_at: string
          d_lat: number
          d_lng: number
          fuente: string
          km: number
          minutos: number
          o_lat: number
          o_lng: number
        }
        Insert: {
          created_at?: string
          d_lat: number
          d_lng: number
          fuente?: string
          km: number
          minutos: number
          o_lat: number
          o_lng: number
        }
        Update: {
          created_at?: string
          d_lat?: number
          d_lng?: number
          fuente?: string
          km?: number
          minutos?: number
          o_lat?: number
          o_lng?: number
        }
        Relationships: []
      }
      delivery_secciones: {
        Row: {
          comercio_id: string
          created_at: string
          id: string
          nombre: string
          orden: number
          visible: boolean
        }
        Insert: {
          comercio_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          visible?: boolean
        }
        Update: {
          comercio_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_secciones_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_soporte_respuestas: {
        Row: {
          activo: boolean
          id: string
          orden: number
          texto: string
          titulo: string
        }
        Insert: {
          activo?: boolean
          id?: string
          orden?: number
          texto: string
          titulo: string
        }
        Update: {
          activo?: boolean
          id?: string
          orden?: number
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      delivery_tienda_suscriptores: {
        Row: {
          comercio_id: string
          creado_at: string
          email: string
          id: string
        }
        Insert: {
          comercio_id: string
          creado_at?: string
          email: string
          id?: string
        }
        Update: {
          comercio_id?: string
          creado_at?: string
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tienda_suscriptores_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tienda_visitas: {
        Row: {
          comercio_id: string
          dia: string
          visitas: number
        }
        Insert: {
          comercio_id: string
          dia?: string
          visitas?: number
        }
        Update: {
          comercio_id?: string
          dia?: string
          visitas?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tienda_visitas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "delivery_comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_turnos: {
        Row: {
          activo: boolean
          created_at: string
          cupos: number
          desde: string
          fecha: string
          hasta: string
          id: string
          nota: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          cupos: number
          desde: string
          fecha: string
          hasta: string
          id?: string
          nota?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          cupos?: number
          desde?: string
          fecha?: string
          hasta?: string
          id?: string
          nota?: string | null
        }
        Relationships: []
      }
      delivery_turnos_reservas: {
        Row: {
          cancelado_at: string | null
          created_at: string
          repartidor_id: string
          turno_id: string
        }
        Insert: {
          cancelado_at?: string | null
          created_at?: string
          repartidor_id: string
          turno_id: string
        }
        Update: {
          cancelado_at?: string | null
          created_at?: string
          repartidor_id?: string
          turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_turnos_reservas_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "delivery_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ubicaciones: {
        Row: {
          latitud: number
          longitud: number
          repartidor_id: string
          updated_at: string
        }
        Insert: {
          latitud: number
          longitud: number
          repartidor_id: string
          updated_at?: string
        }
        Update: {
          latitud?: number
          longitud?: number
          repartidor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ubicaciones_repartidor_id_fkey"
            columns: ["repartidor_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_viaje_codigos: {
        Row: {
          codigo: string
          viaje_id: string
        }
        Insert: {
          codigo: string
          viaje_id: string
        }
        Update: {
          codigo?: string
          viaje_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_viaje_codigos_viaje_id_fkey"
            columns: ["viaje_id"]
            isOneToOne: true
            referencedRelation: "delivery_viajes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_viajes: {
        Row: {
          abordo_at: string | null
          asignado_at: string | null
          calificacion: number | null
          cancelado_at: string | null
          cliente_id: string
          comision_pct: number
          completado_at: string | null
          conductor_id: string | null
          created_at: string
          destino_direccion: string
          destino_lat: number
          destino_lng: number
          distancia_km: number
          estado: string
          ganancia_conductor: number
          id: string
          llego_at: string | null
          metodo_pago: string
          minutos_estimados: number
          motivo_cancelacion: string | null
          notas: string | null
          origen_direccion: string
          origen_lat: number
          origen_lng: number
          pasajeros: number
          programado_para: string | null
          propina: number
          tarifa: number
          telefono: string
          total: number
          updated_at: string
        }
        Insert: {
          abordo_at?: string | null
          asignado_at?: string | null
          calificacion?: number | null
          cancelado_at?: string | null
          cliente_id: string
          comision_pct: number
          completado_at?: string | null
          conductor_id?: string | null
          created_at?: string
          destino_direccion: string
          destino_lat: number
          destino_lng: number
          distancia_km: number
          estado?: string
          ganancia_conductor: number
          id?: string
          llego_at?: string | null
          metodo_pago?: string
          minutos_estimados?: number
          motivo_cancelacion?: string | null
          notas?: string | null
          origen_direccion: string
          origen_lat: number
          origen_lng: number
          pasajeros: number
          programado_para?: string | null
          propina?: number
          tarifa: number
          telefono: string
          total: number
          updated_at?: string
        }
        Update: {
          abordo_at?: string | null
          asignado_at?: string | null
          calificacion?: number | null
          cancelado_at?: string | null
          cliente_id?: string
          comision_pct?: number
          completado_at?: string | null
          conductor_id?: string | null
          created_at?: string
          destino_direccion?: string
          destino_lat?: number
          destino_lng?: number
          distancia_km?: number
          estado?: string
          ganancia_conductor?: number
          id?: string
          llego_at?: string | null
          metodo_pago?: string
          minutos_estimados?: number
          motivo_cancelacion?: string | null
          notas?: string | null
          origen_direccion?: string
          origen_lat?: number
          origen_lng?: number
          pasajeros?: number
          programado_para?: string | null
          propina?: number
          tarifa?: number
          telefono?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zona_interes: {
        Row: {
          comercio_mas_cercano_km: number | null
          created_at: string
          direccion: string | null
          id: string
          latitud: number
          longitud: number
          perfil_id: string
        }
        Insert: {
          comercio_mas_cercano_km?: number | null
          created_at?: string
          direccion?: string | null
          id?: string
          latitud: number
          longitud: number
          perfil_id: string
        }
        Update: {
          comercio_mas_cercano_km?: number | null
          created_at?: string
          direccion?: string | null
          id?: string
          latitud?: number
          longitud?: number
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zona_interes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zonas: {
        Row: {
          activa: boolean
          cerrada: boolean
          created_at: string
          id: string
          multiplicador: number
          nombre: string
          nota: string | null
          poligono: Json
          recargo: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          cerrada?: boolean
          created_at?: string
          id?: string
          multiplicador?: number
          nombre: string
          nota?: string | null
          poligono: Json
          recargo?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          cerrada?: boolean
          created_at?: string
          id?: string
          multiplicador?: number
          nombre?: string
          nota?: string | null
          poligono?: Json
          recargo?: number
          updated_at?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nombre: string
          telefono: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nombre: string
          telefono?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _ts_bloque: { Args: { b: Json; idx: number }; Returns: Json }
      _ts_color: { Args: { k: string; v: Json }; Returns: string }
      _ts_diseno: { Args: { d: Json }; Returns: Json }
      _ts_enum: {
        Args: { def: string; k: string; opts: string[]; v: Json }
        Returns: string
      }
      _ts_int: {
        Args: { def: number; hi: number; k: string; lo: number; v: Json }
        Returns: number
      }
      _ts_txt: {
        Args: { k: string; max_len: number; v: Json }
        Returns: string
      }
      _ts_url: {
        Args: { k: string; max_len: number; v: Json }
        Returns: string
      }
      core_rol_en_negocio: { Args: { p_business: string }; Returns: string }
      delivery_abierto_ahora: {
        Args: { p_horarios: Json; p_momento?: string }
        Returns: boolean
      }
      delivery_aceptar_pedido: {
        Args: { p_pedido: string; p_prep_min?: number }
        Returns: string
      }
      delivery_actor_rol: {
        Args: { p_cliente: string; p_comercio: string; p_repartidor: string }
        Returns: string
      }
      delivery_actualizar_estado: {
        Args: {
          p_codigo?: string
          p_estado: Database["public"]["Enums"]["delivery_estado_pedido"]
          p_motivo?: string
          p_pedido: string
        }
        Returns: undefined
      }
      delivery_admin_asignar_pedido: {
        Args: { p_pedido: string; p_repartidor: string }
        Returns: undefined
      }
      delivery_admin_campana_crear: {
        Args: { p_mensaje: string; p_segmento: string; p_titulo: string }
        Returns: string
      }
      delivery_admin_cargar_billetera: {
        Args: { p_cliente: string; p_monto: number; p_motivo: string }
        Returns: number
      }
      delivery_admin_cliente_control: {
        Args: {
          p_bloqueado: boolean
          p_cliente: string
          p_motivo?: string
          p_nota?: string
        }
        Returns: undefined
      }
      delivery_admin_clientes: {
        Args: { p_buscar?: string; p_limite?: number; p_solo?: string }
        Returns: Json
      }
      delivery_admin_comercios: {
        Args: never
        Returns: {
          acepta_programados: boolean
          acepta_retiro: boolean
          activo: boolean
          aprobado: boolean
          business_id: string | null
          categoria: Database["public"]["Enums"]["delivery_categoria"]
          comision_pct: number
          costo_envio: number
          costo_por_km: number
          created_at: string
          descripcion: string | null
          destacado: boolean
          direccion: string
          envio_gratis_desde: number | null
          esta_abierto: boolean
          horario: string
          horarios: Json | null
          id: string
          imagen_url: string | null
          latitud: number | null
          liquidacion_frecuencia: string
          logo_url: string | null
          longitud: number | null
          motivo_rechazo: string | null
          nombre: string
          parent_store_id: string | null
          pausado_hasta: string | null
          pedido_minimo: number
          promo_texto: string | null
          propietario_id: string | null
          radio_entrega_km: number
          rating: number
          rubro: string | null
          slug: string
          telefono: string | null
          tiempo_max: number
          tiempo_min: number
          tiempo_preparacion_min: number
          tienda_tema: Json
          total_resenas: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "delivery_comercios"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delivery_admin_comision: {
        Args: { p_comercio: string; p_pct: number }
        Returns: undefined
      }
      delivery_admin_contabilidad: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      delivery_admin_crear_turno: {
        Args: {
          p_cupos: number
          p_desde: string
          p_fecha: string
          p_hasta: string
          p_nota: string
          p_repetir_dias?: number
        }
        Returns: number
      }
      delivery_admin_demanda_zonas: {
        Args: never
        Returns: {
          comercio_mas_cercano_km: number
          direccion_ejemplo: string
          latitud: number
          longitud: number
          personas: number
          solicitudes: number
          ultima: string
        }[]
      }
      delivery_admin_directorio: { Args: never; Returns: Json }
      delivery_admin_directorio_estado: {
        Args: { p_estado: string; p_id: string; p_nota: string }
        Returns: undefined
      }
      delivery_admin_enviar: { Args: never; Returns: undefined }
      delivery_admin_estado_mp: { Args: never; Returns: Json }
      delivery_admin_generar_liquidacion: {
        Args: { p_comercio: string; p_hasta?: string }
        Returns: string
      }
      delivery_admin_generar_todas: {
        Args: { p_hasta?: string }
        Returns: number
      }
      delivery_admin_guardar_ajuste: {
        Args: { p_clave: string; p_valor: number }
        Returns: undefined
      }
      delivery_admin_guardar_meta: {
        Args: {
          p_activa: boolean
          p_bono: number
          p_hora_desde: string
          p_hora_hasta: string
          p_id: string
          p_nombre: string
          p_objetivo: number
          p_periodo: string
        }
        Returns: string
      }
      delivery_admin_guardar_mp: {
        Args: { p_access_token: string }
        Returns: undefined
      }
      delivery_admin_liberar_pedido: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      delivery_admin_liquidacion_frecuencia: {
        Args: { p_comercio: string; p_frecuencia: string }
        Returns: undefined
      }
      delivery_admin_marcar_liquidacion: {
        Args: { p_liquidacion: string; p_referencia?: string }
        Returns: undefined
      }
      delivery_admin_marcar_reintegrado: {
        Args: { p_pedido: string }
        Returns: undefined
      }
      delivery_admin_metricas_enviar: { Args: never; Returns: undefined }
      delivery_admin_movimiento_repartidor: {
        Args: {
          p_monto: number
          p_nota?: string
          p_repartidor: string
          p_tipo: string
        }
        Returns: string
      }
      delivery_admin_operaciones: { Args: never; Returns: Json }
      delivery_admin_pedir_control: {
        Args: { p_perfil: string }
        Returns: undefined
      }
      delivery_admin_regalar_credito: {
        Args: {
          p_cliente: string
          p_dias?: number
          p_monto: number
          p_motivo: string
        }
        Returns: string
      }
      delivery_admin_rehacer_libro: { Args: never; Returns: number }
      delivery_admin_remis_revisar: {
        Args: { p_motivo?: string; p_ok: boolean; p_perfil: string }
        Returns: undefined
      }
      delivery_admin_revisar_control: {
        Args: { p_motivo?: string; p_ok: boolean; p_perfil: string }
        Returns: undefined
      }
      delivery_admin_revisar_identidad: {
        Args: {
          p_aprobada: boolean
          p_controles?: Json
          p_motivo?: string
          p_perfil: string
        }
        Returns: undefined
      }
      delivery_admin_soporte: { Args: never; Returns: Json }
      delivery_admin_turno_activo: {
        Args: { p_activo: boolean; p_id: string }
        Returns: undefined
      }
      delivery_admin_turnos: { Args: never; Returns: Json }
      delivery_admin_verificar_repartidor: {
        Args: { p_aprobado: boolean; p_motivo?: string; p_repartidor: string }
        Returns: undefined
      }
      delivery_agregar_demora: {
        Args: { p_min: number; p_pedido: string }
        Returns: string
      }
      delivery_ajustar_precios: {
        Args: { p_comercio: string; p_ids: string[]; p_pct: number }
        Returns: number
      }
      delivery_ajuste: {
        Args: { p_clave: string; p_defecto: number }
        Returns: number
      }
      delivery_aplicar_ajuste: {
        Args: { p_acepta: boolean; p_ajuste: string; p_vencido: boolean }
        Returns: undefined
      }
      delivery_aplicar_tarifa: {
        Args: { p_costo: number; p_tarifa: Json }
        Returns: number
      }
      delivery_arrepentimiento_crear: {
        Args: {
          p_email: string
          p_motivo: string
          p_nombre: string
          p_pedido: string
          p_telefono: string
          p_tipo: string
        }
        Returns: string
      }
      delivery_arrepentimiento_resolver: {
        Args: { p_estado: string; p_id: string; p_resolucion: string }
        Returns: undefined
      }
      delivery_ausencias: { Args: { p_rep: string }; Returns: number }
      delivery_batch_ok: {
        Args: { p_pedido: string; p_rep: string }
        Returns: boolean
      }
      delivery_billetera_cliente: { Args: never; Returns: Json }
      delivery_billetera_repartidor: {
        Args: { p_dias?: number; p_repartidor?: string }
        Returns: Json
      }
      delivery_borrar_mi_pregunta: {
        Args: { p_id: string }
        Returns: undefined
      }
      delivery_calificar: {
        Args: { p_comentario?: string; p_pedido: string; p_puntaje: number }
        Returns: undefined
      }
      delivery_calificar_viaje: {
        Args: { p_estrellas: number; p_id: string }
        Returns: undefined
      }
      delivery_campana_audiencia: {
        Args: { p_comercio: string; p_segmento: string }
        Returns: string[]
      }
      delivery_campana_cerrar: {
        Args: { p_campana: string; p_enviados: number; p_ids: string[] }
        Returns: undefined
      }
      delivery_campana_conteo: { Args: { p_comercio: string }; Returns: Json }
      delivery_campana_crear: {
        Args: {
          p_comercio: string
          p_cupon?: string
          p_mensaje: string
          p_segmento: string
          p_titulo: string
        }
        Returns: string
      }
      delivery_campana_destinatarios: {
        Args: { p_campana: string }
        Returns: {
          perfil_id: string
        }[]
      }
      delivery_campana_texto_valido: {
        Args: { p_texto: string }
        Returns: boolean
      }
      delivery_cancelar_envio: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      delivery_cancelar_impagos: { Args: never; Returns: number }
      delivery_cancelar_viaje: {
        Args: { p_id: string; p_motivo?: string }
        Returns: undefined
      }
      delivery_candidato_oferta: { Args: { p_pedido: string }; Returns: string }
      delivery_capacidad_ok: {
        Args: { p_pedido: string; p_rep: string }
        Returns: boolean
      }
      delivery_cbu_valido: { Args: { p_cbu: string }; Returns: boolean }
      delivery_club_canjear: { Args: { p_premio: string }; Returns: string }
      delivery_club_multiplicador: {
        Args: { p_nivel: string }
        Returns: number
      }
      delivery_club_nivel: { Args: { p_ganados: number }; Returns: string }
      delivery_club_resumen: { Args: never; Returns: Json }
      delivery_cobro_guardar: {
        Args: {
          p_alias: string
          p_cbu: string
          p_cuit: string
          p_entidad: string
          p_entidad_id: string
          p_titular: string
        }
        Returns: undefined
      }
      delivery_control_enviar: { Args: never; Returns: undefined }
      delivery_controles_vencidos: { Args: never; Returns: number }
      delivery_costo_envio: {
        Args: { p_base: number; p_km: number; p_por_km: number }
        Returns: number
      }
      delivery_cotizar_envio: {
        Args: {
          p_dlat: number
          p_dlng: number
          p_olat: number
          p_olng: number
          p_tamano: string
        }
        Returns: Json
      }
      delivery_cotizar_viaje: {
        Args: {
          p_dlat: number
          p_dlng: number
          p_olat: number
          p_olng: number
          p_programado?: string
        }
        Returns: Json
      }
      delivery_crear_cupon_personal: {
        Args: {
          p_cliente: string
          p_descripcion: string
          p_dias: number
          p_minimo: number
          p_prefijo: string
          p_tipo: string
          p_tope: number
          p_valor: number
        }
        Returns: string
      }
      delivery_crear_envio: {
        Args: {
          p_dcontacto: string
          p_descripcion: string
          p_destino: string
          p_dlat: number
          p_dlng: number
          p_dnotas: string
          p_dtel: string
          p_ocontacto: string
          p_olat: number
          p_olng: number
          p_onotas: string
          p_origen: string
          p_otel: string
          p_propina: number
          p_quien_paga: string
          p_tamano: string
        }
        Returns: string
      }
      delivery_crear_pedido: {
        Args: {
          p_comercio: string
          p_cupon?: string
          p_direccion: string
          p_direccion_id?: string
          p_items: Json
          p_latitud?: number
          p_longitud?: number
          p_metodo_pago?: string
          p_notas?: string
          p_paga_con?: number
          p_programado_para?: string
          p_propina?: number
          p_telefono?: string
          p_tipo_entrega?: string
          p_usar_saldo?: boolean
        }
        Returns: string
      }
      delivery_crear_pedido_online: {
        Args: {
          p_comercio: string
          p_cupon?: string
          p_direccion: string
          p_direccion_id?: string
          p_items: Json
          p_latitud?: number
          p_longitud?: number
          p_notas?: string
          p_programado_para?: string
          p_propina?: number
          p_telefono?: string
          p_tipo_entrega?: string
        }
        Returns: string
      }
      delivery_crear_reclamo: {
        Args: { p_detalle: string; p_pedido: string; p_tipo: string }
        Returns: string
      }
      delivery_crear_sucursal: {
        Args: {
          p_copiar_menu: boolean
          p_direccion: string
          p_lat: number
          p_lng: number
          p_nombre: string
          p_origen: string
          p_telefono: string
        }
        Returns: string
      }
      delivery_crear_viaje: {
        Args: {
          p_destino: string
          p_dlat: number
          p_dlng: number
          p_notas: string
          p_olat: number
          p_olng: number
          p_origen: string
          p_pasajeros: number
          p_programado: string
          p_propina: number
          p_telefono: string
        }
        Returns: string
      }
      delivery_cuit_valido: { Args: { p_cuit: string }; Returns: boolean }
      delivery_demanda_actual: { Args: never; Returns: Json }
      delivery_desafio_aleatorio: { Args: never; Returns: string }
      delivery_direccion_principal: {
        Args: { p_id: string }
        Returns: undefined
      }
      delivery_directorio_interes: {
        Args: { p_activo: boolean; p_id: string; p_tipo: string }
        Returns: undefined
      }
      delivery_directorio_lista: { Args: never; Returns: Json }
      delivery_distancia_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      delivery_documento_quitar: { Args: { p_id: string }; Returns: undefined }
      delivery_documento_registrar: {
        Args: {
          p_entidad: string
          p_entidad_id: string
          p_path: string
          p_tipo: string
        }
        Returns: string
      }
      delivery_eliminar_cuenta: { Args: never; Returns: undefined }
      delivery_enviar_mensaje: {
        Args: { p_canal: string; p_pedido: string; p_texto: string }
        Returns: string
      }
      delivery_envio_avanzar: {
        Args: { p_codigo?: string; p_estado: string; p_id: string }
        Returns: undefined
      }
      delivery_envios_disponibles: {
        Args: never
        Returns: {
          cobrar: number
          created_at: string
          descripcion: string
          destino_zona: string
          dist_retiro_km: number
          distancia_km: number
          ganancia: number
          id: string
          origen_zona: string
          quien_paga: string
          tamano: string
        }[]
      }
      delivery_equipo_cambiar_rol: {
        Args: { p_id: string; p_rol: string }
        Returns: undefined
      }
      delivery_equipo_invitaciones: { Args: never; Returns: Json }
      delivery_equipo_invitar: {
        Args: { p_comercio: string; p_email: string; p_rol: string }
        Returns: string
      }
      delivery_equipo_listar: { Args: { p_comercio: string }; Returns: Json }
      delivery_equipo_quitar: { Args: { p_id: string }; Returns: undefined }
      delivery_equipo_responder: {
        Args: { p_acepta: boolean; p_id: string }
        Returns: undefined
      }
      delivery_es_duenio_producto: {
        Args: { p_producto: string }
        Returns: boolean
      }
      delivery_estadisticas_comercio: {
        Args: { p_comercio: string; p_dias?: number }
        Returns: Json
      }
      delivery_eta_calc: {
        Args: { p: Database["public"]["Tables"]["delivery_pedidos"]["Row"] }
        Returns: Json
      }
      delivery_eta_pedido: { Args: { p_pedido: string }; Returns: Json }
      delivery_exportar_mis_datos: { Args: never; Returns: Json }
      delivery_finanzas_comercio: {
        Args: { p_comercio: string }
        Returns: Json
      }
      delivery_finanzas_lineas: {
        Args: { p_comercio: string; p_hasta: string }
        Returns: {
          balance: number
          cobrado_directo: number
          comision: number
          descuento_comercio: number
          fecha: string
          metodo_pago: string
          neto: number
          pedido_id: string
          tipo_entrega: string
          ventas: number
        }[]
      }
      delivery_franjas: { Args: { p_comercio: string }; Returns: Json }
      delivery_generar_liquidacion_interna: {
        Args: { p_comercio: string; p_hasta: string; p_por: string }
        Returns: string
      }
      delivery_guardar_suscripcion: {
        Args: {
          p_auth: string
          p_dispositivo?: string
          p_endpoint: string
          p_p256dh: string
        }
        Returns: undefined
      }
      delivery_guardar_tienda_tema: {
        Args: { p_comercio: string; p_tema: Json }
        Returns: undefined
      }
      delivery_identidad_enviar: { Args: never; Returns: undefined }
      delivery_identidad_guardar: {
        Args: { p_dni: string; p_nacimiento: string; p_nombre: string }
        Returns: {
          controles: Json
          created_at: string
          desafio: string
          dni: string
          enviado_at: string | null
          estado: string
          fecha_nacimiento: string | null
          intentos: number
          motivo_rechazo: string | null
          nombre_legal: string
          perfil_id: string
          revisado_at: string | null
          revisado_por: string | null
          updated_at: string
          vence_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "delivery_identidad"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delivery_inicio_periodo: {
        Args: { p_momento?: string; p_periodo: string }
        Returns: string
      }
      delivery_kds: { Args: { p_comercio: string }; Returns: Json }
      delivery_legal_guardar: {
        Args: {
          p_comercio: string
          p_condicion: string
          p_cuit: string
          p_razon_social: string
        }
        Returns: undefined
      }
      delivery_libro_pedido: { Args: { p_pedido: string }; Returns: number }
      delivery_libro_servicio: {
        Args: {
          p_efectivo: boolean
          p_fecha: string
          p_ganancia: number
          p_id: string
          p_rep: string
          p_tipo: string
          p_total: number
        }
        Returns: number
      }
      delivery_liquidacion_detalle: {
        Args: { p_liquidacion: string }
        Returns: {
          balance: number
          cobrado_directo: number
          comision: number
          descuento_comercio: number
          fecha: string
          metodo_pago: string
          neto: number
          pedido_id: string
          tipo_entrega: string
          ventas: number
        }[]
      }
      delivery_liquidar_automatico: { Args: never; Returns: number }
      delivery_marcar_canal: {
        Args: { p_canal: string; p_pedido: string }
        Returns: undefined
      }
      delivery_marcar_leidos: {
        Args: { p_canal: string; p_pedido: string }
        Returns: undefined
      }
      delivery_marcar_listo: { Args: { p_pedido: string }; Returns: undefined }
      delivery_marcar_llegada: {
        Args: { p_donde: string; p_pedido: string }
        Returns: undefined
      }
      delivery_margen_programado: { Args: never; Returns: string }
      delivery_mensajes_sin_leer: {
        Args: { p_pedidos: string[] }
        Returns: {
          canal: string
          pedido_id: string
          total: number
        }[]
      }
      delivery_metas_evaluar: { Args: { p_rep: string }; Returns: number }
      delivery_mfa_ok: { Args: never; Returns: boolean }
      delivery_mi_acceso: { Args: { p_comercio?: string }; Returns: Json }
      delivery_mi_codigo_referido: { Args: never; Returns: string }
      delivery_mi_perfil: { Args: never; Returns: Json }
      delivery_minutos_conectado: {
        Args: { p_desde: string; p_hasta: string; p_rep: string }
        Returns: number
      }
      delivery_mis_comercios: { Args: never; Returns: Json }
      delivery_mis_metas: { Args: never; Returns: Json }
      delivery_mis_negocios: { Args: never; Returns: Json }
      delivery_mis_ofertas: {
        Args: never
        Returns: {
          cobrar: number
          comercio_direccion: string
          comercio_latitud: number
          comercio_longitud: number
          comercio_nombre: string
          dist_entrega_km: number
          dist_retiro_km: number
          entrega_latitud: number
          entrega_longitud: number
          exclusivo: boolean
          ganancia: number
          listo_en_min: number
          metodo_pago: string
          pedido_id: string
          productos: number
          programado_para: string
          vence_at: string
          zona_entrega: string
        }[]
      }
      delivery_mis_turnos: { Args: never; Returns: Json }
      delivery_moderar_comercio: {
        Args: { p_aprobado: boolean; p_comercio: string; p_motivo?: string }
        Returns: undefined
      }
      delivery_moderar_pregunta: {
        Args: { p_id: string; p_visible: boolean }
        Returns: undefined
      }
      delivery_ofertas_visibles: {
        Args: { p_repartidor: string }
        Returns: {
          exclusivo: boolean
          pedido_id: string
          vence_at: string
        }[]
      }
      delivery_pagos_online_activos: { Args: never; Returns: boolean }
      delivery_pausar_comercio: {
        Args: { p_comercio: string; p_minutos?: number }
        Returns: string
      }
      delivery_pedido_historial: { Args: { p_pedido: string }; Returns: Json }
      delivery_pedido_puede_ver: {
        Args: { p: Database["public"]["Tables"]["delivery_pedidos"]["Row"] }
        Returns: boolean
      }
      delivery_pedido_volumen: { Args: { p_pedido: string }; Returns: number }
      delivery_permiso: {
        Args: { p_comercio: string; p_permiso: string }
        Returns: boolean
      }
      delivery_poligono_valido: { Args: { p: Json }; Returns: boolean }
      delivery_preguntar: {
        Args: { p_producto: string; p_texto: string }
        Returns: string
      }
      delivery_preguntas_comercio: {
        Args: { p_comercio: string }
        Returns: {
          autor: string
          created_at: string
          id: string
          pregunta: string
          producto: string
          producto_id: string
          respondida_at: string
          respuesta: string
          visible: boolean
        }[]
      }
      delivery_prep_real_min: { Args: { p_comercio: string }; Returns: number }
      delivery_proponer_ajuste: {
        Args: { p_item: string; p_pausar?: boolean; p_reemplazo?: string }
        Returns: string
      }
      delivery_puede_catalogo_producto: {
        Args: { p_producto: string }
        Returns: boolean
      }
      delivery_puede_ver_finanzas: {
        Args: { p_comercio: string }
        Returns: boolean
      }
      delivery_puntaje_despacho: {
        Args: { p_pedido: string; p_rep: string }
        Returns: number
      }
      delivery_punto_en_poligono: {
        Args: { p_lat: number; p_lng: number; p_poly: Json }
        Returns: boolean
      }
      delivery_recalcular_pedido: {
        Args: { p_delta_subtotal: number; p_pedido: string }
        Returns: undefined
      }
      delivery_rechazar_oferta: {
        Args: { p_motivo?: string; p_pedido: string }
        Returns: undefined
      }
      delivery_registrar_foto_entrega: {
        Args: { p_path: string; p_pedido: string }
        Returns: undefined
      }
      delivery_registrar_zona: {
        Args: { p_direccion?: string; p_lat: number; p_lng: number }
        Returns: Json
      }
      delivery_remis_solicitar: { Args: never; Returns: undefined }
      delivery_renombrar_seccion: {
        Args: { p_actual: string; p_comercio: string; p_nuevo: string }
        Returns: undefined
      }
      delivery_repartidor_ocupado: {
        Args: { p_repartidor: string }
        Returns: boolean
      }
      delivery_reportar_error: {
        Args: {
          p_agente: string
          p_mensaje: string
          p_stack: string
          p_url: string
        }
        Returns: undefined
      }
      delivery_resolver_opciones: {
        Args: { p_opciones: Json; p_producto: string }
        Returns: Json
      }
      delivery_resolver_reclamo: {
        Args: {
          p_estado: string
          p_monto?: number
          p_reclamo: string
          p_resolucion: string
        }
        Returns: undefined
      }
      delivery_responder_ajuste: {
        Args: { p_acepta: boolean; p_ajuste: string }
        Returns: undefined
      }
      delivery_responder_pregunta: {
        Args: { p_id: string; p_respuesta: string }
        Returns: undefined
      }
      delivery_responder_resena: {
        Args: { p_resena: string; p_respuesta: string }
        Returns: undefined
      }
      delivery_resumen_sucursales: { Args: never; Returns: Json }
      delivery_rol_en_chat: {
        Args: { p_canal: string; p_pedido: string }
        Returns: string
      }
      delivery_ruta_km: {
        Args: { p_dlat: number; p_dlng: number; p_olat: number; p_olng: number }
        Returns: number
      }
      delivery_saldo_cliente: { Args: { p_cliente: string }; Returns: number }
      delivery_slug_disponible: { Args: { p_slug: string }; Returns: boolean }
      delivery_soltar_envio: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      delivery_soltar_pedido: {
        Args: { p_motivo: string; p_pedido: string }
        Returns: undefined
      }
      delivery_soltar_viaje: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      delivery_soporte_asignar: {
        Args: { p_agente?: string; p_reclamo: string }
        Returns: undefined
      }
      delivery_soporte_calificar: {
        Args: { p_comentario?: string; p_puntaje: number; p_reclamo: string }
        Returns: undefined
      }
      delivery_soporte_cerrar_inactivos: { Args: never; Returns: number }
      delivery_soporte_crear: {
        Args: { p_detalle: string; p_tipo: string }
        Returns: string
      }
      delivery_soporte_enviar: {
        Args: { p_interna?: boolean; p_reclamo: string; p_texto: string }
        Returns: undefined
      }
      delivery_soporte_prioridad: {
        Args: { p_prioridad: string; p_reclamo: string }
        Returns: undefined
      }
      delivery_soporte_resolver: {
        Args: {
          p_credito?: number
          p_estado: string
          p_reclamo: string
          p_reintegro?: number
          p_resolucion: string
        }
        Returns: string
      }
      delivery_tarifa_repartidor: {
        Args: { p_pedido: string }
        Returns: number
      }
      delivery_tarifa_zona: {
        Args: { p_lat: number; p_lng: number }
        Returns: Json
      }
      delivery_tienda_estadisticas: {
        Args: { p_comercio: string }
        Returns: {
          dia: string
          visitas: number
        }[]
      }
      delivery_tienda_suscribir: {
        Args: { p_comercio: string; p_email: string }
        Returns: undefined
      }
      delivery_tienda_visita: { Args: { p_slug: string }; Returns: undefined }
      delivery_tomar_envio: { Args: { p_id: string }; Returns: undefined }
      delivery_tomar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      delivery_tomar_viaje: { Args: { p_id: string }; Returns: undefined }
      delivery_turno_cancelar: { Args: { p_turno: string }; Returns: undefined }
      delivery_turno_fin: {
        Args: { t: Database["public"]["Tables"]["delivery_turnos"]["Row"] }
        Returns: string
      }
      delivery_turno_inicio: {
        Args: { t: Database["public"]["Tables"]["delivery_turnos"]["Row"] }
        Returns: string
      }
      delivery_turno_reservar: { Args: { p_turno: string }; Returns: undefined }
      delivery_usar_codigo_referido: {
        Args: { p_codigo: string }
        Returns: undefined
      }
      delivery_validar_cupon: {
        Args: { p_codigo: string; p_comercio: string; p_subtotal: number }
        Returns: Json
      }
      delivery_velocidad_repartidor: {
        Args: { p_rep: string }
        Returns: number
      }
      delivery_vencer_ajustes: { Args: never; Returns: number }
      delivery_vencer_sin_respuesta: { Args: never; Returns: number }
      delivery_vendedor_resumen: { Args: { p_slug: string }; Returns: Json }
      delivery_viaje_avanzar: {
        Args: { p_codigo?: string; p_estado: string; p_id: string }
        Returns: undefined
      }
      delivery_viaje_conductor: { Args: { p_viaje: string }; Returns: Json }
      delivery_viajes_disponibles: {
        Args: never
        Returns: {
          created_at: string
          destino_zona: string
          dist_recogida_km: number
          distancia_km: number
          ganancia: number
          id: string
          origen_zona: string
          pasajeros: number
          programado_para: string
        }[]
      }
      delivery_viajes_periodo: {
        Args: {
          p_desde: string
          p_hasta: string
          p_hora_desde: string
          p_hora_hasta: string
          p_rep: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "rep"
      delivery_categoria: "comida" | "supermercado" | "farmacia" | "tiendas"
      delivery_estado_pedido:
        | "pendiente"
        | "confirmado"
        | "preparando"
        | "listo"
        | "en_camino"
        | "entregado"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "rep"],
      delivery_categoria: ["comida", "supermercado", "farmacia", "tiendas"],
      delivery_estado_pedido: [
        "pendiente",
        "confirmado",
        "preparando",
        "listo",
        "en_camino",
        "entregado",
        "cancelado",
      ],
    },
  },
} as const
