-- WorkClock: tabla de refresh tokens
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rt_token    ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_rt_empleado ON refresh_tokens(empleado_id);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role key (backend) puede leer/escribir
