# ABAC Implementation for Flight Management System

## 🎯 **Your Use Case: Flight Management with Granular Permissions**

You have a flight management system with pages like:
- **Flight Schedules** (`/flight-schedules`)
- **Real-time Status** (`/realtime-status`) 
- **Documents** (`/documents`)
- **Passengers** (`/passengers`)

Each page has different CRUD operations that users should only see if they have specific permissions.

## 📋 **ABAC Policy Examples for Your System**

### **1. Real-time Status Page Permissions**

```sql
-- Policy: Allow users to READ real-time status
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Realtime Status Read Access', 'Allow users to read real-time status data', 'allow', 10);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'realtime.read'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'realtime_status'),
(LASTVAL(), 'subject', 'user_role', 'in', '["pilot", "dispatcher", "admin"]');

-- Policy: Allow users to EDIT real-time status
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Realtime Status Edit Access', 'Allow users to edit real-time status data', 'allow', 15);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'realtime.edit'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'realtime_status'),
(LASTVAL(), 'subject', 'user_role', 'in', '["pilot", "admin"]'),
(LASTVAL(), 'environment', 'business_hours', 'equals', 'true');

-- Policy: Allow users to DELETE real-time status (only admins)
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Realtime Status Delete Access', 'Allow admins to delete real-time status data', 'allow', 20);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'realtime.delete'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'realtime_status'),
(LASTVAL(), 'subject', 'user_role', 'equals', 'admin');
```

### **2. Flight Schedules Permissions**

```sql
-- Policy: Allow users to VIEW flight schedules
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Flight Schedule Read Access', 'Allow users to view flight schedules', 'allow', 10);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'schedule.read'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'flight_schedule'),
(LASTVAL(), 'subject', 'user_role', 'in', '["pilot", "dispatcher", "admin", "crew"]');

-- Policy: Allow users to EDIT flight schedules (with restrictions)
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Flight Schedule Edit Access', 'Allow authorized users to edit flight schedules', 'allow', 15);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'schedule.edit'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'flight_schedule'),
(LASTVAL(), 'subject', 'user_role', 'in', '["dispatcher", "admin"]'),
(LASTVAL(), 'environment', 'time_of_day', 'in', '["business_hours", "emergency"]');
```

### **3. Documents Permissions**

```sql
-- Policy: Allow users to VIEW documents based on clearance
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Document Read Access', 'Allow users to read documents based on clearance', 'allow', 10);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'document.read'),
(LASTVAL(), 'resource', 'resource_type', 'equals', 'document'),
(LASTVAL(), 'subject', 'security_clearance', 'greater_than_or_equal', 'resource.clearance_level');

-- Policy: DENY access to sensitive documents outside business hours
INSERT INTO "abac_policies" ("name", "description", "effect", "priority") VALUES
('Sensitive Document Time Restriction', 'Deny access to sensitive documents outside business hours', 'deny', 25);

INSERT INTO "policy_conditions" ("policy_id", "condition_type", "attribute_name", "operator", "attribute_value") VALUES
(LASTVAL(), 'action', 'action', 'equals', 'document.read'),
(LASTVAL(), 'resource', 'sensitivity_level', 'equals', 'high'),
(LASTVAL(), 'environment', 'business_hours', 'equals', 'false');
```

## 🔧 **Backend Implementation for Your Use Case**

### **1. Enhanced Auth API with Permission Checking**

