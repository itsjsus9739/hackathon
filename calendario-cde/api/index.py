"""
CDE Nest - Calendario por roles (Flask, desplegable en Vercel).

Tipos de actividad: evento, networking, conversatorio, cita, coworking.
Roles: admin, miembro, profesor, emprendedor, estudiante.
"""
import os
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, template_folder=os.path.join(BASE_DIR, "templates"))
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "cde-dev-secret-cambiar")

# En Vercel el disco es efímero: para datos persistentes define DATABASE_URL
# (Vercel Postgres / Neon / Supabase). Sin ella se usa SQLite en /tmp (demo).
db_url = os.environ.get("DATABASE_URL", "sqlite:////tmp/cde_calendario.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Reglas de negocio (una sola fuente de verdad, también se envía al frontend)
# ---------------------------------------------------------------------------
ROLES = {
    "admin": "Administrador CDE",
    "miembro": "Miembro del CDE",
    "profesor": "Profesor",
    "emprendedor": "Emprendedor",
    "estudiante": "Estudiante",
}
ALL_ROLES = list(ROLES)

TYPES = {
    "evento": {"label": "Evento", "color": "#2563eb", "public": True,
               "creators": ["admin", "miembro", "emprendedor"],
               "attendee_roles": ALL_ROLES},
    "networking": {"label": "Networking", "color": "#9333ea", "public": True,
                   "creators": ["admin", "miembro", "emprendedor"],
                   "attendee_roles": ALL_ROLES},
    "conversatorio": {"label": "Conversatorio", "color": "#ea580c", "public": False,
                      "creators": ["admin", "profesor"],
                      "attendee_roles": ["miembro", "emprendedor", "estudiante", "profesor", "admin"]},
    "cita": {"label": "Cita", "color": "#16a34a", "public": False,
             "creators": ALL_ROLES, "attendee_roles": ALL_ROLES},
    "coworking": {"label": "Coworking", "color": "#0d9488", "public": False,
                  "creators": ALL_ROLES, "attendee_roles": ALL_ROLES},
}


def can_create(role, etype):
    return etype in TYPES and role in TYPES[etype]["creators"]


def can_manage(user, ev):
    """Editar / eliminar: el creador o el administrador."""
    return user.role == "admin" or ev.creator_id == user.id


def can_view(user, ev):
    if user.role == "admin" or TYPES[ev.type]["public"]:
        return True
    return ev.creator_id == user.id or any(a.user_id == user.id for a in ev.attendees)


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email,
                "role": self.role, "role_label": ROLES[self.role]}


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, default="")
    location = db.Column(db.String(200), default="")
    start = db.Column(db.DateTime, nullable=False)
    end = db.Column(db.DateTime, nullable=False)
    creator_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    creator = db.relationship("User")
    attendees = db.relationship("Attendee", cascade="all, delete-orphan", backref="event")

    def to_dict(self, viewer):
        mine = next((a for a in self.attendees if a.user_id == viewer.id), None)
        counts = {"confirmado": 0, "rechazado": 0, "pendiente": 0}
        for a in self.attendees:
            counts[a.status] += 1
        t = TYPES[self.type]
        return {
            "id": self.id, "title": self.title, "type": self.type,
            "type_label": t["label"], "color": t["color"], "public": t["public"],
            "description": self.description or "", "location": self.location or "",
            "start": self.start.isoformat(), "end": self.end.isoformat(),
            "creator": self.creator.to_dict(),
            "attendees": [{"user": a.user.to_dict(), "status": a.status} for a in self.attendees],
            "counts": counts,
            "my_status": mine.status if mine else None,
            "can_manage": can_manage(viewer, self),
        }


class Attendee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    status = db.Column(db.String(12), default="pendiente")  # pendiente | confirmado | rechazado
    user = db.relationship("User")
    __table_args__ = (db.UniqueConstraint("event_id", "user_id"),)


