// Pretend goals for the guest view of the Goals tab: a five-year-old boy's big plans. Nothing here is saved.
import type { PItem } from './privateData.ts'
import type { AnchorIcon } from './anchors.ts'
import { addDays, today } from './dates.ts'

export const DEMO_ANCHORS: { text: string; icon: AnchorIcon }[] = [
  { text: 'Fill my piggy bank right to the top', icon: 'wallet' },
  { text: 'Be brave, like a superhero', icon: 'shield' },
  { text: 'Grow taller than Dad', icon: 'growth' },
  { text: 'A treehouse in the backyard', icon: 'house' },
  { text: 'See every dinosaur in the whole world', icon: 'globe' },
  { text: 'Ice cream every Friday', icon: 'heart' },
  { text: 'Lots of sleepovers at Grandma and Grandpa\'s', icon: 'family' },
  { text: 'Always be kind to my little sister', icon: 'child' },
]

const P = (id: string, kind: PItem['kind'], title: string, f: Partial<PItem> = {}): PItem => ({ id, kind, title, sub: '', cat: '', num1: 0, num2: 0, day: null, sort: 0, ...f })

export function demoItems(): PItem[] {
  const t = today(); const y = Number(t.slice(0, 4))
  const xmas = `${t.slice(5) > '12-25' ? y + 1 : y}-12-25`
  return [
    P('g-bike', 'pillar', 'Ride a bike with no training wheels', { sort: 1 }),
    P('s-1', 'step', 'Get a cool red helmet', { cat: 'g-bike', num1: 1, sort: 1 }),
    P('s-2', 'step', 'Practise in the park with Dad', { cat: 'g-bike', num1: 1, sort: 2 }),
    P('s-3', 'step', 'Take one training wheel off', { cat: 'g-bike', sort: 3 }),
    P('s-4', 'step', 'Ride all the way to the corner shop', { cat: 'g-bike', sort: 4 }),
    P('g-lego', 'pillar', 'Build the tallest Lego tower ever', { sort: 2 }),
    P('s-5', 'step', 'Find all the blue bricks', { cat: 'g-lego', num1: 1, sort: 1 }),
    P('s-6', 'step', 'Build it taller than the couch', { cat: 'g-lego', sort: 2 }),
    P('s-7', 'step', 'Do not let my sister knock it over', { cat: 'g-lego', sort: 3 }),
    P('g-swim', 'pillar', 'Swim without floaties', { sort: 3 }),
    P('s-8', 'step', 'Put my face in the water', { cat: 'g-swim', num1: 1, sort: 1 }),
    P('s-9', 'step', 'Kick across the little pool', { cat: 'g-swim', sort: 2 }),
    P('c-1', 'countdown', 'My birthday party', { day: addDays(t, 40), sort: 1 }),
    P('c-2', 'countdown', 'Christmas presents', { day: xmas, sort: 2 }),
    P('c-3', 'countdown', 'Trip to the zoo', { day: addDays(t, 12), sort: 3 }),
    P('v-1', 'pin', 'A puppy called Rex', { cat: 'Home', sort: 1 }),
    P('v-2', 'pin', 'Visit the dinosaur museum', { cat: 'Travel', sort: 2 }),
    P('v-3', 'pin', 'Be a firefighter', { cat: 'Career', sort: 3 }),
    P('v-4', 'pin', 'Fly to the moon in a rocket', { cat: 'Travel', sort: 4 }),
    P('v-5', 'pin', 'Best friends forever with Max', { cat: 'Love', sort: 5 }),
    P('v-6', 'pin', 'Eat all my vegies (sometimes)', { cat: 'Health', sort: 6 }),
    P('m-1', 'money', 'Toy fire truck', { cat: String(y + 1), num1: 32, num2: 60, sort: 1 }),
    P('m-2', 'money', 'Dinosaur museum ticket', { cat: String(y + 1), num1: 8, num2: 25, sort: 2 }),
    P('m-3', 'money', 'A real telescope', { cat: String(y + 2), num1: 5, num2: 120, sort: 3 }),
  ]
}
