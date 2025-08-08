@echo off
REM Universal Authentication System Database Setup Script for Windows
REM Database: auth

echo 🚀 Setting up Universal Authentication System Database...

REM Configuration
set DB_NAME=auth
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432

REM Check if PostgreSQL is running
echo [INFO] Checking PostgreSQL connection...
pg_isready -h %DB_HOST% -p %DB_PORT% -U %DB_USER% >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL is not running or not accessible
    echo [ERROR] Please start PostgreSQL and try again
    pause
    exit /b 1
)
echo [SUCCESS] PostgreSQL is running

REM Create database if it doesn't exist
echo [INFO] Creating database '%DB_NAME%' if it doesn't exist...

REM Check if database exists
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -lqt | findstr /C:"%DB_NAME%" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Database '%DB_NAME%' already exists
    set /p choice="Do you want to drop and recreate it? (y/N): "
    if /i "%choice%"=="y" (
        echo [INFO] Dropping existing database...
        dropdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME%
        echo [SUCCESS] Database dropped
    ) else (
        echo [WARNING] Using existing database
        goto :run_schema
    )
)

REM Create database
createdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create database
    pause
    exit /b 1
)
echo [SUCCESS] Database '%DB_NAME%' created successfully

:run_schema
REM Run schema file
echo [INFO] Running schema file...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f schema.sql
if %errorlevel% neq 0 (
    echo [ERROR] Failed to apply schema
    pause
    exit /b 1
)
echo [SUCCESS] Schema applied successfully

REM Run seed file
echo [INFO] Running seed data...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f seeds.sql
if %errorlevel% neq 0 (
    echo [ERROR] Failed to apply seed data
    pause
    exit /b 1
)
echo [SUCCESS] Seed data applied successfully

REM Verify setup
echo [INFO] Verifying database setup...

REM Check if tables exist
for %%t in (users user_permissions user_attributes user_sessions abac_policies policy_conditions audit_logs) do (
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '%%t');" | findstr /C:"t" >nul
    if %errorlevel% equ 0 (
        echo [SUCCESS] Table '%%t' exists
    ) else (
        echo [ERROR] Table '%%t' is missing
        pause
        exit /b 1
    )
)

REM Check if admin user exists
for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@authsystem.com';"') do set ADMIN_COUNT=%%i
if "%ADMIN_COUNT%"=="1" (
    echo [SUCCESS] Admin user created successfully
) else (
    echo [ERROR] Admin user not found
    pause
    exit /b 1
)

REM Check sample data
for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM users;"') do set USER_COUNT=%%i
for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM user_permissions;"') do set PERMISSION_COUNT=%%i
for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COUNT(*) FROM abac_policies;"') do set POLICY_COUNT=%%i

echo [SUCCESS] Database setup complete:
echo   - Users: %USER_COUNT%
echo   - Permissions: %PERMISSION_COUNT%
echo   - Policies: %POLICY_COUNT%

REM Show connection info
echo.
echo [INFO] Database connection information:
echo   - Database: %DB_NAME%
echo   - Host: %DB_HOST%
echo   - Port: %DB_PORT%
echo   - User: %DB_USER%
echo.
echo [INFO] Test connection with:
echo   psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME%
echo.
echo [INFO] Default admin credentials:
echo   - Email: admin@authsystem.com
echo   - Password: admin123
echo.
echo 🎉 Database setup completed successfully!
echo.
echo [INFO] Next steps:
echo   1. Update your application configuration to use database '%DB_NAME%'
echo   2. Test the connection with the provided credentials
echo   3. Start building your authentication API
echo.
pause
