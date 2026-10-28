# Plan de juego · UNAB Venture Challenge 2026

**Reto:** "De datos dispersos a conocimiento que innova" · **Cliente:** CDE UNAB
**Desarrollo:** mié 28 oct 10:00 a. m. → jue 29 oct 9:00 a. m. (≈ 23 h) · **Pitch:** 5 min + 5 min de preguntas
**Premio:** 50 % de la matrícula del próximo semestre para cada integrante.

---

## 1. Cómo se gana (y dónde poner las horas)

| Criterio | Pts | Quién califica | Qué implica para nosotros |
|---|---|---|---|
| Funcionalidad | **60** | 3 jurados técnicos | Demo **en vivo** con datos reales/creíbles, flujos completos de punta a punta, **automatización visible** y evidencia de **ISO/IEC 25010** (sección 6). |
| Innovación y diferenciación | 15 | Jurado en pleno | Depuración inteligente de duplicados + QR de asistencia + asistente IA sobre los datos + gamificación con recompensas reales. |
| Modelo de negocio | 15 | 2 jurados de negocio | "Replicable, escalable y **vendible**": SaaS para otros centros de emprendimiento (sección 8). |
| Equipo | 10 | Jurado en pleno | Interdisciplinario, todos hablan en el pitch, roles claros. |

**Desempate:** gana quien tenga más en Funcionalidad. → Ante cualquier duda, **la herramienta funcionando manda**.

Reglas clave: el pitch es obligatorio; **no replantear el problema** en el pitch (el CDE ya lo definió); tiempo estricto de 5 min; llevar computadores propios.

---

## 2. Alcance priorizado

La regla: **pocos módulos completos > muchos a medias**. Cada P0 debe funcionar de punta a punta antes de tocar un P1.

### P0 — Validación 1 (5:00 p. m. de hoy)
1. **Empresas (ficha 360°)**: listado con búsqueda y filtros (sector, tamaño, formalización, municipio, vínculo UNAB) + ficha con **línea de tiempo del historial** (vista `historial_empresa`). → *"historial completo en < 1 minuto"*.
2. **Importar y depurar**: subir el Excel/CSV del CDE → vista previa → validación de NIT con DV → **detección de duplicados** (NIT, correo, celular, nombre parecido) → fusionar. Demo con `app/data/demo/base_cde_sucia.csv`. → *"no existen empresas duplicadas"*.
3. **Planes de acción y proyectos de aula**: tablero de compromisos con responsable, fecha, avance (%) y estado; vencidos marcados solos.
4. **Dashboard de conocimiento** (básico): empresas por sector/tamaño/formalización, **calidad de datos** (% con sector, tamaño…), brechas por dimensión del diagnóstico.

### P1 — Noche (para Validación 2, 8:00 a. m.)
5. **Eventos + QR**: publicar evento → inscripción → correo con QR (`qrcode`) → escaneo con celular (`html5-qrcode`) → **inscritos vs. asistentes** (vista `asistencia_eventos`) + sumar puntos al asistir.
6. **Citas**: solicitud desde el portal → agenda → **recordatorio automático por correo** (Resend + Vercel Cron, ya hecho en `app/src/app/api/cron/recordatorios/route.ts`).
7. **Formación por recompensas**: microcurso (video + quiz) → puntos → nivel (Semilla → Explorador → Constructor → Escalador) → insignias → ranking → canjear recompensa. `canvas-confetti` al subir de nivel.
8. **Portal del emprendedor**: su etapa, compromisos pendientes, puntos/nivel, eventos recomendados.

### P2 — Si sobra tiempo (diferenciadores "wow")
9. **Asistente IA (API de Claude)**: "¿Cuáles son las mayores brechas del sector Alimentos?" → responde con datos reales. Resumen automático del historial de una empresa. Solo lectura.
10. **Recomendación de eventos** según brechas del diagnóstico (empresa con baja puntuación digital → "IA para tu negocio").
11. **Mapa** de empresas por municipio de Santander (Leaflet).
12. **Reporte de impacto** en un clic (PDF/Excel exportable).
13. Login con cuenta institucional (Microsoft/Google vía Supabase Auth).

### Trazabilidad: cada "Cómo sabremos que el reto se resolvió" del CDE → funcionalidad

