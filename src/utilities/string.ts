import { wrapInTryCatch } from './common';

/**
 * It returns a random string
 * @returns A random string of 16 characters.
 */
export function getRandomString() {
	return wrapInTryCatch(() => {
		const divisor = 2;
		const defaultStringLength = 16;
		const fullStringLength = defaultStringLength * divisor;

		return Math.random().toString(fullStringLength).substring(divisor);
	}) as string;
}
