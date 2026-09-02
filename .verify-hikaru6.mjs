import { fetchAll } from './.verify-hikaru.mjs';
const all = await fetchAll('places','select=title,place_type,fee,status,closed');
const pub = all.filter(p=>p.status==='published'&&!p.closed);
const S=/学校|大学|高校|中学|小学|学園|学院|専門学校|キャンパス|短大|幼稚園|保育園/;
const sc=pub.filter(p=>S.test(p.title||''));
console.log('school n=',sc.length,'place_type:',sc.reduce((m,p)=>(m[p.place_type]=(m[p.place_type]||0)+1,m),{}));
const rates=sc.map(p=>(p.fee||'').match(/(\d+)\s*[%％]/)?.[1]).filter(Boolean);
console.log('school commission rates:',rates.reduce((m,r)=>(m[r]=(m[r]||0)+1,m),{}));
console.log('school with any 円 (minimum guarantee):',sc.filter(p=>/円/.test(p.fee||'')).length);