| Criterio de éxito del CDE | Dónde se demuestra |
|---|---|
| Historial completo de una empresa en < 1 min | Ficha 360° + búsqueda (P0-1) |
| Caracterizar por sector, tamaño, ingresos, formalización sin consolidar a mano | Dashboard (P0-4) |
| Cada plan de acción con responsable, estado y avance | Tablero de planes (P0-3) |
| Inscritos vs. asistentes y quiénes son | Eventos + QR (P1-5) |
| El emprendedor ve su acompañamiento y la oferta sin preguntar | Portal (P1-8) |
| Recordatorios y citas sin trabajo manual | Cron + Resend (P1-6) |
| Nada sin empresa asociada, sin duplicados | Llaves foráneas obligatorias + importador (P0-2) |
| Reportes de impacto sin consolidación manual | Dashboard + exportar (P0-4 / P2-12) |
| Experiencia intuitiva y divertida | Gamificación (P1-7) |
| Responder preguntas de investigación con sus datos | Vista `brechas_sector` + asistente IA (P2-9) |

---

## 3. Lo que ya está listo en el repo (`app/`)

- **Next.js 15 + TypeScript + Tailwind 4**, con navegación de los 9 módulos. `npm run build` y `npm run lint` pasan.
- **Esquema completo de Supabase/Postgres** en `app/supabase/migrations/0001_schema.sql`, probado en Postgres 16:
  - Todo cuelga de `empresas` (citas, proyectos, planes, eventos, diagnósticos: llave foránea obligatoria).
  - Duplicados: normalización (sin tildes, sin "S.A.S.", minúsculas) + `pg_trgm`, vista `posibles_duplicados`, campo `fusionada_en`.
  - Roles (`admin_cde`, `asesor_cde`, `docente`, `consultor`, `emprendedor`) con **Row Level Security**: el emprendedor solo ve lo suyo.
  - **Auditoría** automática de cambios (tabla `auditoria`).
  - Consentimiento de **Ley 1581** en `personas`.
  - Gamificación: microcursos, quiz, puntos (libro de movimientos), niveles, insignias, recompensas, vista `ranking`.
  - Vistas de conocimiento: `historial_empresa`, `asistencia_eventos`, `brechas_sector`, `calidad_datos`.
- **Datos de demo** (`npm run datos`): 180 empresas ficticias con la distribución real de sectores del CDE, municipios de Santander, diagnósticos en dos semestres (para mostrar **evolución**), proyectos integradores, planes, citas, 8 eventos con asistencia ≈ 60 %, microcursos y recompensas. + `data/demo/base_cde_sucia.csv` (66 filas sucias con duplicados, NIT en 4 formatos y un DV inválido) para la demo del importador.
- **Lógica probada** (`npm test`, 7 pruebas): validación de NIT con DV DIAN (`src/lib/nit.ts`), detección y agrupación de duplicados (`src/lib/duplicados.ts`).
- **Recordatorios automáticos**: `/api/cron/recordatorios` (citas de mañana por correo + marca compromisos vencidos), programado en `vercel.json`.

