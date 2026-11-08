BEGIN;

SELECT set_config('search_path', format('%I,%I', current_schema(), n.nspname), true)
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
WHERE e.extname = 'citext';

-- 1. ENUM TYPES FOR DOCUMENTS & POLICIES
CREATE TYPE document_type AS ENUM (
  'TENDER_DOC',
  'CATALOG_EVIDENCE',
  'CERTIFICATE',
  'OTHER'
);

CREATE TYPE file_scan_status AS ENUM (
  'PENDING',
  'SCANNING',
  'CLEAN',
  'QUARANTINED'
);

CREATE TYPE document_version_status AS ENUM (
  'DRAFT',
  'READY',
  'ARCHIVED'
);

CREATE TYPE data_classification AS ENUM (
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED'
);

-- 2. FILE ASSETS (Physical binary / object metadata)
CREATE TABLE file_assets (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  bucket text NOT NULL,
  object_key text NOT NULL UNIQUE,
  original_filename text NOT NULL CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK (length(btrim(mime_type)) BETWEEN 3 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL CHECK (length(btrim(sha256)) = 64),
  scan_status file_scan_status NOT NULL DEFAULT 'PENDING',
  quarantine_reason text,
  upload_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id)
);

CREATE INDEX file_assets_org_scan_idx ON file_assets(organization_id, scan_status, created_at DESC);
CREATE INDEX file_assets_org_sha_idx ON file_assets(organization_id, sha256);

-- 3. DOCUMENTS (Logical entity belonging to tenant, linked to tender or product)
CREATE TABLE documents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 255),
  document_type document_type NOT NULL DEFAULT 'TENDER_DOC',
  classification data_classification NOT NULL DEFAULT 'INTERNAL',
  description text CHECK (description IS NULL OR length(btrim(description)) <= 2000),
  tender_id uuid,
  product_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id),
  CONSTRAINT documents_tender_org_fkey
    FOREIGN KEY (tender_id, organization_id)
    REFERENCES tenders(id, organization_id)
    ON DELETE SET NULL,
  CONSTRAINT documents_product_org_fkey
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products(id, organization_id)
    ON DELETE SET NULL
);

CREATE INDEX documents_org_tender_idx ON documents(organization_id, tender_id);
CREATE INDEX documents_org_product_idx ON documents(organization_id, product_id);
CREATE INDEX documents_org_created_idx ON documents(organization_id, created_at DESC, id DESC);

-- 4. DOCUMENT VERSIONS (Immutable snapshots of documents pointing to a file_asset)
CREATE TABLE document_versions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  version_label text NOT NULL CHECK (length(btrim(version_label)) BETWEEN 1 AND 40),
  file_asset_id uuid NOT NULL,
  status document_version_status NOT NULL DEFAULT 'DRAFT',
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_confirmed_at timestamptz,
  accepted_terms_version text,
  accepted_privacy_version text,
  accepted_ai_notice_version text,
  notes text CHECK (notes IS NULL OR length(btrim(notes)) <= 2000),
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id),
  UNIQUE (document_id, version_number),
  UNIQUE (document_id, version_label),
  CONSTRAINT document_versions_doc_org_fkey
    FOREIGN KEY (document_id, organization_id)
    REFERENCES documents(id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT document_versions_asset_org_fkey
    FOREIGN KEY (file_asset_id, organization_id)
    REFERENCES file_assets(id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX document_versions_org_doc_idx ON document_versions(organization_id, document_id, version_number DESC);

-- 5. USER POLICY CONSENTS (Record user consent per organization & version)
CREATE TABLE user_policy_consents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_version text NOT NULL CHECK (length(btrim(policy_version)) BETWEEN 1 AND 40),
  terms_accepted boolean NOT NULL DEFAULT true,
  privacy_accepted boolean NOT NULL DEFAULT true,
  ai_notice_accepted boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id, policy_version)
);

CREATE INDEX user_policy_consents_org_user_idx ON user_policy_consents(organization_id, user_id);

-- 6. SECURITY INCIDENTS (Quarantined files and malware investigations)
CREATE TABLE security_incidents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  reference text NOT NULL UNIQUE,
  file_asset_id uuid NOT NULL,
  file_name text NOT NULL,
  sha256 text NOT NULL,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'PURGED')),
  ip_address text,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  purge_reason text,
  purged_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT security_incidents_asset_org_fkey
    FOREIGN KEY (file_asset_id, organization_id)
    REFERENCES file_assets(id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX security_incidents_org_status_idx ON security_incidents(organization_id, status, created_at DESC);

-- 7. FOREIGN KEY: product_specifications.document_version_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_specifications_doc_version_fkey'
  ) THEN
    ALTER TABLE product_specifications
    ADD CONSTRAINT product_specifications_doc_version_fkey
    FOREIGN KEY (document_version_id, organization_id)
    REFERENCES document_versions(id, organization_id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 8. PERMISSIONS & ROW LEVEL SECURITY
REVOKE ALL ON file_assets, documents, document_versions, user_policy_consents, security_incidents FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON file_assets, documents, document_versions, user_policy_consents, security_incidents TO medtender_app;

ALTER TABLE file_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE user_policy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_policy_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents FORCE ROW LEVEL SECURITY;

CREATE POLICY file_assets_scope ON file_assets
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY documents_scope ON documents
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY document_versions_scope ON document_versions
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY user_policy_consents_scope ON user_policy_consents
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY security_incidents_scope ON security_incidents
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

COMMIT;
