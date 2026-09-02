// 物差しの妥当性を疑う: 「既知の重複ペア12.2%」は本当に重複の基準値か？
// 統合前の原稿どうし（＝本物のカニバリ判定を受けた組）を測って比べる
import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const D = '/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/docs/blog/';
const docs = JSON.parse(fs.readFileSync(`${SP}/mydocs.json`, 'utf8'));
const by = Object.fromEntries(docs.map(d => [d.slug, d.content || '']));
const md = f => fs.readFileSync(D + f, 'utf8').replace(/^---[\s\S]*?\n---\n/, '');

const norm = s => (s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*|>`~\-\s\r\n]/g, '');
const gs = (s, n) => { const t = new Set(); for (let i = 0; i + n <= s.length; i++) t.add(s.slice(i, i + n)); return t; };
function score(a, b) { const ga = gs(norm(a), 4), gb = gs(norm(b), 4); let i = 0; for (const x of ga) if (gb.has(x)) i++; return { j: i / (ga.size + gb.size - i), cA: i / ga.size, cB: i / gb.size }; }
function chunks(a, b, min = 14) { const X = norm(a), Y = norm(b); const f = []; let i = 0; while (i < X.length) { let l = 0; while (i + l < X.length && Y.includes(X.slice(i, i + l + 1))) l++; if (l >= min) { f.push(X.slice(i, i + l)); i += l; } else i++; } return f; }
const line = (name, a, b) => { const s = score(a, b); const c = chunks(a, b); console.log(`${(s.j * 100).toFixed(1).padStart(5)}%  含有${(s.cA * 100).toFixed(0)}/${(s.cB * 100).toFixed(0)}  14字以上${String(c.length).padStart(3)}か所/${String(c.reduce((t, x) => t + x.length, 0)).padStart(4)}字  最長${String(Math.max(0, ...c.map(x => x.length))).padStart(3)}  ${name}`); };

console.log('=== 物差しの検証 ===');
line('【対象】探し方 × 平日（現行・公開中）', by['kitchen-car-location-guide'], by['weekday-food-truck-spots']);
line('【相手の物差し】renting-parking-space × auto-mtgh64lh（現行DB）', by['renting-parking-space'], by['auto-mtgh64lh-jwwkxe']);
console.log('--- 実際にカニバリ判定を受けて統合された「統合前の原稿どうし」 ---');
line('探し方(統合前) × how-to-find(統合前) ← B-1で重複判定された2本', md('kitchen-car-location-guide.previous.md'), md('how-to-find-food-truck-spots.previous.md'));
line('renting(統合後) × auto-mtgh64lh(統合前の原稿)', by['renting-parking-space'], md('auto-mtgh64lh-jwwkxe.previous.md'));
line('食い違い確認: auto-mtgh64lh DB版 × 同 previous原稿', by['auto-mtgh64lh-jwwkxe'], md('auto-mtgh64lh-jwwkxe.previous.md'));
console.log('--- 統合されなかった＝別記事として残された組（許容ラインの目安） ---');
line('探し方 × choose-profitable（別の疑問として残した）', by['kitchen-car-location-guide'], by['choose-profitable-food-truck-location']);
line('探し方 × how-to-find（現行DB）', by['kitchen-car-location-guide'], by['how-to-find-food-truck-spots']);
line('平日 × 出店料相場', by['weekday-food-truck-spots'], by['food-truck-fee-guide']);
line('開業費用 × 営業許可', by['kitchen-car-startup-cost'], by['kitchen-car-business-license']);
line('イベント集め方 × 呼ぶには（棚卸しで「重複ぎみ」と書かれた組）', by['event-food-truck-guide'], by['how-to-invite-kitchen-car']);

// 締めのCTA定型文が何本に入っているか
console.log('\n=== 締めのCTA定型文はサイト共通か ===');
const key = '（残る6件は応相談）';
const key2 = '「毎週火・木曜日」のような曜日で書かれているものが多く';
for (const d of docs) {
  const n = norm(d.content);
  if (n.includes(norm(key)) || n.includes(norm(key2))) console.log(`  ${d.slug}: 応相談=${n.includes(norm(key))} 毎週火木=${n.includes(norm(key2))}`);
}

// 「募集中110件」という同じ母集団を使う記事は何本か
console.log('\n=== 同じ母集団(110件)を使う記事 ===');
for (const d of docs) if ((d.content || '').includes('110件')) console.log(`  ${d.slug}  出現${(d.content.match(/110件/g) || []).length}回`);
