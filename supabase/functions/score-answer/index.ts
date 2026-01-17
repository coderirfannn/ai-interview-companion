import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rule-based scoring system (no AI)
function scoreAnswer(
  answerText: string,
  expectedKeywords: string[],
  idealLength: number
): {
  score: number;
  technical_accuracy: number;
  clarity: number;
  structure: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
} {
  const answer = answerText.toLowerCase().trim();
  const words = answer.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // 1. Keyword matching score (40% of total)
  const matchedKeywords = expectedKeywords.filter(kw => 
    answer.includes(kw.toLowerCase())
  );
  const keywordRatio = expectedKeywords.length > 0 
    ? matchedKeywords.length / expectedKeywords.length 
    : 0;
  const keywordScore = keywordRatio * 10;

  // 2. Length score (20% of total)
  // Ideal is around the target length, penalize too short or too long
  let lengthScore = 10;
  if (wordCount < idealLength * 0.5) {
    lengthScore = (wordCount / (idealLength * 0.5)) * 6; // Max 6 if too short
  } else if (wordCount > idealLength * 2) {
    lengthScore = 7; // Slightly penalize for being too verbose
  } else if (wordCount >= idealLength * 0.8 && wordCount <= idealLength * 1.5) {
    lengthScore = 10; // Perfect range
  } else {
    lengthScore = 8;
  }

  // 3. Structure score (20% of total)
  // Check for: multiple sentences, bullet points/lists, proper structure
  let structureScore = 5;
  
  // Multiple sentences
  if (sentences.length >= 3) structureScore += 2;
  else if (sentences.length >= 2) structureScore += 1;
  
  // Contains structural elements
  if (answer.includes('-') || answer.includes('•') || answer.includes('1.')) {
    structureScore += 2;
  }
  
  // Contains transition words
  const transitionWords = ['first', 'second', 'then', 'next', 'finally', 'however', 'therefore', 'because', 'for example'];
  const hasTransitions = transitionWords.some(tw => answer.includes(tw));
  if (hasTransitions) structureScore += 1;

  structureScore = Math.min(10, structureScore);

  // 4. Clarity score (20% of total)
  // Based on sentence length (not too long), no excessive repetition
  let clarityScore = 7;
  
  // Average sentence length (ideal: 15-25 words)
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  if (avgSentenceLength >= 10 && avgSentenceLength <= 30) {
    clarityScore += 2;
  } else if (avgSentenceLength < 10) {
    clarityScore += 1; // Too choppy
  }
  
  // Check for excessive filler words
  const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually'];
  const fillerCount = fillerWords.reduce((count, fw) => {
    return count + (answer.split(fw).length - 1);
  }, 0);
  
  if (fillerCount === 0) clarityScore += 1;
  else if (fillerCount > 5) clarityScore -= 2;

  clarityScore = Math.max(0, Math.min(10, clarityScore));

  // Calculate weighted total
  const totalScore = (
    (keywordScore * 0.4) + 
    (lengthScore * 0.2) + 
    (structureScore * 0.2) + 
    (clarityScore * 0.2)
  );

  // Generate feedback
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  // Keyword feedback
  if (keywordRatio >= 0.7) {
    strengths.push('Covered most of the key technical concepts');
  } else if (keywordRatio >= 0.4) {
    weaknesses.push('Some important concepts were missing');
    const missingKeywords = expectedKeywords.filter(kw => !answer.includes(kw.toLowerCase()));
    if (missingKeywords.length > 0 && missingKeywords.length <= 3) {
      suggestions.push(`Consider discussing: ${missingKeywords.slice(0, 3).join(', ')}`);
    }
  } else {
    weaknesses.push('Many key concepts were not addressed');
    suggestions.push('Review the fundamental concepts related to this topic');
  }

  // Length feedback
  if (wordCount < idealLength * 0.5) {
    weaknesses.push('Answer was too brief');
    suggestions.push('Provide more detail and examples in your response');
  } else if (wordCount >= idealLength * 0.8 && wordCount <= idealLength * 1.5) {
    strengths.push('Good answer length with appropriate detail');
  } else if (wordCount > idealLength * 2) {
    weaknesses.push('Answer was longer than necessary');
    suggestions.push('Try to be more concise while covering key points');
  }

  // Structure feedback
  if (structureScore >= 8) {
    strengths.push('Well-structured response with clear organization');
  } else if (structureScore < 6) {
    weaknesses.push('Answer could be better organized');
    suggestions.push('Use a structured approach: introduce the concept, explain details, give examples');
  }

  // Clarity feedback
  if (clarityScore >= 8) {
    strengths.push('Clear and easy to understand explanation');
  } else if (fillerCount > 3) {
    weaknesses.push('Too many filler words detected');
    suggestions.push('Practice speaking more directly without filler words');
  }

  return {
    score: Math.round(totalScore * 10) / 10,
    technical_accuracy: Math.round(keywordScore * 10) / 10,
    clarity: Math.round(clarityScore * 10) / 10,
    structure: Math.round(structureScore * 10) / 10,
    strengths,
    weaknesses,
    suggestions
  };
}

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

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { interviewId } = await req.json();

    // Fetch interview with questions and answers
    const { data: interview, error: interviewError } = await serviceClient
      .from('interviews')
      .select(`
        *,
        interview_questions (
          *,
          interview_answers (*)
        )
      `)
      .eq('id', interviewId)
      .single();

    if (interviewError) throw interviewError;

    const questions = interview.interview_questions || [];
    let totalScore = 0;
    let answeredCount = 0;

    for (const question of questions) {
      const answer = question.interview_answers?.[0];
      if (!answer) continue;

      const answerText = answer.answer_text || answer.transcript || '';
      if (!answerText.trim()) continue;

      // Find matching question in question_bank by text
      const { data: bankQuestion } = await serviceClient
        .from('question_bank')
        .select('*')
        .eq('question_text', question.question_text)
        .maybeSingle();

      const expectedKeywords = bankQuestion?.expected_keywords || [];
      const idealLength = bankQuestion?.ideal_answer_length || 100;

      // Score the answer
      const feedback = scoreAnswer(answerText, expectedKeywords, idealLength);

      // Update the answer record
      await serviceClient
        .from('interview_answers')
        .update({
          ai_score: feedback.score,
          ai_feedback: feedback
        })
        .eq('id', answer.id);

      totalScore += feedback.score;
      answeredCount++;
    }

    // Calculate overall score
    const overallScore = answeredCount > 0 ? totalScore / answeredCount : 0;

    // Update interview
    await serviceClient
      .from('interviews')
      .update({
        overall_score: overallScore,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', interviewId);

    // Update user progress
    const { data: progress } = await serviceClient
      .from('user_progress')
      .select('*')
      .eq('user_id', interview.user_id)
      .maybeSingle();

    if (progress) {
      const newTotalScore = (progress.total_score || 0) + overallScore;
      await serviceClient
        .from('user_progress')
        .update({ total_score: newTotalScore })
        .eq('user_id', interview.user_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        overallScore,
        answeredCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in score-answer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
