import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class lists so a caller's class wins over a component's default
 * instead of both landing in the DOM and the cascade deciding.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
