# ABAC Attributes - Practical Examples for Flight Management

## 🎯 **What Are Attributes?**

Attributes are **dynamic properties** that describe users, resources, and the environment. They make ABAC incredibly flexible by allowing **context-aware permissions**.

## 📋 **1. User Attributes Examples**

### **User Profile Attributes**
```sql
-- User attributes stored in user_attributes table
INSERT INTO "user_attributes" ("user_id", "attribute_key", "attribute_value") VALUES
-- Pilot Smith
(1, 'security_clearance', 'high'),
(1, 'department', 'flight_operations'),
(1, 'location', 'LAX'),
(1, 'certification_level', 'captain'),
(1, 'aircraft_type_rating', 'B737,A320'),
(1, 'experience_years', '15'),
(1, 'shift_type', 'day'),
(1, 'emergency_contact', 'true'),

-- Dispatcher Johnson
(2, 'security_clearance', 'medium'),
(2, 'department', 'operations'),
(2, 'location', 'JFK'),
(2, 'certification_level', 'dispatcher'),
(2, 'shift_type', 'night'),
(2, 'supervisor_approval', 'true'),

-- Maintenance Engineer Davis
(3, 'security_clearance', 'medium'),
(3, 'department', 'maintenance'),
(3, 'location', 'ORD'),
(3, 'certification_level', 'senior_technician'),
(3, 'aircraft_specialty', 'engines'),
(3, 'shift_type', 'day'),
(3, 'on_call_status', 'true');
```

### **Dynamic User Attributes**
```javascript
// server/application/api/auth/user-attributes.js
({
  async getUserAttributes(userId) {
    const staticAttributes = await db.rows('user_attributes', ['*'], { user_id: userId });
    
    // Dynamic attributes calculated in real-time
    const dynamicAttributes = {
      'current_location': await this.getUserCurrentLocation(userId),
      'online_status': await this.getUserOnlineStatus(userId),
      'last_activity': await this.getUserLastActivity(userId),
      'session_count': await this.getUserActiveSessions(userId),
      'timezone': await this.getUserTimezone(userId),
      'business_hours': this.isBusinessHours(),
      'weekend_work': this.isWeekendWork(),
      'emergency_mode': await this.isEmergencyMode()
    };
    
    return { ...staticAttributes, ...dynamicAttributes };
  }
});
```

## 📋 **2. Resource Attributes Examples**

### **Flight Resource Attributes**
```sql
-- Resource attributes for different flight types
INSERT INTO "resource_attributes" ("resource_id", "resource_type", "attribute_key", "attribute_value") VALUES
-- Domestic Flight
('flight_001', 'flight', 'flight_type', 'domestic'),
('flight_001', 'flight', 'aircraft_type', 'B737'),
('flight_001', 'flight', 'departure_airport', 'LAX'),
('flight_001', 'flight', 'arrival_airport', 'JFK'),
('flight_001', 'flight', 'passenger_count', '150'),
('flight_001', 'flight', 'cargo_type', 'passenger'),
('flight_001', 'flight', 'priority_level', 'normal'),

-- International Flight
('flight_002', 'flight', 'flight_type', 'international'),
('flight_002', 'flight', 'aircraft_type', 'B777'),
('flight_002', 'flight', 'departure_airport', 'JFK'),
('flight_002', 'flight', 'arrival_airport', 'LHR'),
('flight_002', 'flight', 'passenger_count', '300'),
('flight_002', 'flight', 'cargo_type', 'mixed'),
('flight_002', 'flight', 'priority_level', 'high'),

-- Cargo Flight
('flight_003', 'flight', 'flight_type', 'cargo'),
('flight_003', 'flight', 'aircraft_type', 'B747'),
('flight_003', 'flight', 'departure_airport', 'ORD'),
('flight_003', 'flight', 'arrival_airport', 'FRA'),
('flight_003', 'flight', 'cargo_type', 'dangerous_goods'),
('flight_003', 'flight', 'priority_level', 'urgent');
```

