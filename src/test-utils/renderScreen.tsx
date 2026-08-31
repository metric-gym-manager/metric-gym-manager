import { render, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

/**
 * Render harness for the workspace **screens**, as opposed to the primitives.
 *
 * It exists because of finding B1 of the overhaul's inverted check: twelve
 * screens were rewritten wholesale and **not one test rendered any of them**.
 * The suite covered pure logic and isolated primitives, so a screen could
 * compose a correct primitive incorrectly — or fail to mount at all — with the
 * whole gate green. Three of the defects that shipped past `tsc`, `eslint`,
 * `arch:check` and 1,359 passing tests were of exactly that shape.
 *
 * What this harness can and cannot see is worth stating, so nobody mistakes a
 * green run for more than it is:
 *
 * - **Can:** mounting, data reaching the DOM, loading/empty/error branches,
 *   query keys and request URLs, wiring between a screen and its primitives,
 *   accessible names and roles, singular/plural and formatting of rendered text.
 * - **Cannot:** anything requiring layout. jsdom computes no geometry, so the
 *   members toolbar wrapping onto three rows — the defect that motivated the
 *   visual pass — is invisible here and always will be. That class needs a
 *   browser; see the Playwright specs.
 */
export function renderScreen(
  ui: ReactElement,
  {
    wrapper: Extra,
  }: { wrapper?: (props: { children: ReactNode }) => ReactElement } = {}
): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Retries turn a deliberate failure case into a multi-second timeout,
      // and the error branch is one of the things these tests exist to cover.
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })

  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {Extra ? <Extra>{children}</Extra> : children}
      </QueryClientProvider>
    ),
  })

  return { ...result, queryClient }
}

/**
 * Route `fetch` by URL substring.
 *
 * Screens here call several endpoints from one mount, so a single-response
 * mock silently feeds the wrong payload to whichever query resolves second.
 * Matching on the path keeps each assertion about the endpoint it names.
 *
 * An unmatched request **throws** rather than returning an empty object: a
 * screen that starts calling a new endpoint should break a test loudly instead
 * of rendering a blank region that still passes.
 *
 * @param routes - Map of URL substring → JSON payload, or a per-route
 *   `{ status, body }` for non-2xx cases.
 * @returns The jest mock installed on `globalThis.fetch`.
 */
export function mockFetchRoutes(
  routes: Record<string, unknown | { status: number; body?: unknown }>
): jest.Mock {
  const mock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const hit = Object.keys(routes).find((key) => url.includes(key))

    if (!hit) {
      throw new Error(
        `mockFetchRoutes: no route matches "${url}". ` +
          `Known routes: ${Object.keys(routes).join(', ') || '(none)'}`
      )
    }

    const value = routes[hit]
    const isEnvelope =
      typeof value === 'object' &&
      value !== null &&
      'status' in (value as Record<string, unknown>)
    const status = isEnvelope ? (value as { status: number }).status : 200
    const body = isEnvelope ? (value as { body?: unknown }).body : value

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response
  })

  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

/**
 * The API envelope every route returns via `ResponseBuilder` (§2.3). Screens
 * unwrap `result.data`, so a fixture that omits the wrapper reads as an empty
 * response and the test passes for the wrong reason.
 */
export const apiOk = <T,>(data: T) => ({ success: true, data })
