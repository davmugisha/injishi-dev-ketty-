import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's class merger: conditional classes in, deduped Tailwind out. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
