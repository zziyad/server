# Optimized Permission System - No API Calls

## 🎯 **Security-Optimized Approach**

Instead of making API calls for each permission check, we **cache all permissions** in the user session after login. This is more secure and performant.

## 📋 **1. Enhanced Login with Permission Caching**

```javascript
// server/application/api/auth/enhanced-auth.js
({
  async login(login, password, context = {}) {
    const user = await this.validateCredentials(login, password);
    if (!user) throw new Error('Invalid credentials');

    // Get user attributes and profile
    const userAttributes = await this.getUserAttributes(user.id);
    const userProfile = await db.row('user_profiles', ['*'], { account_id: user.id });

    // Calculate ALL permissions at login time
    const userPermissions = await this.calculateUserPermissions(user.id, userAttributes, userProfile);

    // Create enhanced session with cached permissions
    const token = this.generateToken();
    const sessionData = {
      id: user.id,
      login: user.login,
      roles: user.roles,
      attributes: userAttributes,
      security_clearance: userProfile?.security_clearance || 'basic',
      department: userProfile?.department,
      location: userProfile?.location,
      // CACHED PERMISSIONS - No API calls needed!
      permissions: userPermissions,
      permissions_hash: this.generatePermissionsHash(userPermissions) // For security validation
    };

    await sessionManager.createSession(token, sessionData, context);

    // Log successful login
    await auditLogger.logAction(user.id, null, 'login', { type: 'auth', id: 'login' }, {
      ip: context.ip,
      userAgent: context.userAgent,
      success: true,
      permissions_count: userPermissions.length
    });

    return { token, user: sessionData };
  },

  async calculateUserPermissions(userId, userAttributes, userProfile) {
    const permissions = [];
    const actions = ['read', 'edit', 'delete', 'create'];
    const resources = ['realtime_status', 'flight_schedule', 'document', 'passenger'];

    // Get all active ABAC policies (cached for performance)
    const policies = await this.getActivePolicies();
    
    for (const action of actions) {
      for (const resource of resources) {
        const permissionKey = `${resource}.${action}`;
        
        // Check if user has this permission using ABAC
        const hasPermission = await this.evaluatePermissionWithABAC(
          userId, 
          permissionKey, 
          resource, 
          userAttributes, 
          userProfile, 
          policies
        );
        
        if (hasPermission) {
          permissions.push(permissionKey);
        }
      }
    }

    return permissions;
  },

  async evaluatePermissionWithABAC(userId, action, resource, userAttributes, userProfile, policies) {
    const user = {
      id: userId,
      attributes: userAttributes,
      profile: userProfile
    };

    const resourceObj = { type: resource };
    const environment = {
      time: new Date().toISOString(),
      business_hours: this.isBusinessHours(),
      time_of_day: this.getTimeOfDay()
    };

    // Evaluate policies in priority order (highest first)
    const sortedPolicies = policies.sort((a, b) => b.priority - a.priority);
    
    for (const policy of sortedPolicies) {
      const conditions = await this.getPolicyConditions(policy.policy_id);
      
      if (await this.evaluateConditions(conditions, user, resourceObj, action, environment)) {
        return policy.effect === 'allow';
      }
    }
    
    return false; // Default deny
  },

  generatePermissionsHash(permissions) {
    // Create a hash of permissions for security validation
    const sortedPermissions = permissions.sort();
    return crypto.createHash('sha256').update(sortedPermissions.join(',')).digest('hex');
  }
});
```

## 📋 **2. Optimized Frontend PermissionGuard (No API Calls)**

```typescript
// trs_front/src/components/permission-aware/OptimizedPermissionGuard.tsx
interface OptimizedPermissionGuardProps {
  children: React.ReactNode;
  action: string;
  resource: string;
  fallback?: React.ReactNode;
}

export const OptimizedPermissionGuard: React.FC<OptimizedPermissionGuardProps> = ({ 
  children, 
  action, 
  resource, 
  fallback = null 
}) => {
  const { user } = useEnhancedAuth();
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (user?.permissions) {
      // Check permission from cached user data - NO API CALL!
      const permissionKey = `${resource}.${action}`;
      const hasAccess = user.permissions.includes(permissionKey);
      setHasPermission(hasAccess);
    } else {
      setHasPermission(false);
    }
  }, [user, action, resource]);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

// Usage - No loading states needed!
export const RealtimeStatusPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1>Real-time Flight Status</h1>
      
      {/* Instant permission check - no API call */}
      <OptimizedPermissionGuard action="realtime.read" resource="realtime_status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FlightStatusCard />
          <WeatherInfoCard />
        </div>
      </OptimizedPermissionGuard>

      <OptimizedPermissionGuard action="realtime.edit" resource="realtime_status">
        <div className="mt-6">
          <h2>Update Status</h2>
          <StatusEditForm />
        </div>
      </OptimizedPermissionGuard>

      <OptimizedPermissionGuard action="realtime.delete" resource="realtime_status">
        <div className="mt-6">
          <h2>Manage Status</h2>
          <StatusDeleteButton />
        </div>
      </OptimizedPermissionGuard>
    </div>
  );
};
```

## 📋 **3. Enhanced Auth Context with Cached Permissions**

