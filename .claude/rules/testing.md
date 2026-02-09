5. Testing Requirements
5.1 Testing Pyramid
Target Distribution:

70% Unit Tests (pure functions, business logic)
20% Integration Tests (API routes, database interactions)
10% E2E Tests (critical user flows)

5.2 Mandatory Test Coverage
Every feature must include tests for:

Happy path (expected success)
Validation errors (invalid input)
Authorization errors (wrong role)
Edge cases (null, undefined, boundary values)

Example:
typescriptdescribe('Subscription Service', () => {
  describe('createSubscription', () => {
    it('creates subscription for valid payment method', async () => {
      // Happy path
    });
    
    it('rejects invalid payment method', async () => {
      // Validation error
    });
    
    it('prevents non-admin from creating subscriptions', async () => {
      // Authorization error
    });
    
    it('handles Stripe API failures gracefully', async () => {
      // Edge case
    });
  });
});
5.3 Testing Tools

Unit: Vitest (preferred) or Jest
Integration: Supertest for API routes
E2E: Playwright (for critical flows only)
Mocking: MSW for external API calls