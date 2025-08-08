-- Universal Authentication System - Seed Data
-- Database: auth
-- Initial data for development and testing

-- =============================================================================
-- INITIAL ADMIN USER
-- =============================================================================

-- Create initial admin user (password: admin123)
INSERT INTO "users" (
  "email", 
  "password_hash", 
  "name", 
  "role", 
  "active", 
  "created_at"
) VALUES (
  'admin@authsystem.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.sUuKGi', -- admin123
  'System Administrator',
  'admin',
  true,
  CURRENT_TIMESTAMP
);

-- =============================================================================
-- SAMPLE USERS FOR TESTING
-- =============================================================================

-- Event Manager
INSERT INTO "users" (
  "email", 
  "password_hash", 
  "name", 
  "role", 
  "active", 
  "created_by",
  "created_at"
) VALUES (
  'manager@authsystem.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.sUuKGi', -- admin123
  'Event Manager',
  'event_manager',
  true,
  1,
  CURRENT_TIMESTAMP
);

-- Driver
INSERT INTO "users" (
  "email", 
  "password_hash", 
  "name", 
  "role", 
  "active", 
  "created_by",
  "created_at"
) VALUES (
  'driver@authsystem.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.sUuKGi', -- admin123
  'Transport Driver',
  'driver',
  true,
  1,
  CURRENT_TIMESTAMP
);

-- Coordinator
INSERT INTO "users" (
  "email", 
  "password_hash", 
  "name", 
  "role", 
  "active", 
  "created_by",
  "created_at"
) VALUES (
  'coordinator@authsystem.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.sUuKGi', -- admin123
  'Transport Coordinator',
  'coordinator',
  true,
  1,
  CURRENT_TIMESTAMP
);

-- Regular User
INSERT INTO "users" (
  "email", 
  "password_hash", 
  "name", 
  "role", 
  "active", 
  "created_by",
  "created_at"
) VALUES (
  'user@authsystem.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.sUuKGi', -- admin123
  'Regular User',
  'user',
  true,
  1,
  CURRENT_TIMESTAMP
);

-- =============================================================================
-- SAMPLE PERMISSIONS
-- =============================================================================

-- Admin permissions
INSERT INTO "user_permissions" ("user_id", "permission") VALUES
(1, 'user.manage'),
(1, 'user.create'),
(1, 'user.read'),
(1, 'user.update'),
(1, 'user.delete'),
(1, 'policy.manage'),
(1, 'policy.create'),
(1, 'policy.read'),
(1, 'policy.update'),
(1, 'policy.delete'),
(1, 'session.manage'),
(1, 'session.read'),
(1, 'session.revoke'),
(1, 'audit.read'),
(1, 'system.configure');

-- Event Manager permissions
INSERT INTO "user_permissions" ("user_id", "permission") VALUES
(2, 'event.create'),
(2, 'event.read'),
(2, 'event.update'),
(2, 'event.delete'),
(2, 'driver.assign'),
(2, 'driver.read'),
(2, 'fleet.manage'),
(2, 'fleet.read'),
(2, 'fleet.update');

-- Driver permissions
INSERT INTO "user_permissions" ("user_id", "permission") VALUES
(3, 'status.update'),
(3, 'status.read'),
(3, 'report.create'),
(3, 'report.read'),
(3, 'event.read');

-- Coordinator permissions
INSERT INTO "user_permissions" ("user_id", "permission") VALUES
(4, 'fleet.manage'),
(4, 'fleet.read'),
(4, 'fleet.update'),
(4, 'driver.assign'),
(4, 'driver.read'),
(4, 'status.read_all'),
(4, 'report.read_all');

-- Regular user permissions
INSERT INTO "user_permissions" ("user_id", "permission") VALUES
(5, 'event.read'),
(5, 'status.read');

-- =============================================================================
-- SAMPLE USER ATTRIBUTES
-- =============================================================================

-- Admin attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(1, 'department', 'management'),
(1, 'location', 'headquarters'),
(1, 'security_clearance', 'admin'),
(1, 'can_manage_users', 'true'),
(1, 'can_create_events', 'true');

-- Event Manager attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(2, 'department', 'event_management'),
(2, 'location', 'LAX'),
(2, 'security_clearance', 'manager'),
(2, 'can_create_events', 'true'),
(2, 'can_assign_drivers', 'true'),
(2, 'max_events_limit', '10');

