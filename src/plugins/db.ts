import { defineStore } from 'pinia';
import { getFromCache, setToCache } from './cache-adapter';
import { deepClone, get, set } from '../utilities/common';
import { dynamicallyExecuteFunction } from 'vue-subscription';

import type { StoreDefinition } from 'pinia';
import type {
  GenericArray,
  GenericObject,
  GetDeepValue,
  PathInto,
  PathIntoDeep,
  Prettier,
  PrimitiveTypes
} from '../types/utilities';

export type TypesOfState = Record<string, PrimitiveTypes | GenericArray | GenericObject>;
export type BasicTable<T = TypesOfState> = {
  name: string;
  state: T;
  getters?: {};
  actions?: {};
  useCache?: boolean;
};

function deepCloneDbValue<InferredType>(val: InferredType): InferredType {
  // console.log(val);
  if (val === undefined) {
    return val;
  }

  return deepClone(val);
}

const CACHE_KEY = 'bnw-cache-db';
const _stores: Map<string, StoreDefinition> = new Map();

// eslint-disable-next-line sonarjs/no-unused-collection
const _cachedTables = new Map([['all', false]]);

const _coreState: Record<string, unknown> = {};

/**
 * It creates a Pinia store for the table and caches the table's state if the table is marked as
 * cacheable
 * @param {T} table - T extends BasicTable - This is the table that we're creating a store for.
 * @returns A function that takes a table and returns a table.
 */
function createStore<T extends BasicTable>(table: T) {
  _stores.set(
    table.name,
    defineStore(table.name, {
      state: () => table.state,
      getters: table.getters ?? {},
      actions: table.actions ?? {}
    })
  );

  // link store state to core state
  _coreState[table.name] = (_stores.get(table.name!) as StoreDefinition)().$state;

  if (table.useCache) {
    _cachedTables.set(table.name, true);
    const cachedData = getFromCache(table.name);
    if (cachedData) {
      const storeInstance = _stores.get(table.name)!();
      storeInstance.$state = cachedData;
    } else {
      setToCache(table.state, table.name);
    }
  }

  return table;
}

type Subscriber<T = unknown> = (val: T) => Promise<void> | void;
type SubscribersMap<T = unknown> = Map<string, Set<Subscriber<T>>>;
const _subscribersMap: SubscribersMap = new Map();

function runCommonSubscribers() {
  _subscribersMap.get('')?.forEach(subscriber => {
    dynamicallyExecuteFunction(subscriber, _coreState);
  });
}

/**
 * It takes a key and data, and if there are any subscribers for that key, it executes them with the
 * data
 * @param {string} key - The key that the subscriber is listening to.
 * @param {unknown} [data] - the data that is passed to the subscriber
 */
function runSubscribers(key: string, data: unknown) {
  const subDataList: [string, unknown][] = [];

  for (const existingkey of _subscribersMap.keys()) {
    // add key if it has subscribers
    if (existingkey === key) {
      subDataList.push([key, data]);
      continue;
    }
    // For deep keys
    const deepKey = existingkey.split('.*')[0];
    if (key.indexOf(deepKey) === 0) {
      subDataList.push([existingkey, get(_coreState, deepKey)]);
    }
  }

  for (const subData of subDataList) {
    _subscribersMap.get(subData[0])?.forEach(subscriber => {
      dynamicallyExecuteFunction(subscriber, subData[1]);
    });
  }

  runCommonSubscribers();
}

type NewTable<T> = Prettier<BasicTable<T>>;

type StoreOptions<T = unknown> = {
  useCache?: boolean;
  table?: NewTable<T>;
  host?: boolean;
} & {};

type DbKeyForDbWithTableInstance<T, U = string> = T extends undefined ? U : (PathInto<T> | keyof T) & U;

// @ts-expect-error - ts does not need to worry here
type DbKeyForSubs<T, U = string> = T extends undefined ? U : (PathIntoDeep<T> | keyof T | `${keyof T}.*`) & U;

type GetDbValueIfNotEmpty<State, Key, T> = State extends undefined
  ? T
  : Key extends `${infer MainKey}.*`
  ? GetDeepValue<State, MainKey>
  : GetDeepValue<State, Key>;

type TableKey<State, K = string> = State extends undefined ? K : keyof State;

class DB<InferedState = undefined> {
  #host = false;
  #key = '' as string;
  #data = undefined as InferedState | undefined;

  constructor(table?: NewTable<InferedState>, mainTable?: string) {
    if (table) {
      this.addTable(table as BasicTable, true);
    } else if (mainTable) {
      this.#host = true;
      this.#key = mainTable;
    }
  }

