# Enhanced User Management, ABAC & Audit System - Implementation Plan

## 🎯 **System Overview**

This plan transforms your existing system into a comprehensive user management, ABAC (Attribute-Based Access Control), and audit logging platform with real-time session control and monitoring.

## 📋 **Phase 1: Core Infrastructure & Database Migration**

### **1.1 Database Setup**
```bash
# Run the enhanced schema
psql -d your_database -f server/application/db/enhanced_schema.sql

# Verify tables created
\dt user_*
\dt abac_*
\dt audit_*
```

### **1.2 Backend Core Services**

#### **Enhanced Session Manager**
```javascript
// server/src/enhancedSessionManager.js
class EnhancedSessionManager extends SessionManager {
  async createSession(token, data, context = {}) {
    const sessionData = {
      ...data,
      ip_address: context.ip,
      user_agent: context.userAgent,
      device_id: context.deviceId,
      location: context.location,
      expires_at: new Date(Date.now() + this.ttl * 1000)
    };

    // Store in Redis (existing)
    await super.createSession(token, sessionData);

    // Store in PostgreSQL for enhanced tracking
    await this.db.insert('user_sessions', {
      token,
      account_id: data.id,
      ip_address: context.ip,
      user_agent: context.userAgent,
      device_id: context.deviceId,
      location: context.location,
      status: 'active',
      expires_at: sessionData.expires_at,
      session_data: JSON.stringify(sessionData)
    });

    // Update user presence
    await this.updateUserPresence(data.id, 'online', token);
  }

  async updateUserPresence(accountId, status, sessionId = null) {
    await this.db.upsert('user_presence', {
      account_id: accountId,
      status,
      last_seen: new Date(),
      current_session_id: sessionId
    });
  }
}
```

#### **ABAC Policy Engine**
```javascript
// server/src/abacEngine.js
class ABACEngine {
  async evaluatePolicy(subject, resource, action, environment = {}) {
    const policies = await this.getActivePolicies();
    
    for (const policy of policies.sort((a, b) => b.priority - a.priority)) {
      const conditions = await this.getPolicyConditions(policy.policy_id);
      
      if (await this.evaluateConditions(conditions, subject, resource, action, environment)) {
        return policy.effect === 'allow';
      }
    }
    
    return false; // Default deny
  }

  async evaluateConditions(conditions, subject, resource, action, environment) {
    for (const condition of conditions) {
      const value = this.getAttributeValue(condition, subject, resource, action, environment);
      if (!this.compareValues(value, condition.attribute_value, condition.operator)) {
        return false;
      }
    }
    return true;
  }
}
```

#### **Audit Logger**
```javascript
// server/src/auditLogger.js
class AuditLogger {
  async logAction(accountId, sessionId, action, resource, details = {}) {
    const logEntry = {
      account_id: accountId,
      session_id: sessionId,
      action,
      resource_type: resource.type,
      resource_id: resource.id,
      ip_address: details.ip,
      user_agent: details.userAgent,
      success: details.success !== false,
      details: JSON.stringify(details),
      severity: details.severity || 'info'
    };

    await this.db.insert('audit_logs', logEntry);
  }

  async logSecurityEvent(eventType, severity, description, accountId = null, details = {}) {
    await this.db.insert('security_events', {
      event_type: eventType,
      severity,
      description,
      account_id: accountId,
      ip_address: details.ip,
      location: details.location,
      details: JSON.stringify(details)
    });
  }
}
```

### **1.3 Frontend Core Components**

