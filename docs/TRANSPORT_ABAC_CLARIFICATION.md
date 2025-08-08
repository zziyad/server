# Transport Management Program - ABAC Clarification with Drivers

## 🎯 **Your System Overview**

Based on your work-flow and schema, your Transport Management Program has:

### **User Types:**
1. **Administrators** - Full system access
2. **Event Managers** - Create/manage events
3. **Drivers** - Transport personnel (NEW!)
4. **Transport Coordinators** - Manage transport operations
5. **Regular Users** - Basic access to assigned events

### **Core Entities:**
- **Events** - Main transport events (e.g., "Conference 2025")
- **Flets** - Transport markers (e.g., "Car-001", "Bus-ABC")
- **Hotels** - Accommodation locations
- **Destinations** - Transport destinations
- **Flight Schedules** - Arrival/departure data
- **Transport Reports** - Driver reports
- **Real-time Status** - Live transport tracking

## 📋 **1. Enhanced User Schema with Driver Support**

```sql
-- Enhanced User model with driver-specific attributes
CREATE TABLE "users" (
  "user_id" bigint generated always as identity,
  "username" varchar(100) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "role" varchar(50) NOT NULL CHECK (role IN ('admin', 'event_manager', 'driver', 'coordinator', 'user')),
  "full_name" varchar(255),
  "email" varchar(255),
  "phone" varchar(15),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id")
);

-- Driver-specific attributes
CREATE TABLE "driver_attributes" (
  "driver_id" bigint generated always as identity,
  "user_id" bigint NOT NULL,
  "license_number" varchar(50),
  "vehicle_type" varchar(100), -- 'car', 'bus', 'van', 'truck'
  "assigned_vehicle_code" varchar(50), -- Links to flet
  "shift_type" varchar(20), -- 'day', 'night', 'flexible'
  "experience_years" integer,
  "certification_level" varchar(50), -- 'basic', 'advanced', 'specialized'
  "current_location" varchar(100),
  "availability_status" varchar(20) DEFAULT 'available', -- 'available', 'busy', 'off_duty'
  "emergency_contact" varchar(255),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("driver_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE
);

-- User attributes for ABAC
CREATE TABLE "user_attributes" (
  "attribute_id" bigint generated always as identity,
  "user_id" bigint NOT NULL,
  "attribute_key" varchar(100) NOT NULL,
  "attribute_value" text,
  "attribute_type" varchar(50) DEFAULT 'string',
  "is_sensitive" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("attribute_id"),
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
  UNIQUE ("user_id", "attribute_key")
);
```

## 📋 **2. ABAC Attributes for Transport Management**

### **User Attributes Examples**
```sql
-- Administrator attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(1, 'security_clearance', 'admin'),
(1, 'department', 'management'),
(1, 'location', 'headquarters'),
(1, 'can_manage_users', 'true'),
(1, 'can_create_events', 'true');

-- Event Manager attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(2, 'security_clearance', 'manager'),
(2, 'department', 'event_management'),
(2, 'location', 'LAX'),
(2, 'can_create_events', 'true'),
(2, 'can_assign_drivers', 'true'),
(2, 'max_events_limit', '10');

-- Driver attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(3, 'security_clearance', 'driver'),
(3, 'department', 'transport'),
(3, 'location', 'LAX'),
(3, 'vehicle_type', 'car'),
(3, 'assigned_vehicle_code', 'Car-001'),
(3, 'shift_type', 'day'),
(3, 'experience_years', '5'),
(3, 'certification_level', 'advanced'),
(3, 'can_update_status', 'true'),
(3, 'can_submit_reports', 'true');

-- Transport Coordinator attributes
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
(4, 'security_clearance', 'coordinator'),
(4, 'department', 'transport_coordination'),
(4, 'location', 'JFK'),
(4, 'can_assign_drivers', 'true'),
(4, 'can_manage_fleets', 'true'),
(4, 'can_view_all_status', 'true');
```

