import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { questions, resources, mode = "merge" } = await req.json();

    let questionsResult = { inserted: 0, updated: 0, deleted: 0 };
    let resourcesResult = { inserted: 0, updated: 0, deleted: 0 };

    // Sync questions if provided
    if (questions && Array.isArray(questions)) {
      if (mode === "replace") {
        // Delete all existing questions
        const { error: deleteError } = await supabase
          .from("question_bank")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
        
        if (deleteError) throw deleteError;
        questionsResult.deleted = -1; // Indicates all deleted
      }

      for (const q of questions) {
        // Check if question already exists by matching text, role, and difficulty
        const { data: existing } = await supabase
          .from("question_bank")
          .select("id")
          .eq("question_text", q.question_text)
          .eq("role", q.role)
          .eq("difficulty", q.difficulty)
          .single();

        if (existing) {
          // Update existing question
          const { error } = await supabase
            .from("question_bank")
            .update({
              expected_keywords: q.expected_keywords,
              ideal_answer_length: q.ideal_answer_length,
              scoring_rubric: q.scoring_rubric || null,
            })
            .eq("id", existing.id);
          
          if (!error) questionsResult.updated++;
        } else {
          // Insert new question
          const { error } = await supabase
            .from("question_bank")
            .insert({
              role: q.role,
              difficulty: q.difficulty,
              question_text: q.question_text,
              expected_keywords: q.expected_keywords,
              ideal_answer_length: q.ideal_answer_length,
              scoring_rubric: q.scoring_rubric || null,
            });
          
          if (!error) questionsResult.inserted++;
        }
      }
    }

    // Sync resources if provided
    if (resources && Array.isArray(resources)) {
      if (mode === "replace") {
        const { error: deleteError } = await supabase
          .from("learning_resources")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        
        if (deleteError) throw deleteError;
        resourcesResult.deleted = -1;
      }

      for (const r of resources) {
        // Check if resource already exists by matching title, role, and difficulty
        const { data: existing } = await supabase
          .from("learning_resources")
          .select("id")
          .eq("title", r.title)
          .eq("role", r.role)
          .eq("difficulty", r.difficulty)
          .single();

        if (existing) {
          const { error } = await supabase
            .from("learning_resources")
            .update({
              description: r.description,
              resource_type: r.resource_type,
              url: r.url,
            })
            .eq("id", existing.id);
          
          if (!error) resourcesResult.updated++;
        } else {
          const { error } = await supabase
            .from("learning_resources")
            .insert({
              role: r.role,
              difficulty: r.difficulty,
              title: r.title,
              description: r.description,
              resource_type: r.resource_type,
              url: r.url,
            });
          
          if (!error) resourcesResult.inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        questions: questionsResult,
        resources: resourcesResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
