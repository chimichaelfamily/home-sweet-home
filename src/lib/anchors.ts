// Our anchors: the things we are building towards, for life.
// These are not editable in the app on purpose. To change them, edit this list and push.
export type AnchorIcon = 'wallet' | 'shield' | 'growth' | 'house' | 'globe' | 'heart' | 'family' | 'child'
export const ANCHORS: { text: string; icon: AnchorIcon; color: string }[] = [
  { text: 'Income that comfortably covers our expenses', icon: 'wallet', color: '#F5A524' },
  { text: 'A solid emergency fund in place', icon: 'shield', color: '#2FA66B' },
  { text: 'Automatic investing, with compound interest', icon: 'growth', color: '#3B82F6' },
  { text: 'An investment property', icon: 'house', color: '#E5609A' },
  { text: 'The freedom to live anywhere in the world', icon: 'globe', color: '#14A3B8' },
  { text: 'Work that is a passion and a choice, no more corporate', icon: 'heart', color: '#EF6C4D' },
  { text: 'Being with our parents whenever we want', icon: 'family', color: '#7C5CE0' },
  { text: 'To have and raise children', icon: 'child', color: '#F0B429' },
]
