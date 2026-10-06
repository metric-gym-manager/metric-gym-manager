5. Testing Requirements

5.1 Testing Pyramid

Target distribution: 70% unit tests (pure functions, business logic), 20% integration tests (API routes, database interactions), 10% E2E tests (critical user flows, Playwright).

5.2 Mandatory Test Coverage

Every feature must include tests for:

- Happy path (expected success)
- Validation errors (invalid input)
- Authorization errors (wrong caller)
- Edge cases (null, undefined, boundary values)
