// Lo que el asistente sabe de la base. Solo tablas y columnas que el rol ia_lectura puede leer
// (sin documento de identidad, correos ni teléfonos de personas: Ley 1581 de 2012).
// Texto estable a propósito: va en el system prompt y se cachea.

export const ESQUEMA = `
Base PostgreSQL del Centro de Desarrollo Empresarial (CDE) de la UNAB, en Bucaramanga (Santander, Colombia).
Todas las tablas están en el esquema public. Fechas sin hora en zona America/Bogota.

TABLAS PRINCIPALES
- empresas(id uuid, nombre, nit (solo dígitos, sin DV), nit_dv, sector → sectores.nombre,
  tamano ('Emprendimiento','Micro','Pequeña','Mediana','Grande'), formalizacion ('Formal','En proceso','Informal' o null),
  municipio, departamento, vinculo_unab ('Externo','Estudiante','Graduado','Colaborador','Emprendedor' o null),
  descripcion, id_representante → perfiles.id, id_mentor → perfiles.id (miembro del CDE),
  datos_estimados text[] (campos inventados para la demo: 'sector' y/o 'tamano'), creado_en)
- sectores(nombre)
- contactos_empresa(id, id_empresa, id_perfil, nombre, cargo, es_principal)   -- sin correo ni teléfono
- ingresos_empresa(id, id_empresa, anio, monto numeric en pesos, fuente ('Reportado por la empresa','Verificado por el CDE'))
- postulaciones(id, id_empresa, origen, origen_registro, estado ('Seleccionadas','En proceso','Saldo disponible','Por aprobar','Finalizado'), creado_en)
- atenciones(id, id_empresa, tipo_actividad, semestre ('2026-1'…), fecha date, notas)   -- acompañamientos del CDE
- diagnosticos(id, id_empresa, fecha, tipo_iniciativa, estrategia, mercadeo_ventas, financiera, normativa_legal,
  productividad, transformacion_digital (cada área de 1 a 5), promedio, nivel ('Bajo','Medio','Alto'),
  es_ejemplo boolean (true = diagnóstico inventado para la demo))   -- una empresa puede tener varios: el primero es su línea base
- catalogo_brechas(id, area ('Productividad','Transformación digital','Gestión financiera','Gestión de mercadeo y ventas',
  'Legal - Normativo','Gestión estratégica','Seguridad y salud en el trabajo','Sostenibilidad',
  'Comercio exterior e internacionalización','Organización de estructura','Comunicación y clima organizacional','Otro'),
  eje_diagnostico (columna del diagnóstico relacionada o null), descripcion)
- brechas_empresa(id, id_empresa, id_brecha → catalogo_brechas.id, id_proyecto → proyectos_aula.id, semestre ('2026-1'…),
  detectada_en date, cerrada_en date (null = sigue abierta; con fecha = impacto logrado), evidencia, es_ejemplo boolean)
- planes_accion(id, id_empresa, id_diagnostico, titulo, objetivo,
  area ('estrategia','mercadeo_ventas','financiera','normativa_legal','productividad','transformacion_digital','otra'),
  id_responsable → perfiles.id, estado ('Pendiente','En curso','Completado','Cancelado'), fecha_inicio, fecha_limite,
  es_ejemplo boolean)
- compromisos(id, id_plan → planes_accion.id, descripcion, id_responsable → perfiles.id (null = el del plan),
  fecha_limite date, estado ('Pendiente','En curso','Cumplido','Cancelado'), avance 0-100, completado_en)
  Un compromiso está VENCIDO si estado in ('Pendiente','En curso') y fecha_limite < (now() at time zone 'America/Bogota')::date.
- proyectos_aula(id, id_empresa, nombre, id_asignatura → asignaturas.id, area_intervenida, semestre,
  estado ('Planeado','En curso','Finalizado','Cancelado'), descripcion, resultados, estudiantes_reportados, fecha_inicio)
- asignaturas(id, nombre); carga_docente(docente, asignatura, semestre, proyectos, estudiantes)
- proyecto_docentes(id_proyecto, id_docente); proyecto_estudiantes(id_proyecto, id_estudiante)
- perfiles(id, nombre, rol ('admin_cde','cde','emprendedor','docente','estudiante'), sexo)   -- usuarios del sistema
- citas(id, id_empresa, motivo, estado ('Solicitada','Agendada','Atendida','Cancelada','No asistió'), fecha_hora, id_miembro_cde)
- eventos(id, nombre, fecha (inicio), fin, tipo ('Evento','Capacitación','Ruta de acompañamiento','Sesión empresarial','Conversatorio',
  'Networking','Feria','Cita','Coworking'), lugar, cupo, puntos_gamificacion, creado_por (perfiles.id), es_ejemplo boolean)
- inscripciones_eventos(id, id_evento, id_usuario, id_empresa, asistio boolean, estado ('pendiente','confirmado','rechazado'),
  invitado_por)   -- estado = respuesta a la invitación; asistio = asistencia real
- actividades_cronograma(id, categoria, actividad, fecha_inicio, fecha_fin, estado, responsable)
- Gamificación: areas(nombre, puntos_por_aporte), aportes(id_proyecto, id_usuario, id_area, estado ('Pendiente','Validado','Rechazado')),
  insignias(nombre, nivel, criterio, meta), insignias_usuario(id_usuario, id_insignia), puntos_movimientos(id_usuario, puntos, motivo, origen_tipo),
  recompensas(nombre, costo_puntos, stock), canjes(id_recompensa, id_usuario, puntos, estado)

VISTAS ÚTILES
- historial_empresa(id_empresa, tipo ('atencion','proyecto_aula','cita','diagnostico','evento','plan_accion'), fecha, titulo, detalle, estado)
- resumen_proyectos(id, nombre, asignatura, semestre, estado, empresa, estudiantes)
- asistencia_eventos(id, nombre, fecha, inscritos, asistentes, tasa_asistencia)
- cierre_brechas(area, semestre, detectadas, cerradas, porcentaje_cerradas, empresas)   -- impacto por área y semestre
- evolucion_diagnosticos(id_empresa, diagnosticos, fecha_inicial, fecha_final, promedio_inicial, promedio_final, cambio_promedio,
  cambio_estrategia, cambio_mercadeo_ventas, cambio_financiera, cambio_normativa_legal, cambio_productividad,
  cambio_transformacion_digital, nivel_inicial, nivel_final, es_ejemplo)   -- solo empresas con 2+ diagnósticos
- atenciones_por_semestre(semestre, atenciones, empresas_unicas)
- cronograma(… de actividades_cronograma, duracion_dias, situacion)
- posibles_duplicados(id_empresa_a, nombre_a, nit_a, id_empresa_b, nombre_b, nit_b, similitud)
- puntos_usuario(id_usuario, puntos, eventos_asistidos, saldo, insignias)
`.trim();
