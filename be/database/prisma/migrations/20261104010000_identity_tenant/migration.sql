BEGIN;

-- Managed PostgreSQL may already have citext in its extensions schema.
SELECT set_config('search_path', format('%I,%I', current_schema(), n.nspname), true)
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
WHERE e.extname = 'citext';

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medtender_app') THEN
    CREATE ROLE medtender_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles AS role
    WHERE role.rolname = 'medtender_app'
      AND (
        role.rolsuper OR role.rolbypassrls OR role.rolcreaterole OR role.rolcreatedb
        OR role.rolreplication
        OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = role.oid)
      )
  ) THEN
    RAISE EXCEPTION 'medtender_app must be an unprivileged runtime role without role memberships';
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO medtender_app', current_schema());
END
$role$;

CREATE TYPE organization_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE membership_status AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE membership_role AS ENUM ('OWNER', 'ADMIN', 'BID_MANAGER', 'ANALYST', 'CATALOG_MANAGER', 'REVIEWER', 'VIEWER');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text,
  auth_provider text NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status organization_status NOT NULL DEFAULT 'ACTIVE',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  role membership_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_memberships_user_id_status_idx ON organization_memberships(user_id, status);

REVOKE ALL ON users, organizations, organization_memberships FROM PUBLIC;
GRANT SELECT ON organizations TO medtender_app;
GRANT SELECT, INSERT ON organization_memberships TO medtender_app;
GRANT UPDATE (role, status) ON organization_memberships TO medtender_app;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_read ON organization_memberships
FOR SELECT TO medtender_app USING (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  OR (
    NULLIF(current_setting('app.org_id', true), '') IS NULL
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    AND status = 'ACTIVE'
  )
);

CREATE POLICY membership_insert ON organization_memberships
FOR INSERT TO medtender_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
);

CREATE POLICY membership_update ON organization_memberships
FOR UPDATE TO medtender_app USING (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
) WITH CHECK (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
);

CREATE POLICY organization_read ON organizations
FOR SELECT TO medtender_app USING (
  id = NULLIF(current_setting('app.org_id', true), '')::uuid
  OR (
    NULLIF(current_setting('app.org_id', true), '') IS NULL
    AND status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM organization_memberships AS membership
      WHERE membership.organization_id = organizations.id
        AND membership.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND membership.status = 'ACTIVE'
    )
  )
);

COMMIT;
