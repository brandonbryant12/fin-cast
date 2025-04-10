import { useState } from 'react';

// Define known persistent keys to handle specific validation if needed
// (Example: Ensuring playback rate is valid)
// You might want to centralize these keys elsewhere too.
const LOCAL_STORAGE_RATE_KEY = 'fin_cast_audio_rate';
// This import might be needed if PLAYBACK_RATES isn't globally accessible
// or if we pass validation logic into the hook later.
// import { PLAYBACK_RATES } from '@/contexts/audio-player-context';

// Basic validation function type (optional enhancement)
type Validator<T> = (value: unknown) => value is T;

/**
 * A hook to manage state that persists in localStorage.
 * @param key The localStorage key.
 * @param initialValue The initial value if nothing is stored.
 * @param validator Optional function to validate the stored value.
 * @returns A stateful value, and a function to update it.
 */
export function usePersistentState<T>(
    key: string,
    initialValue: T,
    // validator?: Validator<T> // Example of adding validator
): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue; // Return initial value during SSR
        }
        try {
            const item = window.localStorage.getItem(key);
            const parsed = item ? JSON.parse(item) : initialValue;

            // --- Specific Validation Example (can be made generic with validator) ---
            // This validation logic might ideally live closer to where PLAYBACK_RATES
            // is defined, or passed into the hook.
            if (key === LOCAL_STORAGE_RATE_KEY) {
                 // Need PLAYBACK_RATES here or a way to validate the rate.
                 // For now, let's assume the context file handles validation on read.
                 // If we enhance this hook later, validation logic goes here.
                 // const isValidRate = (r: unknown): r is number =>
                 //     typeof r === 'number' && PLAYBACK_RATES.includes(r as any);
                 // return isValidRate(parsed) ? parsed : initialValue;
                 return parsed; // Temporarily skip validation here, context does it
            }
            // --- End Specific Validation Example ---

            // Add generic validator check if implemented
            // if (validator && !validator(parsed)) {
            //     console.warn(`Stored value for key “${key}” failed validation.`);
            //     return initialValue;
            // }

            return parsed;
        } catch (error) {
            console.error(`Error reading localStorage key “${key}”:`, error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
         if (typeof window === 'undefined') {
            console.warn(`Attempted to set localStorage key “${key}” during SSR.`);
            return; // Don't try to set localStorage during SSR
        }
        try {
            // Allow value to be a function so we have the same API as useState
            const valueToStore =
                value instanceof Function ? value(storedValue) : value;
            // Save state
            setStoredValue(valueToStore);
            // Save to localStorage
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            // A more advanced implementation would handle the error case
            console.error(`Error setting localStorage key “${key}”:`, error);
        }
    };

    return [storedValue, setValue];
} 