
3. Development Workflow
3.1 Red-Green-Refactor Cycle (TDD)
For every new feature, Claude must:

RED: Write a failing test

typescript// tests/services/check-in.test.ts
describe('checkInMember', () => {
  it('should reject expired subscription', async () => {
    const expiredUser = { id: '123', subscriptionStatus: 'expired' };
    await expect(checkInMember(expiredUser.id))
      .rejects.toThrow('Subscription expired');
  });
});

GREEN: Implement minimal code to pass

typescript// services/check-in.ts
export async function checkInMember(userId: string) {
  const user = await db.getUser(userId);
  if (user.subscriptionStatus === 'expired') {
    throw new Error('Subscription expired');
  }
  // ... rest of logic
}
```

3. **REFACTOR**: Optimize without changing behavior

### 3.2 Commit Message Standards

Use Conventional Commits:
```
feat(subscriptions): add Stripe webhook handler
fix(auth): resolve RLS policy for trainer role
docs(readme): update environment setup instructions
test(check-in): add edge cases for timezone handling