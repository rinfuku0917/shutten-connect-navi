const urls = [
  'https://app.connect-navi.com/blog/kitchen-car-location-guide',
  'https://app.connect-navi.com/blog/food-truck-fee-guide',
  'https://app.connect-navi.com/blog/kitchen-car-required-documents',
]
for (const u of urls) {
  const res = await fetch(u)
  const html = await res.text()
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  console.log(`\n=== ${u} → HTTP ${res.status} ===`)
  const needles = [
    '募集に応募するには書類が要ります',
    '応募には損害賠償保険とPL保険の2つが必須',
    '書類がそろっていないと、その場で応募できません',
    '応募そのものは、書類がそろっていなくてもできます',
  ]
  for (const n of needles) {
    if (text.includes(n)) console.log(`  HIT: ${n}`)
  }
}
