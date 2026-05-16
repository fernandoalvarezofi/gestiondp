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
      comentarios: {
        Row: {
          contenido: string
          created_at: string
          id: string
          menciones: string[] | null
          perfil_id: string
          publicacion_id: string
          respuesta_a: string | null
          total_likes: number
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          menciones?: string[] | null
          perfil_id: string
          publicacion_id: string
          respuesta_a?: string | null
          total_likes?: number
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          menciones?: string[] | null
          perfil_id?: string
          publicacion_id?: string
          respuesta_a?: string | null
          total_likes?: number
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
            referencedRelation: "feed_woref"
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
      comunidad_canales: {
        Row: {
          comunidad_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          comunidad_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          orden?: number
          tipo?: string
        }
        Update: {
          comunidad_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunidad_canales_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidad_miembros: {
        Row: {
          comunidad_id: string
          created_at: string
          id: string
          perfil_id: string
          rol: Database["public"]["Enums"]["tipo_miembro_comunidad"]
        }
        Insert: {
          comunidad_id: string
          created_at?: string
          id?: string
          perfil_id: string
          rol?: Database["public"]["Enums"]["tipo_miembro_comunidad"]
        }
        Update: {
          comunidad_id?: string
          created_at?: string
          id?: string
          perfil_id?: string
          rol?: Database["public"]["Enums"]["tipo_miembro_comunidad"]
        }
        Relationships: [
          {
            foreignKeyName: "comunidad_miembros_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidad_miembros_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidad_posts: {
        Row: {
          canal_id: string | null
          comunidad_id: string
          contenido: string
          created_at: string
          id: string
          imagen_url: string | null
          perfil_id: string
          titulo: string | null
          total_likes: number
          total_respuestas: number
        }
        Insert: {
          canal_id?: string | null
          comunidad_id: string
          contenido: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          perfil_id: string
          titulo?: string | null
          total_likes?: number
          total_respuestas?: number
        }
        Update: {
          canal_id?: string | null
          comunidad_id?: string
          contenido?: string
          created_at?: string
          id?: string
          imagen_url?: string | null
          perfil_id?: string
          titulo?: string | null
          total_likes?: number
          total_respuestas?: number
        }
        Relationships: [
          {
            foreignKeyName: "comunidad_posts_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "comunidad_canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidad_posts_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidad_posts_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidades: {
        Row: {
          avatar_url: string | null
          creador_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          portada_url: string | null
          privada: boolean
          slug: string
          tags: string[] | null
          tematica: string | null
          total_miembros: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          creador_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          portada_url?: string | null
          privada?: boolean
          slug: string
          tags?: string[] | null
          tematica?: string | null
          total_miembros?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          creador_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          portada_url?: string | null
          privada?: boolean
          slug?: string
          tags?: string[] | null
          tematica?: string | null
          total_miembros?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunidades_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
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
      encuesta_votos: {
        Row: {
          created_at: string
          id: string
          opcion_index: number
          perfil_id: string
          publicacion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opcion_index: number
          perfil_id: string
          publicacion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opcion_index?: number
          perfil_id?: string
          publicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encuesta_votos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encuesta_votos_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "feed_woref"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encuesta_votos_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "publicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      estadisticas_publicacion: {
        Row: {
          comentarios: number
          fecha: string
          id: string
          likes: number
          publicacion_id: string
          vistas: number
        }
        Insert: {
          comentarios?: number
          fecha?: string
          id?: string
          likes?: number
          publicacion_id: string
          vistas?: number
        }
        Update: {
          comentarios?: number
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
            referencedRelation: "feed_woref"
            referencedColumns: ["id"]
          },
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
          proyecto_id: string | null
          publicacion_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          proyecto_id?: string | null
          publicacion_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          proyecto_id?: string | null
          publicacion_id?: string | null
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
            foreignKeyName: "favoritos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "feed_woref"
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
      foro_categorias: {
        Row: {
          color: string | null
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number
          slug: string
        }
        Insert: {
          color?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number
          slug: string
        }
        Update: {
          color?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number
          slug?: string
        }
        Relationships: []
      }
      foro_likes: {
        Row: {
          created_at: string
          id: string
          perfil_id: string
          post_id: string | null
          resp_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          post_id?: string | null
          resp_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          post_id?: string | null
          resp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foro_likes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "foro_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_likes_resp_id_fkey"
            columns: ["resp_id"]
            isOneToOne: false
            referencedRelation: "foro_respuestas"
            referencedColumns: ["id"]
          },
        ]
      }
      foro_posts: {
        Row: {
          categoria_id: string
          contenido: string
          created_at: string
          fijado: boolean
          id: string
          imagen_url: string | null
          perfil_id: string
          resuelto: boolean
          tags: string[] | null
          titulo: string
          total_likes: number
          total_respuestas: number
          total_vistas: number
          updated_at: string
        }
        Insert: {
          categoria_id: string
          contenido: string
          created_at?: string
          fijado?: boolean
          id?: string
          imagen_url?: string | null
          perfil_id: string
          resuelto?: boolean
          tags?: string[] | null
          titulo: string
          total_likes?: number
          total_respuestas?: number
          total_vistas?: number
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          contenido?: string
          created_at?: string
          fijado?: boolean
          id?: string
          imagen_url?: string | null
          perfil_id?: string
          resuelto?: boolean
          tags?: string[] | null
          titulo?: string
          total_likes?: number
          total_respuestas?: number
          total_vistas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foro_posts_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "foro_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_posts_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foro_respuestas: {
        Row: {
          contenido: string
          created_at: string
          es_solucion: boolean
          id: string
          perfil_id: string
          post_id: string
          respuesta_a: string | null
          total_likes: number
        }
        Insert: {
          contenido: string
          created_at?: string
          es_solucion?: boolean
          id?: string
          perfil_id: string
          post_id: string
          respuesta_a?: string | null
          total_likes?: number
        }
        Update: {
          contenido?: string
          created_at?: string
          es_solucion?: boolean
          id?: string
          perfil_id?: string
          post_id?: string
          respuesta_a?: string | null
          total_likes?: number
        }
        Relationships: [
          {
            foreignKeyName: "foro_respuestas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_respuestas_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "foro_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_respuestas_respuesta_a_fkey"
            columns: ["respuesta_a"]
            isOneToOne: false
            referencedRelation: "foro_respuestas"
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
          comunidad_post_id: string | null
          created_at: string
          id: string
          perfil_id: string
          publicacion_id: string | null
        }
        Insert: {
          comunidad_post_id?: string | null
          created_at?: string
          id?: string
          perfil_id: string
          publicacion_id?: string | null
        }
        Update: {
          comunidad_post_id?: string | null
          created_at?: string
          id?: string
          perfil_id?: string
          publicacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_comunidad_post_id_fkey"
            columns: ["comunidad_post_id"]
            isOneToOne: false
            referencedRelation: "comunidad_posts"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "feed_woref"
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
      match_acciones: {
        Row: {
          accion: string
          created_at: string
          id: string
          objetivo_id: string
          perfil_id: string
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          objetivo_id: string
          perfil_id: string
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          objetivo_id?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_acciones_objetivo_id_fkey"
            columns: ["objetivo_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_acciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          motivo: string[] | null
          perfil_a_id: string
          perfil_b_id: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string[] | null
          perfil_a_id: string
          perfil_b_id: string
          score?: number
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string[] | null
          perfil_a_id?: string
          perfil_b_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "matches_perfil_a_id_fkey"
            columns: ["perfil_a_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_perfil_b_id_fkey"
            columns: ["perfil_b_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
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
            referencedRelation: "feed_woref"
            referencedColumns: ["id"]
          },
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
          proyecto_id: string | null
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
          proyecto_id?: string | null
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
          proyecto_id?: string | null
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
            foreignKeyName: "mensajes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "feed_woref"
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
          comunidad_id: string | null
          created_at: string
          id: string
          leida: boolean
          origen_id: string | null
          perfil_id: string
          proyecto_id: string | null
          publicacion_id: string | null
          texto: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Insert: {
          comentario_id?: string | null
          comunidad_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          origen_id?: string | null
          perfil_id: string
          proyecto_id?: string | null
          publicacion_id?: string | null
          texto?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
        }
        Update: {
          comentario_id?: string | null
          comunidad_id?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          origen_id?: string | null
          perfil_id?: string
          proyecto_id?: string | null
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
            foreignKeyName: "notificaciones_comunidad_id_fkey"
            columns: ["comunidad_id"]
            isOneToOne: false
            referencedRelation: "comunidades"
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
            foreignKeyName: "notificaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_publicacion_id_fkey"
            columns: ["publicacion_id"]
            isOneToOne: false
            referencedRelation: "feed_woref"
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
          actualmente: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          industria: string | null
          instagram: string | null
          intereses: string[] | null
          linkedin: string | null
          mensajes_privados: boolean
          mostrar_ubicacion: boolean
          nombre: string
          portada_url: string | null
          que_busca: string | null
          que_ofrece: string | null
          score: number
          sitio_web: string | null
          skills: string[] | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones: number
          total_seguidores: number
          total_siguiendo: number
          twitter: string | null
          ubicacion: string | null
          updated_at: string
          username: string
          verificado: boolean
          youtube: string | null
        }
        Insert: {
          activo?: boolean
          actualmente?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id: string
          industria?: string | null
          instagram?: string | null
          intereses?: string[] | null
          linkedin?: string | null
          mensajes_privados?: boolean
          mostrar_ubicacion?: boolean
          nombre: string
          portada_url?: string | null
          que_busca?: string | null
          que_ofrece?: string | null
          score?: number
          sitio_web?: string | null
          skills?: string[] | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones?: number
          total_seguidores?: number
          total_siguiendo?: number
          twitter?: string | null
          ubicacion?: string | null
          updated_at?: string
          username: string
          verificado?: boolean
          youtube?: string | null
        }
        Update: {
          activo?: boolean
          actualmente?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          industria?: string | null
          instagram?: string | null
          intereses?: string[] | null
          linkedin?: string | null
          mensajes_privados?: boolean
          mostrar_ubicacion?: boolean
          nombre?: string
          portada_url?: string | null
          que_busca?: string | null
          que_ofrece?: string | null
          score?: number
          sitio_web?: string | null
          skills?: string[] | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          total_publicaciones?: number
          total_seguidores?: number
          total_siguiendo?: number
          twitter?: string | null
          ubicacion?: string | null
          updated_at?: string
          username?: string
          verificado?: boolean
          youtube?: string | null
        }
        Relationships: []
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
      proyecto_miembros: {
        Row: {
          created_at: string
          es_fundador: boolean
          id: string
          perfil_id: string
          proyecto_id: string
          rol: string
        }
        Insert: {
          created_at?: string
          es_fundador?: boolean
          id?: string
          perfil_id: string
          proyecto_id: string
          rol?: string
        }
        Update: {
          created_at?: string
          es_fundador?: boolean
          id?: string
          perfil_id?: string
          proyecto_id?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_miembros_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_miembros_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_seguidores: {
        Row: {
          created_at: string
          id: string
          perfil_id: string
          proyecto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_id: string
          proyecto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          perfil_id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_seguidores_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_seguidores_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_updates: {
        Row: {
          contenido: string | null
          created_at: string
          id: string
          imagen_url: string | null
          perfil_id: string
          proyecto_id: string
          titulo: string
        }
        Insert: {
          contenido?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          perfil_id: string
          proyecto_id: string
          titulo: string
        }
        Update: {
          contenido?: string | null
          created_at?: string
          id?: string
          imagen_url?: string | null
          perfil_id?: string
          proyecto_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_updates_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_updates_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          buscando: string[] | null
          categoria: string | null
          created_at: string
          demo_url: string | null
          descripcion: string | null
          destacado: boolean
          estado: Database["public"]["Enums"]["estado_proyecto"]
          id: string
          nombre: string
          perfil_id: string
          portada_url: string | null
          progreso: number
          repo_url: string | null
          sitio_web: string | null
          slug: string | null
          tags: string[] | null
          total_miembros: number
          total_seguidores: number
          updated_at: string
        }
        Insert: {
          buscando?: string[] | null
          categoria?: string | null
          created_at?: string
          demo_url?: string | null
          descripcion?: string | null
          destacado?: boolean
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          id?: string
          nombre: string
          perfil_id: string
          portada_url?: string | null
          progreso?: number
          repo_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          tags?: string[] | null
          total_miembros?: number
          total_seguidores?: number
          updated_at?: string
        }
        Update: {
          buscando?: string[] | null
          categoria?: string | null
          created_at?: string
          demo_url?: string | null
          descripcion?: string | null
          destacado?: boolean
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          id?: string
          nombre?: string
          perfil_id?: string
          portada_url?: string | null
          progreso?: number
          repo_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          tags?: string[] | null
          total_miembros?: number
          total_seguidores?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publicaciones: {
        Row: {
          created_at: string
          cuerpo: string | null
          cuerpo_largo: string | null
          destacada: boolean
          encuesta_cierre: string | null
          encuesta_opciones: string[] | null
          estado: Database["public"]["Enums"]["estado_publicacion"]
          formato: Database["public"]["Enums"]["formato_publicacion"]
          id: string
          imagen_url: string | null
          industria_op: string | null
          modalidad: string | null
          pais: string | null
          perfil_id: string
          rol_buscado: string | null
          tags: string[] | null
          thumbnail_url: string | null
          tipo: Database["public"]["Enums"]["tipo_publicacion"]
          titulo: string | null
          total_comentarios: number
          total_guardados: number
          total_likes: number
          total_repostes: number
          updated_at: string
          video_duracion: number | null
          video_url: string | null
          vistas: number
        }
        Insert: {
          created_at?: string
          cuerpo?: string | null
          cuerpo_largo?: string | null
          destacada?: boolean
          encuesta_cierre?: string | null
          encuesta_opciones?: string[] | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          formato?: Database["public"]["Enums"]["formato_publicacion"]
          id?: string
          imagen_url?: string | null
          industria_op?: string | null
          modalidad?: string | null
          pais?: string | null
          perfil_id: string
          rol_buscado?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          tipo?: Database["public"]["Enums"]["tipo_publicacion"]
          titulo?: string | null
          total_comentarios?: number
          total_guardados?: number
          total_likes?: number
          total_repostes?: number
          updated_at?: string
          video_duracion?: number | null
          video_url?: string | null
          vistas?: number
        }
        Update: {
          created_at?: string
          cuerpo?: string | null
          cuerpo_largo?: string | null
          destacada?: boolean
          encuesta_cierre?: string | null
          encuesta_opciones?: string[] | null
          estado?: Database["public"]["Enums"]["estado_publicacion"]
          formato?: Database["public"]["Enums"]["formato_publicacion"]
          id?: string
          imagen_url?: string | null
          industria_op?: string | null
          modalidad?: string | null
          pais?: string | null
          perfil_id?: string
          rol_buscado?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          tipo?: Database["public"]["Enums"]["tipo_publicacion"]
          titulo?: string | null
          total_comentarios?: number
          total_guardados?: number
          total_likes?: number
          total_repostes?: number
          updated_at?: string
          video_duracion?: number | null
          video_url?: string | null
          vistas?: number
        }
        Relationships: [
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
            referencedRelation: "feed_woref"
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
      feed_woref: {
        Row: {
          autor_avatar: string | null
          autor_nombre: string | null
          autor_score: number | null
          autor_tipo: Database["public"]["Enums"]["tipo_usuario"] | null
          autor_username: string | null
          autor_verificado: boolean | null
          created_at: string | null
          cuerpo: string | null
          cuerpo_largo: string | null
          destacada: boolean | null
          encuesta_opciones: string[] | null
          formato: Database["public"]["Enums"]["formato_publicacion"] | null
          id: string | null
          imagen_url: string | null
          modalidad: string | null
          rol_buscado: string | null
          tags: string[] | null
          thumbnail_url: string | null
          tipo: Database["public"]["Enums"]["tipo_publicacion"] | null
          titulo: string | null
          total_comentarios: number | null
          total_guardados: number | null
          total_likes: number | null
          total_repostes: number | null
          video_duracion: number | null
          video_url: string | null
          vistas: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_mis_conversaciones: {
        Args: { user_id: string }
        Returns: {
          created_at: string
          id: string
          no_leidos_a: number
          no_leidos_b: number
          perfil_a_id: string
          perfil_b_id: string
          ultimo_mensaje: string | null
          ultimo_mensaje_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "conversaciones"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      estado_proyecto:
        | "idea"
        | "en_desarrollo"
        | "lanzado"
        | "pausado"
        | "completado"
        | "buscando_equipo"
        | "buscando_inversion"
      estado_publicacion: "activa" | "borrador" | "pausada" | "eliminada"
      formato_publicacion:
        | "texto"
        | "imagen"
        | "video_corto"
        | "video_largo"
        | "articulo"
        | "proyecto"
        | "encuesta"
        | "recurso"
      tipo_miembro_comunidad: "miembro" | "moderador" | "admin"
      tipo_notificacion:
        | "nuevo_seguidor"
        | "like"
        | "comentario"
        | "respuesta_comentario"
        | "reposteo"
        | "mencion"
        | "nuevo_mensaje"
        | "match"
        | "invitacion_proyecto"
        | "invitacion_comunidad"
        | "oportunidad"
        | "nuevo_miembro_proyecto"
      tipo_publicacion:
        | "update"
        | "proyecto"
        | "oportunidad"
        | "recurso"
        | "idea"
        | "logro"
        | "lanzamiento"
        | "busco_socio"
        | "busco_colaborador"
        | "hiring"
        | "contenido_corto"
        | "contenido_largo"
        | "video_corto"
        | "video_largo"
        | "encuesta"
        | "general"
      tipo_usuario:
        | "emprendedor"
        | "empresa"
        | "inversor"
        | "marca"
        | "freelancer"
        | "atleta"
        | "creador"
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
      estado_proyecto: [
        "idea",
        "en_desarrollo",
        "lanzado",
        "pausado",
        "completado",
        "buscando_equipo",
        "buscando_inversion",
      ],
      estado_publicacion: ["activa", "borrador", "pausada", "eliminada"],
      formato_publicacion: [
        "texto",
        "imagen",
        "video_corto",
        "video_largo",
        "articulo",
        "proyecto",
        "encuesta",
        "recurso",
      ],
      tipo_miembro_comunidad: ["miembro", "moderador", "admin"],
      tipo_notificacion: [
        "nuevo_seguidor",
        "like",
        "comentario",
        "respuesta_comentario",
        "reposteo",
        "mencion",
        "nuevo_mensaje",
        "match",
        "invitacion_proyecto",
        "invitacion_comunidad",
        "oportunidad",
        "nuevo_miembro_proyecto",
      ],
      tipo_publicacion: [
        "update",
        "proyecto",
        "oportunidad",
        "recurso",
        "idea",
        "logro",
        "lanzamiento",
        "busco_socio",
        "busco_colaborador",
        "hiring",
        "contenido_corto",
        "contenido_largo",
        "video_corto",
        "video_largo",
        "encuesta",
        "general",
      ],
      tipo_usuario: [
        "emprendedor",
        "empresa",
        "inversor",
        "marca",
        "freelancer",
        "atleta",
        "creador",
        "profesional",
        "institucion",
      ],
    },
  },
} as const
