/** Shared feature types: qualification reasoning, enrichment, referrals. */

export type CheckResult = 'pass' | 'fail' | 'partial'

export interface QualificationCheck {
  check_name: string // 'budget_fit' | 'timeline_fit' | 'scope_match' | …
  result: CheckResult
  detail: string
}

export interface Enrichment {
  company_size: string
  industry: string
  tech_stack: string[]
  public_presence_summary: string
  source_domain: string
  enriched_at: string
}

export interface ReferralContact {
  name: string
  service: string
  contact: string
}

export interface WidgetBrief {
  client_contact: string
  email: string
  company: string
  website: string
  project_type: string
  scope_summary: string
  budget: string
  timeline: string
  urgency: string
}

/** Human labels for the qualification check names. */
export const CHECK_LABELS: Record<string, string> = {
  budget_fit: 'Budget fit',
  timeline_fit: 'Timeline fit',
  scope_match: 'Scope match',
}

/** Pretty label for a check result. */
export const RESULT_LABELS: Record<CheckResult, string> = {
  pass: 'Pass',
  fail: 'Fail',
  partial: 'Partial',
}
