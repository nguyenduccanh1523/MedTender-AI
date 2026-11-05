BEGIN;

CREATE TYPE global_role AS ENUM ('SYSTEM_ADMIN');
CREATE TYPE organization_application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE users ADD COLUMN global_role global_role;

CREATE TABLE organization_applications (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  organization_name text NOT NULL,
  tax_code text NOT NULL,
  website text,
  address text NOT NULL,
  contact_name text NOT NULL,
  contact_email citext NOT NULL,
  contact_phone text NOT NULL,
  status organization_application_status NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  reviewed_at timestamptz,
  rejection_reason text,
  organization_id uuid UNIQUE REFERENCES organizations(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX organization_applications_status_created_at_idx ON organization_applications(status, created_at);
CREATE INDEX organization_applications_contact_email_status_idx ON organization_applications(contact_email, status);

CREATE TABLE account_activation_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX account_activation_tokens_user_id_expires_at_idx ON account_activation_tokens(user_id, expires_at);

REVOKE ALL ON organization_applications, account_activation_tokens FROM PUBLIC;
GRANT SELECT, INSERT ON organization_applications TO medtender_app;
GRANT UPDATE (status, reviewed_by_user_id, reviewed_at, rejection_reason, organization_id, updated_at) ON organization_applications TO medtender_app;
GRANT SELECT, INSERT ON account_activation_tokens TO medtender_app;
GRANT UPDATE (used_at) ON account_activation_tokens TO medtender_app;

ALTER TABLE organization_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE account_activation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_activation_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY application_public_create ON organization_applications FOR INSERT TO medtender_app WITH CHECK (
  status = 'PENDING' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL AND organization_id IS NULL
);
CREATE POLICY application_system_admin_read ON organization_applications FOR SELECT TO medtender_app USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
);
CREATE POLICY application_system_admin_update ON organization_applications FOR UPDATE TO medtender_app USING (
  status = 'PENDING' AND EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
) WITH CHECK (
  status IN ('APPROVED', 'REJECTED') AND reviewed_by_user_id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid
);
CREATE POLICY activation_token_create_by_admin ON account_activation_tokens FOR INSERT TO medtender_app WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
);
CREATE POLICY activation_token_consume ON account_activation_tokens FOR SELECT TO medtender_app USING (
  token_hash = NULLIF(current_setting('app.activation_token_hash', true), '')
);
CREATE POLICY activation_token_update ON account_activation_tokens FOR UPDATE TO medtender_app USING (
  token_hash = NULLIF(current_setting('app.activation_token_hash', true), '')
) WITH CHECK (token_hash = NULLIF(current_setting('app.activation_token_hash', true), ''));

CREATE POLICY organization_system_admin_insert ON organizations FOR INSERT TO medtender_app WITH CHECK (
  id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND created_by_user_id = NULLIF(current_setting('app.provisioning_owner_id', true), '')::uuid
  AND EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
);
CREATE POLICY organization_system_admin_read ON organizations FOR SELECT TO medtender_app USING (
  id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
);
CREATE POLICY membership_system_admin_insert ON organization_memberships FOR INSERT TO medtender_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND user_id = NULLIF(current_setting('app.provisioning_owner_id', true), '')::uuid
  AND role = 'OWNER' AND status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM users WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid AND users.global_role = 'SYSTEM_ADMIN')
);

COMMIT;
