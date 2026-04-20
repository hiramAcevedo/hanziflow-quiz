import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMeanings(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [raw];
  }
}

export function parsePos(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [raw];
  }
}

export function blockLabel(block: string): string {
  switch (block) {
    case "hsk2_l1":
      return "HSK 2.0 — Nivel 1";
    case "hsk2_l2":
      return "HSK 2.0 — Nivel 2";
    case "hsk3_l1_new":
      return "HSK 3.0 L1 (nuevos)";
    case "hsk3_l2_new":
      return "HSK 3.0 L2 (nuevos)";
    default:
      return "Todos";
  }
}