### **Document Resource Attributes**
```sql
-- Document attributes
INSERT INTO "resource_attributes" ("resource_id", "resource_type", "attribute_key", "attribute_value") VALUES
-- Flight Manual
('doc_001', 'document', 'document_type', 'flight_manual'),
('doc_001', 'document', 'aircraft_type', 'B737'),
('doc_001', 'document', 'security_level', 'confidential'),
('doc_001', 'document', 'version', '2024.1'),
('doc_001', 'document', 'department', 'flight_operations'),

-- Maintenance Report
('doc_002', 'document', 'document_type', 'maintenance_report'),
('doc_002', 'document', 'aircraft_id', 'N12345'),
('doc_002', 'document', 'security_level', 'internal'),
('doc_002', 'document', 'status', 'pending_review'),
('doc_002', 'document', 'department', 'maintenance'),

-- Passenger Manifest
('doc_003', 'document', 'document_type', 'passenger_manifest'),
('doc_003', 'document', 'flight_id', 'flight_001'),
('doc_003', 'document', 'security_level', 'restricted'),
('doc_003', 'document', 'status', 'final'),
('doc_003', 'document', 'department', 'operations');
```

## 📋 **3. Environment Attributes Examples**

### **Time-Based Environment**
```javascript
// server/application/api/auth/environment-attributes.js
({
  getEnvironmentAttributes() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return {
      'time_of_day': hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
      'business_hours': hour >= 8 && hour <= 18,
      'night_shift': hour >= 22 || hour <= 6,
      'weekend': isWeekend,
      'holiday': this.isHoliday(now),
      'emergency_mode': this.isEmergencyMode(),
      'weather_conditions': await this.getWeatherConditions(),
      'system_load': await this.getSystemLoad(),
      'maintenance_window': this.isMaintenanceWindow(now)
    };
  }
});
```

## 📋 **4. Practical ABAC Policy Examples Using Attributes**

### **Example 1: Pilot Can Only Edit Flights They're Assigned To**
```sql
-- Policy: Pilots can edit only their assigned flights
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Pilot Flight Edit Access', 'Pilots can edit only their assigned flights during business hours', 'allow', 20);

-- Subject condition: User is a pilot
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'subject', 'certification_level', 'equals', 'captain'),
(1, 'subject', 'certification_level', 'equals', 'first_officer');

-- Resource condition: Flight is assigned to this pilot
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'resource', 'assigned_pilot_id', 'equals', '${user.id}');

-- Environment condition: During business hours
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(1, 'environment', 'business_hours', 'equals', 'true');
```

### **Example 2: Maintenance Engineers Can Access Aircraft Documents**
```sql
-- Policy: Maintenance engineers can access aircraft documents
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Maintenance Document Access', 'Maintenance engineers can access aircraft documents', 'allow', 15);

-- Subject conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(2, 'subject', 'department', 'equals', 'maintenance'),
(2, 'subject', 'certification_level', 'in', 'senior_technician,technician');

-- Resource conditions
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(2, 'resource', 'document_type', 'in', 'maintenance_report,technical_manual'),
(2, 'resource', 'aircraft_id', 'equals', '${user.aircraft_assignment}');
```

### **Example 3: Emergency Access for All Certified Personnel**
```sql
-- Policy: Emergency access for all certified personnel
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Emergency Access', 'All certified personnel can access critical systems during emergencies', 'allow', 25);

-- Subject condition: User has certification
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(3, 'subject', 'certification_level', 'not_equals', 'none');

-- Environment condition: Emergency mode is active
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(3, 'environment', 'emergency_mode', 'equals', 'true');
```

### **Example 4: Location-Based Access Control**
```sql
-- Policy: Users can only access flights at their assigned location
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Location-Based Access', 'Users can only access flights at their assigned location', 'allow', 18);

-- Subject condition: User has location
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(4, 'subject', 'location', 'not_equals', 'null');

-- Resource condition: Flight departs from user's location
INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_key", "operator", "attribute_value") VALUES
(4, 'resource', 'departure_airport', 'equals', '${user.location}');
```

## 📋 **5. Real-World Usage Examples**

