import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

/** A list of short facts, each marked with a success tick. */
export function CheckList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 border-b border-line-subtle py-2.5 text-sm text-ink-secondary last:border-0"
        >
          <Check
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-success"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
