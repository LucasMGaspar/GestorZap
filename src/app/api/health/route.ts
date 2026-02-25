import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        return NextResponse.json({
            status: 'env_missing',
            url_set: !!url,
            key_set: !!key,
        }, { status: 500 })
    }

    try {
        const supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            realtime: { params: { eventsPerSecond: -1 } },
        })
        const { data, error } = await supabase.from('usuarios').select('count').limit(1)

        return NextResponse.json({
            status: 'ok',
            url_prefix: url.slice(0, 30),
            key_prefix: key.slice(0, 20),
            usuarios_ok: !error,
            usuarios_error: error?.message ?? null,
        })
    } catch (e: any) {
        return NextResponse.json({ status: 'exception', message: e.message }, { status: 500 })
    }
}
