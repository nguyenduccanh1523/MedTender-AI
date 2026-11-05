GRANT UPDATE (password_hash) ON users TO medtender_app;

CREATE POLICY membership_system_admin_read ON organization_memberships
FOR SELECT TO medtender_app USING (
  organization_id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid
      AND users.global_role = 'SYSTEM_ADMIN'
  )
);

CREATE POLICY activation_token_admin_read ON account_activation_tokens
FOR SELECT TO medtender_app USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = NULLIF(current_setting('app.system_admin_id', true), '')::uuid
      AND users.global_role = 'SYSTEM_ADMIN'
  )
);