#### **Enhanced Auth Context**
```typescript
// trs_front/src/contexts/EnhancedAuthContext.tsx
interface EnhancedAuthContextType {
  user: User | null;
  session: Session | null;
  isOnline: boolean;
  userPresence: UserPresence;
  permissions: Permission[];
  abacAttributes: Record<string, any>;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updatePresence: (status: PresenceStatus) => Promise<void>;
  checkPermission: (resource: string, action: string) => Promise<boolean>;
}

export const EnhancedAuthContext = createContext<EnhancedAuthContextType | null>(null);

export const EnhancedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [userPresence, setUserPresence] = useState<UserPresence | null>(null);

  // Real-time presence updates
  useEffect(() => {
    if (user) {
      const presenceInterval = setInterval(async () => {
        const presence = await api.getUserPresence(user.id);
        setUserPresence(presence);
        setIsOnline(presence.status === 'online');
      }, 30000); // Update every 30 seconds

      return () => clearInterval(presenceInterval);
    }
  }, [user]);

  return (
    <EnhancedAuthContext.Provider value={{
      user,
      session,
      isOnline,
      userPresence,
      // ... other methods
    }}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};
```

## 📋 **Phase 2: User Management & Session Control**

### **2.1 Backend API Endpoints**

#### **Enhanced Auth API**
```javascript
// server/application/api/auth/enhanced-auth.js
({
  async login(login, password, context = {}) {
    const user = await this.validateCredentials(login, password);
    if (!user) throw new Error('Invalid credentials');

    // Create enhanced session
    const token = this.generateToken();
    const sessionData = {
      id: user.id,
      login: user.login,
      roles: user.roles,
      attributes: await this.getUserAttributes(user.id)
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

  async logout(token, context = {}) {
    const session = await sessionManager.getSession(token);
    if (session) {
      await sessionManager.invalidateSession(token);
      await sessionManager.updateUserPresence(session.id, 'offline');
      
      await auditLogger.logAction(session.id, null, 'logout', { type: 'auth', id: 'logout' }, {
        ip: context.ip,
        success: true
      });
    }
  },

  async getUserPresence(accountId) {
    return await db.row('user_presence', ['*'], { account_id: accountId });
  },

  async updateUserPresence(accountId, status, message = '') {
    await db.update('user_presence', { 
      status, 
      status_message: message,
      last_seen: new Date()
    }, { account_id: accountId });
  }
});
```

