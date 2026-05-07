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
          perfil_id: string
          publicacion_id: string
          respuesta_a: string | null
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          perfil_id: string
          publicacion_id: string
          respuesta_a?: string | null
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          perfil_id?: string
          publicacion_id?: string
          respuesta_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles_inmo"
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
            referencedRelation: "perfiles_inmo"
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
            referencedRelation: "perfiles_inmo"
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
      imagenes_publicacion: {
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
            foreignKeyName: "imagenes_publicacion_publicacion_id_fkey"
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
      perfiles_inmo: {
        Row: {
          activo: boolean
          avatar_url: string | null
          ciudad_id: string | null
          created_at: string
          descripcion: string | null
          facebook: string | null
          id: string
          instagram: string | null
          nombre: string
          portada_url: string | null
          sitio_web: string | null
          slug: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario_inmo"]
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
          id: string
          instagram?: string | null
          nombre: string
          portada_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario_inmo"]
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
          id?: string
          instagram?: string | null
          nombre?: string
          portada_url?: string | null
          sitio_web?: string | null
          slug?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario_inmo"]
          updated_at?: string
          verificado?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_inmo_ciudad_id_fkey"
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
          gas_natural: boolean
          hectareas: number | null
          id: string
          internet: boolean
          luz: boolean
          moneda: string
          mostrar_direccion: boolean
          perfil_id: string
          precio: number | null
          precio_negociable: boolean
          referencia: string | null
          superficie_cubierta: number | null
          superficie_total: number | null
          tiene_casa_campo: boolean
          tiene_galpon: boolean
          tipo_operacion: Database["public"]["Enums"]["tipo_operacion"]
          tipo_propiedad: Database["public"]["Enums"]["tipo_propiedad"]
          tipo_suelo: string | null
          titulo: string
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
          gas_natural?: boolean
          hectareas?: number | null
          id?: string
          internet?: boolean
          luz?: boolean
          moneda?: string
          mostrar_direccion?: boolean
          perfil_id: string
          precio?: number | null
          precio_negociable?: boolean
          referencia?: string | null
          superficie_cubierta?: number | null
          superficie_total?: number | null
          tiene_casa_campo?: boolean
          tiene_galpon?: boolean
          tipo_operacion: Database["public"]["Enums"]["tipo_operacion"]
          tipo_propiedad: Database["public"]["Enums"]["tipo_propiedad"]
          tipo_suelo?: string | null
          titulo: string
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
          gas_natural?: boolean
          hectareas?: number | null
          id?: string
          internet?: boolean
          luz?: boolean
          moneda?: string
          mostrar_direccion?: boolean
          perfil_id?: string
          precio?: number | null
          precio_negociable?: boolean
          referencia?: string | null
          superficie_cubierta?: number | null
          superficie_total?: number | null
          tiene_casa_campo?: boolean
          tiene_galpon?: boolean
          tipo_operacion?: Database["public"]["Enums"]["tipo_operacion"]
          tipo_propiedad?: Database["public"]["Enums"]["tipo_propiedad"]
          tipo_suelo?: string | null
          titulo?: string
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
            referencedRelation: "perfiles_inmo"
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
      seed_default_pipeline: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note"
      app_role: "admin" | "manager" | "rep"
      estado_publicacion:
        | "activa"
        | "pausada"
        | "vendida"
        | "alquilada"
        | "eliminada"
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
      tipo_usuario_inmo:
        | "dueno_directo"
        | "inmobiliaria"
        | "agente_independiente"
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
        "eliminada",
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
      tipo_usuario_inmo: [
        "dueno_directo",
        "inmobiliaria",
        "agente_independiente",
      ],
    },
  },
} as const