### **Frontend Component with Attribute-Based UI**
```typescript
// trs_front/src/components/flight/FlightStatusCard.tsx
export const FlightStatusCard: React.FC<{ flight: Flight }> = ({ flight }) => {
  const { user } = useEnhancedAuth();
  const { hasPermission } = useEnhancedAuth();
  
  // Check if user can edit this specific flight based on attributes
  const canEditFlight = hasPermission('flight.edit') && 
    user?.attributes?.location === flight.departure_airport &&
    user?.attributes?.certification_level === 'captain';

  return (
    <div className="border rounded-lg p-4">
      <h3>Flight {flight.flight_number}</h3>
      <p>From: {flight.departure_airport}</p>
      <p>To: {flight.arrival_airport}</p>
      <p>Status: {flight.status}</p>
      
      {/* Only show edit button if user has permission AND is assigned */}
      {canEditFlight && (
        <button className="btn btn-primary">
          Edit Flight
        </button>
      )}
      
      {/* Show different options based on user attributes */}
      {user?.attributes?.department === 'maintenance' && (
        <button className="btn btn-secondary">
          View Maintenance Log
        </button>
      )}
      
      {user?.attributes?.department === 'operations' && (
        <button className="btn btn-info">
          View Passenger Manifest
        </button>
      )}
    </div>
  );
};
```

### **Backend API with Attribute-Based Authorization**
```javascript
// server/application/api/flight/update-status.js
({
  async updateFlightStatus(flightId, newStatus, context) {
    const user = context.user;
    const flight = await this.getFlight(flightId);
    
    // Check if user can edit this specific flight
    const canEdit = await this.checkFlightEditPermission(user, flight);
    
    if (!canEdit) {
      throw new Error('Access denied: You cannot edit this flight');
    }
    
    // Additional attribute-based checks
    if (flight.flight_type === 'international' && 
        user.attributes.security_clearance !== 'high') {
      throw new Error('Access denied: International flights require high security clearance');
    }
    
    if (flight.cargo_type === 'dangerous_goods' && 
        user.attributes.certification_level !== 'senior_technician') {
      throw new Error('Access denied: Dangerous goods require senior technician certification');
    }
    
    // Proceed with update
    await this.updateFlight(flightId, newStatus);
    
    // Log the action with attributes
    await auditLogger.logAction(user.id, flightId, 'update_flight_status', {
      old_status: flight.status,
      new_status: newStatus,
      user_location: user.attributes.location,
      user_department: user.attributes.department,
      flight_type: flight.flight_type
    });
  }
});
```

## 📋 **6. Dynamic Permission Calculation with Attributes**

```javascript
// server/application/api/auth/enhanced-permissions.js
({
  async calculateUserPermissions(userId, userAttributes, userProfile) {
    const permissions = [];
    
    // Get all possible permissions
    const allPermissions = [
      'flight.read', 'flight.edit', 'flight.delete',
      'document.read', 'document.edit', 'document.delete',
      'passenger.read', 'passenger.edit',
      'maintenance.read', 'maintenance.edit'
    ];
    
    for (const permission of allPermissions) {
      const [resource, action] = permission.split('.');
      
      // Check if user has this permission based on their attributes
      const hasPermission = await this.evaluatePermissionWithAttributes(
        userId, 
        action, 
        resource, 
        userAttributes
      );
      
      if (hasPermission) {
        permissions.push(permission);
      }
    }
    
    return permissions;
  },
  
  async evaluatePermissionWithAttributes(userId, action, resource, userAttributes) {
    // Example: Pilots can edit flights at their location
    if (resource === 'flight' && action === 'edit') {
      return userAttributes.certification_level?.includes('captain') ||
             userAttributes.certification_level?.includes('first_officer');
    }
    
    // Example: Maintenance can edit maintenance records
    if (resource === 'maintenance' && action === 'edit') {
      return userAttributes.department === 'maintenance';
    }
    
    // Example: High security clearance for international flights
    if (resource === 'flight' && action === 'read') {
      return userAttributes.security_clearance === 'high' ||
             userAttributes.security_clearance === 'medium';
    }
    
    return false;
  }
});
```

## 🎯 **Key Benefits of Attributes:**

### **1. Dynamic Access Control**
- ✅ **Location-based**: Users can only access flights at their airport
- ✅ **Time-based**: Different permissions during business hours vs. night shift
- ✅ **Role-based**: Different capabilities based on certification level
- ✅ **Context-aware**: Emergency mode gives broader access

### **2. Granular Security**
- ✅ **Resource-specific**: Can edit only assigned flights
- ✅ **Department-specific**: Maintenance can only access maintenance records
- ✅ **Clearance-based**: High clearance for sensitive operations

### **3. Flexible Policies**
- ✅ **Easy to modify**: Change policies without code changes
- ✅ **Complex conditions**: Multiple attributes in single policy
- ✅ **Real-time updates**: Attributes can change during session

This attribute-based approach gives you **maximum flexibility** while maintaining **strong security**! 🚀