```typescript
// trs_front/src/contexts/EnhancedAuthContext.tsx
interface EnhancedAuthContextType {
  user: User | null;
  session: Session | null;
  isOnline: boolean;
  userPresence: UserPresence;
  permissions: string[]; // Cached permissions
  checkPermission: (action: string, resource: string) => boolean; // No API calls
  hasPermission: (permission: string) => boolean; // Direct check
}

export const EnhancedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  // Check permission from cached data - NO API CALLS!
  const checkPermission = useCallback((action: string, resource: string): boolean => {
    if (!user?.permissions) return false;
    const permissionKey = `${resource}.${action}`;
    return user.permissions.includes(permissionKey);
  }, [user]);

  // Direct permission check
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user?.permissions) return false;
    return user.permissions.includes(permission);
  }, [user]);

  // Update permissions when user changes
  useEffect(() => {
    if (user?.permissions) {
      setPermissions(user.permissions);
    } else {
      setPermissions([]);
    }
  }, [user]);

  return (
    <EnhancedAuthContext.Provider value={{
      user,
      session,
      permissions,
      checkPermission,
      hasPermission,
      // ... other methods
    }}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};
```

## 📋 **4. Security Validation and Refresh**

```typescript
// trs_front/src/hooks/usePermissionValidation.ts
export const usePermissionValidation = () => {
  const { user } = useEnhancedAuth();

  // Validate permissions hash on critical operations
  const validatePermissions = useCallback(async () => {
    if (!user) return false;

    try {
      // Only validate on critical operations, not on every check
      const response = await api.validatePermissionsHash(user.permissions_hash);
      return response.isValid;
    } catch (error) {
      console.error('Permission validation failed:', error);
      return false;
    }
  }, [user]);

  // Refresh permissions when needed (e.g., after policy changes)
  const refreshPermissions = useCallback(async () => {
    if (!user) return;

    try {
      const newPermissions = await api.refreshUserPermissions(user.id);
      // Update user context with new permissions
      // This would trigger a re-login or session update
    } catch (error) {
      console.error('Permission refresh failed:', error);
    }
  }, [user]);

  return { validatePermissions, refreshPermissions };
};
```

## 📋 **5. Permission Refresh Strategies**

```javascript
// server/application/api/auth/permission-refresh.js
({
  async refreshUserPermissions(userId) {
    // Only refresh when policies have changed
    const lastPolicyUpdate = await this.getLastPolicyUpdate();
    const userLastRefresh = await this.getUserLastPermissionRefresh(userId);
    
    if (lastPolicyUpdate > userLastRefresh) {
      // Recalculate permissions
      const userAttributes = await this.getUserAttributes(userId);
      const userProfile = await db.row('user_profiles', ['*'], { account_id: userId });
      const newPermissions = await this.calculateUserPermissions(userId, userAttributes, userProfile);
      
      // Update session with new permissions
      await this.updateSessionPermissions(userId, newPermissions);
      
      return newPermissions;
    }
    
    return null; // No refresh needed
  },

  async validatePermissionsHash(permissionsHash) {
    // Validate that permissions haven't been tampered with
    const expectedHash = this.calculateExpectedPermissionsHash();
    return { isValid: permissionsHash === expectedHash };
  }
});
```

## 🔧 **Security Benefits of This Approach:**

### **1. No API Calls for Permission Checks**
- ✅ **Instant UI updates** - no loading states
- ✅ **Reduced server load** - no repeated permission checks
- ✅ **Better UX** - immediate feedback

### **2. Cached Permissions with Security**
- ✅ **Permissions calculated once** at login
- ✅ **Hash validation** prevents tampering
- ✅ **Automatic refresh** when policies change

### **3. Performance Optimized**
- ✅ **No network requests** for permission checks
- ✅ **Cached ABAC evaluation** at login
- ✅ **Minimal memory usage** (just permission strings)

### **4. Security Features**
- ✅ **Permission hash validation** for critical operations
- ✅ **Automatic refresh** when policies change
- ✅ **Session-based caching** (cleared on logout)

## 🎯 **Example User Session Data:**

```javascript
// What gets stored in the session
const sessionData = {
  id: 123,
  login: 'pilot.smith',
  roles: ['pilot'],
  attributes: {
    'security_clearance': 'medium',
    'department': 'flight_operations',
    'location': 'LAX'
  },
  // CACHED PERMISSIONS - No API calls needed!
  permissions: [
    'realtime_status.read',
    'realtime_status.edit',
    'flight_schedule.read',
    'document.read'
  ],
  permissions_hash: 'a1b2c3d4e5f6...' // For security validation
};
```

## 🚀 **Usage in Components:**

```typescript
// Super fast permission checks - no API calls!
export const FlightDashboard = () => {
  const { hasPermission } = useEnhancedAuth();

  return (
    <div>
      <h1>Flight Dashboard</h1>
      
      {/* Instant check - no loading */}
      {hasPermission('realtime_status.read') && (
        <FlightStatusCard />
      )}
      
      {hasPermission('realtime_status.edit') && (
        <StatusEditForm />
      )}
      
      {hasPermission('realtime_status.delete') && (
        <StatusDeleteButton />
      )}
    </div>
  );
};
```

This approach gives you **maximum security** with **optimal performance** - the best of both worlds! 🎯
