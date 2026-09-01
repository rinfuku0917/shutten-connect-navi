// 公開ページ本文（DB）と原稿の該当箇所を突き合わせる
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data, error } = await sb.from('blog_posts').select('*').eq('slug', 'food-truck-fee-guide');
if (error) { console.log('blog_posts err:', error.message); }
const post = data?.[0];
if (!post) { console.log('記事がDBに見つからない'); process.exit(0); }

const body = post.content ?? post.body ?? '';
console.log('DB記事 len:', body.length, ' updated:', post.updated_at);

// 表・数字が出る行だけ抜く
body.split('\n').forEach((l, i) => {
  if (/単発|常設|応相談|固定制|歩合制|併用|13件|97件|110件|50件|51件|7件|6件/.test(l))
    console.log(String(i + 1).padStart(4), l);
});
