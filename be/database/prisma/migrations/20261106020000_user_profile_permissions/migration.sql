BEGIN;

GRANT UPDATE (display_name, password_hash) ON users TO medtender_app;

COMMIT;
