import fs from 'node:fs';
const posts=JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json','utf8'));
const want=process.argv.slice(2);
for(const p of posts){if(!want.includes(p.slug))continue;
 console.log('\n############ '+p.slug+' ['+p.category+'] '+p.title);
 console.log('meta:',p.meta_description);
 console.log(process.env.FULL?p.content:p.content.split('\n').filter(l=>/^#|^\|/.test(l)).join('\n'));}
