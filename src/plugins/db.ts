import { shallowReactive, toRaw } from 'vue';
import { defineStore } from 'pinia';
import { getFromCache, setToCache } from './cacheAdapter';
import { deepClone, get, set } from '@/utilities/common';

import type { Store, StoreDefinition, PiniaCustomStateProperties } from 'pinia';

type TypesOfState = Record<string, string | boolean | number | null | Array<unknown> | Record<string, unknown>>;
export type BasicTable = {
	name: string;
	state: TypesOfState;
	getters?: {};
	actions?: {};
	useCache?: boolean;
};

const CACHE_KEY = 'bnw-cache-stores';
const _stores: Map<string, StoreDefinition> = new Map();

const _stateToStoreMap = new Map();
// eslint-disable-next-line sonarjs/no-unused-collection
const _cachedTables = new Map([['all', false]]);

const createStore = <T extends BasicTable>(table: T) => {
	_stores.set(
		table.name,
		defineStore(table.name, {
			state: () => ({ ...table.state }),
			getters: { ...table.getters },
			actions: { ...table.actions }
		})
	);

	if (table.useCache) {
		_cachedTables.set(table.name, true);
		const cachedData = getFromCache(CACHE_KEY, table.name);
		if (cachedData) {
			const storeInstance = _stores.get(table.name)!();
			storeInstance.$state = cachedData;
		} else {
			setToCache(table.state, CACHE_KEY, table.name);
		}
	}

	return table;
};

const _internalState = shallowReactive<Record<string, PiniaCustomStateProperties<{}>>>({});

interface InitStoreParam {
	tableId?: string;
	storeInstance?: Store;
	table?: BasicTable;
}
const createStateToStoreMap = ({ tableId, storeInstance, table }: InitStoreParam) => {
	if (!tableId) {
		tableId = table ? table.name : storeInstance?.$id;
	}
	if (!storeInstance) {
		const storeDefinition = _stores.get(tableId!) as StoreDefinition;
		storeInstance = storeDefinition();
	}
	const states = storeInstance!.$state as BasicTable['state'];
	Object.keys(states).forEach(key => {
		_stateToStoreMap.set(key, tableId);
	});
	_internalState[tableId!] = storeInstance!.$state;

	return _internalState[tableId!];
};

const _coreState = new Proxy(_internalState, {
	get: (target, key) => defineGetter(target, key),
	set: (target, key, value) => defineSetter(target, key, value)
});

type TemporaryData = {
	key: string;
	data: unknown;
	value: unknown;
};

const tempDBdata: TemporaryData = {
	key: '',
	data: undefined,
	value: undefined
};
export const useDb = () => ({
	temporary: Object.assign({}, { ...tempDBdata }),

	flush() {
		Object.assign(this.temporary, { ...tempDBdata });
	},

	get<T>(key: string) {
		this.temporary.value = get(_coreState, key) as T;

		return this;
	},
	value<T>() {
		const value = deepClone(this.temporary.value as T);
		this.flush();

		return value;
	},
	getValue<T>(key: string) {
		return get(_coreState, key) as T;
	},

	update(key: string, callback: Function) {
		this.temporary.key = key;
		const data = get(_coreState, key);
		this.temporary.data = callback(deepClone(data));

		return this;
	},
	write(callback: Function = () => {}) {
		set(_coreState, this.temporary.key, this.temporary.data);
		callback(deepClone(this.temporary.data));
		handleCacheOfStore(this.temporary.key);
		this.flush();

		return this;
	},
	writeUpdate(key: string, callback: Function) {
		const data = callback(deepClone(get(_coreState, key)));
		set(_coreState, key, data);
		handleCacheOfStore(key);
		this.flush();

		return this;
	},

	has(key: string) {
		return get(_coreState, key) !== undefined;
	},
	next(callback: Function, key?: string) {
		let data = _coreState;
		if (key) {
			data = get(_coreState, key);
		}
		callback(deepClone(data));

		return this;
	},

	addTable<T extends BasicTable>(table: T) {
		createStore(table);
		createStateToStoreMap({ tableId: table.name, table });

		return this;
	}
});

export const db = () => useDb();

function handleCache() {
	_cachedTables.set('all', true);
	const stores = getFromCache<TypesOfState>(CACHE_KEY);
	if (stores) {
		const dbInstance = useDb();
		Object.keys(stores).forEach((storeName: string) => {
			dbInstance.writeUpdate(storeName, (data: unknown) => {
				data = stores[storeName];

				return data;
			});
		});
	} else {
		_stores.forEach((store, storeName) => {
			const storeInstance = store();
			setToCache(toRaw(storeInstance.$state), CACHE_KEY, storeName);
		});
	}
}

type Tables<T> = T & Array<BasicTable>;
export function initDb<T>(tables: Tables<T>, useCache = false) {
	tables.forEach(table => {
		createStore(table);
		createStateToStoreMap({ tableId: table.name });
	});
	if (useCache) {
		handleCache();
	}
}

const _iniStores = () => {
	_stores.forEach(store => {
		createStateToStoreMap({ table: undefined, storeInstance: store() });
	});
};

export function useStores<S>(): S;
// eslint-disable-next-line no-redeclare
export function useStores<S, T>(tables: Tables<T>, useCache?: boolean): S;
// eslint-disable-next-line no-redeclare
export function useStores<T>(tables?: Tables<T>, useCache?: boolean): unknown;
// eslint-disable-next-line no-redeclare, no-unused-vars
export function useStores(tables?: unknown[], useCache?: boolean): unknown {
	if (_stateToStoreMap.size === 0) {
		if (_stores.size === 0 && tables && tables.length > 0) {
			initDb(tables as BasicTable[], useCache ?? false);
		} else if (_stores.size > 0) {
			_iniStores();
		}
	}

	return _coreState;
}

function defineGetter(target: {}, key: string | symbol) {
	let value = undefined;
	let isTable = true;
	let storeId = key as string;
	if (_stateToStoreMap.has(key)) {
		isTable = false;
		storeId = _stateToStoreMap.get(key);
	}

	const store = _stores.get(storeId) as StoreDefinition;
	if (store) {
		const storeInstance = store();
		value = isTable ? storeInstance.$state : storeInstance.$state[key];
	}

	return value;
}

function handleCacheOfStore(key: string) {
	const tableName = key.split('.')[0];

	if (_cachedTables.get('all') || _cachedTables.get(tableName)) {
		const storeName = tableName;
		const state = _coreState[storeName];
		setToCache(state, CACHE_KEY, storeName);
	}
}

function defineSetter(target: {}, key: string | symbol, value: any) {
	let isTable = true;
	let storeId = key as string;
	if (_stateToStoreMap.has(key)) {
		isTable = false;
		storeId = _stateToStoreMap.get(key);
	}
	const store = _stores.get(storeId) as StoreDefinition;
	if (store) {
		const storeInstance = store();
		if (isTable) {
			storeInstance.$state = value;
			handleCacheOfStore(key as string);
		} else {
			storeInstance.$patch(state => {
				state[key] = value;
			});
		}
	}

	return true;
}
