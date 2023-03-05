import { get, set } from '@/utilities/common';

export function getFromCache<expectedType = unknown>(cacheKey: string, key?: string) {
  const cachedData = localStorage.getItem(cacheKey);
  if (!cachedData) {
    return undefined;
  }
  if (!key) {
    return JSON.parse(cachedData) as expectedType;
  }
  const value = get(JSON.parse(cachedData) as Record<string, unknown>, key);
  if (!value) {
    return undefined;
  }

  return value as expectedType;
}

export function setToCache(value: unknown, cacheKey: string, key?: string) {
  if (!key) {
    localStorage.setItem(cacheKey, JSON.stringify(value));

    return;
  }
  const cachedData = localStorage.getItem(cacheKey);
  if (!cachedData) {
    localStorage.setItem(cacheKey, JSON.stringify({ [key]: value }));

    return true;
  }
  let data = JSON.parse(cachedData);
  if (Array.isArray(data)) {
    // @ts-expect-error - data is an array
    data[key] = value;
  } else {
    data = set(data as Record<string, unknown>, key, value);
  }
  localStorage.setItem(cacheKey, JSON.stringify(data));

  return true;
}
