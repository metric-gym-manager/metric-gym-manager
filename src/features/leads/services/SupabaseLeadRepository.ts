import type { SupabaseClient } from '@supabase/supabase-js'
import { LeadInterest } from '../config/LeadConfig'
import type { Lead, NewLead } from '../types'
import type { ILeadRepository } from './ILeadRepository'

interface LeadRow {
  id: string
  name: string
  email: string
  phone: string
  gym_name: string | null
  message: string | null
  interest: string
  source: string
  created_at: string
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    gymName: row.gym_name,
    message: row.message,
    interest: row.interest as LeadInterest,
    source: row.source,
    createdAt: row.created_at,
  }
}

/**
 * Supabase-backed lead store. Anonymous callers have no RLS session, so the
 * public route wires this with the service-role admin client (writes bypass
 * RLS — the `leads` table denies direct client access by default).
 */
export class SupabaseLeadRepository implements ILeadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(lead: NewLead): Promise<Lead> {
    const { data, error } = await this.supabase
      .from('leads')
      .insert({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        gym_name: lead.gymName,
        message: lead.message,
        interest: lead.interest,
        source: lead.source,
      })
      .select()
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to store lead')
    }

    return toLead(data as LeadRow)
  }
}
