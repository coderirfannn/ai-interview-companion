import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = userData.user.id;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const role = url.searchParams.get('role') || 'sde';
    const difficulty = url.searchParams.get('difficulty');
    const limit = parseInt(url.searchParams.get('limit') || '5');

    // Get user progress
    let { data: progress } = await serviceClient
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      const { data: newProgress } = await serviceClient
        .from('user_progress')
        .insert({ user_id: userId, used_question_ids: [], used_resource_ids: [] })
        .select()
        .single();
      progress = newProgress;
    }

    const usedResourceIds: string[] = progress?.used_resource_ids || [];

    // Build query for resources
    let query = serviceClient
      .from('learning_resources')
      .select('*')
      .eq('role', role);

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    const { data: allResources, error: resourcesError } = await query;
    if (resourcesError) throw resourcesError;

    // Filter out used resources
    let availableResources = allResources?.filter(r => !usedResourceIds.includes(r.id)) || [];

    // If all used, reset
    if (availableResources.length < limit) {
      const usedForRole = allResources?.map(r => r.id) || [];
      const newUsedIds = usedResourceIds.filter(id => !usedForRole.includes(id));
      
      await serviceClient
        .from('user_progress')
        .update({ used_resource_ids: newUsedIds })
        .eq('user_id', userId);

      availableResources = allResources || [];
    }

    // Randomly select resources
    const shuffled = availableResources.sort(() => Math.random() - 0.5);
    const selectedResources = shuffled.slice(0, limit);

    // Update user progress
    const newUsedIds = [...usedResourceIds, ...selectedResources.map(r => r.id)];
    await serviceClient
      .from('user_progress')
      .update({ used_resource_ids: newUsedIds })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resources: selectedResources
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-resources:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
