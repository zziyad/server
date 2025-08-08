# Universal Authentication System - Windows Setup Guide

## 🎯 **Prerequisites**

### **1. Install PostgreSQL on Windows**

1. **Download PostgreSQL:**
   - Go to: https://www.postgresql.org/download/windows/
   - Download the latest version (recommended: PostgreSQL 15 or 16)

2. **Install PostgreSQL:**
   - Run the installer as Administrator
   - Choose installation directory (default: `C:\Program Files\PostgreSQL\15`)
   - Set password for `postgres` user (remember this password!)
   - Keep default port: `5432`
   - Complete the installation

3. **Verify Installation:**
   ```cmd
   psql --version
   ```

### **2. Add PostgreSQL to PATH (if not already done)**

1. **Open System Properties:**
   - Right-click on "This PC" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"

2. **Add to PATH:**
   - Under "System variables", find "Path"
   - Click "Edit" → "New"
   - Add: `C:\Program Files\PostgreSQL\15\bin`
   - Click "OK" on all dialogs

3. **Verify PATH:**
   ```cmd
   echo %PATH%
   ```

## 🚀 **Database Setup**

### **Option 1: Automated Setup (Recommended)**

1. **Navigate to the database directory:**
   ```cmd
   cd server\application\db
   ```

2. **Run the Windows setup script:**
   ```cmd
   setup.bat
   ```

3. **Follow the prompts:**
   - The script will check if PostgreSQL is running
   - It will create the `auth` database
   - It will apply the schema and seed data
   - It will verify the setup

### **Option 2: Manual Setup**

If the automated script doesn't work, you can run the commands manually:

1. **Create the database:**
   ```cmd
   createdb -h localhost -p 5432 -U postgres auth
   ```

2. **Apply the schema:**
   ```cmd
   psql -h localhost -p 5432 -U postgres -d auth -f schema.sql
   ```

3. **Apply the seed data:**
   ```cmd
   psql -h localhost -p 5432 -U postgres -d auth -f seeds.sql
   ```

## 🔧 **Troubleshooting**

### **Common Issues:**

#### **1. "psql is not recognized"**
- **Solution:** Add PostgreSQL bin directory to PATH
- **Path:** `C:\Program Files\PostgreSQL\15\bin`

#### **2. "Connection refused"**
- **Solution:** Start PostgreSQL service
- **Command:** `net start postgresql-x64-15`

#### **3. "Authentication failed"**
- **Solution:** Check your PostgreSQL password
- **Test:** `psql -h localhost -U postgres -d postgres`

#### **4. "Database already exists"**
- **Solution:** Drop and recreate
- **Command:** `dropdb -h localhost -U postgres auth`

### **Manual PostgreSQL Service Management:**

```cmd
REM Start PostgreSQL service
net start postgresql-x64-15

REM Stop PostgreSQL service
net stop postgresql-x64-15

REM Check service status
sc query postgresql-x64-15
```

## 📋 **Verification**

### **Test Database Connection:**
```cmd
psql -h localhost -p 5432 -U postgres -d auth
```

### **Check Tables:**
```sql
\dt
```

### **Check Sample Data:**
```sql
SELECT user_id, email, name, role FROM users;
```

### **Check Permissions:**
```sql
SELECT u.email, up.permission 
FROM users u 
JOIN user_permissions up ON u.user_id = up.user_id 
ORDER BY u.email, up.permission;
```

## 🔑 **Default Credentials**

After setup, you'll have these test users:

| Email | Password | Role |
|-------|----------|------|
| admin@authsystem.com | admin123 | admin |
| manager@authsystem.com | admin123 | event_manager |
| driver@authsystem.com | admin123 | driver |
| coordinator@authsystem.com | admin123 | coordinator |
| user@authsystem.com | admin123 | user |

## 📊 **Database Structure**

The setup creates these tables:

- **`users`** - Core user information
- **`user_permissions`** - User permissions (normalized)
- **`user_attributes`** - User attributes for ABAC
- **`user_sessions`** - Session management
- **`abac_policies`** - ABAC policy definitions
- **`policy_conditions`** - Policy conditions
- **`audit_logs`** - Audit logging (partitioned)

## 🎯 **Next Steps**

1. **Update your application configuration** to use the `auth` database
2. **Test the connection** with the provided credentials
3. **Start building your authentication API** using the schema
4. **Implement the ABAC policy engine** for advanced access control

## 📞 **Support**

If you encounter issues:

1. **Check PostgreSQL logs:**
   ```cmd
   type "C:\Program Files\PostgreSQL\15\data\pg_log\postgresql-*.log"
   ```

2. **Verify PostgreSQL is running:**
   ```cmd
   pg_isready -h localhost -p 5432
   ```

3. **Test basic connection:**
   ```cmd
   psql -h localhost -U postgres -d postgres
   ```

The database is now ready for your Universal Authentication System! 🎉
