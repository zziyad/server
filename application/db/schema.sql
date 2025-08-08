-- Universal Authentication System Database Schema
-- Database: auth
-- Optimized for performance and security

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table (core user information)
CREATE TABLE "users" (
  "user_id" bigint generated always as identity,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "name" varchar(255),
  "role" varchar(50) NOT NULL CHECK (role IN ('admin', 'event_manager', 'driver', 'coordinator', 'user')),
  "active" boolean DEFAULT true,
  "account_expires_at" timestamp with time zone,
  "created_by" bigint,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id"),
  FOREIGN KEY ("created_by") REFERENCES "users" ("user_id")
);

-- User permissions (normalized for better performance)
CREATE TABLE "user_permissions" (
  "permission_id" bigint generated always as identity,
  "user_id" bigint NOT NULL,
  "permission" varchar(100) NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("permission_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
  UNIQUE ("user_id", "permission"),
  CONSTRAINT "chk_permission_format" CHECK (permission ~ '^[a-z_]+\.(read|write|create|delete|update)$')
);

-- User attributes for ABAC
CREATE TABLE "user_attributes" (
  "attribute_id" bigint generated always as identity,
  "user_id" bigint NOT NULL,
  "attribute_key" varchar(100) NOT NULL,
  "attribute_value" text,
  "attribute_type" varchar(50) DEFAULT 'string',
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("attribute_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
  UNIQUE ("user_id", "attribute_key")
);

-- User sessions (minimal data for performance)
CREATE TABLE "user_sessions" (
  "session_id" bigint generated always as identity,
  "user_id" bigint NOT NULL,
  "refresh_token" varchar(255) NOT NULL UNIQUE,
  "ip_address" inet,
  "login_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "last_activity" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp with time zone,
  "revoked" boolean DEFAULT false,
  PRIMARY KEY ("session_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE
);

-- =============================================================================
-- ABAC POLICY SYSTEM
-- =============================================================================

-- ABAC policies (normalized for better indexing)
CREATE TABLE "abac_policies" (
  "policy_id" bigint generated always as identity,
  "name" varchar(255) NOT NULL,
  "description" text,
  "effect" varchar(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  "priority" integer DEFAULT 10,
  "active" boolean DEFAULT true,
  "created_by" bigint,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("policy_id"),
  FOREIGN KEY ("created_by") REFERENCES "users" ("user_id")
);

-- Policy conditions (normalized for better performance)
CREATE TABLE "policy_conditions" (
  "condition_id" bigint generated always as identity,
  "policy_id" bigint NOT NULL,
  "condition_type" varchar(20) NOT NULL CHECK (condition_type IN ('subject', 'resource', 'environment', 'action')),
  "attribute_key" varchar(100) NOT NULL,
  "operator" varchar(20) NOT NULL CHECK (operator IN ('equals', 'not_equals', 'in', 'not_in', 'range', 'exists', 'not_exists')),
  "attribute_value" text,
  PRIMARY KEY ("condition_id"),
  FOREIGN KEY ("policy_id") REFERENCES "abac_policies" ("policy_id") ON DELETE CASCADE
);

-- =============================================================================
-- AUDIT LOGGING
-- =============================================================================

-- Audit logs (partitioned for performance)
CREATE TABLE "audit_logs" (
  "log_id" bigint generated always as identity,
  "user_id" bigint,
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(50),
  "resource_id" bigint,
  "details" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("log_id", "created_at")
) PARTITION BY RANGE ("created_at");

-- Create monthly partitions for audit logs
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE audit_logs_2024_03 PARTITION OF audit_logs
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users table indexes
CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_users_role" ON "users" ("role");
CREATE INDEX "idx_users_active" ON "users" ("active");
CREATE INDEX "idx_users_created_by" ON "users" ("created_by");

-- User permissions indexes
CREATE INDEX "idx_user_permissions_user" ON "user_permissions" ("user_id");
CREATE INDEX "idx_user_permissions_expires" ON "user_permissions" ("expires_at");
CREATE INDEX "idx_user_permissions_permission" ON "user_permissions" ("permission");

-- User attributes indexes
CREATE INDEX "idx_user_attributes_user" ON "user_attributes" ("user_id");
CREATE INDEX "idx_user_attributes_key" ON "user_attributes" ("attribute_key");
CREATE INDEX "idx_user_attributes_expires" ON "user_attributes" ("expires_at");

-- User sessions indexes
CREATE INDEX "idx_user_sessions_user" ON "user_sessions" ("user_id");
CREATE INDEX "idx_user_sessions_token" ON "user_sessions" ("refresh_token");
CREATE INDEX "idx_user_sessions_expires" ON "user_sessions" ("expires_at");
CREATE INDEX "idx_user_sessions_revoked" ON "user_sessions" ("revoked");

-- ABAC policies indexes
CREATE INDEX "idx_abac_policies_active" ON "abac_policies" ("active");
CREATE INDEX "idx_abac_policies_priority" ON "abac_policies" ("priority" DESC);
CREATE INDEX "idx_abac_policies_effect" ON "abac_policies" ("effect");

-- Policy conditions indexes
CREATE INDEX "idx_policy_conditions_policy" ON "policy_conditions" ("policy_id");
CREATE INDEX "idx_policy_conditions_type" ON "policy_conditions" ("condition_type");
CREATE INDEX "idx_policy_conditions_key" ON "policy_conditions" ("attribute_key");

-- Audit logs indexes
CREATE INDEX "idx_audit_logs_user" ON "audit_logs" ("user_id");
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at");

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update updated_at timestamp on users table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON "users" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE "users" IS 'Core user table with authentication and role information';
COMMENT ON TABLE "user_permissions" IS 'Normalized user permissions for better performance';
COMMENT ON TABLE "user_attributes" IS 'User attributes for ABAC policy evaluation';
COMMENT ON TABLE "user_sessions" IS 'Minimal session data for performance';
COMMENT ON TABLE "abac_policies" IS 'ABAC policies with priority-based evaluation';
COMMENT ON TABLE "policy_conditions" IS 'Normalized policy conditions for better indexing';
COMMENT ON TABLE "audit_logs" IS 'Partitioned audit logs for performance';

COMMENT ON COLUMN "users"."role" IS 'User role for basic access control';
COMMENT ON COLUMN "users"."account_expires_at" IS 'Optional account expiration date';
COMMENT ON COLUMN "user_permissions"."permission" IS 'Permission in format: resource.action';
COMMENT ON COLUMN "user_attributes"."expires_at" IS 'Optional attribute expiration for temporary permissions';
COMMENT ON COLUMN "abac_policies"."priority" IS 'Higher numbers evaluated first';
COMMENT ON COLUMN "policy_conditions"."operator" IS 'Comparison operator for condition evaluation';
