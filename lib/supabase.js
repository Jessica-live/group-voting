import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public client — for reading positions, candidates, live tallies
export const supabase = createClient(supabaseUrl, supabasePublishable)

// Service client — for API routes only (writing votes, managing tokens)
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser
export const supabaseAdmin = () =>
  createClient(supabaseUrl, supabaseSecret)