#### **Session Management API**
```javascript
// server/application/api/auth/session-management.js
({
  async getActiveSessions(accountId) {
    return await db.rows('user_sessions', ['*'], { 
      account_id: accountId, 
      status: 'active' 
    });
  },

  async terminateSession(sessionId, terminatedBy) {
    await db.update('user_sessions', { 
      status: 'terminated' 
    }, { session_id: sessionId });

    await auditLogger.logAction(terminatedBy, null, 'session_terminated', {
      type: 'session',
      id: sessionId
    });
  },

  async getSessionAnalytics(accountId) {
    return await db.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        MAX(last_activity) as last_activity
      FROM user_sessions 
      WHERE account_id = $1
    `, [accountId]);
  }
});
```

### **2.2 Frontend User Management Components**

#### **User Dashboard**
```typescript
// trs_front/src/components/user-management/UserDashboard.tsx
export const UserDashboard: React.FC = () => {
  const { user, isOnline, userPresence } = useEnhancedAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    const [sessionsData, analyticsData] = await Promise.all([
      api.getActiveSessions(user!.id),
      api.getSessionAnalytics(user!.id)
    ]);
    setSessions(sessionsData);
    setAnalytics(analyticsData);
  };

  return (
    <div className="space-y-6">
      {/* User Status Card */}
      <UserStatusCard 
        user={user}
        isOnline={isOnline}
        presence={userPresence}
      />

      {/* Active Sessions */}
      <ActiveSessionsCard 
        sessions={sessions}
        onTerminateSession={handleTerminateSession}
      />

      {/* Session Analytics */}
      <SessionAnalyticsCard analytics={analytics} />
    </div>
  );
};
```

#### **Real-time Presence Component**
```typescript
// trs_front/src/components/user-management/UserPresence.tsx
export const UserPresence: React.FC = () => {
  const { userPresence, updatePresence } = useEnhancedAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (status: PresenceStatus) => {
    setIsUpdating(true);
    try {
      await updatePresence(status);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className={`w-3 h-3 rounded-full ${
        userPresence?.status === 'online' ? 'bg-green-500' :
        userPresence?.status === 'away' ? 'bg-yellow-500' :
        userPresence?.status === 'busy' ? 'bg-red-500' : 'bg-gray-500'
      }`} />
      
      <Select value={userPresence?.status} onValueChange={handleStatusChange}>
        <SelectTrigger disabled={isUpdating}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="online">Online</SelectItem>
          <SelectItem value="away">Away</SelectItem>
          <SelectItem value="busy">Busy</SelectItem>
          <SelectItem value="offline">Offline</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
```

## 📋 **Phase 3: ABAC Policy Management**

### **3.1 Backend ABAC Implementation**

#### **Policy Management API**
```javascript
// server/application/api/abac/policy-management.js
({
  async createPolicy(policyData) {
    const { name, description, effect, priority, conditions } = policyData;
    
    const policyId = await db.insert('abac_policies', {
      name,
      description,
      effect,
      priority,
      is_active: true
    });

    // Create conditions
    for (const condition of conditions) {
      await db.insert('policy_conditions', {
        policy_id: policyId,
        condition_type: condition.type,
        attribute_name: condition.attribute,
        operator: condition.operator,
        attribute_value: condition.value
      });
    }

    return policyId;
  },

  async evaluateAccess(subject, resource, action, environment = {}) {
    const abacEngine = new ABACEngine();
    return await abacEngine.evaluatePolicy(subject, resource, action, environment);
  },

  async getUserAttributes(accountId) {
    return await db.rows('user_attributes', ['*'], { account_id: accountId });
  },

  async setUserAttribute(accountId, key, value, type = 'string', isSensitive = false) {
    await db.upsert('user_attributes', {
      account_id: accountId,
      attribute_key: key,
      attribute_value: value,
      attribute_type: type,
      is_sensitive: isSensitive
    });
  }
});
```

### **3.2 Frontend ABAC Management**

#### **Policy Builder Component**
```typescript
// trs_front/src/components/abac/PolicyBuilder.tsx
export const PolicyBuilder: React.FC = () => {
  const [policy, setPolicy] = useState<ABACPolicy>({
    name: '',
    description: '',
    effect: 'allow',
    priority: 0,
    conditions: []
  });

  const addCondition = () => {
    setPolicy(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        type: 'subject',
        attribute: '',
        operator: 'equals',
        value: ''
      }]
    }));
  };

  const handleSubmit = async () => {
    try {
      await api.createPolicy(policy);
      toast.success('Policy created successfully');
    } catch (error) {
      toast.error('Failed to create policy');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create ABAC Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Policy Name"
              value={policy.name}
              onChange={(e) => setPolicy(prev => ({ ...prev, name: e.target.value }))}
            />
            <Select value={policy.effect} onValueChange={(value) => setPolicy(prev => ({ ...prev, effect: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Policy Description"
            value={policy.description}
            onChange={(e) => setPolicy(prev => ({ ...prev, description: e.target.value }))}
          />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4>Conditions</h4>
              <Button onClick={addCondition} size="sm">Add Condition</Button>
            </div>
            
            {policy.conditions.map((condition, index) => (
              <ConditionBuilder
                key={index}
                condition={condition}
                onChange={(updatedCondition) => {
                  const newConditions = [...policy.conditions];
                  newConditions[index] = updatedCondition;
                  setPolicy(prev => ({ ...prev, conditions: newConditions }));
                }}
                onRemove={() => {
                  const newConditions = policy.conditions.filter((_, i) => i !== index);
                  setPolicy(prev => ({ ...prev, conditions: newConditions }));
                }}
              />
            ))}
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Create Policy
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
```

## 📋 **Phase 4: Audit & Monitoring Dashboard**

### **4.1 Backend Audit API**

#### **Audit & Monitoring API**
```javascript
// server/application/api/audit/audit-management.js
({
  async getAuditLogs(filters = {}) {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.accountId) {
      query += ` AND account_id = $${paramIndex++}`;
      params.push(filters.accountId);
    }

    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1000';

    return await db.query(query, params);
  },

  async getSecurityEvents(filters = {}) {
    let query = 'SELECT * FROM security_events WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(filters.severity);
    }

    if (filters.resolved !== undefined) {
      query += ` AND resolved = $${paramIndex++}`;
      params.push(filters.resolved);
    }

    query += ' ORDER BY timestamp DESC LIMIT 500';

    return await db.query(query, params);
  },

  async getSystemAnalytics() {
    const [userStats, sessionStats, securityStats] = await Promise.all([
      db.query('SELECT COUNT(*) as total_users, COUNT(CASE WHEN status = "active" THEN 1 END) as active_users FROM user_profiles'),
      db.query('SELECT COUNT(*) as total_sessions, COUNT(CASE WHEN status = "active" THEN 1 END) as active_sessions FROM user_sessions'),
      db.query('SELECT COUNT(*) as total_events, COUNT(CASE WHEN resolved = false THEN 1 END) as unresolved_events FROM security_events')
    ]);

    return {
      users: userStats[0],
      sessions: sessionStats[0],
      security: securityStats[0]
    };
  }
});
```

### **4.2 Frontend Monitoring Dashboard**

#### **Admin Dashboard**
```typescript
// trs_front/src/components/admin/AdminDashboard.tsx
export const AdminDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    const [analyticsData, logsData, eventsData] = await Promise.all([
      api.getSystemAnalytics(),
      api.getAuditLogs({ limit: 50 }),
      api.getSecurityEvents({ resolved: false })
    ]);

    setAnalytics(analyticsData);
    setRecentAuditLogs(logsData);
    setSecurityEvents(eventsData);
  };

  return (
    <div className="space-y-6">
      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SystemOverviewCard
          title="Users"
          value={analytics?.users.total_users}
          subtitle={`${analytics?.users.active_users} active`}
          icon={Users}
        />
        <SystemOverviewCard
          title="Sessions"
          value={analytics?.sessions.total_sessions}
          subtitle={`${analytics?.sessions.active_sessions} active`}
          icon={Monitor}
        />
        <SystemOverviewCard
          title="Security Events"
          value={analytics?.security.total_events}
          subtitle={`${analytics?.security.unresolved_events} unresolved`}
          icon={Shield}
        />
      </div>

      {/* Real-time Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AuditLogsTable logs={recentAuditLogs} />
        <SecurityEventsTable events={securityEvents} />
      </div>

      {/* User Activity Map */}
      <UserActivityMap />
    </div>
  );
};
```

#### **Real-time Monitoring Components**
```typescript
// trs_front/src/components/admin/UserActivityMap.tsx
export const UserActivityMap: React.FC = () => {
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);

  useEffect(() => {
    const loadUserActivity = async () => {
      const activity = await api.getUserActivitySummary();
      setUserActivity(activity);
    };

    loadUserActivity();
    const interval = setInterval(loadUserActivity, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Real-time User Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {userActivity.map((user) => (
            <div key={user.account_id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  user.is_online ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <div>
                  <p className="font-medium">{user.login}</p>
                  <p className="text-sm text-gray-500">
                    {user.active_sessions} active sessions
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Last activity: {formatDistanceToNow(new Date(user.last_activity))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

## 📋 **Phase 5: Integration & Middleware**

### **5.1 Enhanced Middleware**

#### **ABAC Middleware**
```typescript
// trs_front/src/middleware/abacMiddleware.ts
export const abacMiddleware = (resource: string, action: string) => {
  return async (req: NextRequest) => {
    const session = await getSession(req);
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const hasPermission = await api.evaluateAccess({
      subject: session.user,
      resource: { type: resource, id: req.nextUrl.pathname },
      action,
      environment: {
        time: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers.get('user-agent')
      }
    });

    if (!hasPermission) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    return NextResponse.next();
  };
};
```

#### **Audit Middleware**
```typescript
// trs_front/src/middleware/auditMiddleware.ts
export const auditMiddleware = (action: string) => {
  return async (req: NextRequest, res: NextResponse) => {
    const session = await getSession(req);
    
    // Log the action
    if (session?.user) {
      await api.logAuditAction({
        accountId: session.user.id,
        sessionId: session.token,
        action,
        resource: {
          type: 'page',
          id: req.nextUrl.pathname
        },
        details: {
          ip: req.ip,
          userAgent: req.headers.get('user-agent'),
          method: req.method,
          success: res.status < 400
        }
      });
    }

    return res;
  };
};
```

### **5.2 Backend Integration**

#### **Enhanced Application Bootstrap**
```javascript
// server/src/enhancedApplicationBootstrap.js
class EnhancedApplicationBootstrap {
  constructor() {
    this.abacEngine = new ABACEngine();
    this.auditLogger = new AuditLogger();
    this.sessionManager = new EnhancedSessionManager();
  }

  async initialize() {
    // Initialize all enhanced services
    await this.sessionManager.initialize();
    await this.abacEngine.initialize();
    await this.auditLogger.initialize();

    // Set up periodic tasks
    this.setupPeriodicTasks();
  }

  setupPeriodicTasks() {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      const cleaned = await this.sessionManager.cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired sessions`);
      }
    }, 5 * 60 * 1000);

    // Update user presence status every minute
    setInterval(async () => {
      await this.sessionManager.updateUserPresenceStatus();
    }, 60 * 1000);
  }

  async handleRequest(req, res) {
    const startTime = Date.now();
    
    try {
      // Log request
      await this.auditLogger.logAction(
        req.user?.id,
        req.session?.token,
        req.method,
        { type: 'api', id: req.path },
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          method: req.method,
          path: req.path
        }
      );

      // Check ABAC permissions
      const hasAccess = await this.abacEngine.evaluateAccess(
        req.user,
        { type: 'api', id: req.path },
        req.method,
        {
          time: new Date().toISOString(),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      );

      if (!hasAccess) {
        await this.auditLogger.logSecurityEvent(
          'unauthorized_access',
          'high',
          `Unauthorized access attempt to ${req.path}`,
          req.user?.id,
          { ip: req.ip, path: req.path }
        );
        
        return res.status(403).json({ error: 'Access denied' });
      }

      // Process request
      const result = await this.processRequest(req, res);
      
      // Log successful response
      await this.auditLogger.logAction(
        req.user?.id,
        req.session?.token,
        `${req.method}_success`,
        { type: 'api', id: req.path },
        {
          ip: req.ip,
          duration: Date.now() - startTime,
          success: true
        }
      );

      return result;
    } catch (error) {
      // Log error
      await this.auditLogger.logAction(
        req.user?.id,
        req.session?.token,
        `${req.method}_error`,
        { type: 'api', id: req.path },
        {
          ip: req.ip,
          error: error.message,
          duration: Date.now() - startTime,
          success: false
        }
      );

      throw error;
    }
  }
}
```

## 🚀 **Deployment Strategy**

### **Phase 1: Database Migration (Week 1)**
1. Run enhanced schema migration
2. Set up initial ABAC policies
3. Configure audit logging

### **Phase 2: Backend Integration (Week 2)**
1. Implement enhanced session manager
2. Add ABAC policy engine
3. Integrate audit logging

### **Phase 3: Frontend Components (Week 3)**
1. Build user management dashboard
2. Create ABAC policy builder
3. Implement real-time presence

### **Phase 4: Monitoring & Analytics (Week 4)**
1. Deploy admin dashboard
2. Set up real-time monitoring
3. Configure alerts and notifications

### **Phase 5: Testing & Optimization (Week 5)**
1. Performance testing
2. Security testing
3. User acceptance testing

## 🔧 **Key Integration Points**

1. **Session Management**: Enhanced Redis + PostgreSQL hybrid
2. **ABAC Engine**: Real-time policy evaluation
3. **Audit Trail**: Comprehensive logging and monitoring
4. **User Presence**: Real-time status tracking
5. **Security Events**: Automated threat detection

This plan creates a cohesive system where all components work together as a single organism, providing comprehensive user management, access control, and monitoring capabilities.