-- Driver attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(3, 'department', 'transport'),
(3, 'location', 'LAX'),
(3, 'vehicle_type', 'car'),
(3, 'assigned_vehicle_code', 'Car-001'),
(3, 'shift_type', 'day'),
(3, 'experience_years', '5'),
(3, 'certification_level', 'advanced'),
(3, 'can_update_status', 'true'),
(3, 'can_submit_reports', 'true');

-- Coordinator attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(4, 'department', 'transport_coordination'),
(4, 'location', 'JFK'),
(4, 'security_clearance', 'coordinator'),
(4, 'can_assign_drivers', 'true'),
(4, 'can_manage_fleets', 'true'),
(4, 'can_view_all_status', 'true');

-- Regular user attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(5, 'department', 'general'),
(5, 'location', 'HQ'),
(5, 'security_clearance', 'basic');

-- =============================================================================
-- SAMPLE ABAC POLICIES
-- =============================================================================

-- Policy 1: Admin can manage everything
INSERT INTO "abac_policies" ("name", "description", "effect", "priority", "created_by") VALUES
('Admin Full Access', 'Administrators have full system access', 'allow', 25, 1);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'subject', 'role', 'equals', 'admin');

-- Policy 2: Event managers can manage events
INSERT INTO "abac_policies" ("name", "description", "effect", "priority", "created_by") VALUES
('Event Manager Access', 'Event managers can manage events and assign drivers', 'allow', 20, 1);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(2, 'subject', 'role', 'equals', 'event_manager');

-- Policy 3: Drivers can update their status
INSERT INTO "abac_policies" ("name", "description", "effect", "priority", "created_by") VALUES
('Driver Status Update', 'Drivers can update their assigned vehicle status', 'allow', 15, 1);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(3, 'subject', 'role', 'equals', 'driver'),
(3, 'subject', 'can_update_status', 'equals', 'true');

-- Policy 4: Coordinators can view all transport data
INSERT INTO "abac_policies" ("name", "description", "effect", "priority", "created_by") VALUES
('Coordinator View Access', 'Transport coordinators can view all transport data', 'allow', 12, 1);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(4, 'subject', 'role', 'equals', 'coordinator'),
(4, 'subject', 'can_view_all_status', 'equals', 'true');

-- Policy 5: Business hours restriction
INSERT INTO "abac_policies" ("name", "description", "effect", "priority", "created_by") VALUES
('Business Hours Access', 'Users can only access system during business hours', 'allow', 10, 1);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(5, 'environment', 'business_hours', 'equals', 'true');

-- =============================================================================
-- SAMPLE AUDIT LOGS
-- =============================================================================

-- Sample audit logs for testing
INSERT INTO "audit_logs" ("user_id", "action", "resource_type", "resource_id", "details", "ip_address", "user_agent") VALUES
(1, 'user_create', 'user', 2, '{"email": "manager@authsystem.com", "role": "event_manager"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'user_create', 'user', 3, '{"email": "driver@authsystem.com", "role": "driver"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'user_create', 'user', 4, '{"email": "coordinator@authsystem.com", "role": "coordinator"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'user_create', 'user', 5, '{"email": "user@authsystem.com", "role": "user"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'policy_create', 'policy', 1, '{"name": "Admin Full Access", "effect": "allow", "priority": 25}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify data was inserted correctly
SELECT 'Users created:' as info, COUNT(*) as count FROM "users"
UNION ALL
SELECT 'Permissions created:', COUNT(*) FROM "user_permissions"
UNION ALL
SELECT 'Attributes created:', COUNT(*) FROM "user_attributes"
UNION ALL
SELECT 'Policies created:', COUNT(*) FROM "abac_policies"
UNION ALL
SELECT 'Conditions created:', COUNT(*) FROM "policy_conditions"
UNION ALL
SELECT 'Audit logs created:', COUNT(*) FROM "audit_logs";

-- Show sample data
SELECT 'Sample Users:' as info;
SELECT user_id, email, name, role, active FROM "users" ORDER BY user_id;

SELECT 'Sample Permissions:' as info;
SELECT up.user_id, u.email, up.permission 
FROM "user_permissions" up 
JOIN "users" u ON up.user_id = u.user_id 
ORDER BY up.user_id, up.permission;

SELECT 'Sample Attributes:' as info;
SELECT ua.user_id, u.email, ua.attribute_key, ua.attribute_value 
FROM "user_attributes" ua 
JOIN "users" u ON ua.user_id = u.user_id 
ORDER BY ua.user_id, ua.attribute_key;
