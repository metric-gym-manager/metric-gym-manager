# Gym Management SaaS - Phase 1 MVP

A production-grade, multi-tenant SaaS platform for gym and fitness center management built with Next.js 14, PostgreSQL, TypeScript, and Stripe.

## 🎉 Project Status

**Phase 1 MVP: COMPLETE (100%)**

- ✅ Full backend implementation (authentication, members, memberships, payments)
- ✅ Admin dashboard UI
- ✅ Mock payment system for development
- ✅ Row Level Security (RLS) for multi-tenant isolation
- ✅ Comprehensive database schema with migrations

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis (optional, for caching)
- npm >= 9.0.0

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gym_management_dev
DB_USER=postgres
DB_PASSWORD=your_password

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_min_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Mock Payments (DEV ONLY)
ENABLE_MOCK_PAYMENTS=true
```

3. **Run database migrations:**

```bash
npm run db:migrate
```

4. **Seed the database:**

```bash
npm run db:seed
```

This creates:
- A test gym (FitLife Gym)
- An admin user (email: `owner@fitlife.com`, password: `Password123`)
- 3 membership plans (Monthly Basic, Annual Premium, Drop-In Pass)

5. **Start the development server:**

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📋 Key Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (gym_owner, admin, trainer, front_desk)
- Secure password hashing with bcrypt

### Member Management
- Complete member profiles with personal information
- Emergency contact management
- Medical waiver signing
- Member status tracking (active, pending, frozen, expired, cancelled)

### Membership Plans
- Flexible plan types (monthly, annual, drop-in, class packs, custom)
- Configurable pricing and billing frequencies
- Trial periods
- Plan assignment to members

### Payment Processing (Mock)
- **⚠️ Development-only mock payment processor**
- 80% success rate simulation
- Auto-activation of members on successful payment
- Payment retry logic (max 3 attempts)
- Database triggers for automated status updates

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with node-pg-migrate
- **Caching**: Redis (ioredis)
- **Authentication**: JWT (jsonwebtoken + bcrypt)
- **Validation**: Zod schemas
- **Testing**: Jest, Playwright, @testing-library

### Feature-First Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/            # Auth pages
│   └── (dashboard)/       # Dashboard pages
├── features/              # Feature modules
│   ├── auth/             # Authentication
│   ├── members/          # Member management
│   ├── memberships/      # Plans & assignments
│   └── payments/         # Payment processing
├── lib/                   # Core infrastructure
│   ├── db/               # Database client
│   ├── jwt/              # JWT service
│   └── middleware/       # Auth, validation, errors
└── components/            # Reusable UI components
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start dev server
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
npm run db:reset         # Reset database
```

## 📝 API Endpoints

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
- `GET /api/memberships/assignments` - Membership history

### Payments (Mock)
- `POST /api/payments/mock` - Process mock payment (DEV ONLY)
- `GET /api/payments` - Payment history
- `POST /api/payments/[id]/retry` - Retry failed payment

## 🔐 Security Features

### Multi-Tenant Isolation
- Row Level Security (RLS) enforced at database level
- Each gym can only access its own data
- RLS context set via `current_setting('app.current_user_id')`

### Input Validation
- All API inputs validated with Zod schemas
- Type-safe request/response handling
- SQL injection protection via parameterized queries

### Authentication
- JWT access tokens (15 min expiry)
- JWT refresh tokens (7 day expiry)
- Token hashing for storage
- Role-based access control

## 📚 Documentation

Detailed documentation available in `.claude/rules/`:
- `architecture.md` - System architecture and patterns
- `security.md` - Security practices and RLS
- `testing.md` - Testing pyramid and coverage
- `development.md` - TDD workflow and standards
- `performance.md` - Optimization strategies

## 🎯 Testing the System

### 1. Login
Navigate to [http://localhost:3000/login](http://localhost:3000/login)
- Email: `owner@fitlife.com`
- Password: `Password123`

### 2. Create a Member
1. Go to Members page
2. Click "Add Member"
3. Fill in member details
4. Submit

### 3. Create Membership Plans
1. Go to Plans page
2. Click "Create Plan"
3. Configure plan details
4. Submit

### 4. Assign Plan to Member
Use API or build UI:
```bash
POST /api/memberships/assignments
{
  "memberId": "member-uuid",
  "planId": "plan-uuid",
  "startDate": "2024-02-09T00:00:00.000Z",
  "autoRenew": true
}
```

### 5. Process Mock Payment
1. Go to Payments page
2. Enter member ID and membership ID
3. Set amount and force outcome (optional)
4. Process payment
5. Check Members page to see status change to "active"

## 🚧 Known Limitations (Phase 1)

- No class scheduling or booking
- No check-in system
- No real Stripe integration (mock only)
- No reporting/analytics
- Limited member dashboard
- No email notifications

These features are planned for Phase 2+.

## 📈 Next Steps (Phase 2)

- Class scheduling and booking system
- QR code check-in system
- Real Stripe integration
- Basic reporting and analytics
- Email notifications
- Enhanced member dashboard

## 🤝 Contributing

This is a demonstration project built following production-grade standards:
- TDD (Test-Driven Development)
- Feature-first architecture
- Strict TypeScript
- Comprehensive documentation

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built with:
- Next.js 14
- TypeScript
- PostgreSQL
- Tailwind CSS
- Zod
- JWT
- And many other amazing open-source tools

---

**Built with Claude Code** 🤖
