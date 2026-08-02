import { env } from './env'

/** The public-facing URL for the chat widget (used for embedding). */
export const WIDGET_BASE_URL = import.meta.env.VITE_WIDGET_BASE_URL ?? window.location.origin

/** The Supabase Edge Function URL for the chat proxy. */
export const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL ?? `${env.supabaseUrl}/functions/v1/chat`

/** The Supabase Edge Function URL that exchanges the Speechmatics API key for a realtime JWT. */
export const STT_TOKEN_URL = import.meta.env.VITE_STT_TOKEN_URL ?? `${env.supabaseUrl}/functions/v1/stt-token`

/** Known conversation statuses. */
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  QUALIFIED: 'qualified',
  NEEDS_INFO: 'needs_info',
  OUT_OF_SCOPE: 'out_of_scope',
  HANDLED: 'handled',
  ARCHIVED: 'archived',
} as const

export type ConversationStatus = (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS]

/** localStorage keys for widget state persistence. */
export const STORAGE_KEYS = {
  VISITOR_ID: 'cic_visitor_id',
  CONVERSATION_ID: 'cic_conversation_id',
} as const