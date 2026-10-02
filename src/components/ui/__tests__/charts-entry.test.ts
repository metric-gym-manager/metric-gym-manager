/**
 * SEO-055: Charts have their own barrel, `@/components/ui/charts`.
 *
 * The main barrel used to end with `export * from './primitives/Charts'`, and
 * `Charts.tsx` imports recharts at module scope. A bundler keeps every module a
 * barrel re-exports, so every page that imported ANY primitive — and the root
 * layout imports `Toaster`, so every page did — shipped recharts: a 653 KB
 * chunk on /login, the homepage and every marketing page, none of which draws
 * a chart.
 *
 * Jest's module registry is a model of that graph, not the bundle itself; the
 * production build is the proof (see SEO-055's verification).
 */

describe('chart entry point', () => {
  it('the main barrel never loads recharts', () => {
    let rechartsLoaded = false
    jest.isolateModules(() => {
      jest.doMock('recharts', () => {
        rechartsLoaded = true
        return {}
      })
      require('@/components/ui')
    })
    expect(rechartsLoaded).toBe(false)
  })

  it('serves every chart primitive from @/components/ui/charts', () => {
    jest.isolateModules(() => {
      const charts = require('@/components/ui/charts')
      for (const name of [
        'LineChart',
        'BarChart',
        'AreaChart',
        'PieChart',
        'DonutChart',
        'ScatterChart',
        'Sparkline',
      ]) {
        expect(typeof charts[name]).toBe('function')
      }
      expect(Array.isArray(charts.CHART_SERIES)).toBe(true)
    })
  })

  it('no longer offers a chart from the main barrel', () => {
    jest.isolateModules(() => {
      const ui = require('@/components/ui')
      expect(ui.LineChart).toBeUndefined()
      expect(ui.Sparkline).toBeUndefined()
      expect(ui.CHART_SERIES).toBeUndefined()
    })
  })
})
