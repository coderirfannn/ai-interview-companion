-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'candidate');

-- Create enum for interview difficulty
CREATE TYPE public.interview_difficulty AS ENUM ('easy', 'medium', 'hard');

-- Create enum for interview role
CREATE TYPE public.interview_role AS ENUM ('sde', 'data_engineer', 'cloud_engineer');

-- Create enum for interview status
CREATE TYPE public.interview_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role interview_role NOT NULL,
  difficulty interview_difficulty NOT NULL,
  status interview_status NOT NULL DEFAULT 'in_progress',
  overall_score DECIMAL(4,2),
  confidence_score DECIMAL(4,2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interview_questions table
CREATE TABLE public.interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interview_answers table
CREATE TABLE public.interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.interview_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT,
  audio_url TEXT,
  transcript TEXT,
  words_per_minute DECIMAL(5,2),
  filler_word_count INTEGER DEFAULT 0,
  pause_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(4,2),
  ai_score DECIMAL(4,2),
  ai_feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Interviews policies
CREATE POLICY "Users can view own interviews"
ON public.interviews FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interviews"
ON public.interviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interviews"
ON public.interviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all interviews"
ON public.interviews FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Interview questions policies
CREATE POLICY "Users can view questions for own interviews"
ON public.interview_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = interview_questions.interview_id
    AND interviews.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert questions for own interviews"
ON public.interview_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interviews
    WHERE interviews.id = interview_questions.interview_id
    AND interviews.user_id = auth.uid()
  )
);

-- Interview answers policies
CREATE POLICY "Users can view answers for own questions"
ON public.interview_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.interview_questions q
    JOIN public.interviews i ON i.id = q.interview_id
    WHERE q.id = interview_answers.question_id
    AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert answers for own questions"
ON public.interview_answers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.interview_questions q
    JOIN public.interviews i ON i.id = q.interview_id
    WHERE q.id = interview_answers.question_id
    AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update answers for own questions"
ON public.interview_answers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.interview_questions q
    JOIN public.interviews i ON i.id = q.interview_id
    WHERE q.id = interview_answers.question_id
    AND i.user_id = auth.uid()
  )
);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'candidate');
  
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_interview_answers_updated_at
  BEFORE UPDATE ON public.interview_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();