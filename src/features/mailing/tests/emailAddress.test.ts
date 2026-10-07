/**
 * @jest-environment node
 */
import { emailAddressOf, mailboxKey } from '../utils/emailAddress'

describe('emailAddressOf', () => {
  it.each([
    ['Ruwan Perera <Ruwan@IronGym.lk>', 'ruwan@irongym.lk'],
    ['"Perera, Ruwan" <ruwan@irongym.lk>', 'ruwan@irongym.lk'],
    ['owner+gym@titan.lk', 'owner+gym@titan.lk'],
    ['  <hello@go.metricgymos.com>  ', 'hello@go.metricgymos.com'],
  ])('reads %s as %s', (value, address) => {
    expect(emailAddressOf(value)).toBe(address)
  })

  it.each(['', 'Ruwan Perera', 'not an address <nope>', 'a@b'])(
    'finds no address in %p',
    (value) => {
      expect(emailAddressOf(value)).toBeNull()
    }
  )
})

describe('mailboxKey', () => {
  it.each([
    ['Colombo.Shyan+Outreach@Gmail.com', 'colomboshyan@gmail.com'],
    ['c.o.l.o.m.b.o.shyan@googlemail.com', 'colomboshyan@gmail.com'],
    ['owner+gyms@titan.lk', 'owner@titan.lk'],
    // Dots are part of the name everywhere but Gmail.
    ['ruwan.perera@titan.lk', 'ruwan.perera@titan.lk'],
  ])('reads %s as the inbox %s', (email, key) => {
    expect(mailboxKey(email)).toBe(key)
  })
})
