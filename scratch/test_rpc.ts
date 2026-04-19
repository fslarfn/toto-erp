
import { createClient } from '@supabase/supabase-api'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPC() {
  console.log('Testing fn_cockpit_cashflow_14d...')
  const { data, error } = await supabase.rpc('fn_cockpit_cashflow_14d')
  if (error) {
    console.error('RPC Error:', error)
  } else {
    console.log('RPC Success:', data)
  }
}

testRPC()
