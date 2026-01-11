import { createClient } from '@supabase/supabase-js';

// 請從你的 App 那邊 (src/services/supabase.ts) 複製原本的網址跟 Key 過來貼上
const supabaseUrl = 'https://vjbbvsyoqauvbzyrpmrw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqYmJ2c3lvcWF1dmJ6eXJwbXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODY0MDgsImV4cCI6MjA4MTU2MjQwOH0.vwtByQadCUGDAUbGKF2e7wlwRc3AmlKUPKyxbLNXNsY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);