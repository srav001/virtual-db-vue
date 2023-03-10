// A set of utility functions to use to remove repetitive and widley used code

export type UtilityFunction<T = void> = (...args: unknown[]) => T;

/**
 * Try to run the function passed in, and if it fails, log the error.
 * @param {UtilityFunction} func - UtilityFunction
 * @returns The function execution is being returned.
 */
export const wrapInTryCatch = <T = unknown>(func: UtilityFunction<T>) => {
	try {
		return func();
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
	}
};

/**
 * It takes a value, turns it into a string, then turns that string back into a value
 * @param value - The value to be cloned.
 */
export function deepClone<InferedType>(value: InferedType) {
	return wrapInTryCatch(() => JSON.parse(JSON.stringify(value))) as InferedType;
}

export type BasicObject = Record<string, unknown>;

function getOrSetNestedValueInObject(objectToUpdate: BasicObject, path: string, value: unknown = undefined) {
	return wrapInTryCatch(() => {
		let schema: BasicObject = objectToUpdate;
		const pathList = path.split('.');
		const pathArrayLength = pathList.length;
		for (let i = 0; i < pathArrayLength - 1; i++) {
			const elem: string = pathList[i];
			if (!schema[elem]) {
				schema[elem] = {};
			}
			//@ts-expect-error - We know that the schema is an object, but TS doesn't.
			schema = schema[elem];
		}

		if (value) {
			schema[pathList[pathArrayLength - 1]] = value;

			return objectToUpdate;
		}

		return schema[pathList[pathArrayLength - 1]];
	});
}

/**
 * A function that takes an object, a path, and a value, and sets the value at the path in the object.
 * @param {BasicObject} objectToUpdate - The object to modify.
 * @param {string} path - The path of the value in the object to update.
 * @param {any} value - The value to update.
 * @returns The updated object.
 */
export function set(objectToUpdate: BasicObject, path: string, value: unknown) {
	return getOrSetNestedValueInObject(objectToUpdate, path, value) as BasicObject;
}

/**
 * It takes an object and a path, and returns the value at that path
 * @param {BasicObject} objectToUpdate - The object that you want to update.
 * @param {string} path - The path to the property you want to get.
 * @returns The value of the property at the end of the path.
 */
export function get<T>(objectToUpdate: BasicObject, path: string) {
	return getOrSetNestedValueInObject(objectToUpdate, path) as T extends null ? null : T;
}
