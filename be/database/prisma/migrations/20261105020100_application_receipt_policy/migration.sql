CREATE POLICY application_public_receipt_read ON organization_applications
FOR SELECT TO medtender_app USING (
  status = 'PENDING'
  AND reference = NULLIF(current_setting('app.application_reference', true), '')
);

CREATE UNIQUE INDEX organization_applications_pending_email_key
  ON organization_applications(contact_email) WHERE status = 'PENDING';
CREATE UNIQUE INDEX organization_applications_pending_tax_code_key
  ON organization_applications(tax_code) WHERE status = 'PENDING';