# ---------------------------------------------------------------------------
# Datos de demostración
# ---------------------------------------------------------------------------
SEED_USERS = [
    ("Laura Gómez", "admin@cde.unab.edu.co", "admin"),
    ("Carlos Rueda", "carlos.rueda@cde.unab.edu.co", "miembro"),
    ("Ana Pinzón", "ana.pinzon@cde.unab.edu.co", "miembro"),
    ("Dr. Jorge Silva", "jsilva@unab.edu.co", "profesor"),
    ("Mtra. Paula Ardila", "pardila@unab.edu.co", "profesor"),
    ("Sofía Mantilla (Café Andino)", "sofia@cafeandino.co", "emprendedor"),
    ("Andrés Duarte (AgroTech SAS)", "andres@agrotech.co", "emprendedor"),
    ("Valentina Ortiz", "vortiz@unab.edu.co", "estudiante"),
    ("Mateo Cáceres", "mcaceres@unab.edu.co", "estudiante"),
]

_ready = False


def init_db():
    global _ready
    if _ready:
        return
    db.create_all()
    if User.query.count() == 0:
        users = [User(name=n, email=e, role=r) for n, e, r in SEED_USERS]
        db.session.add_all(users)
        db.session.flush()
        u = {x.email.split("@")[0]: x for x in users}
        base = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        def mk(title, etype, day, h, dur, creator, desc="", loc="", att=()):
            ev = Event(title=title, type=etype, description=desc, location=loc,
                       start=base + timedelta(days=day, hours=h),
                       end=base + timedelta(days=day, hours=h + dur), creator=creator)
            for usr, st in att:
                ev.attendees.append(Attendee(user=usr, status=st))
            db.session.add(ev)

        mk("Feria de Emprendimiento UNAB", "evento", 2, 9, 4, u["admin"],
           "Muestra de emprendimientos de la comunidad UNAB.", "Plazoleta central")
        mk("Café de Networking: Agroindustria", "networking", 1, 16, 2, u["carlos.rueda"],
           "Conecta con empresas del sector agro de Santander.", "CDE - Sala 2",
           [(u["andres"], "confirmado"), (u["sofia"], "pendiente")])
        mk("Conversatorio: Finanzas para pymes", "conversatorio", 3, 10, 2, u["jsilva"],
           "Charla abierta sobre flujo de caja y formalización.", "Auditorio Mayor",
           [(u["sofia"], "confirmado"), (u["vortiz"], "pendiente"), (u["ana.pinzon"], "pendiente")])
        mk("Asesoría plan de negocio", "cita", 0, 14, 1, u["sofia"],
           "Revisión del modelo Canvas.", "CDE - Oficina 3",
           [(u["carlos.rueda"], "confirmado")])
        mk("Coworking proyecto de aula", "coworking", 4, 8, 3, u["vortiz"],
           "Trabajo en el prototipo para el reto CDE.", "Biblioteca piso 4",
           [(u["mcaceres"], "pendiente"), (u["pardila"], "pendiente")])
        mk("Rueda de negocios Santander", "networking", 7, 14, 3, u["andres"],
           "Encuentro entre emprendedores e inversionistas.", "Centro de Convenciones Neomundo")
        db.session.commit()
    _ready = True


@app.before_request
def _before():
    init_db()


# ---------------------------------------------------------------------------
# Sesión (demo: selector de usuario; en producción conectar con SSO UNAB)
# ---------------------------------------------------------------------------
def current_user():
    uid = session.get("uid")
    return db.session.get(User, uid) if uid else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        user = current_user()
        if not user:
            return jsonify(error="Debes iniciar sesión"), 401
        return fn(user, *a, **kw)
    return wrapper


def parse_dt(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "")[:19])
    except (AttributeError, ValueError):
        return None


