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
    const { interviewId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch interview with questions and answers
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*, interview_questions(*, interview_answers(*))')
      .eq('id', interviewId)
      .single();

    if (interviewError) throw interviewError;

    const questions = interview.interview_questions || [];
    let totalScore = 0;
    let totalConfidence = 0;
    let answeredCount = 0;

    // Analyze each answer
    for (const question of questions) {
      const answer = question.interview_answers?.[0];
      if (!answer || (!answer.answer_text && !answer.transcript)) continue;

      const answerText = answer.answer_text || answer.transcript || '';
      
      const systemPrompt = `You are an expert technical interviewer providing feedback on interview answers.
Analyze the following answer and provide structured feedback.

Return a JSON object with this exact format:
{
  "score": <number 0-10>,
  "technical_accuracy": <number 0-10>,
  "clarity": <number 0-10>,
  "structure": <number 0-10>,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Be constructive but honest. Only return the JSON, no additional text.`;

      const userPrompt = `Question: ${question.question_text}

Answer: ${answerText}

Analyze this technical interview answer.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        console.error('AI gateway error for question:', question.id);
        continue;
      }

      const data = await response.json();
      let feedbackText = data.choices[0].message.content;
      feedbackText = feedbackText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let feedback;
      try {
        feedback = JSON.parse(feedbackText);
      } catch (e) {
        console.error('Failed to parse feedback:', feedbackText);
        continue;
      }

      // Calculate voice analytics if there was a transcript
      let confidenceScore = 70; // Default confidence
      let wordsPerMinute = 0;
      let fillerWordCount = 0;
      
      if (answer.transcript) {
        const words = answer.transcript.split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        
        // Estimate speaking time (assuming ~150 WPM is normal)
        wordsPerMinute = wordCount * 2; // Rough estimate for a 30-second answer
        
        // Count filler words
        const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'so', 'well'];
        fillerWordCount = words.filter((w: string) => 
          fillerWords.includes(w.toLowerCase().replace(/[.,!?]/g, ''))
        ).length;

        // Calculate confidence score based on:
        // - Speaking rate (optimal: 120-150 WPM)
        // - Filler word ratio (lower is better)
        const rateScore = Math.max(0, 100 - Math.abs(wordsPerMinute - 135) * 0.5);
        const fillerRatio = fillerWordCount / Math.max(wordCount, 1);
        const fillerScore = Math.max(0, 100 - fillerRatio * 500);
        
        confidenceScore = Math.round((rateScore * 0.4 + fillerScore * 0.3 + feedback.clarity * 10 * 0.3));
      }

      // Update the answer with feedback
      await supabase
        .from('interview_answers')
        .update({
          ai_score: feedback.score,
          ai_feedback: feedback,
          confidence_score: confidenceScore,
          words_per_minute: wordsPerMinute,
          filler_word_count: fillerWordCount,
        })
        .eq('id', answer.id);

      totalScore += feedback.score;
      totalConfidence += confidenceScore;
      answeredCount++;
    }

    // Calculate overall scores
    const overallScore = answeredCount > 0 ? totalScore / answeredCount : 0;
    const overallConfidence = answeredCount > 0 ? totalConfidence / answeredCount : 0;

    // Update interview with overall scores
    await supabase
      .from('interviews')
      .update({
        overall_score: overallScore,
        confidence_score: overallConfidence,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', interviewId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        overallScore, 
        overallConfidence,
        answersAnalyzed: answeredCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-answers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
