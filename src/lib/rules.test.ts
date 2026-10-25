import assert from 'node:assert/strict'
import { addMonths, diffDays, today } from './dates.ts'
import { nextDue, status, daysLate, headsUps, type Rule } from './rules.ts'

const mk = (last: string, n: number, unit: Rule['unit']): Rule => ({
  id: 'x', name: 'x', category: 'x', action: 'x', every_n: n, unit, applies_to: 'Both', keep: true, last_done: last, size: 'baby',
})
const T = '2026-10-24'
assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
assert.equal(addMonths('2026-10-23', 3), '2027-01-23')
assert.equal(diffDays('2026-10-24', '2026-03-01'), 237)
// The 13 rules from the household workbook, checked against the numbers worked out by hand.
assert.equal(nextDue(mk('2025-09-01', 6, 'months')), '2026-03-01')
assert.equal(daysLate(mk('2025-09-01', 6, 'months'), T), 237)
assert.equal(daysLate(mk('2026-01-01', 3, 'months'), T), 206)
assert.equal(daysLate(mk('2026-01-01', 6, 'months'), T), 115)
assert.equal(daysLate(mk('2025-09-01', 12, 'months'), T), 53)
assert.equal(daysLate(mk('2026-09-01', 1, 'weeks'), T), 46)
assert.equal(daysLate(mk('2026-09-01', 1, 'months'), T), 23)
assert.equal(status(mk('2026-10-24', 1, 'weeks'), T), 'soon')
assert.equal(nextDue(mk('2026-01-01', 2, 'years')), '2028-01-01')
assert.equal(status(mk('2026-01-01', 2, 'years'), T), 'ok')
// heads-ups: 7-day cycle gets none; 3-month cycle gets both
assert.deepEqual(headsUps(mk('2026-10-24', 1, 'weeks')), { monthBefore: null, weeksBefore: null })
assert.deepEqual(headsUps(mk('2026-09-01', 3, 'months')), { monthBefore: '2026-11-01', weeksBefore: '2026-11-17' })
console.log('rules tests passed')

// ---- actions ----
import { addTask, complete, undo, monthPoints } from './actions.ts'
import type { State } from './types.ts'
import * as A from './actions.ts'
const base: State = { rules: [mk('2025-09-01', 6, 'months')], tasks: [], events: [], snoozes: [], habits: [], habitLogs: [] }
let r = addTask(base, 'Clean the oven', 'biggie')
assert.equal(r.state.tasks.length, 1)
const tid = r.state.tasks[0].id
let c = complete(r.state, 'task', tid, 'both')
assert.equal(c.state.events.length, 2)
assert.deepEqual(monthPoints(c.state, today().slice(0, 7)), { linh: 3, michael: 3 })
let u = undo(c.state, c.batch!)
assert.equal(u.state.tasks[0].done_at, null)
assert.deepEqual(monthPoints(u.state, today().slice(0, 7)), { linh: 0, michael: 0 })
// ticking a rule moves last_done to today and undo puts the old date back
let rr = complete(base, 'rule', base.rules[0].id, 'linh')
assert.notEqual(rr.state.rules[0].last_done, '2025-09-01')
assert.equal(undo(rr.state, rr.batch!).state.rules[0].last_done, '2025-09-01')
console.log('actions tests passed')

// ---- habits ----
import { streak, longestInMonth } from './habits.ts'
import { toggleHabit, addHabit } from './actions.ts'
const dset = (...d: string[]) => new Set(d)
assert.equal(streak(dset('2026-10-22', '2026-10-23', '2026-10-24'), '2026-10-24'), 3)
assert.equal(streak(dset('2026-10-22', '2026-10-23'), '2026-10-24'), 2) // today not ticked yet keeps the streak
assert.equal(streak(dset('2026-10-21'), '2026-10-24'), 0)
assert.equal(longestInMonth(dset('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'), '2026-10', '2026-10-24'), 3)
let h = addHabit(base, 'linh', ' Walk ')
const hid = h.state.habits[0].id
assert.equal(h.state.habits[0].name, 'Walk')
let tg = toggleHabit(h.state, hid, '2026-10-24')
assert.equal(tg.state.habitLogs.length, 1)
assert.equal(toggleHabit(tg.state, hid, '2026-10-24').state.habitLogs.length, 0)
console.log('habit tests passed')