@app.get("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


@app.get("/api/users")
def list_users():
    return jsonify([u.to_dict() for u in User.query.order_by(User.role, User.name)])


@app.post("/api/login")
def login():
    user = db.session.get(User, (request.json or {}).get("user_id"))
    if not user:
        return jsonify(error="Usuario no encontrado"), 404
    session["uid"] = user.id
    return jsonify(user.to_dict())


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
@login_required
def me(user):
    return jsonify({
        "user": user.to_dict(),
        "types": {k: {"label": v["label"], "color": v["color"], "public": v["public"],
                      "can_create": can_create(user.role, k),
                      "attendee_roles": v["attendee_roles"]} for k, v in TYPES.items()},
        "roles": ROLES,
    })


@app.get("/api/events")
@login_required
def list_events(user):
    q = Event.query
    start, end = parse_dt(request.args.get("start")), parse_dt(request.args.get("end"))
    if start:
        q = q.filter(Event.end >= start)
    if end:
        q = q.filter(Event.start <= end)
    return jsonify([e.to_dict(user) for e in q.order_by(Event.start) if can_view(user, e)])


def _apply_payload(ev, data, user, creating):
    title = (data.get("title") or "").strip()
    etype = data.get("type", ev.type if not creating else None)
    start, end = parse_dt(data.get("start")), parse_dt(data.get("end"))
    if not title:
        return "El título es obligatorio"
    if etype not in TYPES:
        return "Tipo de actividad inválido"
    if (creating or etype != ev.type) and not can_create(user.role, etype):
        return f"Tu rol ({ROLES[user.role]}) no puede crear actividades de tipo {TYPES[etype]['label']}"
    if not start or not end or end <= start:
        return "Revisa las fechas: la hora de fin debe ser posterior al inicio"

    ids = {int(i) for i in data.get("attendees", []) if str(i).isdigit()} - {ev.creator_id or user.id}
    allowed = TYPES[etype]["attendee_roles"]
    invitees = User.query.filter(User.id.in_(ids)).all() if ids else []
    bad = [u.name for u in invitees if u.role not in allowed]
    if bad:
        return f"No puedes invitar a {', '.join(bad)} a una actividad de tipo {TYPES[etype]['label']}"

    ev.title, ev.type, ev.start, ev.end = title, etype, start, end
    ev.description = (data.get("description") or "").strip()
    ev.location = (data.get("location") or "").strip()
    # Sincroniza asistentes conservando el estado de quienes ya estaban
    current = {a.user_id: a for a in ev.attendees}
    for uid, att in current.items():
        if uid not in ids:
            ev.attendees.remove(att)
    for u in invitees:
        if u.id not in current:
            ev.attendees.append(Attendee(user=u, status="pendiente"))
    return None


@app.post("/api/events")
@login_required
def create_event(user):
    ev = Event(creator=user, creator_id=user.id)
    err = _apply_payload(ev, request.json or {}, user, creating=True)
    if err:
        return jsonify(error=err), 400
    db.session.add(ev)
    db.session.commit()
    return jsonify(ev.to_dict(user)), 201


@app.put("/api/events/<int:eid>")
@login_required
def update_event(user, eid):
    ev = db.session.get(Event, eid)
    if not ev or not can_view(user, ev):
        return jsonify(error="Actividad no encontrada"), 404
    if not can_manage(user, ev):
        return jsonify(error="Solo el creador o el administrador pueden editarla"), 403
    err = _apply_payload(ev, request.json or {}, user, creating=False)
    if err:
        db.session.rollback()
        return jsonify(error=err), 400
    db.session.commit()
    return jsonify(ev.to_dict(user))


@app.delete("/api/events/<int:eid>")
@login_required
def delete_event(user, eid):
    ev = db.session.get(Event, eid)
    if not ev or not can_view(user, ev):
        return jsonify(error="Actividad no encontrada"), 404
    if not can_manage(user, ev):
        return jsonify(error="Solo el creador o el administrador pueden eliminarla"), 403
    db.session.delete(ev)
    db.session.commit()
    return jsonify(ok=True)


@app.post("/api/events/<int:eid>/rsvp")
@login_required
def rsvp(user, eid):
    status = (request.json or {}).get("status")
    if status not in ("confirmado", "rechazado"):
        return jsonify(error="Estado inválido"), 400
    ev = db.session.get(Event, eid)
    if not ev or not can_view(user, ev):
        return jsonify(error="Actividad no encontrada"), 404
    att = next((a for a in ev.attendees if a.user_id == user.id), None)
    if not att:
        # En eventos y networking (públicos) cualquiera puede inscribirse
        if not TYPES[ev.type]["public"]:
            return jsonify(error="No estás invitado a esta actividad"), 403
        att = Attendee(user=user)
        ev.attendees.append(att)
    att.status = status
    db.session.commit()
    return jsonify(ev.to_dict(user))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
