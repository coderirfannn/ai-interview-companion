-- Create question_bank table to store seeded questions
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role interview_role NOT NULL,
  difficulty interview_difficulty NOT NULL,
  question_text text NOT NULL,
  expected_keywords text[] NOT NULL DEFAULT '{}',
  ideal_answer_length integer NOT NULL DEFAULT 100,
  scoring_rubric jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create learning_resources table
CREATE TABLE public.learning_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role interview_role NOT NULL,
  difficulty interview_difficulty NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  url text,
  resource_type text NOT NULL DEFAULT 'article',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_progress table to track used questions/resources
CREATE TABLE public.user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_question_ids uuid[] NOT NULL DEFAULT '{}',
  used_resource_ids uuid[] NOT NULL DEFAULT '{}',
  total_interviews integer NOT NULL DEFAULT 0,
  total_score numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- question_bank: read-only for authenticated users
CREATE POLICY "Authenticated users can read questions"
  ON public.question_bank FOR SELECT
  TO authenticated
  USING (true);

-- learning_resources: read-only for authenticated users
CREATE POLICY "Authenticated users can read resources"
  ON public.learning_resources FOR SELECT
  TO authenticated
  USING (true);

-- user_progress: users manage their own progress
CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();