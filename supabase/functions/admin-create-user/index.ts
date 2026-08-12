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
    if (!caller?.active || caller.role !== 'Admin') throw new Error('Only active administrators can create accounts.');

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 8) throw new Error('Temporary passwords must contain at least 8 characters.');

    const metadata = {
      name: String(profile.name || ''), role: String(profile.role || 'Staff'), tsr: Boolean(profile.tsr),
      campus_id: String(profile.campus_id || ''), title: String(profile.title || ''),
      department: String(profile.department || ''), phone: String(profile.phone || ''),
      office: String(profile.office || ''), manager: String(profile.manager || ''), joined: String(profile.joined || '')
    };
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: metadata
    });
    if (createError) throw createError;

    const { data: savedProfile, error: profileError } = await adminClient.from('profiles').upsert({
      id: created.user.id, email, ...metadata, active: true, updated_at: new Date().toISOString()
    }).select().single();
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }
    return new Response(JSON.stringify({ profile: savedProfile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to create account.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
