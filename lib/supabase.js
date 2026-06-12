import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public client — for reading positions, candidates, live tallies
export const supabase = createClient(supabaseUrl, supabasePublishable)

// Service client — server-side only, never exposed to browser
// Pass auth header explicitly for new sb_secret_ key format
export const supabaseAdmin = () =>
  createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${supabaseSecret}`,
        apikey: supabaseSecret,
      }
    }
  })
