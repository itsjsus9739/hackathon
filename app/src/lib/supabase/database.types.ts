// Generado desde Supabase (proyecto dgubdqszyxrlpcfatqvl) tras la migración 0016; helpers Tables/Enums simplificados.
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
      aportes: {
        Row: {
          comentario_revision: string | null
          creado_en: string
          descripcion: string
          estado: string
          evidencia_url: string | null
          id: string
          id_area: string
          id_proyecto: string
          id_usuario: string
          validado_en: string | null
          validado_por: string | null
        }
        Insert: {
          comentario_revision?: string | null
          creado_en?: string
          descripcion: string
          estado?: string
          evidencia_url?: string | null
          id?: string
          id_area: string
          id_proyecto: string
          id_usuario?: string
          validado_en?: string | null
          validado_por?: string | null
        }
        Update: {
          comentario_revision?: string | null
          creado_en?: string
          descripcion?: string
          estado?: string
          evidencia_url?: string | null
          id?: string
          id_area?: string
          id_proyecto?: string
          id_usuario?: string
          validado_en?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aportes_id_area_fkey"
            columns: ["id_area"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "resumen_proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aportes_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          activa: boolean
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
          puntos_por_aporte: number
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
          puntos_por_aporte?: number
        }
        Update: {
          activa?: boolean
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          puntos_por_aporte?: number
        }
        Relationships: []
      }
      asignatura_docentes: {
        Row: {
          id_asignatura: string
          id_docente: string
          semestre: string
        }
        Insert: {
          id_asignatura: string
          id_docente: string
          semestre: string
        }
        Update: {
          id_asignatura?: string
          id_docente?: string
          semestre?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignatura_docentes_id_asignatura_fkey"
            columns: ["id_asignatura"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignatura_docentes_id_docente_fkey"
            columns: ["id_docente"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asignatura_estudiantes: {
        Row: {
          id_asignatura: string
          id_estudiante: string
          semestre: string
        }
        Insert: {
          id_asignatura: string
          id_estudiante: string
          semestre: string
        }
        Update: {
          id_asignatura?: string
          id_estudiante?: string
          semestre?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignatura_estudiantes_id_asignatura_fkey"
            columns: ["id_asignatura"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignatura_estudiantes_id_estudiante_fkey"
            columns: ["id_estudiante"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asignaturas: {
        Row: {
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
        }
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
          {
            foreignKeyName: "atenciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atenciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "atenciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "atenciones_tipo_actividad_fkey"
            columns: ["tipo_actividad"]
            isOneToOne: false
            referencedRelation: "tipos_actividad"
            referencedColumns: ["nombre"]
          },
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
      canales: {
        Row: {
          creado_en: string
          descripcion: string | null
          id: string
          id_proyecto: string | null
          nombre: string
          tipo: string
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          id_proyecto?: string | null
          nombre: string
          tipo?: string
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          id?: string
          id_proyecto?: string | null
          nombre?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "canales_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: true
            referencedRelation: "proyectos_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canales_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: true
            referencedRelation: "resumen_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      canjes: {
        Row: {
          comentario: string | null
          creado_en: string
          estado: string
          id: string
          id_recompensa: string
          id_usuario: string
          puntos: number
          resuelto_en: string | null
          resuelto_por: string | null
        }
        Insert: {
          comentario?: string | null
          creado_en?: string
          estado?: string
          id?: string
          id_recompensa: string
          id_usuario?: string
          puntos?: number
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Update: {
          comentario?: string | null
          creado_en?: string
          estado?: string
          id?: string
          id_recompensa?: string
          id_usuario?: string
          puntos?: number
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canjes_id_recompensa_fkey"
            columns: ["id_recompensa"]
            isOneToOne: false
            referencedRelation: "recompensas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canjes_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canjes_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "carga_docente_id_asignatura_fkey"
            columns: ["id_asignatura"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carga_docente_id_perfil_fkey"
            columns: ["id_perfil"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "citas_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "citas_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "citas_id_miembro_cde_fkey"
            columns: ["id_miembro_cde"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_solicitada_por_fkey"
            columns: ["solicitada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compromisos: {
        Row: {
          actualizado_en: string
          avance: number
          completado_en: string | null
          creado_en: string
          descripcion: string
          estado: string
          evidencia: string | null
          fecha_limite: string | null
          id: string
          id_plan: string
          id_responsable: string | null
        }
        Insert: {
          actualizado_en?: string
          avance?: number
          completado_en?: string | null
          creado_en?: string
          descripcion: string
          estado?: string
          evidencia?: string | null
          fecha_limite?: string | null
          id?: string
          id_plan: string
          id_responsable?: string | null
        }
        Update: {
          actualizado_en?: string
          avance?: number
          completado_en?: string | null
          creado_en?: string
          descripcion?: string
          estado?: string
          evidencia?: string | null
          fecha_limite?: string | null
          id?: string
          id_plan?: string
          id_responsable?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compromisos_id_plan_fkey"
            columns: ["id_plan"]
            isOneToOne: false
            referencedRelation: "avance_planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisos_id_plan_fkey"
            columns: ["id_plan"]
            isOneToOne: false
            referencedRelation: "planes_accion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisos_id_responsable_fkey"
            columns: ["id_responsable"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos_empresa: {
        Row: {
          cargo: string | null
          correo: string | null
          creado_en: string
          es_principal: boolean
          id: string
          id_empresa: string
          id_perfil: string | null
          nombre: string
          telefono: string | null
        }
        Insert: {
          cargo?: string | null
          correo?: string | null
          creado_en?: string
          es_principal?: boolean
          id?: string
          id_empresa: string
          id_perfil?: string | null
          nombre: string
          telefono?: string | null
        }
        Update: {
          cargo?: string | null
          correo?: string | null
          creado_en?: string
          es_principal?: boolean
          id?: string
          id_empresa?: string
          id_perfil?: string | null
          nombre?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contactos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "contactos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "contactos_empresa_id_perfil_fkey"
            columns: ["id_perfil"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          creado_en: string
          es_ejemplo: boolean
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
          es_ejemplo?: boolean
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
          es_ejemplo?: boolean
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
          {
            foreignKeyName: "diagnosticos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "diagnosticos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "diagnosticos_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          creado_en: string
          datos_estimados: string[]
          departamento: string | null
          descripcion: string | null
          formalizacion: string | null
          id: string
          id_mentor: string | null
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
          datos_estimados?: string[]
          departamento?: string | null
          descripcion?: string | null
          formalizacion?: string | null
          id?: string
          id_mentor?: string | null
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
          datos_estimados?: string[]
          departamento?: string | null
          descripcion?: string | null
          formalizacion?: string | null
          id?: string
          id_mentor?: string | null
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
          {
            foreignKeyName: "empresas_id_mentor_fkey"
            columns: ["id_mentor"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_id_representante_fkey"
            columns: ["id_representante"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_sector_fkey"
            columns: ["sector"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["nombre"]
          },
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
          {
            foreignKeyName: "eventos_id_actividad_cronograma_fkey"
            columns: ["id_actividad_cronograma"]
            isOneToOne: false
            referencedRelation: "actividades_cronograma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_id_actividad_cronograma_fkey"
            columns: ["id_actividad_cronograma"]
            isOneToOne: false
            referencedRelation: "cronograma"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_empresa: {
        Row: {
          anio: number
          creado_en: string
          fuente: string
          id: string
          id_empresa: string
          monto: number
          registrado_por: string | null
        }
        Insert: {
          anio: number
          creado_en?: string
          fuente?: string
          id?: string
          id_empresa: string
          monto: number
          registrado_por?: string | null
        }
        Update: {
          anio?: number
          creado_en?: string
          fuente?: string
          id?: string
          id_empresa?: string
          monto?: number
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingresos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "ingresos_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "ingresos_empresa_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripciones_eventos: {
        Row: {
          asistio: boolean
          id: string
          id_empresa: string | null
          id_evento: string
          id_usuario: string
          inscrito_en: string
        }
        Insert: {
          asistio?: boolean
          id?: string
          id_empresa?: string | null
          id_evento: string
          id_usuario: string
          inscrito_en?: string
        }
        Update: {
          asistio?: boolean
          id?: string
          id_empresa?: string | null
          id_evento?: string
          id_usuario?: string
          inscrito_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_eventos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_eventos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "inscripciones_eventos_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "inscripciones_eventos_id_evento_fkey"
            columns: ["id_evento"]
            isOneToOne: false
            referencedRelation: "asistencia_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_eventos_id_evento_fkey"
            columns: ["id_evento"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_eventos_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insignias: {
        Row: {
          activa: boolean
          creado_en: string
          criterio: string
          descripcion: string
          icono: string | null
          id: string
          id_area: string | null
          meta: number
          nivel: number
          nombre: string
          roles: Database["public"]["Enums"]["rol_usuario"][] | null
        }
        Insert: {
          activa?: boolean
          creado_en?: string
          criterio: string
          descripcion: string
          icono?: string | null
          id?: string
          id_area?: string | null
          meta?: number
          nivel?: number
          nombre: string
          roles?: Database["public"]["Enums"]["rol_usuario"][] | null
        }
        Update: {
          activa?: boolean
          creado_en?: string
          criterio?: string
          descripcion?: string
          icono?: string | null
          id?: string
          id_area?: string | null
          meta?: number
          nivel?: number
          nombre?: string
          roles?: Database["public"]["Enums"]["rol_usuario"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "insignias_id_area_fkey"
            columns: ["id_area"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      insignias_usuario: {
        Row: {
          id_insignia: string
          id_usuario: string
          otorgada_en: string
          otorgada_por: string | null
        }
        Insert: {
          id_insignia: string
          id_usuario: string
          otorgada_en?: string
          otorgada_por?: string | null
        }
        Update: {
          id_insignia?: string
          id_usuario?: string
          otorgada_en?: string
          otorgada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insignias_usuario_id_insignia_fkey"
            columns: ["id_insignia"]
            isOneToOne: false
            referencedRelation: "insignias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insignias_usuario_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insignias_usuario_otorgada_por_fkey"
            columns: ["otorgada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes: {
        Row: {
          contenido: string
          creado_en: string
          editado_en: string | null
          id: string
          id_autor: string
          id_canal: string
          id_respuesta_a: string | null
        }
        Insert: {
          contenido: string
          creado_en?: string
          editado_en?: string | null
          id?: string
          id_autor?: string
          id_canal: string
          id_respuesta_a?: string | null
        }
        Update: {
          contenido?: string
          creado_en?: string
          editado_en?: string | null
          id?: string
          id_autor?: string
          id_canal?: string
          id_respuesta_a?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_id_autor_fkey"
            columns: ["id_autor"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_id_canal_fkey"
            columns: ["id_canal"]
            isOneToOne: false
            referencedRelation: "canales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_id_respuesta_a_fkey"
            columns: ["id_respuesta_a"]
            isOneToOne: false
            referencedRelation: "mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          creado_en: string
          cuerpo: string | null
          enlace: string | null
          id: string
          id_referencia: string | null
          id_usuario: string
          leida_en: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          creado_en?: string
          cuerpo?: string | null
          enlace?: string | null
          id?: string
          id_referencia?: string | null
          id_usuario: string
          leida_en?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          creado_en?: string
          cuerpo?: string | null
          enlace?: string | null
          id?: string
          id_referencia?: string | null
          id_usuario?: string
          leida_en?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_en: string
          avatar: Json
          creado_en: string
          documento_identidad: string | null
          estado_acceso: Database["public"]["Enums"]["estado_acceso"]
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          sexo: Database["public"]["Enums"]["sexo"] | null
        }
        Insert: {
          actualizado_en?: string
          avatar?: Json
          creado_en?: string
          documento_identidad?: string | null
          estado_acceso?: Database["public"]["Enums"]["estado_acceso"]
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sexo?: Database["public"]["Enums"]["sexo"] | null
        }
        Update: {
          actualizado_en?: string
          avatar?: Json
          creado_en?: string
          documento_identidad?: string | null
          estado_acceso?: Database["public"]["Enums"]["estado_acceso"]
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          sexo?: Database["public"]["Enums"]["sexo"] | null
        }
        Relationships: []
      }
      planes_accion: {
        Row: {
          actualizado_en: string
          area: string | null
          creado_en: string
          creado_por: string | null
          es_ejemplo: boolean
          estado: string
          fecha_inicio: string
          fecha_limite: string | null
          id: string
          id_diagnostico: string | null
          id_empresa: string
          id_responsable: string
          objetivo: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          area?: string | null
          creado_en?: string
          creado_por?: string | null
          es_ejemplo?: boolean
          estado?: string
          fecha_inicio?: string
          fecha_limite?: string | null
          id?: string
          id_diagnostico?: string | null
          id_empresa: string
          id_responsable: string
          objetivo?: string | null
          titulo: string
        }
        Update: {
          actualizado_en?: string
          area?: string | null
          creado_en?: string
          creado_por?: string | null
          es_ejemplo?: boolean
          estado?: string
          fecha_inicio?: string
          fecha_limite?: string | null
          id?: string
          id_diagnostico?: string | null
          id_empresa?: string
          id_responsable?: string
          objetivo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "planes_accion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_accion_id_diagnostico_fkey"
            columns: ["id_diagnostico"]
            isOneToOne: false
            referencedRelation: "diagnosticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "planes_accion_id_responsable_fkey"
            columns: ["id_responsable"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "postulaciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postulaciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "postulaciones_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
        ]
      }
      progreso_onboarding: {
        Row: {
          actualizado_en: string
          completado_en: string | null
          id_usuario: string
          paso_actual: number
          pasos_completados: string[]
        }
        Insert: {
          actualizado_en?: string
          completado_en?: string | null
          id_usuario?: string
          paso_actual?: number
          pasos_completados?: string[]
        }
        Update: {
          actualizado_en?: string
          completado_en?: string | null
          id_usuario?: string
          paso_actual?: number
          pasos_completados?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "progreso_onboarding_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_docentes: {
        Row: {
          asignado_en: string
          id_docente: string
          id_proyecto: string
        }
        Insert: {
          asignado_en?: string
          id_docente: string
          id_proyecto: string
        }
        Update: {
          asignado_en?: string
          id_docente?: string
          id_proyecto?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_docentes_id_docente_fkey"
            columns: ["id_docente"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_docentes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_docentes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "resumen_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_estudiantes: {
        Row: {
          asignado_en: string
          id_estudiante: string
          id_proyecto: string
        }
        Insert: {
          asignado_en?: string
          id_estudiante: string
          id_proyecto: string
        }
        Update: {
          asignado_en?: string
          id_estudiante?: string
          id_proyecto?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_estudiantes_id_estudiante_fkey"
            columns: ["id_estudiante"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_estudiantes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "proyectos_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_estudiantes_id_proyecto_fkey"
            columns: ["id_proyecto"]
            isOneToOne: false
            referencedRelation: "resumen_proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos_aula: {
        Row: {
          actualizado_en: string
          area_intervenida: string | null
          asignatura_heredada: string | null
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
          asignatura_heredada?: string | null
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
          asignatura_heredada?: string | null
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
          {
            foreignKeyName: "proyectos_aula_id_asignatura_fkey"
            columns: ["id_asignatura"]
            isOneToOne: false
            referencedRelation: "asignaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_aula_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_aula_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "proyectos_aula_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
        ]
      }
      puntos_movimientos: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: number
          id_usuario: string
          motivo: string
          origen_id: string | null
          origen_tipo: string
          puntos: number
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: never
          id_usuario: string
          motivo: string
          origen_id?: string | null
          origen_tipo: string
          puntos: number
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: never
          id_usuario?: string
          motivo?: string
          origen_id?: string | null
          origen_tipo?: string
          puntos?: number
        }
        Relationships: [
          {
            foreignKeyName: "puntos_movimientos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_movimientos_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recompensas: {
        Row: {
          activa: boolean
          aprobada_por: string | null
          costo_puntos: number
          creado_en: string
          descripcion: string | null
          id: string
          nombre: string
          stock: number | null
        }
        Insert: {
          activa?: boolean
          aprobada_por?: string | null
          costo_puntos: number
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre: string
          stock?: number | null
        }
        Update: {
          activa?: boolean
          aprobada_por?: string | null
          costo_puntos?: number
          creado_en?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recompensas_aprobada_por_fkey"
            columns: ["aprobada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sectores: {
        Row: {
          nombre: string
        }
        Insert: {
          nombre: string
        }
        Update: {
          nombre?: string
        }
        Relationships: []
      }
      solicitudes_acceso: {
        Row: {
          comentario_revision: string | null
          confianza_ia: number | null
          correo: string
          creado_en: string
          estado: Database["public"]["Enums"]["estado_acceso"]
          id: string
          id_perfil: string
          justificacion_ia: string | null
          motivo: string | null
          recomendacion_ia: Database["public"]["Enums"]["estado_acceso"] | null
          revisado_en: string | null
          revisado_por: string | null
          revisor_tipo: string | null
          rol_solicitado: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          comentario_revision?: string | null
          confianza_ia?: number | null
          correo: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_acceso"]
          id?: string
          id_perfil: string
          justificacion_ia?: string | null
          motivo?: string | null
          recomendacion_ia?: Database["public"]["Enums"]["estado_acceso"] | null
          revisado_en?: string | null
          revisado_por?: string | null
          revisor_tipo?: string | null
          rol_solicitado?: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          comentario_revision?: string | null
          confianza_ia?: number | null
          correo?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["estado_acceso"]
          id?: string
          id_perfil?: string
          justificacion_ia?: string | null
          motivo?: string | null
          recomendacion_ia?: Database["public"]["Enums"]["estado_acceso"] | null
          revisado_en?: string | null
          revisado_por?: string | null
          revisor_tipo?: string | null
          rol_solicitado?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_acceso_id_perfil_fkey"
            columns: ["id_perfil"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_acceso_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_actividad: {
        Row: {
          nombre: string
        }
        Insert: {
          nombre: string
        }
        Update: {
          nombre?: string
        }
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
        Row: {
          atenciones: number | null
          empresas_unicas: number | null
          semestre: string | null
        }
        Relationships: []
      }
      avance_planes: {
        Row: {
          area: string | null
          avance: number | null
          compromisos: number | null
          cumplidos: number | null
          empresa: string | null
          estado: string | null
          fecha_inicio: string | null
          fecha_limite: string | null
          id: string | null
          id_empresa: string | null
          id_responsable: string | null
          responsable: string | null
          titulo: string | null
          vencidos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_a"]
          },
          {
            foreignKeyName: "planes_accion_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "posibles_duplicados"
            referencedColumns: ["id_empresa_b"]
          },
          {
            foreignKeyName: "planes_accion_id_responsable_fkey"
            columns: ["id_responsable"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
        Insert: {
          actividad?: string | null
          categoria?: string | null
          creado_en?: string | null
          detalle?: string | null
          duracion_dias?: never
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string | null
          responsable?: string | null
          situacion?: never
        }
        Update: {
          actividad?: string | null
          categoria?: string | null
          creado_en?: string | null
          detalle?: string | null
          duracion_dias?: never
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string | null
          responsable?: string | null
          situacion?: never
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
      linea_tiempo_empresa: {
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
        Row: {
          eventos_asistidos: number | null
          id_usuario: string | null
          insignias: number | null
          puntos: number | null
          saldo: number | null
        }
        Relationships: [
          {
            foreignKeyName: "puntos_movimientos_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
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
      correos_cde: { Args: never; Returns: { correo: string; nombre: string }[] }
      avatares: {
        Args: never
        Returns: { avatar: Json; id: string; nombre: string; rol: Database["public"]["Enums"]["rol_usuario"] }[]
      }
      guardar_avatar: { Args: { avatar: Json }; Returns: Json }
      acceso_aprobado: { Args: never; Returns: boolean }
      asignaturas_del_docente: { Args: never; Returns: string[] }
      compromisos_editables: { Args: never; Returns: string[] }
      cupos_eventos: {
        Args: never
        Returns: {
          cupo: number
          disponibles: number
          id_evento: string
          inscritos: number
        }[]
      }
      directorio: {
        Args: never
        Returns: {
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }[]
      }
      es_admin: { Args: never; Returns: boolean }
      es_cde: { Args: never; Returns: boolean }
      es_correo_institucional: { Args: { correo: string }; Returns: boolean }
      mis_empresas: { Args: never; Returns: string[] }
      notificar: {
        Args: {
          cuerpo: string
          destino: string
          enlace: string
          tipo: string
          titulo: string
        }
        Returns: undefined
      }
      otorgar_insignias: { Args: { usuario: string }; Returns: undefined }
      personas_de_empresa: { Args: { empresa: string }; Returns: string[] }
      planes_visibles: { Args: never; Returns: string[] }
      proyectos_del_docente: { Args: never; Returns: string[] }
      proyectos_del_estudiante: { Args: never; Returns: string[] }
      puede_ver_canal: { Args: { canal: string }; Returns: boolean }
      ranking_puntos: {
        Args: { limite?: number }
        Returns: {
          id: string
          insignias: number
          nombre: string
          posicion: number
          puntos: number
          rol: Database["public"]["Enums"]["rol_usuario"]
        }[]
      }
      rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
    }
    Enums: {
      estado_acceso: "pendiente" | "aprobado" | "rechazado"
      estado_proyecto: "Planeado" | "En curso" | "Finalizado" | "Cancelado"
      rol_usuario:
        | "admin_cde"
        | "cde"
        | "emprendedor"
        | "docente"
        | "estudiante"
      sexo: "Femenino" | "Masculino"
      tamano_empresa:
        | "Emprendimiento"
        | "Micro"
        | "Pequeña"
        | "Mediana"
        | "Grande"
      vinculo_unab:
        | "Externo"
        | "Estudiante"
        | "Graduado"
        | "Colaborador"
        | "Emprendedor"
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

/** Fila para insertar: TablesInsert<"empresas"> */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      estado_acceso: ["pendiente", "aprobado", "rechazado"],
      estado_proyecto: ["Planeado", "En curso", "Finalizado", "Cancelado"],
      rol_usuario: ["admin_cde", "cde", "emprendedor", "docente", "estudiante"],
      sexo: ["Femenino", "Masculino"],
      tamano_empresa: ["Emprendimiento", "Micro", "Pequeña", "Mediana", "Grande"],
      vinculo_unab: ["Externo", "Estudiante", "Graduado", "Colaborador", "Emprendedor"],
    },
  },
} as const
