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
    const { role, difficulty, interviewId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const roleLabels: Record<string, string> = {
      sde: 'Software Development Engineer',
      data_engineer: 'Data Engineer',
      cloud_engineer: 'Cloud Engineer',
    };

    const difficultyDescriptions: Record<string, string> = {
      easy: 'entry-level, focusing on fundamental concepts and basic problem-solving',
      medium: 'intermediate, including some complex scenarios and deeper technical knowledge',
      hard: 'advanced, covering complex system design, optimization, and edge cases',
    };

    const systemPrompt = `You are a technical interviewer for a ${roleLabels[role]} position. 
Generate exactly 5 technical interview questions for a ${difficulty} level interview.
The questions should be ${difficultyDescriptions[difficulty]}.

For Software Development Engineer: Focus on data structures, algorithms, coding problems, and system design.
For Data Engineer: Focus on ETL pipelines, data warehousing, SQL, big data technologies, and data modeling.
For Cloud Engineer: Focus on cloud architecture, containerization, infrastructure as code, networking, and security.

Return the questions as a JSON array with the format:
[
  {"number": 1, "question": "Your question here"},
  {"number": 2, "question": "Your question here"},
  ...
]

Only return the JSON array, no additional text.`;

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
          { role: 'user', content: `Generate 5 ${difficulty} level interview questions for a ${roleLabels[role]} position.` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let questionsText = data.choices[0].message.content;
    
    // Clean up the response - remove markdown code blocks if present
    questionsText = questionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('AI response:', questionsText);
    
    const questions = JSON.parse(questionsText);

    // Insert questions into database
    const questionsToInsert = questions.map((q: { number: number; question: string }) => ({
      interview_id: interviewId,
      question_number: q.number,
      question_text: q.question,
    }));

    const { error: insertError } = await supabase
      .from('interview_questions')
      .insert(questionsToInsert);

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, questions: questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-questions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
