import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(`${URL_}/rest/v1/places?select=*&limit=1`, {headers:{apikey:KEY, Authorization:`Bearer ${KEY}`}});
const j = await r.json();
console.log(r.status);
console.log(Object.keys(j[0]||{}).join('\n'));
