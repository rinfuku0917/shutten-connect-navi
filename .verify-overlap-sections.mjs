import fs from 'node:fs';
const SCRATCH = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(SCRATCH + '/posts.json', 'utf8'));
const SIX = ['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space','kitchen-car-required-documents','get-food-truck-offers','weekday-food-truck-spots'];
const bodies = {};
for (const p of posts) bodies[p.slug] = p.content || '';
for (const s of ['get-food-truck-offers','weekday-food-truck-spots']) {
  const raw = fs.readFileSync('docs/blog/' + s + '.md', 'utf8');
  bodies[s] = raw.slice(raw.indexOf('\n---', 3) + 4);
}

// セクション単位の文字数
function sections(md) {
  const parts = md.split(/^##\s+/m).slice(1);
  return parts.map(p => {
    const nl = p.indexOf('\n');
    const title = p.slice(0, nl).trim();
    const body = p.slice(nl);
    const clean = body.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*`|>\-\s]/g, '');
    return { title, len: clean.length };
  });
}
for (const s of ['kitchen-car-location-guide','weekday-food-truck-spots','get-food-truck-offers']) {
  console.log(`\n### ${s} セクション別文字数`);
  const ss = sections(bodies[s]);
  const tot = ss.reduce((a, b) => a + b.len, 0);
  for (const x of ss) console.log(`  ${String(x.len).padStart(5)}字 (${(100*x.len/tot).toFixed(0)}%)  ${x.title}`);
}

// キーワード出現回数（食い合い判定の補助）
const KW = ['平日','週末','常設','出店料','書類','出店場所','スーパー','学校','オフィス','茨城','110件','歩合','固定'];
console.log('\n\n### 主要語の出現回数（6本）');
console.log('           ' + KW.map(k => k.padStart(7)).join(''));
for (const s of SIX) {
  const b = bodies[s];
  console.log(s.slice(0,12).padEnd(13) + KW.map(k => String((b.match(new RegExp(k,'g'))||[]).length).padStart(7)).join(''));
}

// choose-profitable / host-fee-setting-guide2 / vacant-space と6本の 12-gram 一致
function norm(s){return s.replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[#>*`|:_\-\[\]()]/g,' ').replace(/\s+/g,'');}
const N=12;
const G={};
for(const[k,v]of Object.entries(bodies)){const st=new Set();const t=norm(v);for(let i=0;i+N<=t.length;i++)st.add(t.slice(i,i+N));G[k]=st;}
function cont(a,b){let h=0;for(const g of G[a])if(G[b].has(g))h++;return 100*h/G[a].size;}
console.log('\n\n### 既存の近そうな3本 × 6本 の12-gram一致率');
for (const e of ['choose-profitable-food-truck-location','host-fee-setting-guide2','vacant-space-food-truck','first-food-truck-checklist','kitchen-car-profit-menu','how-to-invite-kitchen-car','event-food-truck-guide','regular-event-schedule','host-fee-setting-guide','kitchen-car-business-license']) {
  console.log(e.padEnd(40) + SIX.map(s => `${s.slice(0,8)}:${cont(e,s).toFixed(1)}%`).join('  '));
}

console.log('\n\n### host-fee-setting-guide2 全文');
console.log(bodies['host-fee-setting-guide2']);