### **Resource Attributes Examples**
```sql
-- Event attributes
INSERT INTO "resource_attributes" ("resource_id", "resource_type", "attribute_key", "attribute_value") VALUES
('event_001', 'event', 'event_type', 'conference'),
('event_001', 'event', 'location', 'LAX'),
('event_001', 'event', 'priority_level', 'high'),
('event_001', 'event', 'status', 'active'),
('event_001', 'event', 'start_date', '2025-07-20'),
('event_001', 'event', 'end_date', '2025-07-30');

-- Flight Schedule attributes
INSERT INTO "resource_attributes" ("resource_id", "resource_type", "attribute_key", "attribute_value") VALUES
('flight_001', 'flight_schedule', 'flight_type', 'arrival'),
('flight_001', 'flight_schedule', 'airport', 'LAX'),
('flight_001', 'flight_schedule', 'priority', 'high'),
('flight_001', 'flight_schedule', 'status', 'pending'),
('flight_001', 'flight_schedule', 'assigned_driver_id', '3');

-- Transport Report attributes
INSERT INTO "resource_attributes" ("resource_id", "resource_type", "attribute_key", "attribute_value") VALUES
('report_001', 'transport_report', 'report_type', 'daily'),
('report_001', 'transport_report', 'driver_id', '3'),
('report_001', 'transport_report', 'vehicle_code', 'Car-001'),
('report_001', 'transport_report', 'status', 'submitted'),
('report_001', 'transport_report', 'event_id', '1');
```

## 📋 **3. ABAC Policies for Transport Management**

### **Policy 1: Drivers Can Only Access Their Assigned Events**
```sql
-- Policy: Drivers can only access events they're assigned to
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Driver Event Access', 'Drivers can only access events they are assigned to', 'allow', 20);

-- Subject condition: User is a driver
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'subject', 'role', 'equals', 'driver');

-- Resource condition: User is assigned to this event
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'resource', 'event_id', 'in', '${user.assigned_events}');
```

### **Policy 2: Drivers Can Update Only Their Vehicle Status**
```sql
-- Policy: Drivers can update status for their assigned vehicle
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Driver Status Update', 'Drivers can update status for their assigned vehicle', 'allow', 15);

-- Subject conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(2, 'subject', 'role', 'equals', 'driver'),
(2, 'subject', 'assigned_vehicle_code', 'not_equals', 'null');

-- Resource conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(2, 'resource', 'vehicle_code', 'equals', '${user.assigned_vehicle_code}'),
(2, 'resource', 'event_id', 'in', '${user.assigned_events}');
```

### **Policy 3: Event Managers Can Manage Their Events**
```sql
-- Policy: Event managers can manage events they created
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Event Manager Access', 'Event managers can manage events they created', 'allow', 18);

-- Subject conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(3, 'subject', 'role', 'equals', 'event_manager'),
(3, 'subject', 'can_create_events', 'equals', 'true');

-- Resource conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(3, 'resource', 'created_by', 'equals', '${user.user_id}');
```

### **Policy 4: Coordinators Can View All Transport Data**
```sql
-- Policy: Transport coordinators can view all transport data
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Coordinator View Access', 'Transport coordinators can view all transport data', 'allow', 12);

-- Subject conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(4, 'subject', 'role', 'equals', 'coordinator'),
(4, 'subject', 'can_view_all_status', 'equals', 'true');
```

## 📋 **4. Real-World Usage Examples**

### **Driver Dashboard with Attribute-Based UI**
```typescript
// trs_front/src/components/driver/DriverDashboard.tsx
export const DriverDashboard: React.FC = () => {
  const { user } = useEnhancedAuth();
  const { hasPermission } = useEnhancedAuth();
  
  // Check driver-specific permissions
  const canUpdateStatus = hasPermission('realtime_status.update') && 
    user?.attributes?.role === 'driver';
  
  const canSubmitReport = hasPermission('transport_report.create') && 
    user?.attributes?.role === 'driver';
  
  const assignedVehicle = user?.attributes?.assigned_vehicle_code;

  return (
    <div className="space-y-6">
      <h1>Driver Dashboard</h1>
      
      {/* Show assigned vehicle info */}
      {assignedVehicle && (
        <div className="border rounded-lg p-4">
          <h3>Your Vehicle: {assignedVehicle}</h3>
          <p>Status: {user?.attributes?.availability_status}</p>
        </div>
      )}
      
      {/* Show assigned events */}
      <div className="grid gap-4">
        <h2>Your Assigned Events</h2>
        {/* Event list filtered by driver's assignments */}
      </div>
      
      {/* Status update form - only for drivers */}
      {canUpdateStatus && (
        <div className="border rounded-lg p-4">
          <h3>Update Transport Status</h3>
          <StatusUpdateForm vehicleCode={assignedVehicle} />
        </div>
      )}
      
      {/* Report submission - only for drivers */}
      {canSubmitReport && (
        <div className="border rounded-lg p-4">
          <h3>Submit Transport Report</h3>
          <ReportSubmissionForm />
        </div>
      )}
    </div>
  );
};
```

