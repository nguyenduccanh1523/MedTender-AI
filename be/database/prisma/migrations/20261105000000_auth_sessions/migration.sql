BEGIN;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX auth_sessions_user_id_expires_at_idx ON auth_sessions(user_id, expires_at);
REVOKE ALL ON auth_sessions FROM PUBLIC;
GRANT SELECT, INSERT ON auth_sessions TO medtender_app;
GRANT UPDATE (access_token_hash, refresh_token_hash, access_expires_at, revoked_at)
  ON auth_sessions TO medtender_app;
GRANT SELECT, INSERT ON users TO medtender_app;

ALTER TABLE organizations ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
GRANT INSERT ON organizations TO medtender_app;

-- The onboarding transaction must name the verified creator and its new organization.
CREATE POLICY organization_onboarding_insert ON organizations
FOR INSERT TO medtender_app WITH CHECK (
  id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND created_by_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
);

CREATE POLICY organization_onboarding_read ON organizations
FOR SELECT TO medtender_app USING (
  id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND created_by_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
);

CREATE POLICY membership_onboarding_insert ON organization_memberships
FOR INSERT TO medtender_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND role = 'OWNER' AND status = 'ACTIVE'
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
  AND EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_id AND organizations.created_by_user_id = user_id
  )
);

COMMIT;
