import { getSaasAdmin } from '../requireSaasAdmin';

// Chainable query builder stub: .from(...).select(...).eq(...).maybeSingle()
function makeSupabase(opts: {
  user: { id: string; email: string | null } | null;
  adminRow: { user_id: string } | null;
  rowError?: { message: string } | null;
}) {
  const maybeSingle = jest.fn(() =>
    Promise.resolve({ data: opts.adminRow, error: opts.rowError ?? null })
  );
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return {
    client: {
      auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: opts.user } })) },
      from,
    },
    spies: { from, select, eq, maybeSingle },
  };
}

let current: ReturnType<typeof makeSupabase>;

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(current.client)),
}));

describe('getSaasAdmin', () => {
  it('returns null when there is no session user', async () => {
    current = makeSupabase({ user: null, adminRow: null });
    expect(await getSaasAdmin()).toBeNull();
    // Must not even query the table without a user.
    expect(current.spies.from).not.toHaveBeenCalled();
  });

  it('returns null for a signed-in user with no saas_admins row', async () => {
    current = makeSupabase({ user: { id: 'u1', email: 'u1@example.com' }, adminRow: null });
    expect(await getSaasAdmin()).toBeNull();
    // Self-scoped read: filters on the caller's own id (RLS returns zero rows).
    expect(current.spies.from).toHaveBeenCalledWith('saas_admins');
    expect(current.spies.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('returns null (fail-closed) when the membership query errors', async () => {
    current = makeSupabase({
      user: { id: 'u1', email: 'u1@example.com' },
      adminRow: null,
      rowError: { message: 'boom' },
    });
    expect(await getSaasAdmin()).toBeNull();
  });

  it('returns the user when a saas_admins row exists', async () => {
    current = makeSupabase({
      user: { id: 'admin1', email: 'ops@example.com' },
      adminRow: { user_id: 'admin1' },
    });
    expect(await getSaasAdmin()).toEqual({ id: 'admin1', email: 'ops@example.com' });
  });

  it('tolerates a null email on the session user', async () => {
    current = makeSupabase({
      user: { id: 'admin2', email: null },
      adminRow: { user_id: 'admin2' },
    });
    expect(await getSaasAdmin()).toEqual({ id: 'admin2', email: null });
  });
});
