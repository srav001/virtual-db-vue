import { wrapInTryCatch } from './common';

/**
 * It returns a random string of a given length
 * @returns A random string of length stringLength.
 */
export function getRandomString(): string {
  return wrapInTryCatch(() => {
    const divisor = 2;
    const defaultStringLength = 16;
    const fullStringLength = defaultStringLength * divisor;

    return Math.random().toString(fullStringLength).substring(divisor);
  });
}
