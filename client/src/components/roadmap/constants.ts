import type { NodeStatus } from '../../lib/api'

export interface StatusStyle {
  bg: string
  border: string
  text: string
}

export function statusStyles(status: NodeStatus): StatusStyle {
  switch (status) {
    case 'mastered':
      return { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' }
    case 'in-progress':
      return { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' }
    case 'available':
      return { bg: 'bg-sky-400', border: 'border-sky-500', text: 'text-white' }
    case 'locked':
    default:
      return { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-600' }
  }
}
