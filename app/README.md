# CDE Conecta

Sistema integrado de gestión de la información del CDE UNAB (Hackatón Semana de Ingeniería 2026).
Plan completo, alcance y pitch: [`../PLAN_HACKATHON.md`](../PLAN_HACKATHON.md).

```bash
npm install
cp .env.example .env.local   # llenar llaves de Supabase, Resend y Anthropic
npm run dev                  # http://localhost:3000
npm test                     # pruebas (NIT/DV, duplicados)
npm run datos                # regenera supabase/seed.sql y data/demo/base_cde_sucia.csv
```

Base de datos: en el SQL Editor de Supabase ejecutar `supabase/migrations/0001_schema.sql` y luego `supabase/seed.sql`.
