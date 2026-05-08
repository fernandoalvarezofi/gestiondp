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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      barrios: {
        Row: {
          ciudad_id: string
          created_at: string
          id: string
          nombre: string
          zona: string | null
        }
        Insert: {
          ciudad_id: string
          created_at?: string
          id?: string
          nombre: string
          zona?: string | null
        }
        Update: {
          ciudad_id?: string
          created_at?: string
          id?: string
          nombre?: string
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barrios_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      ciudades: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
          pais: string
          provincia: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
          pais?: string
          provincia?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
          pais?: string
          provincia?: string
        }
        Relationships: []
      }
      comentarios: {
        Row: {
          contenido: string
          created_at: string
          id: string
          menciones: string[] | null
          perfil_id: string
          publicacion_id: string
          respuesta_a: string | null
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          menciones?: string[] | null
          perfil_id: string
          publicacion_id: string
          respuesta_a?: string | null
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          menciones?: string[] | null
          perfil_id?: string
          publicacion_id?: string
          respuesta_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_respuesta_a_fkey"
            columns: ["respuesta_a"]
            isOneToOne: false
            referencedRelation: "comentarios"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          industry: string | null
          name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      consultas: {
        Row: {
          created_at: string
          de_perfil_id: string
          id: string
          leida: boolean
          mensaje: string
          publicacion_id: string
        }
        Insert: {
          created_at?: string
          de_perfil_id: string
          id?: string
          leida?: boolean
          mensaje: string
          publicacion_id: string
        }
        Update: {
          created_at?: string
          de_perfil_id?: string
          id?: string
          leida?: boolean
          mensaje?: string
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultas_de_perfil_id_fkey"
            columns: ["de_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          position: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones: {
        Row: {
          created_at: string
          id: string
          no_leidos_a: number
          no_leidos_b: number
          perfil_a_id: string
          perfil_b_id: string
          ultimo_mensaje: string | null
          ultimo_mensaje_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          no_leidos_a?: number
          no_leidos_b?: number
          perfil_a_id: string
          perfil_b_id: string
          ultimo_mensaje?: string | null
          ultimo_mensaje_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          no_leidos_a?: number
          no_leidos_b?: number
          perfil_a_id?: string
          perfil_b_id?: string
          ultimo_mensaje?: string | null
          ultimo_mensaje_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_perfil_a_id_fkey"
            columns: ["perfil_a_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_perfil_b_id_fkey"
            columns: ["perfil_b_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          owner_id: string
          pipeline_id: string
          probability: number | null
          stage_id: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          owner_id: string
          pipeline_id: string
          probability?: number | null
          stage_id: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pipeline_id?: string
          probability?: number | null
          stage_id?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estadisticas_publicacion: {
        Row: {
          comentarios: number
          consultas: number
          fecha: string
          id: string
          likes: number
          publicacion_id: string
          vistas: number
        }
        Insert: {
          comentarios?: number
          consultas?: number
          fecha?: string
          id?: string
          likes?: number
          publicacion_id: string
          vistas?: number
        }
        Update: {
          comentarios?: number
          consultas?: number
          fecha?: string
          id?: string
          likes?: number
          publicacion_id?: string
          vistas?: number
        }
        Relationships: [
          {
            foreignKeyName: "estadisticas_publicacion_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos: {
        Row: {
          created_at: string
          id: string
          perfil_id: string
          publicacion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          publicacion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      highlight_items: {
        Row: {
          created_at: string
          highlight_id: string
          id: string
          imagen_url: string | null
          orden: number
          publicacion_id: string | null
        }
        Insert: {
          created_at?: string
          highlight_id: string
          id?: string
          imagen_url?: string | null
          orden?: number
          publicacion_id?: string | null
        }
        Update: {
          created_at?: string
          highlight_id?: string
          id?: string
          imagen_url?: string | null
          orden?: number
          publicacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "highlight_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          color_fondo: string | null
          created_at: string
          icono: string | null
          id: string
          orden: number
          perfil_id: string
          titulo: string
        }
        Insert: {
          color_fondo?: string | null
          created_at?: string
          icono?: string | null
          id?: string
          orden?: number
          perfil_id: string
          titulo: string
        }
        Update: {
          color_fondo?: string | null
          created_at?: string
          icono?: string | null
          id?: string
          orden?: number
          perfil_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          perfil_id: string
          publicacion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          publicacion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      media_publicacion: {
        Row: {
          created_at: string
          es_portada: boolean
          id: string
          orden: number
          publicacion_id: string
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string
          es_portada?: boolean
          id?: string
          orden?: number
          publicacion_id: string
          tipo?: string
          url: string
        }
        Update: {
          created_at?: string
          es_portada?: boolean
          id?: string
          orden?: number
          publicacion_id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_publicacion_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          contenido: string
          conversacion_id: string
          created_at: string
          id: string
          imagen_url: string | null
          leido: boolean
          leido_at: string | null
          publicacion_id: string | null
          remitente_id: string
        }
        Insert: {
          contenido: string
          conversacion_id: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          leido?: boolean
          leido_at?: string | null
          publicacion_id?: string | null
          remitente_id: string
        }
        Update: {
          contenido?: string
          conversacion_id?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          leido?: boolean
          leido_at?: string | null
          publicacion_id?: string | null
          remitente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_remitente_id_fkey"
            columns: ["remitente_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          comentario_id: string | null
          created_at: string
          id: string
          leida: boolean
          origen_id: string | null
          perfil_id: string
          publicacion_id: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Insert: {
          comentario_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          origen_id?: string | null
          perfil_id: string
          publicacion_id?: string | null
          texto?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Update: {
          comentario_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          origen_id?: string | null
          perfil_id?: string
          publicacion_id?: string | null
          texto?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_comentario_id_fkey"
            columns: ["comentario_id"]
            isOneToOne: false
            referencedRelation: "comentarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          activo: boolean
          avatar_url: string | null
          ciudad_id: string | null
          created_at: string
          descripcion: string | null
          facebook: string | null
          horario: string | null
          id: string
          instagram: string | null
          mensajes_privados: boolean
          mostrar_telefono: boolean
          nombre: string
          portada_url: string | null
          sitio_web: string | null
          slug: string | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones: number
          total_seguidores: number
          total_siguiendo: number
          updated_at: string
          verificado: boolean
          whatsapp: string | null
        }
        Insert: {
          activo?: boolean
          avatar_url?: string | null
          ciudad_id?: string | null
          created_at?: string
          descripcion?: string | null
          facebook?: string | null
          horario?: string | null
          id: string
          instagram?: string | null
          mensajes_privados?: boolean
          mostrar_telefono?: boolean
          nombre: string
          portada_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones?: number
          total_seguidores?: number
          total_siguiendo?: number
          updated_at?: string
          verificado?: boolean
          whatsapp?: string | null
        }
        Update: {
          activo?: boolean
          avatar_url?: string | null
          ciudad_id?: string | null
          created_at?: string
          descripcion?: string | null
          facebook?: string | null
          horario?: string | null
          id?: string
          instagram?: string | null
          mensajes_privados?: boolean
          mostrar_telefono?: boolean
          nombre?: string
          portada_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones?: number
          total_seguidores?: number
          total_siguiendo?: number
          updated_at?: string
          verificado?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publicaciones: {
        Row: {
          acceso_pavimento: boolean
          agua_corriente: boolean
          ambientes: number | null
          banos: number | null
          barrio_id: string | null
          ciudad_id: string
          cloaca: boolean
          cochera: boolean
          created_at: string
          descripcion: string | null
          destacada: boolean
          destacada_hasta: string | null
          direccion: string | null
          dormitorios: number | null
          estado: Database["public"]["Enums"]["estado_publicacion"]
          expensas: number | null
          fecha_evento: string | null
          gas_natural: boolean
          hectareas: number | null
          id: string
          internet: boolean
          lugar_evento: string | null
          luz: boolean
          modalidad_empleo: string | null
          moneda: string
          mostrar_direccion: boolean
          perfil_id: string
          precio: number | null
          precio_negociable: boolean
          referencia: string | null
          rubro: string | null
          superficie_cubierta: number | null
          superficie_total: number | null
          tags: string[] | null
          tiene_casa_campo: boolean
          tiene_galpon: boolean
          tipo: Database["public"]["Enums"]["tipo_publicacion"]
          tipo_operacion: Database["public"]["Enums"]["tipo_operacion"] | null
          tipo_propiedad: Database["public"]["Enums"]["tipo_propiedad"] | null
          tipo_suelo: string | null
          titulo: string
          total_comentarios: number
          total_likes: number
          total_repostes: number
          updated_at: string
          vistas: number
        }
        Insert: {
          acceso_pavimento?: boolean
          agua_corriente?: boolean
          ambientes?: number | null
          banos?: number | null
          barrio_id?: string | null
          ciudad_id: string
          cloaca?: boolean
          cochera?: boolean
          created_at?: string
          descripcion?: string | null
          destacada?: boolean
          destacada_hasta?: string | null
          direccion?: string | null
          dormitorios?: number | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          expensas?: number | null
          fecha_evento?: string | null
          gas_natural?: boolean
          hectareas?: number | null
          id?: string
          internet?: boolean
          lugar_evento?: string | null
          luz?: boolean
          modalidad_empleo?: string | null
          moneda?: string
          mostrar_direccion?: boolean
          perfil_id: string
          precio?: number | null
          precio_negociable?: boolean
          referencia?: string | null
          rubro?: string | null
          superficie_cubierta?: number | null
          superficie_total?: number | null
          tags?: string[] | null
          tiene_casa_campo?: boolean
          tiene_galpon?: boolean
          tipo?: Database["public"]["Enums"]["tipo_publicacion"]
          tipo_operacion?: Database["public"]["Enums"]["tipo_operacion"] | null
          tipo_propiedad?: Database["public"]["Enums"]["tipo_propiedad"] | null
          tipo_suelo?: string | null
          titulo: string
          total_comentarios?: number
          total_likes?: number
          total_repostes?: number
          updated_at?: string
          vistas?: number
        }
        Update: {
          acceso_pavimento?: boolean
          agua_corriente?: boolean
          ambientes?: number | null
          banos?: number | null
          barrio_id?: string | null
          ciudad_id?: string
          cloaca?: boolean
          cochera?: boolean
          created_at?: string
          descripcion?: string | null
          destacada?: boolean
          destacada_hasta?: string | null
          direccion?: string | null
          dormitorios?: number | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          expensas?: number | null
          fecha_evento?: string | null
          gas_natural?: boolean
          hectareas?: number | null
          id?: string
          internet?: boolean
          lugar_evento?: string | null
          luz?: boolean
          modalidad_empleo?: string | null
          moneda?: string
          mostrar_direccion?: boolean
          perfil_id?: string
          precio?: number | null
          precio_negociable?: boolean
          referencia?: string | null
          rubro?: string | null
          superficie_cubierta?: number | null
          superficie_total?: number | null
          tags?: string[] | null
          tiene_casa_campo?: boolean
          tiene_galpon?: boolean
          tipo?: Database["public"]["Enums"]["tipo_publicacion"]
          tipo_operacion?: Database["public"]["Enums"]["tipo_operacion"] | null
          tipo_propiedad?: Database["public"]["Enums"]["tipo_propiedad"] | null
          tipo_suelo?: string | null
          titulo?: string
          total_comentarios?: number
          total_likes?: number
          total_repostes?: number
          updated_at?: string
          vistas?: number
        }
        Relationships: [
          {
            foreignKeyName: "publicaciones_barrio_id_fkey"
            columns: ["barrio_id"]
            isOneToOne: false
            referencedRelation: "barrios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repostes: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          perfil_id: string
          publicacion_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          perfil_id: string
          publicacion_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          perfil_id?: string
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repostes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repostes_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      resenas: {
        Row: {
          autor_id: string
          comentario: string | null
          created_at: string
          id: string
          perfil_id: string
          puntuacion: number
        }
        Insert: {
          autor_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          perfil_id: string
          puntuacion: number
        }
        Update: {
          autor_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          perfil_id?: string
          puntuacion?: number
        }
        Relationships: [
          {
            foreignKeyName: "resenas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resenas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguidos: {
        Row: {
          created_at: string
          id: string
          seguido_id: string
          seguidor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seguido_id: string
          seguidor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seguido_id?: string
          seguidor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguidos_seguido_id_fkey"
            columns: ["seguido_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguidos_seguidor_id_fkey"
            columns: ["seguidor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed: boolean
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
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
      get_or_create_conversacion: {
        Args: { user_a: string; user_b: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_vistas: {
        Args: { p_publicacion_id: string }
        Returns: undefined
      }
      is_team_member: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      registrar_vista: {
        Args: { p_publicacion_id: string }
        Returns: undefined
      }
      seed_default_pipeline: { Args: { p_user_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note"
      app_role: "admin" | "manager" | "rep"
      estado_publicacion:
        | "activa"
        | "pausada"
        | "vendida"
        | "alquilada"
        | "finalizada"
        | "eliminada"
      tipo_notificacion:
        | "nuevo_seguidor"
        | "like_publicacion"
        | "comentario_publicacion"
        | "respuesta_comentario"
        | "reposteo"
        | "mencion"
        | "nuevo_mensaje"
        | "publicacion_destacada"
      tipo_operacion:
        | "venta"
        | "alquiler"
        | "alquiler_temporario"
        | "local_comercial"
        | "oficina"
        | "campo_rural"
      tipo_propiedad:
        | "casa"
        | "departamento"
        | "ph"
        | "local"
        | "oficina"
        | "galpon"
        | "terreno"
        | "campo"
        | "chacra"
        | "quinta"
        | "otro"
      tipo_publicacion:
        | "propiedad"
        | "empleo"
        | "servicio"
        | "evento"
        | "venta_objeto"
        | "agro"
        | "novedad_local"
        | "busqueda"
        | "general"
      tipo_usuario:
        | "vecino"
        | "dueno_directo"
        | "inmobiliaria"
        | "agente_independiente"
        | "negocio"
        | "profesional"
        | "institucion"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      activity_type: ["call", "email", "meeting", "note"],
      app_role: ["admin", "manager", "rep"],
      estado_publicacion: [
        "activa",
        "pausada",
        "vendida",
        "alquilada",
        "finalizada",
        "eliminada",
      ],
      tipo_notificacion: [
        "nuevo_seguidor",
        "like_publicacion",
        "comentario_publicacion",
        "respuesta_comentario",
        "reposteo",
        "mencion",
        "nuevo_mensaje",
        "publicacion_destacada",
      ],
      tipo_operacion: [
        "venta",
        "alquiler",
        "alquiler_temporario",
        "local_comercial",
        "oficina",
        "campo_rural",
      ],
      tipo_propiedad: [
        "casa",
        "departamento",
        "ph",
        "local",
        "oficina",
        "galpon",
        "terreno",
        "campo",
        "chacra",
        "quinta",
        "otro",
      ],
      tipo_publicacion: [
        "propiedad",
        "empleo",
        "servicio",
        "evento",
        "venta_objeto",
        "agro",
        "novedad_local",
        "busqueda",
        "general",
      ],
      tipo_usuario: [
        "vecino",
        "dueno_directo",
        "inmobiliaria",
        "agente_independiente",
        "negocio",
        "profesional",
        "institucion",
      ],
    },
  },
} as const
