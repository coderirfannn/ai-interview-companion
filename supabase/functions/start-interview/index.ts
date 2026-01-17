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

    // Create client with user's token for auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.user.id;

    // Create service client for admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { role, difficulty, interviewId } = await req.json();

    // Get or create user progress
    let { data: progress } = await serviceClient
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      const { data: newProgress, error: progressError } = await serviceClient
        .from('user_progress')
        .insert({ user_id: userId, used_question_ids: [], used_resource_ids: [] })
        .select()
        .single();
      
      if (progressError) throw progressError;
      progress = newProgress;
    }

    const usedQuestionIds: string[] = progress.used_question_ids || [];

    // Fetch available questions (not used by this user)
    const { data: allQuestions, error: questionsError } = await serviceClient
      .from('question_bank')
      .select('*')
      .eq('role', role)
      .eq('difficulty', difficulty);

    if (questionsError) throw questionsError;

    // Filter out already used questions
    let availableQuestions = allQuestions?.filter(q => !usedQuestionIds.includes(q.id)) || [];

    // If all questions used, reset and use all
    if (availableQuestions.length < 5) {
      // Reset used questions for this role/difficulty
      const usedForRoleDifficulty = allQuestions?.map(q => q.id) || [];
      const newUsedIds = usedQuestionIds.filter(id => !usedForRoleDifficulty.includes(id));
      
      await serviceClient
        .from('user_progress')
        .update({ used_question_ids: newUsedIds })
        .eq('user_id', userId);

      availableQuestions = allQuestions || [];
    }

    // Randomly select 5 questions
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, 5);

    if (selectedQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions available for this role and difficulty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert interview questions
    const questionsToInsert = selectedQuestions.map((q, index) => ({
      interview_id: interviewId,
      question_number: index + 1,
      question_text: q.question_text,
    }));

    const { error: insertError } = await serviceClient
      .from('interview_questions')
      .insert(questionsToInsert);

    if (insertError) throw insertError;

    // Update user progress with used question IDs
    const newUsedIds = [...usedQuestionIds, ...selectedQuestions.map(q => q.id)];
    await serviceClient
      .from('user_progress')
      .update({ 
        used_question_ids: newUsedIds,
        total_interviews: (progress.total_interviews || 0) + 1
      })
      .eq('user_id', userId);

    // Store question bank IDs for scoring later (we'll link them in metadata)
    // For now, we embed keywords in the question record via a separate table or JSON
    // We'll handle scoring by re-fetching from question_bank based on question_text match

    return new Response(
      JSON.stringify({ 
        success: true, 
        questions: selectedQuestions.map((q, i) => ({
          number: i + 1,
          question: q.question_text,
          questionBankId: q.id
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in start-interview:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