### Puesta en marcha (15 min, antes de las 10:00)
1. Crear proyecto en [supabase.com](https://supabase.com) → SQL Editor → pegar `0001_schema.sql` → luego `seed.sql`.
2. `cp app/.env.example app/.env.local` y llenar llaves (Supabase, Resend, Anthropic).
3. `cd app && npm install && npm run dev`.
4. Conectar el repo a Vercel (importar carpeta `app/`) y copiar las mismas variables de entorno.
5. Opcional en sus portátiles: `npx shadcn@latest init` para componentes (en este entorno estaba bloqueado).

---

## 4. Cronograma interno

| Hora | Qué | Entregable |
|---|---|---|
| 8:30–10:00 | Sesión con el CDE: hacer las preguntas priorizadas (sección 10) y **anotar respuestas** | Ajustar alcance |
| 10:00–10:30 | Supabase + Vercel arriba, todos corriendo en local | URL pública vacía funcionando |
| 10:30–12:00 | Empresas (lista + ficha) · Importador · Diseño de pantallas | Ficha 360° navegable |
| 12:00–2:00 | Almuerzo **por turnos** (no parar los 4 a la vez) · Negocio arranca el lienzo del modelo | — |
| 2:00–4:30 | Planes de acción · Dashboard · Deduplicación conectada a BD | P0 completo |
| 4:30–5:00 | Congelar, probar el recorrido de la demo de Validación 1 | — |
| **5:00** | **Validación 1** (5 min): mostrar P0 y **preguntar qué priorizan** | Feedback del CDE |
| 5:30–9:00 p. m. | Eventos + QR · Citas + recordatorios · Gamificación | P1 a medias |
| 9:00 p. m.–2:00 a. m. | Terminar P1 · Portal del emprendedor · Pitch v1 | P1 completo |
| 2:00–6:00 a. m. | P2 (IA, recomendaciones) · **turnos de sueño** · ensayo del pitch | — |
| 6:00–8:00 | **Congelar código a las 7:30.** Solo arreglos. Grabar video de respaldo de la demo | Demo estable |
| **8:00** | **Validación 2** | — |
| 8:30–9:00 | Ensayar pitch 3 veces con cronómetro | — |
| **9:00** | **Cierre:** entregar URL + repo + presentación | — |

---

## 5. Roles (orientadores; uno puede cubrir varios)

- **Tecnología (backend/datos):** Supabase, importador, deduplicación, cron, IA.
- **Tecnología (frontend):** pantallas, dashboard, QR, gamificación.
- **Usuario y diseño:** recorridos, textos, pruebas con usuarios (pedir a otro equipo/al CDE que pruebe), consistencia visual.
- **Negocio y pitch:** modelo de negocio, costos, presentación, guion, respuestas al jurado, cronómetro.

**Todos** deben aparecer en el pitch (cuenta para "Equipo", 10 pts).

---

## 6. ISO/IEC 25010: evidencia para los jurados técnicos

Llevar una diapositiva con esta tabla: los jurados la buscan explícitamente.

| Característica | Evidencia en nuestra solución |
|---|---|
| Adecuación funcional | Cada criterio de éxito del CDE tiene una funcionalidad (tabla de trazabilidad, sección 2). |
| Eficiencia de desempeño | Postgres con índices (trigramas GIN, únicos parciales), vistas agregadas y paginación para crecer en empresas, eventos y usuarios. |
| Compatibilidad | Importa/exporta Excel y CSV; API REST de Supabase; correo estándar; integración con Google/Microsoft. |
| Capacidad de interacción | Interfaz en español, validación en formularios (NIT con DV), vista previa antes de importar, gamificación, diseño responsive para celular. |
| Fiabilidad | Servicio gestionado con respaldos diarios (Supabase), transacciones, despliegue en Vercel con *rollback*. |
| Seguridad | Autenticación, **RLS por rol**, auditoría de todas las acciones, llave de servicio solo en servidor, consentimiento Ley 1581. |
| Mantenibilidad | Módulos separados, TypeScript, migraciones SQL versionadas, pruebas automáticas (`npm test`). |
| Flexibilidad | Se despliega en la nube o *on-premise* (Postgres estándar + Next.js); multi-institución por diseño. |
| Protección (safety) | Fusionar duplicados no borra (marca `fusionada_en`), confirmaciones antes de acciones masivas, IA solo de lectura. |

---

## 7. Gamificación (formación por recompensas)

- **Ganan puntos por:** completar microcurso (+100), asistir a evento escaneando QR (+50), cumplir compromiso del plan (+75), **completar datos del perfil** (+100).
  → Truco clave para el pitch: *la gamificación también arregla la calidad de datos* (hoy solo el 36 % tiene sector registrado; el emprendedor lo completa a cambio de puntos).
- **Niveles:** Semilla (0) → Explorador (200) → Constructor (700) → Escalador (1500).
- **Insignias:** Primer paso, Empresa formal, Siempre presente, Cumplidor, Aprendiz.
- **Recompensas reales del CDE** (confirmar en la sesión): certificado, prioridad en asesorías, mentoría 1:1, stand en la feria.
- **Ranking** por sector/cohorte (sano, no solo global).

---

## 8. Modelo de negocio y sostenibilidad (15 pts)

- **Propuesta de valor:** el CDE pasa de reaccionar a anticiparse: libera horas de trabajo operativo, demuestra impacto con evidencia y se vuelve centro de investigación del tejido empresarial de Santander.
- **Para la UNAB:** informes de impacto para acreditación (CNA), convocatorias y aliados; datos para investigación y nuevos programas; fideliza graduados emprendedores.
- **Implementación en la UNAB:** fase 1 piloto con el CDE (1 semestre) → fase 2 docentes y proyectos de aula → fase 3 portal abierto a emprendedores. Lo mantiene un semillero / práctica de Ingeniería de Sistemas + TI.
- **Costos de operación (aprox.):** Supabase Pro ≈ USD 25/mes, Vercel Pro ≈ USD 20/mes, Resend ≈ USD 0–20/mes, IA ≈ USD 10–30/mes → **menos de USD 100/mes** (cerca de $400 mil COP).
- **Escalable y vendible:** SaaS multi-institución para centros de emprendimiento de otras universidades, Cámaras de Comercio, incubadoras, alcaldías (secretarías de desarrollo económico). Licencia anual por institución + implementación. La UNAB conserva la propiedad y recibe regalías.
- **Posicionamiento:** "El CRM del ecosistema emprendedor universitario": hecho en Santander, en español, para el flujo real de un CDE (diagnóstico → proyecto de aula → plan → seguimiento), no un CRM de ventas genérico.
- **Diferenciación vs. alternativas** (Excel/Forms, HubSpot/Salesforce, plataformas de incubadoras): integrado de punta a punta, depuración automática de datos, gamificación con recompensas, IA sobre sus propios datos, costo bajo.

---

## 9. Pitch: guion de 5 minutos

| Tiempo | Quién | Contenido |
|---|---|---|
| 0:00–0:20 | Estrategia | Gancho: "497 empresas, 1 sola vista". Nombre y propuesta de valor en una frase. **No** volver a explicar el problema. |
| 0:20–2:50 | Tecnología + Diseño | **Demo en vivo**: buscar empresa → historial en segundos → importar Excel sucio → duplicados detectados y fusionados → plan de acción → evento con QR escaneado en vivo con el celular → sube de nivel con confeti → (IA responde una pregunta de investigación). |
| 2:50–3:20 | Tecnología | Diapositiva ISO 25010 + seguridad (RLS, auditoría, Ley 1581). |
| 3:20–4:30 | Negocio | Modelo de negocio, costos < USD 100/mes, implementación en la UNAB, escalabilidad SaaS, posicionamiento y diferenciador. |
| 4:30–5:00 | Todos | Equipo (quién hizo qué) + cierre: valor para la UNAB. |

**Plan B:** video grabado de la demo (2:30 min) por si falla el internet o el proyector.

### Preguntas probables del jurado
- *¿Cómo garantizan que no haya duplicados?* → Restricciones únicas por NIT/documento/correo + similitud por trigramas + revisión humana antes de fusionar; fusionar no borra.
- *¿Qué pasa con negocios informales sin NIT?* → Se identifican por documento del emprendedor/correo/celular y nombre; se completan al formalizarse.
- *¿Cómo protegen datos personales?* → Consentimiento Ley 1581, RLS por rol, auditoría, llaves solo en servidor.
- *¿Quién lo mantiene cuando termine la hackatón?* → Semillero/práctica + TI; código modular y documentado; costo bajo.
- *¿Por qué no usar HubSpot o Excel?* → Costo, idioma, flujo académico (proyectos de aula, diagnósticos), gamificación e investigación no existen allí.
- *¿Escala a miles de empresas?* → Postgres con índices; el costo crece poco; multi-institución.
- *¿Cómo se gana dinero?* → Licencia SaaS para otras instituciones; la UNAB ahorra horas de su equipo.

---

## 10. Preguntas para el CDE (8:30–10:00)

Ver el documento "Preguntas al CDE y herramientas digitales". Las tres más importantes:
1. Si el sistema solo pudiera hacer **tres cosas bien** desde el primer día, ¿cuáles serían?
2. ¿Qué tarea manual les quita **más horas** a la semana?
3. ¿Qué esperan ver en la **Validación 1**? ¿Pocos módulos completos o muchos básicos?

Además: archivo de ejemplo anonimizado · preguntas del diagnóstico de madurez y cómo se calcula el nivel · identificador de empresa (NIT / cédula / correo) · ¿se permite IA y servicios externos? · formato del material del pitch.

**Respuestas (llenar durante la sesión):**
- …

---

## 11. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Internet de la sede inestable | Datos de celular como respaldo; video de demo grabado; app corre en local. |
| Cuenta nueva de Resend solo envía al correo propio | Para la demo usar el correo del equipo, o verificar un dominio. |
| Querer hacerlo todo | Respetar P0 → P1 → P2; congelar a las 7:30 a. m. |
| Cansancio | Turnos de sueño de 2 h desde las 2:00 a. m.; nunca dejar la demo sin probar. |
| No se permite IA externa | La IA es P2: se quita sin afectar el resto. |
