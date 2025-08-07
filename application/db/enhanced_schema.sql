-- Enhanced Database Schema for User Management, ABAC, Audit Logging, and Session Control
-- This schema extends the existing system with advanced features for better control and monitoring

-- =============================================================================
-- ENHANCED USER MANAGEMENT SCHEMA
-- =============================================================================

-- Enhanced User Profile with ABAC attributes
CREATE TABLE "user_profiles" (
  "profile_id" bigint generated always as identity,
  "account_id" bigint NOT NULL,
  "department" varchar(100),
  "location" varchar(100),
  "security_clearance" varchar(50),
  "last_login_at" timestamp with time zone,
  "login_count" integer DEFAULT 0,
  "status" varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("profile_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE
);

COMMENT ON TABLE "user_profiles" IS 'Enhanced user profile information with ABAC attributes';
COMMENT ON COLUMN "user_profiles"."security_clearance" IS 'Security clearance level for access control';
COMMENT ON COLUMN "user_profiles"."status" IS 'Current user account status';

-- User attributes for ABAC
CREATE TABLE "user_attributes" (
  "attribute_id" bigint generated always as identity,
  "account_id" bigint NOT NULL,
  "attribute_key" varchar(100) NOT NULL,
  "attribute_value" text,
  "attribute_type" varchar(50) DEFAULT 'string',
  "is_sensitive" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("attribute_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE,
  UNIQUE ("account_id", "attribute_key")
);

COMMENT ON TABLE "user_attributes" IS 'Dynamic user attributes for ABAC policy evaluation';
COMMENT ON COLUMN "user_attributes"."is_sensitive" IS 'Flag for sensitive attributes that require special handling';

-- Enhanced session tracking with online/offline status
CREATE TABLE "user_sessions" (
  "session_id" bigint generated always as identity,
  "account_id" bigint NOT NULL,
  "token" varchar(255) NOT NULL,
  "ip_address" inet NOT NULL,
  "user_agent" text,
  "device_id" varchar(100),
  "location" varchar(100),
  "status" varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'idle', 'expired', 'terminated')),
  "last_activity" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp with time zone NOT NULL,
  "session_data" jsonb,
  PRIMARY KEY ("session_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE,
  UNIQUE ("token")
);

COMMENT ON TABLE "user_sessions" IS 'Enhanced session tracking with online/offline status monitoring';
COMMENT ON COLUMN "user_sessions"."device_id" IS 'Unique device identifier for multi-device support';
COMMENT ON COLUMN "user_sessions"."status" IS 'Current session status for online/offline tracking';

-- Session activity tracking
CREATE TABLE "session_activities" (
  "activity_id" bigint generated always as identity,
  "session_id" bigint NOT NULL,
  "action" varchar(100) NOT NULL,
  "resource" varchar(255),
  "details" jsonb,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("activity_id"),
  FOREIGN KEY ("session_id") REFERENCES "user_sessions" ("session_id") ON DELETE CASCADE
);

COMMENT ON TABLE "session_activities" IS 'Detailed tracking of session activities for audit and analytics';

-- =============================================================================
-- ABAC (ATTRIBUTE-BASED ACCESS CONTROL) SCHEMA
-- =============================================================================

-- ABAC Policy Engine
CREATE TABLE "abac_policies" (
  "policy_id" bigint generated always as identity,
  "name" varchar(255) NOT NULL,
  "description" text,
  "effect" varchar(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  "priority" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("policy_id")
);

COMMENT ON TABLE "abac_policies" IS 'ABAC policy definitions for dynamic access control';
COMMENT ON COLUMN "abac_policies"."priority" IS 'Policy evaluation priority (higher numbers evaluated first)';

-- Policy conditions (subject, resource, environment)
CREATE TABLE "policy_conditions" (
  "condition_id" bigint generated always as identity,
  "policy_id" bigint NOT NULL,
  "condition_type" varchar(50) NOT NULL CHECK (condition_type IN ('subject', 'resource', 'environment', 'action')),
  "attribute_name" varchar(100) NOT NULL,
  "operator" varchar(20) NOT NULL CHECK (operator IN ('equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'in', 'not_in')),
  "attribute_value" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("condition_id"),
  FOREIGN KEY ("policy_id") REFERENCES "abac_policies" ("policy_id") ON DELETE CASCADE
);

COMMENT ON TABLE "policy_conditions" IS 'Individual conditions for ABAC policy evaluation';
COMMENT ON COLUMN "policy_conditions"."condition_type" IS 'Type of condition: subject (user), resource, environment, or action';

-- Resource attributes for ABAC
CREATE TABLE "resource_attributes" (
  "resource_id" bigint generated always as identity,
  "resource_type" varchar(100) NOT NULL,
  "resource_identifier" varchar(255) NOT NULL,
  "attribute_key" varchar(100) NOT NULL,
  "attribute_value" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("resource_id"),
  UNIQUE ("resource_type", "resource_identifier", "attribute_key")
);

COMMENT ON TABLE "resource_attributes" IS 'Dynamic resource attributes for ABAC policy evaluation';

-- Environment attributes (time, location, etc.)
CREATE TABLE "environment_attributes" (
  "env_id" bigint generated always as identity,
  "attribute_key" varchar(100) NOT NULL,
  "attribute_value" text,
  "valid_from" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "valid_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("env_id")
);

COMMENT ON TABLE "environment_attributes" IS 'Environment context attributes for ABAC (time, location, etc.)';

-- =============================================================================
-- COMPREHENSIVE AUDIT LOGGING SCHEMA
-- =============================================================================

-- Main audit log table
CREATE TABLE "audit_logs" (
  "log_id" bigint generated always as identity,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "account_id" bigint,
  "session_id" bigint,
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(100),
  "resource_id" varchar(255),
  "ip_address" inet,
  "user_agent" text,
  "success" boolean DEFAULT true,
  "details" jsonb,
  "severity" varchar(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  PRIMARY KEY ("log_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("session_id") REFERENCES "user_sessions" ("session_id") ON DELETE SET NULL
);

COMMENT ON TABLE "audit_logs" IS 'Comprehensive audit trail for all system activities';
COMMENT ON COLUMN "audit_logs"."severity" IS 'Log severity level for filtering and alerting';

-- Security events for monitoring
CREATE TABLE "security_events" (
  "event_id" bigint generated always as identity,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "account_id" bigint,
  "event_type" varchar(100) NOT NULL,
  "severity" varchar(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  "description" text,
  "ip_address" inet,
  "location" varchar(100),
  "details" jsonb,
  "resolved" boolean DEFAULT false,
  "resolved_at" timestamp with time zone,
  "resolved_by" bigint,
  PRIMARY KEY ("event_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("resolved_by") REFERENCES "Account" ("id") ON DELETE SET NULL
);

COMMENT ON TABLE "security_events" IS 'Security incident tracking and resolution management';

-- Data change tracking
CREATE TABLE "data_changes" (
  "change_id" bigint generated always as identity,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "account_id" bigint,
  "table_name" varchar(100) NOT NULL,
  "record_id" varchar(255),
  "operation" varchar(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  "old_values" jsonb,
  "new_values" jsonb,
  "changed_fields" text[],
  PRIMARY KEY ("change_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE SET NULL
);

COMMENT ON TABLE "data_changes" IS 'Track all database modifications for audit and rollback purposes';

-- =============================================================================
-- ENHANCED SESSION CONTROL SCHEMA
-- =============================================================================

-- Session management with online/offline tracking
CREATE TABLE "session_heartbeats" (
  "heartbeat_id" bigint generated always as identity,
  "session_id" bigint NOT NULL,
  "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "status" varchar(20) DEFAULT 'online',
  "latency" integer, -- in milliseconds
  PRIMARY KEY ("heartbeat_id"),
  FOREIGN KEY ("session_id") REFERENCES "user_sessions" ("session_id") ON DELETE CASCADE
);

COMMENT ON TABLE "session_heartbeats" IS 'Real-time session heartbeat tracking for online/offline status';

-- User presence tracking
CREATE TABLE "user_presence" (
  "presence_id" bigint generated always as identity,
  "account_id" bigint NOT NULL,
  "status" varchar(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  "last_seen" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "current_session_id" bigint,
  "away_since" timestamp with time zone,
  "status_message" varchar(255),
  PRIMARY KEY ("presence_id"),
  FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("current_session_id") REFERENCES "user_sessions" ("session_id") ON DELETE SET NULL,
  UNIQUE ("account_id")
);

COMMENT ON TABLE "user_presence" IS 'Real-time user presence and status tracking';

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- User management indexes
CREATE INDEX "idx_user_profiles_account_id" ON "user_profiles" ("account_id");
CREATE INDEX "idx_user_profiles_status" ON "user_profiles" ("status");
CREATE INDEX "idx_user_attributes_account_id" ON "user_attributes" ("account_id");
CREATE INDEX "idx_user_attributes_key" ON "user_attributes" ("attribute_key");

-- Session management indexes
CREATE INDEX "idx_user_sessions_account_id" ON "user_sessions" ("account_id");
CREATE INDEX "idx_user_sessions_status" ON "user_sessions" ("status");
CREATE INDEX "idx_user_sessions_last_activity" ON "user_sessions" ("last_activity");
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" ("expires_at");
CREATE INDEX "idx_session_activities_session_id" ON "session_activities" ("session_id");
CREATE INDEX "idx_session_activities_timestamp" ON "session_activities" ("timestamp");
CREATE INDEX "idx_session_heartbeats_session_id" ON "session_heartbeats" ("session_id");
CREATE INDEX "idx_session_heartbeats_timestamp" ON "session_heartbeats" ("timestamp");

-- ABAC indexes
CREATE INDEX "idx_abac_policies_active" ON "abac_policies" ("is_active", "priority");
CREATE INDEX "idx_policy_conditions_policy_id" ON "policy_conditions" ("policy_id");
CREATE INDEX "idx_policy_conditions_type" ON "policy_conditions" ("condition_type");
CREATE INDEX "idx_resource_attributes_type_id" ON "resource_attributes" ("resource_type", "resource_identifier");
CREATE INDEX "idx_environment_attributes_key" ON "environment_attributes" ("attribute_key");

-- Audit logging indexes
CREATE INDEX "idx_audit_logs_account_id" ON "audit_logs" ("account_id");
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" ("timestamp");
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" ("action");
CREATE INDEX "idx_audit_logs_severity" ON "audit_logs" ("severity");
CREATE INDEX "idx_security_events_severity" ON "security_events" ("severity");
CREATE INDEX "idx_security_events_timestamp" ON "security_events" ("timestamp");
CREATE INDEX "idx_security_events_resolved" ON "security_events" ("resolved");
CREATE INDEX "idx_data_changes_account_id" ON "data_changes" ("account_id");
CREATE INDEX "idx_data_changes_timestamp" ON "data_changes" ("timestamp");
CREATE INDEX "idx_data_changes_table_name" ON "data_changes" ("table_name");

-- User presence indexes
CREATE INDEX "idx_user_presence_status" ON "user_presence" ("status");
CREATE INDEX "idx_user_presence_last_seen" ON "user_presence" ("last_seen");

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Trigger to update user_profiles updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON "user_profiles"
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Trigger to update abac_policies updated_at timestamp
CREATE OR REPLACE FUNCTION update_abac_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_abac_policies_updated_at
  BEFORE UPDATE ON "abac_policies"
  FOR EACH ROW
  EXECUTE FUNCTION update_abac_policies_updated_at();

-- =============================================================================
-- SAMPLE DATA AND INITIAL SETUP
-- =============================================================================

-- Insert default environment attributes
INSERT INTO "environment_attributes" ("attribute_key", "attribute_value") VALUES
('timezone', 'UTC'),
('business_hours_start', '09:00'),
('business_hours_end', '17:00'),
('maintenance_mode', 'false');

-- Insert default ABAC policies
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Default Allow', 'Default allow policy for authenticated users', 'allow', 0),
('Admin Full Access', 'Full access for administrators', 'allow', 100),
('Sensitive Data Protection', 'Protect sensitive data access', 'deny', 50);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active sessions view
CREATE VIEW "active_sessions_view" AS
SELECT 
  us.session_id,
  us.account_id,
  a.login,
  us.ip_address,
  us.status,
  us.last_activity,
  us.created_at,
  us.expires_at,
  up.status as user_status
FROM "user_sessions" us
JOIN "Account" a ON us.account_id = a.id
LEFT JOIN "user_presence" up ON us.account_id = up.account_id
WHERE us.status = 'active' AND us.expires_at > CURRENT_TIMESTAMP;

-- User activity summary view
CREATE VIEW "user_activity_summary" AS
SELECT 
  a.id as account_id,
  a.login,
  up.department,
  up.status as profile_status,
  COUNT(DISTINCT us.session_id) as active_sessions,
  MAX(us.last_activity) as last_activity,
  MAX(up.last_login_at) as last_login
FROM "Account" a
LEFT JOIN "user_profiles" up ON a.id = up.account_id
LEFT JOIN "user_sessions" us ON a.id = us.account_id AND us.status = 'active'
GROUP BY a.id, a.login, up.department, up.status;

-- Security events summary view
CREATE VIEW "security_events_summary" AS
SELECT 
  event_type,
  severity,
  COUNT(*) as event_count,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence,
  COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_count
FROM "security_events"
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY event_type, severity
ORDER BY event_count DESC;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON SCHEMA public IS 'Enhanced database schema for advanced user management, ABAC, audit logging, and session control';

-- Function to get user online status
CREATE OR REPLACE FUNCTION get_user_online_status(p_account_id bigint)
RETURNS TABLE(
  is_online boolean,
  last_seen timestamp with time zone,
  active_sessions integer,
  current_status varchar(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN up.status = 'online' THEN true ELSE false END as is_online,
    up.last_seen,
    COUNT(us.session_id)::integer as active_sessions,
    up.status as current_status
  FROM "user_presence" up
  LEFT JOIN "user_sessions" us ON up.account_id = us.account_id 
    AND us.status = 'active' 
    AND us.expires_at > CURRENT_TIMESTAMP
  WHERE up.account_id = p_account_id
  GROUP BY up.status, up.last_seen;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_online_status(bigint) IS 'Get real-time online status for a user';

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  UPDATE "user_sessions" 
  SET status = 'expired' 
  WHERE expires_at < CURRENT_TIMESTAMP AND status = 'active';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Update user presence for users with no active sessions
  UPDATE "user_presence" 
  SET status = 'offline', current_session_id = NULL
  WHERE account_id IN (
    SELECT DISTINCT up.account_id 
    FROM "user_presence" up
    LEFT JOIN "user_sessions" us ON up.account_id = us.account_id 
      AND us.status = 'active' 
      AND us.expires_at > CURRENT_TIMESTAMP
    WHERE us.session_id IS NULL AND up.status != 'offline'
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Clean up expired sessions and update user presence status';
