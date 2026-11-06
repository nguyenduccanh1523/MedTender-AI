BEGIN;

SELECT set_config('search_path', format('%I,%I', current_schema(), n.nspname), true)
FROM pg_extension AS e
JOIN pg_namespace AS n ON n.oid = e.extnamespace
WHERE e.extname = 'citext';

CREATE TYPE product_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE product_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

CREATE TABLE products (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sku citext NOT NULL CHECK (length(btrim(sku::text)) BETWEEN 1 AND 100),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  brand text NOT NULL CHECK (length(btrim(brand)) BETWEEN 1 AND 120),
  manufacturer text CHECK (manufacturer IS NULL OR length(btrim(manufacturer)) <= 200),
  category text CHECK (category IS NULL OR length(btrim(category)) <= 120),
  status product_status NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id)
);

-- Active SKU must be unique within an organization; archived products do not block SKU reuse.
CREATE UNIQUE INDEX products_org_active_sku_key
  ON products(organization_id, sku)
  WHERE status = 'ACTIVE';

CREATE INDEX products_organization_status_created_idx
  ON products(organization_id, status, created_at DESC, id DESC);

CREATE TABLE product_versions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  version_label text NOT NULL CHECK (length(btrim(version_label)) BETWEEN 1 AND 40),
  model_code text NOT NULL CHECK (length(btrim(model_code)) BETWEEN 1 AND 120),
  status product_version_status NOT NULL DEFAULT 'DRAFT',
  fingerprint text NOT NULL CHECK (length(btrim(fingerprint)) > 0),
  notes text CHECK (notes IS NULL OR length(btrim(notes)) <= 2000),
  published_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, organization_id),
  UNIQUE (product_id, version_number),
  UNIQUE (product_id, version_label),
  CONSTRAINT product_versions_product_org_fkey
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products(id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX product_versions_org_product_version_idx
  ON product_versions(organization_id, product_id, version_number DESC);

CREATE TABLE product_specifications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  product_version_id uuid NOT NULL,
  spec_key text NOT NULL CHECK (length(btrim(spec_key)) BETWEEN 1 AND 120),
  spec_value text NOT NULL CHECK (length(btrim(spec_value)) BETWEEN 1 AND 1000),
  unit text CHECK (unit IS NULL OR length(btrim(unit)) <= 50),
  source_label text NOT NULL CHECK (length(btrim(source_label)) BETWEEN 1 AND 200),
  source_quote text CHECK (source_quote IS NULL OR length(btrim(source_quote)) <= 2000),
  document_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_specifications_version_org_fkey
    FOREIGN KEY (product_version_id, organization_id)
    REFERENCES product_versions(id, organization_id)
    ON DELETE CASCADE
);

CREATE INDEX product_specifications_org_version_idx
  ON product_specifications(organization_id, product_version_id);

REVOKE ALL ON products, product_versions, product_specifications FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON products, product_versions, product_specifications TO medtender_app;
GRANT UPDATE (name, settings) ON organizations TO medtender_app;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications FORCE ROW LEVEL SECURITY;

CREATE POLICY product_scope ON products
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY product_version_scope ON product_versions
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY product_specification_scope ON product_specifications
FOR ALL TO medtender_app
USING (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

CREATE POLICY organization_update ON organizations
FOR UPDATE TO medtender_app
USING (id = NULLIF(current_setting('app.org_id', true), '')::uuid)
WITH CHECK (id = NULLIF(current_setting('app.org_id', true), '')::uuid);

COMMIT;
