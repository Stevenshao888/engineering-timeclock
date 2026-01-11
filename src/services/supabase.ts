import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

// Placeholders as requested
const supabaseUrl = 'https://vjbbvsyoqauvbzyrpmrw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqYmJ2c3lvcWF1dmJ6eXJwbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODY0MDgsImV4cCI6MjA4MTU2MjQwOH0.vwtByQadCUGDAUbGKF2e7wlwRc3AmlKUPKyxbLNXNsY';

// Custom storage adapter that works in both Web and Native
const ExpoStorage = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') {
            return null;
        }
        return AsyncStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        AsyncStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return;
        AsyncStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorage,
        autoRefreshToken: true, // Keep standard behavior
        persistSession: true, // Keep standard behavior
        detectSessionInUrl: false,
    },
});

AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
