# Getting Started with Gym Management SaaS

## Phase 1 MVP - Quick Start Guide

This guide will help you get the Gym Management SaaS system up and running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **npm** >= 9.0.0
- **Git** (already initialized)

## Step-by-Step Setup

### 1. Install Dependencies

Dependencies are already installed, but if you need to reinstall:

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the `.env.example` file to `.env` and configure your environment:

```bash
cp .env.example .env
```

Edit `.env` and fill in the following required variables:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gym_management_dev
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis Configuration (optional for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_min_32_characters_long
JWT_REFRESH_SECRET=your_refresh_secret_min_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Mock Payments (DEV ONLY - set to false in production)
ENABLE_MOCK_PAYMENTS=true
```

**Generate secure JWT secrets:**

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
-join ((65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3. Set Up PostgreSQL Database

Create the database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE gym_management_dev;

# Exit psql
\q
```

### 4. Run Database Migrations

Apply the database schema:

```bash
npm run db:migrate
```

This will create:
- All database tables (gyms, users, members, membership_plans, etc.)
- Row Level Security (RLS) policies for multi-tenant isolation
- Database triggers for automated workflows

### 5. Seed the Database

Populate the database with test data:

```bash
npm run db:seed
```

This creates:
- A test gym: **FitLife Gym**
- An admin user:
  - Email: `owner@fitlife.com`
  - Password: `Password123`
- 3 sample membership plans:
  - Monthly Basic ($49.99)
  - Annual Premium ($499.99)
  - Drop-In Pass ($15.00)

### 6. Verify TypeScript Compilation

Ensure all TypeScript code compiles correctly:

```bash
npm run type-check
```

Expected output: No errors

### 7. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

## Testing the Application

### 1. Login to Admin Dashboard

1. Navigate to: http://localhost:3000/login
2. Enter credentials:
   - **Email:** `owner@fitlife.com`
   - **Password:** `Password123`
3. You'll be redirected to the admin dashboard

### 2. Create a Member

1. Go to the **Members** page
2. Click "Add Member"
3. Fill in member details:
   - Email, First Name, Last Name (required)
   - Phone, Date of Birth, Gender (optional)
4. Submit the form

### 3. Assign a Membership Plan

Use the API or build UI:

```bash
# Example API call to assign a plan
curl -X POST http://localhost:3000/api/memberships/assignments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "member-uuid-here",
    "planId": "plan-uuid-here",
    "startDate": "2024-02-09T00:00:00.000Z",
    "autoRenew": true
  }'
```

### 4. Process a Mock Payment

1. Go to the **Payments** page
2. Enter:
   - Member ID
   - Membership ID
   - Amount
   - Force Outcome (optional: "success" or "failure")
3. Click "Process Payment"
4. Verify the member status changes to "active" on success

## Available Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run type-check       # TypeScript validation
npm run lint             # ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format with Prettier

# Database
npm run db:migrate       # Run migrations
npm run db:migrate:down  # Rollback migration
npm run db:seed          # Seed database
npm run db:reset         # Reset database (drop + migrate + seed)

# Testing
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:integration # Run integration tests
npm run test:e2e         # Run E2E tests with Playwright
npm run test:coverage    # Generate coverage report
```

## Project Structure

```
gym-management-saas/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # Authentication pages
│   │   ├── (dashboard)/      # Dashboard pages
│   │   └── api/              # API routes
│   ├── components/           # Reusable UI components
│   ├── features/             # Feature modules
│   │   ├── auth/            # Authentication
│   │   ├── members/         # Member management
│   │   ├── memberships/     # Plans & assignments
│   │   └── payments/        # Payment processing
│   └── lib/                  # Core infrastructure
│       ├── db/              # Database client
│       ├── jwt/             # JWT service
│       └── middleware/      # Auth, validation, errors
├── migrations/               # Database migrations
├── scripts/                  # Utility scripts
└── tests/                    # Test files
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register staff user
- `POST /api/auth/login` - Login and get JWT tokens
- `POST /api/auth/refresh` - Refresh access token

### Members

- `POST /api/members` - Create member
- `GET /api/members` - List members (with filters)
- `GET /api/members/[id]` - Get member details
- `PATCH /api/members/[id]` - Update member
- `POST /api/members/[id]/emergency-contacts` - Add emergency contact
- `POST /api/members/[id]/medical-waiver` - Sign waiver

### Membership Plans

- `POST /api/memberships/plans` - Create plan
- `GET /api/memberships/plans` - List plans
- `GET /api/memberships/plans/[id]` - Get plan details
- `PATCH /api/memberships/plans/[id]` - Update plan
- `POST /api/memberships/assignments` - Assign plan to member

### Payments (Mock)

- `POST /api/payments/mock` - Process mock payment (DEV ONLY)
- `GET /api/payments` - Payment history
- `POST /api/payments/[id]/retry` - Retry failed payment

## Troubleshooting

### Database Connection Issues

**Error:** `Connection refused` or `Cannot connect to database`

**Solution:**
1. Verify PostgreSQL is running:
   ```bash
   # Linux/Mac
   sudo service postgresql status

   # Windows
   net start postgresql
   ```
2. Check your `.env` database credentials
3. Ensure the database exists:
   ```bash
   psql -U postgres -l | grep gym_management_dev
   ```

### Migration Errors

**Error:** `Migration failed` or `Table already exists`

**Solution:**
1. Reset the database:
   ```bash
   npm run db:reset
   ```
2. If that fails, manually drop and recreate:
   ```bash
   psql -U postgres
   DROP DATABASE gym_management_dev;
   CREATE DATABASE gym_management_dev;
   \q
   npm run db:migrate
   ```

### TypeScript Errors

**Error:** Type errors when running `npm run dev`

**Solution:**
1. Run type check:
   ```bash
   npm run type-check
   ```
2. All type errors should be resolved. If you see errors, ensure you pulled the latest code.

### JWT Token Issues

**Error:** `Invalid or expired access token`

**Solution:**
1. Verify JWT secrets are set in `.env` and are at least 32 characters
2. Clear localStorage in browser and login again
3. Check that tokens haven't expired (default: 15 minutes for access token)

### Mock Payment Not Working

**Error:** `Mock payments are disabled`

**Solution:**
1. Verify `.env` has `ENABLE_MOCK_PAYMENTS=true`
2. Restart the dev server after changing `.env`

## Security Notes

### Important for Production

- **NEVER** use mock payment processor in production
- Set `ENABLE_MOCK_PAYMENTS=false` in production
- Use strong, unique JWT secrets (64+ characters recommended)
- Enable HTTPS/TLS for all connections
- Use environment-specific `.env` files
- Never commit `.env` files to version control

### Row Level Security (RLS)

The database uses PostgreSQL Row Level Security to enforce multi-tenant isolation:
- Each gym can only access its own data
- RLS policies are enforced at the database level
- All queries automatically filtered by `gym_id`

## Next Steps

Now that your system is running, you can:

1. **Explore the Admin Dashboard**
   - View and manage members
   - Create and edit membership plans
   - Process mock payments
   - Monitor system activity

2. **Test the API**
   - Use Postman or curl to test API endpoints
   - Review API documentation in README.md
   - Test authentication flows

3. **Review the Code**
   - Explore the feature-first architecture
   - Review TypeScript types and Zod schemas
   - Understand the database schema

4. **Prepare for Phase 2**
   - Review Phase 2 roadmap in README.md
   - Plan class scheduling features
   - Consider real Stripe integration

## Support

For issues or questions:
- Check the main README.md
- Review documentation in `.claude/rules/`
- File issues on GitHub

## Phase 1 MVP Completion Checklist

- ✅ All dependencies installed
- ✅ TypeScript compilation passes
- ✅ Database migrations applied
- ✅ Seed data created
- ✅ Development server running
- ✅ Login successful
- ✅ Member CRUD working
- ✅ Mock payments functional

**Congratulations! Your Gym Management SaaS Phase 1 MVP is ready for development and testing.**