  addTable<T extends BasicTable>(table: T, host = false): this {
    createStore(table);
    // createStateToStoreMap({ tableId: table.name, table });
    if (this.#host || host) {
      this.#host = true;
      this.#key = table.name;
    }

    return this;
  }

  flush() {
    if (!this.#host) {
      this.#key = '';
    }
    this.#data = undefined;
  }

  get $value() {
    if (this.#key) {
      return _coreState[this.#key] as InferedState;
    }

    return _coreState as InferedState;
  }

  getKey(key?: string) {
    if (!key) {
      return this.#key;
    }
    if (this.#host) {
      return `${this.#key}.${key}`;
    }

    return key;
  }

  get<T extends DbKeyForDbWithTableInstance<InferedState>>(key: T, defaultValue?: unknown) {
    this.#data = (get(_coreState, this.getKey(key)) ?? defaultValue ?? undefined) as InferedState;

    return this as {
      value<K = unknown>(): GetDbValueIfNotEmpty<InferedState, T, K>;
    };
  }
  value<T = unknown>(): T {
    const value = deepCloneDbValue(this.#data) as T;
    this.flush();

    return value;
  }
  getValue<T extends DbKeyForDbWithTableInstance<InferedState>, U = unknown>(key?: T) {
    return get(_coreState, this.getKey(key)) as GetDbValueIfNotEmpty<InferedState, T, U>;
  }
  update<
    U extends DbKeyForDbWithTableInstance<InferedState>,
    K = unknown,
  // @ts-expect-error better to keep optional second in this case
    T extends GetDbValueIfNotEmpty<InferedState, U, K>
  >(key: U, callback: (data: T) => T) {
    key = this.getKey(key) as U;
    this.#key = key;
    this.#data = callback(deepCloneDbValue(get(_coreState, key)) as T) as undefined;

    return this;
  }
  write<T = unknown>(callback?: (data: T) => void) {
    set(_coreState, this.#key, this.#data);
    if (callback) {
      callback(deepCloneDbValue(this.#data as T));
    }
    handleCacheOfStore(this.#key);
    runSubscribers(this.#key, this.#data);
    this.flush();

    return this;
  }
  writeUpdate<
    U extends DbKeyForDbWithTableInstance<InferedState>,
    K = unknown,
  // @ts-expect-error better to keep optional second in this case
    T extends GetDbValueIfNotEmpty<InferedState, U, K>
  >(key: U, callback: (data: T) => T) {
    key = this.getKey(key) as U;
    const data = callback(get(_coreState, key) as T);

    set(_coreState, key, data);
    handleCacheOfStore(key);
    runSubscribers(key, data);
    this.flush();

    return this;
  }

  has<U extends DbKeyForDbWithTableInstance<InferedState>>(key: U) {
    key = this.getKey(key) as U;

    return get(_coreState, key) !== undefined;
  }
  // @ts-expect-error better to keep optional second in this case
  next<T = unknown, U extends DbKeyForDbWithTableInstance<InferedState>>(callback: (data: T) => void, key?: U) {
    let data = _coreState;
    if (key) {
      data = get(_coreState, key);
    }
    callback(deepCloneDbValue(data) as T);

    return this;
  }

  addSubscriber<U extends DbKeyForSubs<InferedState>, T = undefined>(
    key: U | '',
    subscriber: Subscriber<GetDbValueIfNotEmpty<InferedState, U, T>>
  ): this {
    key = this.getKey(key) as U;
    if (!_subscribersMap.has(key as string)) {
      (_subscribersMap as SubscribersMap<typeof subscriber>).set(
        key as string,
        new Set() as Set<Subscriber<typeof subscriber>>
      );
    }

    (_subscribersMap as SubscribersMap<typeof subscriber>)
      .get(key as string)!
      .add(subscriber as Subscriber<typeof subscriber>);

    return this;
  }
  removeSubscriber<U extends DbKeyForSubs<InferedState>, T = undefined>(
    key: U | '',
    subscriber: Subscriber<GetDbValueIfNotEmpty<InferedState, U, T>>
  ): this {
    key = this.getKey(key) as U;
    if (_subscribersMap.has(key as string)) {
      // @ts-expect-error - we know that the #key exists
      _subscribersMap.get(key).delete(subscriber);
    }

    return this;
  }
  unSubscribe<T extends DbKeyForSubs<InferedState>>(key?: T): this {
    key = this.getKey(key) as T;
    _subscribersMap.delete(key);

    return this;
  }
  clearSubscribers(): this {
    _subscribersMap.clear();

    return this;
  }
  set<
    U extends DbKeyForDbWithTableInstance<InferedState>,
    K = unknown,
  // @ts-expect-error optional can be second
    T extends GetDbValueIfNotEmpty<InferedState, U, K>
  >(key: U, value: T) {
    key = this.getKey(key) as U;
    if (this.has(key)) {
      if (_stores.has(key)) {
        _stores
          .get(key)?.()
          .$patch(value as {});

        runSubscribers(key, value);
      } else {
        this.writeUpdate(key, () => value as GetDbValueIfNotEmpty<InferedState, U, TypesOfState>);
      }

      return this;
    }

    const keys = key.split('.');
    let name = key;
    if (keys.length > 1) {
      name = keys[0] as U;
    }
    this.addTable({
      name,
      state: {}
    });
    if (_stores.has(key)) {
      _stores
        .get(key)?.()
        .$patch(value as {});
    } else {
      this.writeUpdate(key, () => value as GetDbValueIfNotEmpty<InferedState, U, TypesOfState>);
    }

    return this;
  }
  dropTable<K extends TableKey<InferedState, string>>(tableKey?: K) {
    if (!_stores.has(tableKey as string)) {
      return;
    }
    //@ts-expect-error not an error
    tableKey = this.getKey(tableKey);
    for (const [key] of _subscribersMap) {
      if (key.indexOf(tableKey) === 0) {
        _subscribersMap.delete(key);
      }
    }
    _subscribersMap.delete(`${tableKey as string}.*`);

    delete _coreState[tableKey as string];

    if (import.meta.env.DEV === true) {
      _stores
        .get(tableKey as string)?.()
        .$dispose();
    }
    _stores.delete(tableKey);
  }
}

type DbInstanceType<T> = InstanceType<typeof DB<T>>;
export type DbInstance<T = undefined> = DbInstanceType<T>;

/**
 * The useDb function is used to read and write data to the state of a Pinia store.
 * It returns an object with several functions to interact with the store's state,
 * including get, update, write, writeUpdate, next, and has.
 * These functions can be used to read data fromthe store,
 *  update the store's data, write new data to the store, and subscribe to changes in the store's data.
 */
export function createDb<T = undefined, K extends string | undefined = undefined>(
  table?: NewTable<T>,
  mainTableKey?: K
) {
  return new DB(table, mainTableKey);
}

/**
 * It checks if there's a cache, if there is, it updates the state of the stores with the cached data,
 * if there isn't, it caches the current state of the stores
 */
function handleCache() {
  _cachedTables.set('all', true);
  const stores = getFromCache<TypesOfState>(CACHE_KEY);
  if (stores) {
    const dbInstance = createDb();
    Object.keys(stores).forEach(function (storeName: string) {
      dbInstance.writeUpdate(storeName, function (data: unknown) {
        data = stores[storeName];

        return data;
      });
    });
  } else {
    _stores.forEach(function (store, storeName) {
      const storeInstance = store();
      setToCache(storeInstance.$state, storeName);
    });
  }
}

type Tables<T> = T & Array<BasicTable>;
/**
 * It creates a store for each table and a state to store map for each table
 * @param tables - An array of tables that you want to create.
 * @param [useCache=false] - If true, the cache will be used to store the data.
 */
export function initDb<T>(tables: Tables<T>, useCache = false) {
  for (const table of tables) {
    createStore(table);
    // createStateToStoreMap({ tableId: table.name });
  }
  if (useCache) {
    handleCache();
  }
}

type UseStoreOptions = Omit<StoreOptions, 'table' | 'host'>;

export function useStores<S>(): S;
// eslint-disable-next-line no-redeclare
export function useStores<S, T>(tables: Tables<T>, options?: UseStoreOptions): S;
// eslint-disable-next-line no-redeclare
export function useStores<T>(tables?: Tables<T>, options?: UseStoreOptions): unknown;
// eslint-disable-next-line no-redeclare, no-unused-vars
export function useStores(tables?: unknown[], options?: UseStoreOptions): unknown {
  if (Object.keys(_coreState).length === 0 && _stores.size === 0 && tables && tables.length > 0) {
    initDb(tables as BasicTable[], options?.useCache ?? false);
  }

  return _coreState;
}

/**
 * If the table is cached, then set the state to the cache
 * @param {string} key - The key of the store that was updated.
 */
function handleCacheOfStore(key: string) {
  const tableName = key.split('.')[0];

  if (_cachedTables.get('all') || _cachedTables.get(tableName)) {
    const storeName = tableName;
    const state = _coreState[storeName];
    setToCache(state, storeName);
  }
}
