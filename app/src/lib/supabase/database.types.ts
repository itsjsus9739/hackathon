// Generado desde Supabase (proyecto dgubdqszyxrlpcfatqvl) tras la migración 0006; helpers Tables/Enums simplificados.
// Regenerar con: npx supabase gen types typescript --project-id dgubdqszyxrlpcfatqvl > src/lib/supabase/database.types.ts
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
      actividades_cronograma: {
        Row: {
          actividad: string
          categoria: string
          creado_en: string
          detalle: string | null
          estado: string
          fecha_fin: string
          fecha_inicio: string
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          responsable: string | null
        }
        Insert: {
          actividad: string
          categoria: string
          creado_en?: string
          detalle?: string | null
          estado?: string
          fecha_fin: string
          fecha_inicio: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          responsable?: string | null
        }
        Update: {
          actividad?: string
          categoria?: string
          creado_en?: string
          detalle?: string | null
          estado?: string
          fecha_fin?: string
          fecha_inicio?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          responsable?: string | null
        }
        Relationships: []
      }
      asignatura_docentes: {
        Row: { id_asignatura: string; id_docente: string; semestre: string }
        Insert: { id_asignatura: string; id_docente: string; semestre: string }
        Update: { id_asignatura?: string; id_docente?: string; semestre?: string }
        Relationships: [
          { foreignKeyName: "asignatura_docentes_id_asignatura_fkey"; columns: ["id_asignatura"]; isOneToOne: false; referencedRelation: "asignaturas"; referencedColumns: ["id"] },
          { foreignKeyName: "asignatura_docentes_id_docente_fkey"; columns: ["id_docente"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      asignatura_estudiantes: {
        Row: { id_asignatura: string; id_estudiante: string; semestre: string }
        Insert: { id_asignatura: string; id_estudiante: string; semestre: string }
        Update: { id_asignatura?: string; id_estudiante?: string; semestre?: string }
        Relationships: [
          { foreignKeyName: "asignatura_estudiantes_id_asignatura_fkey"; columns: ["id_asignatura"]; isOneToOne: false; referencedRelation: "asignaturas"; referencedColumns: ["id"] },
          { foreignKeyName: "asignatura_estudiantes_id_estudiante_fkey"; columns: ["id_estudiante"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      asignaturas: {
        Row: { creado_en: string; id: string; nombre: string }
        Insert: { creado_en?: string; id?: string; nombre: string }
        Update: { creado_en?: string; id?: string; nombre?: string }
        Relationships: []
      }
      atenciones: {
        Row: {
          creado_en: string
          fecha: string
          id: string
          id_empresa: string
          notas: string | null
          semestre: string
          tipo_actividad: string
        }
        Insert: {
          creado_en?: string
          fecha?: string
          id?: string
          id_empresa: string
          notas?: string | null
          semestre: string
          tipo_actividad: string
        }
        Update: {
          creado_en?: string
          fecha?: string
          id?: string
          id_empresa?: string
          notas?: string | null
          semestre?: string
          tipo_actividad?: string
        }
        Relationships: [
          { foreignKeyName: "atenciones_id_empresa_fkey"; columns: ["id_empresa"]; isOneToOne: false; referencedRelation: "empresas"; referencedColumns: ["id"] },
          { foreignKeyName: "atenciones_tipo_actividad_fkey"; columns: ["tipo_actividad"]; isOneToOne: false; referencedRelation: "tipos_actividad"; referencedColumns: ["nombre"] },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          datos: Json | null
          id: number
          registro_id: string | null
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          datos?: Json | null
          id?: never
          registro_id?: string | null
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          datos?: Json | null
          id?: never
          registro_id?: string | null
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      carga_docente: {
        Row: {
          asignatura: string
          docente: string
          estudiantes: number
          id: string
          id_asignatura: string | null
          id_perfil: string | null
          proyectos: number
          semestre: string
        }
        Insert: {
          asignatura: string
          docente: string
          estudiantes: number
          id?: string
          id_asignatura?: string | null
          id_perfil?: string | null
          proyectos: number
          semestre: string
        }
        Update: {
          asignatura?: string
          docente?: string
          estudiantes?: number
          id?: string
          id_asignatura?: string | null
          id_perfil?: string | null
          proyectos?: number
          semestre?: string
        }
        Relationships: [
          { foreignKeyName: "carga_docente_id_asignatura_fkey"; columns: ["id_asignatura"]; isOneToOne: false; referencedRelation: "asignaturas"; referencedColumns: ["id"] },
          { foreignKeyName: "carga_docente_id_perfil_fkey"; columns: ["id_perfil"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      citas: {
        Row: {
          creado_en: string
          estado: string
          fecha_hora: string | null
          id: string
          id_empresa: string
          id_miembro_cde: string | null
          motivo: string
          notas: string | null
          recordatorio_enviado_en: string | null
          solicitada_por: string | null
        }
        Insert: {
          creado_en?: string
          estado?: string
          fecha_hora?: string | null
          id?: string
          id_empresa: string
          id_miembro_cde?: string | null
          motivo: string
          notas?: string | null
          recordatorio_enviado_en?: string | null
          solicitada_por?: string | null
        }
        Update: {
          creado_en?: string
          estado?: string
          fecha_hora?: string | null
          id?: string
          id_empresa?: string
          id_miembro_cde?: string | null
          motivo?: string
          notas?: string | null
          recordatorio_enviado_en?: string | null
          solicitada_por?: string | null
        }
        Relationships: [
          { foreignKeyName: "citas_id_empresa_fkey"; columns: ["id_empresa"]; isOneToOne: false; referencedRelation: "empresas"; referencedColumns: ["id"] },
          { foreignKeyName: "citas_id_miembro_cde_fkey"; columns: ["id_miembro_cde"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
          { foreignKeyName: "citas_solicitada_por_fkey"; columns: ["solicitada_por"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      diagnosticos: {
        Row: {
          creado_en: string
          estrategia: number
          fecha: string
          financiera: number
          id: string
          id_empresa: string
          mercadeo_ventas: number
          nivel: string | null
          normativa_legal: number
          productividad: number
          promedio: number | null
          realizado_por: string | null
          tipo_iniciativa: string | null
          transformacion_digital: number
        }
        Insert: {
          creado_en?: string
          estrategia: number
          fecha?: string
          financiera: number
          id?: string
          id_empresa: string
          mercadeo_ventas: number
          nivel?: string | null
          normativa_legal: number
          productividad: number
          promedio?: number | null
          realizado_por?: string | null
          tipo_iniciativa?: string | null
          transformacion_digital: number
        }
        Update: {
          creado_en?: string
          estrategia?: number
          fecha?: string
          financiera?: number
          id?: string
          id_empresa?: string
          mercadeo_ventas?: number
          nivel?: string | null
          normativa_legal?: number
          productividad?: number
          promedio?: number | null
          realizado_por?: string | null
          tipo_iniciativa?: string | null
          transformacion_digital?: number
        }
        Relationships: [
          { foreignKeyName: "diagnosticos_id_empresa_fkey"; columns: ["id_empresa"]; isOneToOne: false; referencedRelation: "empresas"; referencedColumns: ["id"] },
          { foreignKeyName: "diagnosticos_realizado_por_fkey"; columns: ["realizado_por"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          creado_en: string
          departamento: string | null
          descripcion: string | null
          formalizacion: string | null
          id: string
          id_representante: string | null
          municipio: string | null
          nit: string | null
          nit_dv: number | null
          nombre: string
          sector: string | null
          tamano: Database["public"]["Enums"]["tamano_empresa"] | null
          vinculo_unab: Database["public"]["Enums"]["vinculo_unab"] | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          departamento?: string | null
          descripcion?: string | null
          formalizacion?: string | null
          id?: string
          id_representante?: string | null
          municipio?: string | null
          nit?: string | null
          nit_dv?: number | null
          nombre: string
          sector?: string | null
          tamano?: Database["public"]["Enums"]["tamano_empresa"] | null
          vinculo_unab?: Database["public"]["Enums"]["vinculo_unab"] | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          departamento?: string | null
          descripcion?: string | null
          formalizacion?: string | null
          id?: string
          id_representante?: string | null
          municipio?: string | null
          nit?: string | null
          nit_dv?: number | null
          nombre?: string
          sector?: string | null
          tamano?: Database["public"]["Enums"]["tamano_empresa"] | null
          vinculo_unab?: Database["public"]["Enums"]["vinculo_unab"] | null
        }
        Relationships: [
          { foreignKeyName: "empresas_id_representante_fkey"; columns: ["id_representante"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
          { foreignKeyName: "empresas_sector_fkey"; columns: ["sector"]; isOneToOne: false; referencedRelation: "sectores"; referencedColumns: ["nombre"] },
        ]
      }
      eventos: {
        Row: {
          creado_en: string
          cupo: number | null
          descripcion: string | null
          fecha: string
          id: string
          id_actividad_cronograma: string | null
          lugar: string | null
          nombre: string
          puntos_gamificacion: number
          tipo: string
        }
        Insert: {
          creado_en?: string
          cupo?: number | null
          descripcion?: string | null
          fecha: string
          id?: string
          id_actividad_cronograma?: string | null
          lugar?: string | null
          nombre: string
          puntos_gamificacion?: number
          tipo?: string
        }
        Update: {
          creado_en?: string
          cupo?: number | null
          descripcion?: string | null
          fecha?: string
          id?: string
          id_actividad_cronograma?: string | null
          lugar?: string | null
          nombre?: string
          puntos_gamificacion?: number
          tipo?: string
        }
        Relationships: [
          { foreignKeyName: "eventos_id_actividad_cronograma_fkey"; columns: ["id_actividad_cronograma"]; isOneToOne: false; referencedRelation: "actividades_cronograma"; referencedColumns: ["id"] },
        ]
      }
      inscripciones_eventos: {
        Row: { asistio: boolean; id: string; id_evento: string; id_usuario: string; inscrito_en: string }
        Insert: { asistio?: boolean; id?: string; id_evento: string; id_usuario: string; inscrito_en?: string }
        Update: { asistio?: boolean; id?: string; id_evento?: string; id_usuario?: string; inscrito_en?: string }
        Relationships: [
          { foreignKeyName: "inscripciones_eventos_id_evento_fkey"; columns: ["id_evento"]; isOneToOne: false; referencedRelation: "eventos"; referencedColumns: ["id"] },
          { foreignKeyName: "inscripciones_eventos_id_usuario_fkey"; columns: ["id_usuario"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
        ]
      }
      perfiles: {
        Row: {
          actualizado_en: string
          creado_en: string
          documento_identidad: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          sexo: Database["public"]["Enums"]["sexo"] | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          documento_identidad?: string | null
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sexo?: Database["public"]["Enums"]["sexo"] | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          documento_identidad?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sexo?: Database["public"]["Enums"]["sexo"] | null
        }
        Relationships: []
      }
      postulaciones: {
        Row: {
          creado_en: string
          estado: string
          id: string
          id_empresa: string
          nit_reportado: string | null
          origen: string
          origen_registro: string
        }
        Insert: {
          creado_en?: string
          estado: string
          id: string
          id_empresa: string
          nit_reportado?: string | null
          origen: string
          origen_registro: string
        }
        Update: {
          creado_en?: string
          estado?: string
          id?: string
          id_empresa?: string
          nit_reportado?: string | null
          origen?: string
          origen_registro?: string
        }
        Relationships: [
          { foreignKeyName: "postulaciones_id_empresa_fkey"; columns: ["id_empresa"]; isOneToOne: false; referencedRelation: "empresas"; referencedColumns: ["id"] },
        ]
      }
      proyecto_docentes: {
        Row: { asignado_en: string; id_docente: string; id_proyecto: string }
        Insert: { asignado_en?: string; id_docente: string; id_proyecto: string }
        Update: { asignado_en?: string; id_docente?: string; id_proyecto?: string }
        Relationships: [
          { foreignKeyName: "proyecto_docentes_id_docente_fkey"; columns: ["id_docente"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
          { foreignKeyName: "proyecto_docentes_id_proyecto_fkey"; columns: ["id_proyecto"]; isOneToOne: false; referencedRelation: "proyectos_aula"; referencedColumns: ["id"] },
        ]
      }
      proyecto_estudiantes: {
        Row: { asignado_en: string; id_estudiante: string; id_proyecto: string }
        Insert: { asignado_en?: string; id_estudiante: string; id_proyecto: string }
        Update: { asignado_en?: string; id_estudiante?: string; id_proyecto?: string }
        Relationships: [
          { foreignKeyName: "proyecto_estudiantes_id_estudiante_fkey"; columns: ["id_estudiante"]; isOneToOne: false; referencedRelation: "perfiles"; referencedColumns: ["id"] },
          { foreignKeyName: "proyecto_estudiantes_id_proyecto_fkey"; columns: ["id_proyecto"]; isOneToOne: false; referencedRelation: "proyectos_aula"; referencedColumns: ["id"] },
        ]
      }
      proyectos_aula: {
        Row: {
          actualizado_en: string
          area_intervenida: string | null
          asignatura: string | null
          creado_en: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"]
          estudiantes_reportados: number | null
          fecha_inicio: string | null
          id: string
          id_asignatura: string | null
          id_empresa: string
          nombre: string
          resultados: string | null
          semestre: string
        }
        Insert: {
          actualizado_en?: string
          area_intervenida?: string | null
          asignatura?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          estudiantes_reportados?: number | null
          fecha_inicio?: string | null
          id?: string
          id_asignatura?: string | null
          id_empresa: string
          nombre: string
          resultados?: string | null
          semestre: string
        }
        Update: {
          actualizado_en?: string
          area_intervenida?: string | null
          asignatura?: string | null
          creado_en?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          estudiantes_reportados?: number | null
          fecha_inicio?: string | null
          id?: string
          id_asignatura?: string | null
          id_empresa?: string
          nombre?: string
          resultados?: string | null
          semestre?: string
        }
        Relationships: [
          { foreignKeyName: "proyectos_aula_id_asignatura_fkey"; columns: ["id_asignatura"]; isOneToOne: false; referencedRelation: "asignaturas"; referencedColumns: ["id"] },
          { foreignKeyName: "proyectos_aula_id_empresa_fkey"; columns: ["id_empresa"]; isOneToOne: false; referencedRelation: "empresas"; referencedColumns: ["id"] },
        ]
      }
      sectores: {
        Row: { nombre: string }
        Insert: { nombre: string }
        Update: { nombre?: string }
        Relationships: []
      }
      tipos_actividad: {
        Row: { nombre: string }
        Insert: { nombre: string }
        Update: { nombre?: string }
        Relationships: []
      }
    }
    Views: {
      asistencia_eventos: {
        Row: {
          asistentes: number | null
          fecha: string | null
          id: string | null
          inscritos: number | null
          nombre: string | null
          tasa_asistencia: number | null
        }
        Relationships: []
      }
      atenciones_por_semestre: {
        Row: { atenciones: number | null; empresas_unicas: number | null; semestre: string | null }
        Relationships: []
      }
      cronograma: {
        Row: {
          actividad: string | null
          categoria: string | null
          creado_en: string | null
          detalle: string | null
          duracion_dias: number | null
          estado: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string | null
          responsable: string | null
          situacion: string | null
        }
        Relationships: []
      }
      historial_empresa: {
        Row: {
          detalle: string | null
          estado: string | null
          fecha: string | null
          id_empresa: string | null
          id_registro: string | null
          tipo: string | null
          titulo: string | null
        }
        Relationships: []
      }
      posibles_duplicados: {
        Row: {
          id_empresa_a: string | null
          id_empresa_b: string | null
          nit_a: string | null
          nit_b: string | null
          nombre_a: string | null
          nombre_b: string | null
          similitud: number | null
        }
        Relationships: []
      }
      puntos_usuario: {
        Row: { eventos_asistidos: number | null; id_usuario: string | null; puntos: number | null }
        Relationships: []
      }
      resumen_proyectos: {
        Row: {
          asignatura: string | null
          empresa: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"] | null
          estudiantes: number | null
          id: string | null
          nombre: string | null
          semestre: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      asignaturas_del_docente: { Args: never; Returns: string[] }
      directorio: {
        Args: never
        Returns: { id: string; nombre: string; rol: Database["public"]["Enums"]["rol_usuario"] }[]
      }
      es_admin: { Args: never; Returns: boolean }
      es_cde: { Args: never; Returns: boolean }
      mis_empresas: { Args: never; Returns: string[] }
      proyectos_del_docente: { Args: never; Returns: string[] }
      proyectos_del_estudiante: { Args: never; Returns: string[] }
      rol_actual: { Args: never; Returns: Database["public"]["Enums"]["rol_usuario"] }
    }
    Enums: {
      estado_proyecto: "Planeado" | "En curso" | "Finalizado" | "Cancelado"
      rol_usuario: "admin_cde" | "cde" | "emprendedor" | "docente" | "estudiante"
      sexo: "Femenino" | "Masculino"
      tamano_empresa: "Emprendimiento" | "Micro" | "Pequeña" | "Mediana" | "Grande"
      vinculo_unab: "Externo" | "Estudiante" | "Graduado" | "Colaborador" | "Emprendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

/** Fila de una tabla o vista: Tables<"empresas">, Tables<"historial_empresa"> */
export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
