import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import SettingsPage from '../page'

/**
 * `/settings` renders nothing, deliberately.
 *
 * `SettingsLayout` implements a master/detail split: on desktop it shows the
 * sub-nav beside this content area; on mobile it shows the sub-nav AS the page
 * and hides the content area (`max-tablet:hidden`). That is why the route needs
 * no redirect — the layout already puts a full menu on screen at `/settings`.
 *
 * Giving this page content would put it beside the menu on desktop and behind
 * the hidden content area on mobile, where nobody would ever see it. Pinned
 * because "the index page is empty" reads like an omission to the next person.
 */
describe('Settings index route', () => {
  it('renders no content of its own', () => {
    const { container } = render(<SettingsPage />)
    expect(container).toBeEmptyDOMElement()
  })
})
