import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

export function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const value = key(item);

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

export function round(value: number, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
