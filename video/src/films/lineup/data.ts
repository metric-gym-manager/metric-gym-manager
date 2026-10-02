/**
 * The Lineup — 25s at 30fps. See the Video Ideas Registry, film 5.
 * Six abstract figures, never real faces. The unpaid member is deliberately
 * the one who looks most committed: appearance tells you nothing.
 */
export const DURATION = 750

export const T = {
  hook: { from: 0, to: 60 },
  countdown: { from: 60, to: 240 },
  cantTell: { from: 240, to: 330 },
  search: { from: 330, to: 450 },
  badges: { from: 450, to: 660 },
  card: { from: 660, to: 750 },
} as const

export const TODAY = '2 Oct'

export interface Person {
  n: number
  name: string
  plan: string
  paidThrough: string
  status: 'Active' | 'Expired'
  height: number
  shirt: string
  /** Visual cues that invite (wrong) judgement. */
  props: ReadonlyArray<'headphones' | 'cap' | 'bag' | 'shaker' | 'band' | 'towel'>
}

export const PEOPLE: readonly Person[] = [
  { n: 1, name: 'Ishara Perera', plan: 'Monthly', paidThrough: '28 Oct', status: 'Active', height: 540, shirt: '#3a3f52', props: ['cap'] },
  { n: 2, name: 'Ruwan Silva', plan: 'Student', paidThrough: '14 Oct', status: 'Active', height: 590, shirt: '#4a3a3a', props: ['headphones', 'bag'] },
  { n: 3, name: 'Minoli Gunawardena', plan: 'Monthly', paidThrough: '19 Oct', status: 'Active', height: 520, shirt: '#2f4a44', props: [] },
  { n: 4, name: 'Dilshan Rodrigo', plan: 'Monthly + PT', paidThrough: '30 Sep', status: 'Expired', height: 610, shirt: '#24262e', props: ['shaker', 'band', 'towel'] },
  { n: 5, name: 'Sachini Alwis', plan: 'Monthly', paidThrough: '9 Nov', status: 'Active', height: 530, shirt: '#4b4560', props: ['headphones'] },
  { n: 6, name: 'Kavindu Jayawardena', plan: 'Monthly', paidThrough: '21 Oct', status: 'Active', height: 570, shirt: '#3c4a32', props: ['bag'] },
]

export const CULPRIT = PEOPLE.find((p) => p.status === 'Expired')!
export const SEARCH = { text: 'Dilshan', from: T.search.from + 8, framesPerChar: 3 }
export const RESULT_AT = SEARCH.from + SEARCH.text.length * SEARCH.framesPerChar + 6
