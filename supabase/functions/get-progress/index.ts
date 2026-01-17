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

    // Get user progress
    const { data: progress, error: progressError } = await serviceClient
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (progressError) throw progressError;

    // Get total questions and resources counts
    const { count: totalQuestions } = await serviceClient
      .from('question_bank')
      .select('*', { count: 'exact', head: true });

    const { count: totalResources } = await serviceClient
      .from('learning_resources')
      .select('*', { count: 'exact', head: true });

    // Get completed interviews
    const { data: interviews, error: interviewsError } = await serviceClient
      .from('interviews')
      .select('id, overall_score, role, difficulty, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (interviewsError) throw interviewsError;

    const usedQuestionIds = progress?.used_question_ids || [];
    const usedResourceIds = progress?.used_resource_ids || [];
    const averageScore = progress?.total_interviews && progress?.total_score 
      ? progress.total_score / progress.total_interviews 
      : 0;

    return new Response(
      JSON.stringify({ 
        success: true, 
        progress: {
          totalInterviews: progress?.total_interviews || 0,
          totalScore: progress?.total_score || 0,
          averageScore: Math.round(averageScore * 10) / 10,
          questionsUsed: usedQuestionIds.length,
          totalQuestions: totalQuestions || 0,
          resourcesUsed: usedResourceIds.length,
          totalResources: totalResources || 0,
          recentInterviews: interviews || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-progress:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
