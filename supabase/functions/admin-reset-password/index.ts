import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Authentication is required.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error('Your session is invalid or expired.');
    const { data: caller } = await adminClient.from('profiles').select('role,active').eq('id', user.id).single();
    if (!caller?.active || caller.role !== 'Admin') throw new Error('Only active administrators can reset passwords.');

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Temporary passwords must contain at least 8 characters.');

    const { data: profile, error: profileError } = await adminClient.from('profiles').select('id,active').eq('email', email).single();
    if (profileError || !profile?.id) throw new Error('That account could not be found.');
    const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.id, { password });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to reset the password.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
