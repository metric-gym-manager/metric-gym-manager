import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ServiceWorkerRegistration } from '../ServiceWorkerRegistration'

/**
 * Regression tests for the PWA update banner.
 *
 * The historical bug: on sign-in (a full-document navigation), the banner
 * appeared and the page got stuck reloading. The old implementation drove a
 * `window.location.reload()` from a persistent localStorage flag WITHOUT ever
 * activating the waiting worker, so the worker re-armed the flag and every
 * navigation reloaded again. These tests lock in the corrected contract:
 *
 *  - a waiting update NEVER triggers a reload on its own (no loop),
 *  - a first-ever install NEVER forces a reload,
 *  - only clicking "Refresh Now" reloads, and exactly once,
 *  - "Later" suppresses the banner for the session without reloading.
 */

type Listener = () => void

class FakeEventTarget {
  private listeners: Record<string, Listener[]> = {}
  addEventListener(type: string, cb: Listener) {
    ;(this.listeners[type] ||= []).push(cb)
  }
  removeEventListener(type: string, cb: Listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== cb)
  }
  dispatch(type: string) {
    ;(this.listeners[type] || []).slice().forEach((cb) => cb())
  }
}

class FakeServiceWorker extends FakeEventTarget {
  state = 'installed'
  postMessage = jest.fn()
}

class FakeRegistration extends FakeEventTarget {
  waiting: FakeServiceWorker | null = null
  installing: FakeServiceWorker | null = null
  update = jest.fn()
}

class FakeContainer extends FakeEventTarget {
  controller: object | null = null
  registration = new FakeRegistration()
  register = jest.fn(() => Promise.resolve(this.registration))
}

let container: FakeContainer
let reloadMock: jest.Mock

/** Flush the microtasks queued by `register().then(...)`. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  sessionStorage.clear()

  container = new FakeContainer()
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  })

  reloadMock = jest.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      reload: reloadMock,
      assign: jest.fn(),
      replace: jest.fn(),
      href: 'http://localhost/',
    },
  })
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  delete (navigator as { serviceWorker?: unknown }).serviceWorker
})

describe('ServiceWorkerRegistration', () => {
  it('shows the banner for a waiting update but NEVER reloads on its own (no refresh loop)', async () => {
    container.controller = {} // an app is already installed
    container.registration.waiting = new FakeServiceWorker()

    render(<ServiceWorkerRegistration />)
    await flush()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('New version available!')).toBeInTheDocument()
    // The core regression assertion: no reload without user action.
    expect(reloadMock).not.toHaveBeenCalled()

    // Even the automatic controller change (e.g. another tab applied it) must
    // not force a reload here.
    act(() => container.dispatch('controllerchange'))
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('does not show a banner or reload on the very first install (no controller yet)', async () => {
    container.controller = null // first-ever visit

    render(<ServiceWorkerRegistration />)
    await flush()

    const installing = new FakeServiceWorker()
    container.registration.installing = installing
    act(() => container.registration.dispatch('updatefound'))
    act(() => {
      installing.state = 'installed'
      installing.dispatch('statechange')
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // clients.claim() on first activate fires controllerchange — must not reload.
    act(() => container.dispatch('controllerchange'))
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('shows the banner when an update is found while the app is controlled', async () => {
    container.controller = {}

    render(<ServiceWorkerRegistration />)
    await flush()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const installing = new FakeServiceWorker()
    container.registration.installing = installing
    act(() => container.registration.dispatch('updatefound'))
    act(() => {
      installing.state = 'installed'
      installing.dispatch('statechange')
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('"Refresh Now" activates the waiting worker and reloads exactly once', async () => {
    container.controller = {}
    const waiting = new FakeServiceWorker()
    container.registration.waiting = waiting

    render(<ServiceWorkerRegistration />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Now' }))

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reloadMock).not.toHaveBeenCalled() // waits for the worker to take over

    // Worker activated + claimed this client -> controllerchange fires.
    act(() => container.dispatch('controllerchange'))
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // The 3s safety-net timer must not produce a second reload.
    act(() => jest.advanceTimersByTime(3000))
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // A duplicate controllerchange must not reload again either.
    act(() => container.dispatch('controllerchange'))
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('"Refresh Now" still reloads via the safety net if the worker never takes control', async () => {
    container.controller = {}
    const waiting = new FakeServiceWorker()
    container.registration.waiting = waiting

    render(<ServiceWorkerRegistration />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Now' }))
    expect(reloadMock).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(3000))
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('"Later" hides the banner without reloading and stays hidden for the session', async () => {
    container.controller = {}
    container.registration.waiting = new FakeServiceWorker()

    const { unmount } = render(<ServiceWorkerRegistration />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(reloadMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('pwa_update_dismissed')).toBe('true')

    // A later full-document navigation (remount) must not resurface the banner
    // for the rest of the session.
    unmount()
    render(<ServiceWorkerRegistration />)
    await flush()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
