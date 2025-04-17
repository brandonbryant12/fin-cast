import { useState } from 'react';

/** Type guard for validating a persisted value */
export type Validator<T> = (value: unknown) => value is T;

/**
 * A hook to manage state that persists in`localStorage`.
 *
 * @param key        The localStorage key.
 * @param initial    The initial value if nothing (valid) is stored.
 * @param validator  Optional validator – invalid stored values fall back to `initial`.
 * @returns          A stateful value and a setter (mirrors `useState`).
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validator?: Validator<T>,
): [T, (value: T | ((val: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;

    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : initial;

      if (validator && !validator(parsed)) {
        console.warn(
          `usePersistentState: stored value for “${key}” failed validation - using initial.`,
        );
        return initial;
      }
      return parsed;
    } catch (err) {
      console.error(
        `usePersistentState: error reading localStorage key “${key}”:`,
        err,
      );
      return initial;
    }
  });


  const setValue = (value: T | ((val: T) => T)) => {
    if (typeof window === 'undefined') {
      console.warn(
        `usePersistentState: attempted to write “${key}” during SSR -ignored.`,
      );
      return;
    }
    try {
      const next = value instanceof Function ? value(stored) : value;

      if (validator && !validator(next)) {
        console.warn(
          `usePersistentState: attempted to set invalid value for “${key}” - ignored.`,
        );
        return;
      }

      setStored(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch (err) {
      console.error(`usePersistentState: error setting “${key}”:`, err);
    }
  };

  return [stored, setValue];
}
