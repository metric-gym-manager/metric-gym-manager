import { isUndeliverable } from './deliverability'

/** One address to introduce Metric Gym OS to. */
export interface Prospect {
  /** Lowercased: contacts are stored lowercased (Resend matches case-sensitively). */
  email: string
  gymName: string | null
  name: string | null
  /** The page it was found on, when the CSV says. */
  source: string | null
}

export interface RejectedRow {
  /** The line in the file, counting the header as 1. */
  row: number
  value: string
  reason: 'invalid' | 'duplicate' | 'undeliverable'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_HEADER = /^(e-?mails?|mails?)( address(es)?)?$/
const GYM_HEADER =
  /^(gym|gym name|business|business name|company|company name|organi[sz]ation)$/
const NAME_HEADER = /^(name|owner|owner name|contact|contact name|full name)$/
const SOURCE_HEADER = /^(website|website host|site|url|source|page)$/

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function headerKey(cell: string): string {
  return cell.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The prospects in a CSV assembled by hand: any header wording (or none),
 * several addresses in one cell, repeats and junk reported rather than sent.
 *
 * @param text - The file's contents
 * @returns Unique, deliverable prospects, and every row that was not one
 */
export function parseProspectsCsv(text: string): {
  prospects: Prospect[]
  rejected: RejectedRow[]
} {
  const rows = parseRows(text)
  const prospects: Prospect[] = []
  const rejected: RejectedRow[] = []
  if (rows.length === 0) return { prospects, rejected }

  const header = rows[0].map(headerKey)
  const emailColumn = header.findIndex((cell) => EMAIL_HEADER.test(cell))
  const hasHeader = emailColumn >= 0
  const gymColumn = hasHeader ? header.findIndex((c) => GYM_HEADER.test(c)) : -1
  const nameColumn = hasHeader
    ? header.findIndex((c) => NAME_HEADER.test(c))
    : -1
  const sourceColumn = hasHeader
    ? header.findIndex((c) => SOURCE_HEADER.test(c))
    : -1

  const seen = new Set<string>()
  rows.forEach((cells, index) => {
    if (hasHeader && index === 0) return
    const row = index + 1
    const cellOf = (column: number) =>
      column >= 0 ? (cells[column] ?? '').trim() || null : null
    const raw = hasHeader
      ? (cells[emailColumn] ?? '')
      : (cells.find((cell) => cell.includes('@')) ?? cells[0] ?? '')
    const candidates = raw
      .split(/[;,/\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)

    for (const value of candidates) {
      const email = value.toLowerCase()
      if (!EMAIL.test(email)) {
        rejected.push({ row, value, reason: 'invalid' })
      } else if (isUndeliverable(email)) {
        rejected.push({ row, value, reason: 'undeliverable' })
      } else if (seen.has(email)) {
        rejected.push({ row, value, reason: 'duplicate' })
      } else {
        seen.add(email)
        prospects.push({
          email,
          gymName: cellOf(gymColumn),
          name: cellOf(nameColumn),
          source: cellOf(sourceColumn),
        })
      }
    }
  })
  return { prospects, rejected }
}
