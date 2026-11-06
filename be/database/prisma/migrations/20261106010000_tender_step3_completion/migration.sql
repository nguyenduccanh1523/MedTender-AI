BEGIN;

ALTER TABLE tenders
  ADD CONSTRAINT tenders_id_organization_id_key UNIQUE (id, organization_id),
  ADD CONSTRAINT tenders_title_nonempty CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  ADD CONSTRAINT tenders_reference_max CHECK (reference IS NULL OR length(btrim(reference)) <= 200);

ALTER TABLE tender_lots
  DROP CONSTRAINT tender_lots_tender_id_fkey,
  ADD CONSTRAINT tender_lots_tender_org_fkey
    FOREIGN KEY (tender_id, organization_id)
    REFERENCES tenders(id, organization_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT tender_lots_code_nonempty CHECK (length(btrim(lot_code)) BETWEEN 1 AND 50),
  ADD CONSTRAINT tender_lots_name_nonempty CHECK (length(btrim(name)) BETWEEN 1 AND 200);

ALTER TABLE tender_items
  ADD CONSTRAINT tender_items_no_nonempty CHECK (length(btrim(item_no)) BETWEEN 1 AND 50),
  ADD CONSTRAINT tender_items_name_nonempty CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  ADD CONSTRAINT tender_items_unit_max CHECK (length(btrim(unit)) <= 50),
  ADD CONSTRAINT tender_items_desc_max CHECK (description IS NULL OR length(description) <= 2000);

CREATE TABLE tender_audit_logs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id uuid,
  lot_id uuid,
  item_id uuid,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role membership_role NOT NULL,
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  summary text NOT NULL CHECK (length(btrim(summary)) > 0),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tender_audit_logs_org_tender_created_idx
  ON tender_audit_logs(organization_id, tender_id, created_at DESC, id DESC);

REVOKE ALL ON tender_audit_logs FROM PUBLIC;
GRANT DELETE ON tenders, tender_lots, tender_items TO medtender_app;
GRANT SELECT, INSERT ON tender_audit_logs TO medtender_app;

ALTER TABLE tender_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tender_audit_scope ON tender_audit_logs
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

COMMIT;
