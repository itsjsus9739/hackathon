# Calendario CDE Conecta

Subpestaña tipo Google Calendar para el CDE UNAB: eventos, networking, conversatorios, citas y coworking, con permisos por rol y confirmación de asistencia. Backend en Python (Flask) como función serverless de Vercel; frontend en HTML + FullCalendar.

## Permisos por rol

| Tipo | Quién lo crea | Quién lo ve | A quién se puede invitar |
|---|---|---|---|
| Evento | Admin, Miembro CDE, Emprendedor | Todos (público) | Todos; además cualquiera puede inscribirse |
| Networking | Admin, Miembro CDE, Emprendedor | Todos (público) | Todos; además cualquiera puede inscribirse |
| Conversatorio | Admin, Profesor | Creador, invitados y admin | Miembros CDE, emprendedores, estudiantes, profesores, admin |
| Cita | Todos | Creador, invitados y admin | Todos |
| Coworking | Todos | Creador, invitados y admin | Todos |

- Editar, mover (arrastrar en el calendario) y eliminar: el creador o el administrador.
- El administrador ve todo y puede crear y eliminar cualquier actividad.
- Los invitados responden **Asistiré / No asistiré**; el organizador ve el conteo de confirmados, pendientes y rechazos.
- Las reglas viven en el diccionario `TYPES` de `api/index.py` (se cambian en un solo lugar y el frontend se adapta solo).

## Estructura

```
api/index.py              # API Flask + modelos + reglas de permisos
api/templates/index.html  # Interfaz (calendario, formularios, invitaciones)
requirements.txt
vercel.json
```

## Correr localmente

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python api/index.py
# abrir http://localhost:5000
```

Al iniciar se cargan 9 usuarios de demostración (uno o más por rol) y 6 actividades de ejemplo. En la pantalla inicial eliges con qué usuario entrar para mostrar cómo cambia el calendario según el rol.

## Integración con CDE Conecta (Next.js)

Este calendario vive en `calendario-cde/` en la raíz del repo y se despliega como un **proyecto de Vercel aparte**. La app Next.js (`app/`) lo muestra en `/agenda` dentro de un iframe que apunta a `/calendario`; `app/next.config.ts` reescribe `/calendario` y `/calendario/api/*` hacia la URL de este proyecto (variable `CALENDARIO_URL`). Así todo queda en el mismo dominio y la cookie de sesión de Flask funciona dentro del iframe.

1. En Vercel: **Add New → Project**, importa este mismo repo y en **Root Directory** elige `calendario-cde` (Framework Preset: Other).
2. Variables de entorno de ese proyecto: `SECRET_KEY` (cadena larga aleatoria) y, opcionalmente, `DATABASE_URL`.
3. Copia la URL de producción (p. ej. `https://cde-calendario.vercel.app`).
4. En el proyecto de la app Next.js agrega `CALENDARIO_URL` con esa URL y vuelve a desplegar (los rewrites se leen en el build).

## Desplegar en Vercel

```bash
npm i -g vercel
vercel          # primera vez: crea el proyecto
vercel --prod
```

O sube la carpeta a un repo de GitHub e impórtalo en vercel.com (framework: Other). Variables de entorno recomendadas en Vercel:

- `SECRET_KEY`: cualquier cadena larga aleatoria (firma la sesión).
- `DATABASE_URL` (opcional pero recomendado): cadena de Postgres de Vercel Postgres / Neon / Supabase. Si la usas, descomenta `psycopg2-binary` en `requirements.txt`.

**Importante:** sin `DATABASE_URL` la app usa SQLite en `/tmp`, que en Vercel es temporal: los datos se reinician cuando la función se "enfría" y cada instancia tiene su propia copia. Sirve para la demo, pero para el pitch con datos persistentes conecta Postgres (Neon tiene plan gratis y se enlaza desde el panel de Vercel en Storage).

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users` | Usuarios (demo) |
| POST | `/api/login` | `{user_id}` inicia sesión (demo) |
| GET | `/api/me` | Usuario actual y permisos por tipo |
| GET | `/api/events?start&end` | Actividades visibles para el usuario |
| POST | `/api/events` | Crear |
| PUT | `/api/events/<id>` | Editar (creador o admin) |
| DELETE | `/api/events/<id>` | Eliminar (creador o admin) |
| POST | `/api/events/<id>/rsvp` | `{status: "confirmado" \| "rechazado"}` |

Siguiente paso natural: reemplazar el selector de usuario por el login real (SSO UNAB / correo) y enviar recordatorios por correo de las citas.
