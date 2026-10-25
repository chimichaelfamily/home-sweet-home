// Our anchors: the things we are building towards, for life.
// These are not editable in the app on purpose. To change them, edit this list and push.
export type AnchorIcon = 'wallet' | 'shield' | 'growth' | 'house' | 'globe' | 'heart' | 'family' | 'child'
export const ANCHORS: { text: string; icon: AnchorIcon }[] = [
  { text: 'Income that comfortably covers our expenses', icon: 'wallet' },
  { text: 'A solid emergency fund in place', icon: 'shield' },
  { text: 'Automatic investing, with compound interest', icon: 'growth' },
  { text: 'An investment property', icon: 'house' },
  { text: 'The freedom to live anywhere in the world', icon: 'globe' },
  { text: 'Work that is a passion and a choice, no more corporate', icon: 'heart' },
  { text: 'Being with our parents whenever we want', icon: 'family' },
  { text: 'To have and raise children', icon: 'child' },
]
