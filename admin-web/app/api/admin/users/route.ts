import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export async function DELETE(req: NextRequest) {
    try {
        const { user_id } = await req.json();

        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        // Delete from Supabase Auth
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Attempt to delete from profiles as well (if not handled by DB cascade)
        await supabaseAdmin.from('profiles').delete().eq('id', user_id);

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { user_id, email, password } = await req.json();

        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        const updates: any = {};
        if (email) updates.email = email;
        if (password) updates.password = password;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ message: 'No updates provided' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updates
        );

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'User updated successfully', user: data.user });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
