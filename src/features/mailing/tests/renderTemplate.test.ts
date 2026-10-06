/**
 * @jest-environment node
 */
import {
  placeholdersIn,
  renderTemplate,
  withPreviewBanner,
} from '../utils/renderTemplate'

describe('renderTemplate', () => {
  it('fills each placeholder with its value', () => {
    const result = renderTemplate(
      '<h1>Version {{{VERSION}}}</h1><p>{{{ SUMMARY }}}</p>',
      { VERSION: '1.2.0', SUMMARY: '2 new' },
      []
    )
    expect(result).toEqual({
      html: '<h1>Version 1.2.0</h1><p>2 new</p>',
      unresolved: [],
    })
  })

  it("leaves Resend's per-recipient placeholders for Resend to fill", () => {
    const html =
      '<p>Hi {{{contact.gym_name|your gym}}}, {{{contact.email}}}</p>' +
      '<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">x</a>'
    expect(renderTemplate(html, {}, [])).toEqual({ html, unresolved: [] })
  })

  it("uses the template's declared fallback for a variable we do not supply", () => {
    const result = renderTemplate('<p>{{{TAGLINE}}}</p>', {}, [
      { key: 'TAGLINE', fallback: 'Run your gym' },
    ])
    expect(result).toEqual({ html: '<p>Run your gym</p>', unresolved: [] })
  })

  it('uses an inline fallback when there is no value', () => {
    expect(renderTemplate('{{{TAGLINE|Hello}}}', {}, []).html).toBe('Hello')
  })

  it('prefers our value to any fallback', () => {
    expect(
      renderTemplate('{{{VERSION|0.0.0}}}', { VERSION: '1.2.0' }, [
        { key: 'VERSION', fallback: '9.9.9' },
      ]).html
    ).toBe('1.2.0')
  })

  it('reports a placeholder with no value and no fallback, and leaves it in place', () => {
    const result = renderTemplate(
      '<p>{{{HEADLINE}}} {{{VERSION}}}</p>',
      {
        VERSION: '1.2.0',
      },
      [{ key: 'HEADLINE', fallback: null }]
    )
    expect(result.unresolved).toEqual(['HEADLINE'])
    expect(result.html).toContain('{{{HEADLINE}}}')
  })

  it('never re-reads a value as a template', () => {
    const result = renderTemplate(
      '{{{A}}}',
      { A: '{{{B}}}', B: 'injected' },
      []
    )
    expect(result.html).toBe('{{{B}}}')
  })

  it('renders numbers', () => {
    expect(renderTemplate('{{{NEW_COUNT}}}', { NEW_COUNT: 3 }, []).html).toBe(
      '3'
    )
  })
})

describe('withPreviewBanner', () => {
  it('puts the banner first inside the body', () => {
    expect(
      withPreviewBanner(
        '<html><body class="x"><p>Hi</p></body></html>',
        '<div>B</div>'
      )
    ).toBe('<html><body class="x"><div>B</div><p>Hi</p></body></html>')
  })

  it('puts the banner first when there is no body tag', () => {
    expect(withPreviewBanner('<p>Hi</p>', '<div>B</div>')).toBe(
      '<div>B</div><p>Hi</p>'
    )
  })
})

describe('placeholdersIn', () => {
  it("lists the template's own variables once each, never Resend's", () => {
    expect(
      placeholdersIn(
        '{{{VERSION}}} {{{ SUMMARY|x }}} {{{VERSION}}} {{{contact.email}}} {{{RESEND_UNSUBSCRIBE_URL}}}'
      )
    ).toEqual(['VERSION', 'SUMMARY'])
  })
})
