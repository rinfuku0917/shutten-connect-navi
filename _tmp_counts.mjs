import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})

const q = async (label, b) => { const { count, error } = await b; console.log(label, error ? 'ERR '+error.message : count) }
await q('profiles role=seller            :', db.from('profiles').select('id',{count:'exact',head:true}).eq('role','seller'))
await q('profiles role=seller approved   :', db.from('profiles').select('id',{count:'exact',head:true}).eq('role','seller').eq('approval_status','approved'))
await q('profiles role=host              :', db.from('profiles').select('id',{count:'exact',head:true}).eq('role','host'))
await q('places published & !closed      :', db.from('places').select('id',{count:'exact',head:true}).eq('status','published').eq('closed',false))
// 募集者の登録の流入がどれくらいあるか（何を見て知ったか別）
const { data: hv } = await db.from('profiles').select('found_via,role').eq('role','host')
const agg = {}
for (const r of hv ?? []) agg[r.found_via ?? '(未回答)'] = (agg[r.found_via ?? '(未回答)']||0)+1
console.log('募集者の found_via 内訳:', JSON.stringify(agg))
