#!/bin/bash

# Universal Authentication System Database Setup Script
# Database: auth

set -e  # Exit on any error

echo "🚀 Setting up Universal Authentication System Database..."

# Configuration
DB_NAME="auth"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is running
check_postgres() {
    print_status "Checking PostgreSQL connection..."
    if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
        print_error "PostgreSQL is not running or not accessible"
        print_error "Please start PostgreSQL and try again"
        exit 1
    fi
    print_success "PostgreSQL is running"
}

# Create database if it doesn't exist
create_database() {
    print_status "Creating database '$DB_NAME' if it doesn't exist..."
    
    # Check if database exists
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        print_warning "Database '$DB_NAME' already exists"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Dropping existing database..."
            dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
            print_success "Database dropped"
        else
            print_warning "Using existing database"
            return 0
        fi
    fi
    
    # Create database
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    print_success "Database '$DB_NAME' created successfully"
}

# Run schema file
run_schema() {
    print_status "Running schema file..."
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql; then
        print_success "Schema applied successfully"
    else
        print_error "Failed to apply schema"
        exit 1
    fi
}

# Run seed file
run_seeds() {
    print_status "Running seed data..."
    if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f seeds.sql; then
        print_success "Seed data applied successfully"
    else
        print_error "Failed to apply seed data"
        exit 1
    fi
}

# Verify setup
verify_setup() {
    print_status "Verifying database setup..."
    
    # Check if tables exist
    TABLES=("users" "user_permissions" "user_attributes" "user_sessions" "abac_policies" "policy_conditions" "audit_logs")
    
    for table in "${TABLES[@]}"; do
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" | grep -q t; then
            print_success "Table '$table' exists"
        else
            print_error "Table '$table' is missing"
            exit 1
        fi
    done
    
    # Check if admin user exists
    ADMIN_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@authsystem.com';" | xargs)
    if [ "$ADMIN_COUNT" -eq 1 ]; then
        print_success "Admin user created successfully"
    else
        print_error "Admin user not found"
        exit 1
    fi
    
    # Check if sample data exists
    USER_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;" | xargs)
    PERMISSION_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM user_permissions;" | xargs)
    POLICY_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM abac_policies;" | xargs)
    
    print_success "Database setup complete:"
    echo "  - Users: $USER_COUNT"
    echo "  - Permissions: $PERMISSION_COUNT"
    echo "  - Policies: $POLICY_COUNT"
}

# Show connection info
show_connection_info() {
    print_status "Database connection information:"
    echo "  - Database: $DB_NAME"
    echo "  - Host: $DB_HOST"
    echo "  - Port: $DB_PORT"
    echo "  - User: $DB_USER"
    echo ""
    print_status "Test connection with:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    echo ""
    print_status "Default admin credentials:"
    echo "  - Email: admin@authsystem.com"
    echo "  - Password: admin123"
}

# Main execution
main() {
    echo "=========================================="
    echo "Universal Authentication System Setup"
    echo "=========================================="
    echo ""
    
    check_postgres
    create_database
    run_schema
    run_seeds
    verify_setup
    show_connection_info
    
    echo ""
    print_success "🎉 Database setup completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "  1. Update your application configuration to use database '$DB_NAME'"
    echo "  2. Test the connection with the provided credentials"
    echo "  3. Start building your authentication API"
}

# Run main function
main "$@"