```javascript
// server/application/api/auth/enhanced-auth.js
({
  async login(login, password, context = {}) {
    const user = await this.validateCredentials(login, password);
    if (!user) throw new Error('Invalid credentials');

    // Get user attributes for ABAC
    const userAttributes = await this.getUserAttributes(user.id);
    const userProfile = await db.row('user_profiles', ['*'], { account_id: user.id });

    // Create enhanced session with permissions
    const token = this.generateToken();
    const sessionData = {
      id: user.id,
      login: user.login,
      roles: user.roles,
      attributes: userAttributes,
      security_clearance: userProfile?.security_clearance || 'basic',
      department: userProfile?.department,
      location: userProfile?.location
    };

    await sessionManager.createSession(token, sessionData, context);

    // Log successful login
    await auditLogger.logAction(user.id, null, 'login', { type: 'auth', id: 'login' }, {
      ip: context.ip,
      userAgent: context.userAgent,
      success: true
    });

    return { token, user: sessionData };
  },

  async checkPermission(userId, action, resourceType, resourceId = null) {
    const user = await this.getUserWithAttributes(userId);
    const resource = { type: resourceType, id: resourceId };
    const environment = {
      time: new Date().toISOString(),
      business_hours: this.isBusinessHours(),
      time_of_day: this.getTimeOfDay()
    };

    const abacEngine = new ABACEngine();
    return await abacEngine.evaluatePolicy(user, resource, action, environment);
  },

  async getUserPermissions(userId) {
    const permissions = [];
    const actions = ['read', 'edit', 'delete', 'create'];
    const resources = ['realtime_status', 'flight_schedule', 'document', 'passenger'];

    for (const action of actions) {
      for (const resource of resources) {
        const hasPermission = await this.checkPermission(userId, `${resource}.${action}`, resource);
        if (hasPermission) {
          permissions.push(`${resource}.${action}`);
        }
      }
    }

    return permissions;
  }
});
```

### **2. Frontend Permission-Aware Components**

```typescript
// trs_front/src/components/permission-aware/PermissionGuard.tsx
interface PermissionGuardProps {
  children: React.ReactNode;
  action: string;
  resource: string;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  children, 
  action, 
  resource, 
  fallback = null 
}) => {
  const { user, checkPermission } = useEnhancedAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserPermission = async () => {
      if (user) {
        const permission = await checkPermission(action, resource);
        setHasPermission(permission);
      }
      setIsLoading(false);
    };

    checkUserPermission();
  }, [user, action, resource]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

// Usage in your components
export const RealtimeStatusPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1>Real-time Flight Status</h1>
      
      {/* Read permission - always visible */}
      <PermissionGuard action="realtime.read" resource="realtime_status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FlightStatusCard />
          <WeatherInfoCard />
        </div>
      </PermissionGuard>

      {/* Edit permission - only visible if user has edit rights */}
      <PermissionGuard action="realtime.edit" resource="realtime_status">
        <div className="mt-6">
          <h2>Update Status</h2>
          <StatusEditForm />
        </div>
      </PermissionGuard>

      {/* Delete permission - only for admins */}
      <PermissionGuard action="realtime.delete" resource="realtime_status">
        <div className="mt-6">
          <h2>Manage Status</h2>
          <StatusDeleteButton />
        </div>
      </PermissionGuard>
    </div>
  );
};
```

### **3. Dynamic Menu Based on Permissions**

```typescript
// trs_front/src/components/navigation/DynamicNavigation.tsx
export const DynamicNavigation: React.FC = () => {
  const { user, userPermissions } = useEnhancedAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (user && userPermissions) {
      const availableMenuItems = [
        {
          label: 'Flight Schedules',
          href: '/flight-schedules',
          requiredPermission: 'schedule.read',
          resource: 'flight_schedule'
        },
        {
          label: 'Real-time Status',
          href: '/realtime-status',
          requiredPermission: 'realtime.read',
          resource: 'realtime_status'
        },
        {
          label: 'Documents',
          href: '/documents',
          requiredPermission: 'document.read',
          resource: 'document'
        },
        {
          label: 'Passengers',
          href: '/passengers',
          requiredPermission: 'passenger.read',
          resource: 'passenger'
        }
      ];

      const filteredItems = availableMenuItems.filter(item => 
        userPermissions.includes(item.requiredPermission)
      );

      setMenuItems(filteredItems);
    }
  }, [user, userPermissions]);

  return (
    <nav className="space-y-2">
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
```

