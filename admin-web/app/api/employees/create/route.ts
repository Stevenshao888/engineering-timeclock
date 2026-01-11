import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// PLACEHOLDERS FOR USER TO FILL
const SUPABASE_URL = "https://vjbbvsyoqauvbzyrpmrw.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqYmJ2c3lvcWF1dmJ6eXJwbXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4NjQwOCwiZXhwIjoyMDgxNTYyNDA4fQ.6vsb2SqDq5E4z5nr-Zb4NKdA48VZbCqtAAhTQrnX7RM";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, name, daily_wage, default_site_id, salary_type, monthly_wage } = body;

        // Initialize Supabase with the hardcoded variables
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name }
        });

        if (authError) throw authError;

        // 2. Update Profile
        // We try to update the auto-created profile. 
        // Note: The triggers should have created a profile with the user ID.
        if (authData.user) {
            // Upsert is safer in case of trigger delay/race-condition or if we want to ensure fields are set
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    full_name: name,
                    daily_wage: daily_wage || 0,
                    monthly_wage: monthly_wage || 0,
                    salary_type: salary_type || 'daily',
                    default_site_id: default_site_id,
                    role: 'employee',
                    // existing checks might require email, let's include if needed, but upsert merges
                });

            if (profileError) throw profileError;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
