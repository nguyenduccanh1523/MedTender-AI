BEGIN;

CREATE TABLE organization_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  email text NOT NULL,
  role membership_role NOT NULL CHECK (role <> 'OWNER'),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX organization_invitations_organization_id_created_at_idx
  ON organization_invitations(organization_id, created_at);

REVOKE ALL ON organization_invitations FROM PUBLIC;
GRANT SELECT, INSERT ON organization_invitations TO medtender_app;
GRANT UPDATE (accepted_at, revoked_at) ON organization_invitations TO medtender_app;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY invitation_tenant_read ON organization_invitations
FOR SELECT TO medtender_app USING (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
);

CREATE POLICY invitation_tenant_create ON organization_invitations
FOR INSERT TO medtender_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  AND invited_by = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND accepted_at IS NULL AND revoked_at IS NULL
);

CREATE POLICY invitation_tenant_update ON organization_invitations
FOR UPDATE TO medtender_app USING (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
) WITH CHECK (
  organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid
);

CREATE POLICY invitation_recipient_read ON organization_invitations
FOR SELECT TO medtender_app USING (
  token_hash = NULLIF(current_setting('app.invitation_token_hash', true), '')
  AND email = (
    SELECT lower(users.email::text) FROM users
    WHERE users.id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
);

CREATE POLICY invitation_recipient_update ON organization_invitations
FOR UPDATE TO medtender_app USING (
  token_hash = NULLIF(current_setting('app.invitation_token_hash', true), '')
  AND email = (
    SELECT lower(users.email::text) FROM users
    WHERE users.id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
);

CREATE POLICY organization_invitee_read ON organizations
FOR SELECT TO medtender_app USING (
  status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM organization_invitations AS invitation
    WHERE invitation.organization_id = organizations.id
      AND invitation.token_hash = NULLIF(current_setting('app.invitation_token_hash', true), '')
      AND invitation.accepted_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > CURRENT_TIMESTAMP
  )
);

CREATE POLICY membership_invitee_insert ON organization_memberships
FOR INSERT TO medtender_app WITH CHECK (
  user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND status = 'ACTIVE'
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
  AND EXISTS (
    SELECT 1 FROM organization_invitations AS invitation
    WHERE invitation.organization_id = organization_memberships.organization_id
      AND invitation.role = organization_memberships.role
      AND invitation.token_hash = NULLIF(current_setting('app.invitation_token_hash', true), '')
      AND invitation.accepted_at IS NOT NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > CURRENT_TIMESTAMP
  )
);

COMMIT;
