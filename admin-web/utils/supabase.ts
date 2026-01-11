import { createClient } from '@supabase/supabase-js';

// Placeholders - replace with environmental variables or real keys
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vjbbvsyoqauvbzyrpmrw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqYmJ2c3lvcWF1dmJ6eXJwbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODY0MDgsImV4cCI6MjA4MTU2MjQwOH0.vwtByQadCUGDAUbGKF2e7wlwRc3AmlKUPKyxbLNXNsY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