import { parseIcs, scheduleDays } from './calendar.ts'
{
  assert.deepStrictEqual(scheduleDays('2026-10-24'), ['2026-10-24', '2026-10-25']) // Sat
  assert.strictEqual(scheduleDays('2026-10-25').length, 8) // Sun: today + next week
  assert.strictEqual(scheduleDays('2026-10-25')[1], '2026-10-26')
  assert.deepStrictEqual(scheduleDays('2026-10-28')[0], '2026-10-26') // Wed -> Mon..Sun
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART;VALUE=DATE:20261027\r\nDTEND;VALUE=DATE:20261028\r\nSUMMARY:Holiday\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nDTSTART:20261026T230000Z\r\nDTEND:20261027T000000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Standup\r\nEND:VEVENT\r\nEND:VCALENDAR`
  const ev = parseIcs(ics, 'linh', '2026-10-26', '2026-11-01')
  assert.ok(ev.some(e => e.title === 'Holiday' && e.day === '2026-10-27' && e.allDay))
  assert.strictEqual(ev.filter(e => e.title === 'Standup').length, 3)
  console.log('calendar tests passed')
}

import { daysUntil, monthsTo } from './pmath.ts'
{
  assert.strictEqual(monthsTo(2027, new Date(2026, 9, 25)), 15) // Oct 2026 .. Dec 2027
  assert.strictEqual(monthsTo(2026, new Date(2026, 11, 31)), 1)
  assert.strictEqual(daysUntil('2026-12-25', new Date(2026, 9, 25)), 61)
  console.log('private tests passed')
}

import { mondayOf, weekly } from './weekly.ts'
{
  assert.strictEqual(mondayOf('2026-10-25'), '2026-10-19') // Sunday -> previous Monday
  assert.strictEqual(mondayOf('2026-10-26'), '2026-10-26')
  const st = { rules: [], tasks: [], snoozes: [], habits: [{ id: 'h1', person_id: 'linh' as const, name: 'x', sort: 1, active: true }], habitLogs: ['2026-10-23', '2026-10-24', '2026-10-25'].map(day => ({ habit_id: 'h1', day })),
    events: [{ id: 'e', person_id: 'michael' as const, points: 3, title: 't', category: null, size: 'biggie' as const, shared: false, task_id: null, rule_id: null, batch: 'b', prev_last_done: null, created_at: '2026-10-24T01:00:00Z', undone_at: null }] }
  const w = weekly(st as never, '2026-10-25')
  assert.strictEqual(w.people.michael.points, 3); assert.strictEqual(w.leader, 'michael')
  assert.deepStrictEqual(w.people.michael.pointsByDay, [0, 0, 0, 0, 0, 3, 0])
  assert.deepStrictEqual(w.people.linh.habits[0].done, [false, false, false, false, true, true, true])
  assert.strictEqual(w.people.linh.perfectDays, 3); assert.strictEqual(w.people.linh.bestStreak, 3)
  console.log('weekly tests passed')
}

import { productStatus, useBy } from './products.ts'
{
  assert.strictEqual(useBy('2026-10-24', 12, null), '2027-10-24')
  assert.strictEqual(useBy('2026-10-24', 12, '2027-03-01'), '2027-03-01') // printed date earlier wins
  assert.strictEqual(useBy('2026-10-24', 6, '2028-01-01'), '2027-04-24')
  assert.strictEqual(productStatus('2026-10-02', '2026-10-25').tone, 'late')
  assert.strictEqual(productStatus('2026-11-10', '2026-10-25').label, 'In 16 days')
  console.log('product tests passed')
}

import { embedUrl } from './embed.ts'
{
  assert.ok(embedUrl('https://www.youtube.com/watch?v=abc123')!.src.includes('/embed/abc123'))
  assert.ok(embedUrl('https://youtu.be/xyz?si=1')!.src.includes('/embed/xyz'))
  assert.ok(embedUrl('https://www.youtube.com/playlist?list=PL1')!.src.includes('videoseries?list=PL1'))
  assert.strictEqual(embedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x')!.src, 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC')
  assert.strictEqual(embedUrl('https://example.com/x'), null)
  console.log('embed tests passed')
}

{
  const a = A.addTask(({ rules: [], tasks: [], events: [], snoozes: [], habits: [], habitLogs: [] } as State), 'Vacuum', 'baby')
  const id = a.state.tasks[0].id
  const c = A.complete(a.state, 'task', id, 'both')
  assert.strictEqual(c.state.events.length, 2)
  const e = A.editTask(c.state, id, { title: 'Vacuum lounge', size: 'biggie' })
  assert.strictEqual(e.state.tasks[0].title, 'Vacuum lounge')
  assert.ok(e.state.events.every(x => x.points === 3 && x.title === 'Vacuum lounge'))
  const d = A.deleteTask(e.state, id)
  assert.strictEqual(d.state.tasks.length, 0)
  assert.ok(d.state.events.every(x => !!x.undone_at))
  console.log('task edit tests passed')
}

import { skyOf } from './photos.ts'
{
  assert.strictEqual(skyOf(0), 'clear'); assert.strictEqual(skyOf(61), 'rain'); assert.strictEqual(skyOf(95), 'storm')
  assert.strictEqual(skyOf(73), 'snow'); assert.strictEqual(skyOf(3), 'cloudy'); assert.strictEqual(skyOf(45), 'fog')
  console.log('sky tests passed')
}

import { solarToLunar } from './lunar.ts'
{
  const l = (d: number, m: number, y: number) => { const r = solarToLunar(d, m, y); return `${r.day}/${r.month}${r.leap ? 'L' : ''}` }
  assert.strictEqual(l(17, 2, 2026), '1/1')   // Tết 2026
  assert.strictEqual(l(29, 1, 2025), '1/1')   // Tết 2025
  assert.strictEqual(l(10, 2, 2024), '1/1')   // Tết 2024
  assert.strictEqual(l(25, 9, 2026), '15/8')  // Mid-Autumn 2026
  assert.strictEqual(l(16, 2, 2026), '29/12') // last day of the month before Tết 2026
  console.log('lunar tests passed')
}

import { vicHolidays } from './vicHolidays.ts'
{
  const h = vicHolidays(2026)
  assert.strictEqual(h['2026-03-09'], 'Labour Day')
  assert.strictEqual(h['2026-04-03'], 'Good Friday')
  assert.strictEqual(h['2026-04-06'], 'Easter Monday')
  assert.strictEqual(h['2026-06-08'], "King's Birthday")
  assert.strictEqual(h['2026-09-25'], 'Grand Final Friday')
  assert.strictEqual(h['2026-11-03'], 'Melbourne Cup')
  assert.strictEqual(h['2026-12-28'], 'Boxing Day (day off)')
  assert.strictEqual(Object.keys(h).length, 14 - 0)
  console.log('vic holiday tests passed')
}

import { parseDialogue, parseFact, wordCount } from './ktext.ts'
{
  const d = parseDialogue('**Sam:** Hi there!\nPriya: Hey, how was your weekend?\nSam: Great, we went to the market.\nPriya: Nice!\nTIP: Ask open questions.\nPHRASES: How was your weekend? | Sounds fun | Tell me more')
  assert.strictEqual(d.lines.length, 4)
  assert.strictEqual(d.lines[0].who, 'Sam')
  assert.strictEqual(d.tip, 'Ask open questions.')
  assert.deepStrictEqual(d.phrases, ['How was your weekend?', 'Sounds fun', 'Tell me more'])
  const f = parseFact('FACT: Octopuses have three hearts.\nWHY: Two pump blood to the gills.', 'Nature')
  assert.strictEqual(f.text, 'Octopuses have three hearts.')
  assert.strictEqual(f.why, 'Two pump blood to the gills.')
  assert.strictEqual(wordCount('  one two  three '), 3)
  console.log('knowledge tests passed')
}

import { goodreadsBooks, dailyIndex } from './ktext.ts'
{
  const csv = 'Book Id,Title,Author,My Rating,Exclusive Shelf,My Review,Date Read\n1,"Atomic Habits",James Clear,5,read,"Great<br/>book",2024/05/01\n2,"Dune, Part One",Frank Herbert,0,to-read,,\n3,Deep Work,Cal Newport,0,currently-reading,,\n'
  const b = goodreadsBooks(csv)
  assert.strictEqual(b.length, 3)
  assert.deepStrictEqual([b[0].status, b[0].rating, b[0].review], ['done', 5, 'Great\nbook'])
  assert.strictEqual(b[1].title, 'Dune, Part One')
  assert.strictEqual(b[1].status, 'want')
  assert.strictEqual(b[2].status, 'reading')
  assert.strictEqual(dailyIndex('2026-10-25', 'fact', 10), dailyIndex('2026-10-25', 'fact', 10))
  assert.ok(dailyIndex('2026-10-25', 'fact', 10) < 10)
  console.log('goodreads and bank tests passed')
}

import { parseGoodreadsRss } from './ktext.ts'
{
  const xml = `<rss><channel><item><title><![CDATA[Atomic Habits]]></title><author_name>James Clear</author_name><user_rating>5</user_rating><user_read_at><![CDATA[Mon, 01 Apr 2024]]></user_read_at><user_shelves></user_shelves><user_review><![CDATA[Loved it<br/>so good]]></user_review></item>
<item><title>Deep Work</title><author_name>Cal Newport</author_name><user_rating>0</user_rating><user_read_at></user_read_at><user_shelves>currently-reading</user_shelves><user_review></user_review></item>
<item><title>Dune &amp; More</title><author_name>Frank Herbert</author_name><user_rating>0</user_rating><user_read_at></user_read_at><user_shelves>to-read</user_shelves><user_review></user_review></item></channel></rss>`
  const b = parseGoodreadsRss(xml)
  assert.strictEqual(b.length, 3)
  assert.deepStrictEqual([b[0].status, b[0].rating, b[0].review], ['done', 5, 'Loved it\nso good'])
  assert.strictEqual(b[1].status, 'reading')
  assert.deepStrictEqual([b[2].title, b[2].status], ['Dune & More', 'want'])
  console.log('goodreads rss tests passed')
}
