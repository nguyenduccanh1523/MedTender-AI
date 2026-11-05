DROP POLICY membership_onboarding_insert ON organization_memberships;
CREATE POLICY membership_onboarding_insert ON organization_memberships
FOR INSERT TO medtender_app WITH CHECK (
  organization_id = NULLIF(current_setting('app.provisioning_org_id', true), '')::uuid
  AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  AND role = 'OWNER' AND status = 'ACTIVE'
  AND NULLIF(current_setting('app.org_id', true), '') IS NULL
);
