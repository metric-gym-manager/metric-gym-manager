/**
 * @jest-environment node
 */
import { parseProspectsCsv } from '../utils/prospectsCsv'
import { isUndeliverable } from '../utils/deliverability'

/**
 * The outreach list arrives as a CSV assembled by hand from public pages, so
 * the reader expects mess: any header wording, quoted fields, Windows line
 * endings, a BOM, duplicates, two addresses in one cell, and junk.
 */
describe('parseProspectsCsv', () => {
  it('reads the email and gym columns whatever the header calls them', () => {
    const csv =
      '﻿Gym Name,Owner,E-mail Address\r\nTitan Fitness,Ruwan,Info@TitanFitness.lk\r\n'
    expect(parseProspectsCsv(csv)).toEqual({
      prospects: [
        {
          email: 'info@titanfitness.lk',
          gymName: 'Titan Fitness',
          name: 'Ruwan',
          source: null,
        },
      ],
      rejected: [],
    })
  })

  it('reads a bare column of addresses with no header', () => {
    const { prospects } = parseProspectsCsv('a@gym.lk\nb@gym.lk\n')
    expect(prospects.map((p) => p.email)).toEqual(['a@gym.lk', 'b@gym.lk'])
    expect(prospects[0]).toEqual({
      email: 'a@gym.lk',
      gymName: null,
      name: null,
      source: null,
    })
  })

  it('keeps commas inside quoted fields', () => {
    const csv = 'email,gym\n"x@gym.lk","Iron Temple, Kandy"\n'
    expect(parseProspectsCsv(csv).prospects[0].gymName).toBe(
      'Iron Temple, Kandy'
    )
  })

  it('splits a cell holding several addresses into one prospect each', () => {
    const csv = 'email,gym\n"info@a.lk; sales@a.lk",Alpha Gym\n'
    expect(parseProspectsCsv(csv).prospects).toEqual([
      { email: 'info@a.lk', gymName: 'Alpha Gym', name: null, source: null },
      { email: 'sales@a.lk', gymName: 'Alpha Gym', name: null, source: null },
    ])
  })

  it('drops repeats, whatever their case, and says so', () => {
    const { prospects, rejected } = parseProspectsCsv(
      'email\nA@gym.lk\na@gym.lk\n'
    )
    expect(prospects).toHaveLength(1)
    expect(rejected).toEqual([
      { row: 3, value: 'a@gym.lk', reason: 'duplicate' },
    ])
  })

  it('rejects what is not an address, and addresses that can never receive mail', () => {
    const { prospects, rejected } = parseProspectsCsv(
      'email\nnot-an-email\nowner@gym\nx@demo.local\n\nok@gym.lk\n'
    )
    expect(prospects.map((p) => p.email)).toEqual(['ok@gym.lk'])
    expect(rejected).toEqual([
      { row: 2, value: 'not-an-email', reason: 'invalid' },
      { row: 3, value: 'owner@gym', reason: 'invalid' },
      { row: 4, value: 'x@demo.local', reason: 'undeliverable' },
    ])
  })

  it('reads the owner’s list: a website column, and several addresses per row', () => {
    const csv =
      'website_host,emails\n' +
      'www.lifn.lk,info@lifn.lk;lifnfitness@gmail.com\n' +
      'befit.lk,team@befit.lk\n'
    expect(parseProspectsCsv(csv).prospects).toEqual([
      {
        email: 'info@lifn.lk',
        gymName: null,
        name: null,
        source: 'www.lifn.lk',
      },
      {
        email: 'lifnfitness@gmail.com',
        gymName: null,
        name: null,
        source: 'www.lifn.lk',
      },
      { email: 'team@befit.lk', gymName: null, name: null, source: 'befit.lk' },
    ])
  })

  it('reads nothing from an empty file', () => {
    expect(parseProspectsCsv('')).toEqual({ prospects: [], rejected: [] })
  })
})

describe('isUndeliverable', () => {
  it.each([
    'a@x.test',
    'a@x.example',
    'a@x.invalid',
    'a@localhost',
    'a@x.local',
  ])('knows %s can never receive mail', (email) => {
    expect(isUndeliverable(email)).toBe(true)
  })

  it('lets a real domain through', () => {
    expect(isUndeliverable('a@gym.lk')).toBe(false)
  })
})