### **4. ABAC Policy Management Interface**

```typescript
// trs_front/src/components/admin/PolicyManager.tsx
export const PolicyManager: React.FC = () => {
  const [policies, setPolicies] = useState<ABACPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<ABACPolicy | null>(null);

  const predefinedResources = [
    { type: 'realtime_status', actions: ['read', 'edit', 'delete'] },
    { type: 'flight_schedule', actions: ['read', 'edit', 'delete', 'create'] },
    { type: 'document', actions: ['read', 'edit', 'delete', 'create'] },
    { type: 'passenger', actions: ['read', 'edit', 'delete', 'create'] }
  ];

  const predefinedRoles = ['pilot', 'dispatcher', 'admin', 'crew', 'passenger'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">ABAC Policy Management</h2>
        <Button onClick={() => setSelectedPolicy({})}>Create New Policy</Button>
      </div>

      {/* Policy List */}
      <div className="grid grid-cols-1 gap-4">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.policy_id}
            policy={policy}
            onEdit={() => setSelectedPolicy(policy)}
            onDelete={handleDeletePolicy}
          />
        ))}
      </div>

      {/* Policy Editor */}
      {selectedPolicy && (
        <PolicyEditor
          policy={selectedPolicy}
          resources={predefinedResources}
          roles={predefinedRoles}
          onSave={handleSavePolicy}
          onCancel={() => setSelectedPolicy(null)}
        />
      )}
    </div>
  );
};
```

## 🎯 **Real-world Example: Your Flight System**

### **Scenario 1: Pilot Login**
```javascript
// Pilot logs in
const pilotSession = {
  id: 123,
  login: 'pilot.smith',
  roles: ['pilot'],
  attributes: {
    'security_clearance': 'medium',
    'department': 'flight_operations',
    'location': 'LAX'
  }
};

// Pilot visits /realtime-status
// ABAC checks:
// ✅ realtime.read - ALLOWED (pilot role)
// ✅ realtime.edit - ALLOWED (pilot role, business hours)
// ❌ realtime.delete - DENIED (admin only)
```

### **Scenario 2: Dispatcher Login**
```javascript
// Dispatcher logs in
const dispatcherSession = {
  id: 456,
  login: 'dispatcher.jones',
  roles: ['dispatcher'],
  attributes: {
    'security_clearance': 'high',
    'department': 'operations',
    'location': 'HQ'
  }
};

// Dispatcher visits /flight-schedules
// ABAC checks:
// ✅ schedule.read - ALLOWED (dispatcher role)
// ✅ schedule.edit - ALLOWED (dispatcher role, business hours)
// ❌ schedule.delete - DENIED (admin only)
```

### **Scenario 3: Admin Login**
```javascript
// Admin logs in
const adminSession = {
  id: 789,
  login: 'admin.wilson',
  roles: ['admin'],
  attributes: {
    'security_clearance': 'top',
    'department': 'management',
    'location': 'HQ'
  }
};

// Admin visits any page
// ABAC checks:
// ✅ ALL permissions - ALLOWED (admin role)
```

## 🔧 **Key Benefits for Your System**

1. **Granular Control**: `realtime.read`, `realtime.edit`, `realtime.delete`
2. **Role-based Access**: Different permissions for pilots, dispatchers, admins
3. **Time-based Restrictions**: Business hours vs after-hours access
4. **Location-based Access**: Different permissions based on user location
5. **Security Clearance**: Document access based on clearance levels
6. **Dynamic UI**: Components show/hide based on permissions
7. **Audit Trail**: All access attempts logged for security

## 🚀 **Implementation Steps**

1. **Set up ABAC policies** for your flight system
2. **Create permission-aware components** that check permissions
3. **Build dynamic navigation** that shows only accessible pages
4. **Implement real-time permission checking** on page load
5. **Add audit logging** for all permission checks

This ABAC system gives you **precise control** over what each user can see and do in your flight management system, exactly as you described!
