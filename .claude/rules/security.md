4. Security & Data Integrity
4.1 Database Security Layers
Layer 1: Row Level Security (RLS)
sql-- Every table must have RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Members can only see their own data
CREATE POLICY "Members view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can see everything
CREATE POLICY "Admins view all"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
Layer 2: Role-Based Access Control (RBAC)
typescript// middleware/auth.ts
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request) => {
    const user = await getCurrentUser(req);
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

// Usage in API route
export const POST = requireRole('admin', 'trainer')(async (req) => {
  // Only admins and trainers can access
});
Layer 3: Input Validation
typescript// Every API route must validate input
const CreateMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
});

export async function POST(req: Request) {
  const body = await req.json();
  const validatedData = CreateMemberSchema.parse(body); // Throws if invalid
  // ... proceed with validated data
}
4.2 Secrets Management Checklist

 All API keys in .env (never hardcoded)
 .env in .gitignore
 .env.example committed with dummy values
 Production secrets in Vercel/platform environment variables
 Webhook secrets verified on every request