### **Event Manager Dashboard**
```typescript
// trs_front/src/components/manager/EventManagerDashboard.tsx
export const EventManagerDashboard: React.FC = () => {
  const { user } = useEnhancedAuth();
  const { hasPermission } = useEnhancedAuth();
  
  const canCreateEvents = hasPermission('event.create') && 
    user?.attributes?.role === 'event_manager';
  
  const canAssignDrivers = hasPermission('driver.assign') && 
    user?.attributes?.role === 'event_manager';

  return (
    <div className="space-y-6">
      <h1>Event Manager Dashboard</h1>
      
      {/* Create new event - only for event managers */}
      {canCreateEvents && (
        <div className="border rounded-lg p-4">
          <h3>Create New Event</h3>
          <EventCreationForm />
        </div>
      )}
      
      {/* Manage drivers - only for event managers */}
      {canAssignDrivers && (
        <div className="border rounded-lg p-4">
          <h3>Assign Drivers to Events</h3>
          <DriverAssignmentForm />
        </div>
      )}
      
      {/* View all events created by this manager */}
      <div className="grid gap-4">
        <h2>Your Events</h2>
        {/* Event list filtered by manager */}
      </div>
    </div>
  );
};
```

### **Transport Coordinator Dashboard**
```typescript
// trs_front/src/components/coordinator/CoordinatorDashboard.tsx
export const CoordinatorDashboard: React.FC = () => {
  const { user } = useEnhancedAuth();
  const { hasPermission } = useEnhancedAuth();
  
  const canViewAllStatus = hasPermission('realtime_status.read_all') && 
    user?.attributes?.role === 'coordinator';
  
  const canManageFleets = hasPermission('fleet.manage') && 
    user?.attributes?.role === 'coordinator';

  return (
    <div className="space-y-6">
      <h1>Transport Coordinator Dashboard</h1>
      
      {/* View all transport status - coordinators can see everything */}
      {canViewAllStatus && (
        <div className="border rounded-lg p-4">
          <h3>All Transport Status</h3>
          <AllStatusView />
        </div>
      )}
      
      {/* Manage fleet - coordinators can manage all vehicles */}
      {canManageFleets && (
        <div className="border rounded-lg p-4">
          <h3>Fleet Management</h3>
          <FleetManagementForm />
        </div>
      )}
      
      {/* Driver assignments */}
      <div className="border rounded-lg p-4">
        <h3>Driver Assignments</h3>
        <DriverAssignmentView />
      </div>
    </div>
  );
};
```

## 📋 **5. Permission Examples for Your System**

### **Driver Permissions:**
- ✅ `event.read` - Can view assigned events
- ✅ `realtime_status.update` - Can update their vehicle status
- ✅ `transport_report.create` - Can submit transport reports
- ❌ `event.create` - Cannot create events
- ❌ `driver.assign` - Cannot assign other drivers

### **Event Manager Permissions:**
- ✅ `event.create` - Can create new events
- ✅ `event.edit` - Can edit their events
- ✅ `driver.assign` - Can assign drivers to events
- ✅ `flet.manage` - Can manage transport markers
- ❌ `coordinator.manage` - Cannot manage coordinators

### **Transport Coordinator Permissions:**
- ✅ `realtime_status.read_all` - Can view all transport status
- ✅ `fleet.manage` - Can manage all vehicles
- ✅ `driver.assign` - Can assign drivers
- ✅ `transport_report.read_all` - Can view all reports
- ❌ `user.manage` - Cannot manage users

### **Administrator Permissions:**
- ✅ `user.manage` - Can manage all users
- ✅ `event.manage_all` - Can manage all events
- ✅ `system.configure` - Can configure system settings
- ✅ `audit.view` - Can view audit logs

## 🎯 **Key Benefits for Your Transport System:**

### **1. Role-Based Access Control**
- ✅ **Drivers** only see their assigned events and vehicles
- ✅ **Event Managers** can manage their own events
- ✅ **Coordinators** can oversee all transport operations
- ✅ **Admins** have full system access

### **2. Event-Specific Permissions**
- ✅ Users only see events they're assigned to
- ✅ Transport data is filtered by event_id
- ✅ Drivers can only update their assigned vehicle status

### **3. Dynamic UI Based on Role**
- ✅ Different dashboards for different user types
- ✅ Role-specific buttons and forms
- ✅ Attribute-based feature visibility

This ABAC system perfectly fits your Transport Management Program with **drivers** as a key user type! 🚀
