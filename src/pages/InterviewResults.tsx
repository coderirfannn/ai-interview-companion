import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Lightbulb,
  Play,
  Home,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feedback {
  score: number;
  technical_accuracy: number;
  clarity: number;
  structure: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface Answer {
  id: string;
  answer_text: string | null;
  transcript: string | null;
  ai_score: number | null;
  ai_feedback: Feedback | null;
  confidence_score: number | null;
  words_per_minute: number | null;
  filler_word_count: number | null;
}

interface Question {
  id: string;
  question_number: number;
  question_text: string;
  interview_answers: Answer[];
}

interface Interview {
  id: string;
  role: string;
  difficulty: string;
  overall_score: number | null;
  confidence_score: number | null;
  started_at: string;
  completed_at: string | null;
  interview_questions: Question[];
}

export default function InterviewResults() {
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchResults();
    }
  }, [id]);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          *,
          interview_questions (
            *,
            interview_answers (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Sort questions by number and cast properly
      if (data?.interview_questions) {
        data.interview_questions.sort((a: any, b: any) => a.question_number - b.question_number);
      }
      
      setInterview(data as unknown as Interview);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return 'Excellent';
    if (score >= 8) return 'Very Good';
    if (score >= 7) return 'Good';
    if (score >= 6) return 'Satisfactory';
    if (score >= 5) return 'Needs Improvement';
    return 'Poor';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      sde: 'Software Engineer',
      data_engineer: 'Data Engineer',
      cloud_engineer: 'Cloud Engineer',
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-8 max-w-4xl">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-8 text-center">
          <h1 className="text-2xl font-bold">Results not found</h1>
          <Link to="/dashboard">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </main>
      </div>
    );
  }

  const overallScore = interview.overall_score || 0;
  const confidenceScore = interview.confidence_score || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline">{getRoleLabel(interview.role)}</Badge>
            <Badge variant="outline" className="capitalize">{interview.difficulty}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Results</h1>
          <p className="text-muted-foreground mt-1">
            Here's how you performed in this practice session
          </p>
        </div>

        {/* Score Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Overall Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-4xl font-bold", getScoreColor(overallScore))}>
                {overallScore.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {getScoreLabel(overallScore)}
              </p>
              <Progress 
                value={overallScore * 10} 
                className="mt-3 h-2" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Confidence Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-4xl font-bold", getScoreColor(confidenceScore / 10))}>
                {confidenceScore.toFixed(0)}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Speaking confidence
              </p>
              <Progress 
                value={confidenceScore} 
                className="mt-3 h-2" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Questions Answered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {interview.interview_questions.filter(q => q.interview_answers.length > 0).length}
                <span className="text-lg text-muted-foreground">/{interview.interview_questions.length}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Completion rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Question Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Question-by-Question Breakdown</CardTitle>
            <CardDescription>
              Detailed feedback for each question
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {interview.interview_questions.map((question) => {
                const answer = question.interview_answers[0];
                const feedback = answer?.ai_feedback as Feedback | null;
                const score = answer?.ai_score || 0;

                return (
                  <AccordionItem key={question.id} value={question.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">Q{question.question_number}</Badge>
                          <span className="text-left line-clamp-1">
                            {question.question_text.slice(0, 60)}...
                          </span>
                        </div>
                        {answer && (
                          <Badge 
                            variant="outline" 
                            className={cn("ml-auto", getScoreColor(score))}
                          >
                            {score.toFixed(1)}/10
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {/* Question */}
                        <div>
                          <h4 className="font-medium mb-2">Question</h4>
                          <p className="text-muted-foreground">{question.question_text}</p>
                        </div>

                        {/* Answer */}
                        {answer && (
                          <div>
                            <h4 className="font-medium mb-2">Your Answer</h4>
                            <p className="text-muted-foreground text-sm bg-muted/50 p-3 rounded-lg">
                              {answer.answer_text || answer.transcript || 'No answer provided'}
                            </p>
                          </div>
                        )}

                        {/* Feedback */}
                        {feedback && (
                          <>
                            {/* Score Breakdown */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-lg font-semibold">{feedback.technical_accuracy}/10</div>
                                <div className="text-xs text-muted-foreground">Technical</div>
                              </div>
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-lg font-semibold">{feedback.clarity}/10</div>
                                <div className="text-xs text-muted-foreground">Clarity</div>
                              </div>
                              <div className="text-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-lg font-semibold">{feedback.structure}/10</div>
                                <div className="text-xs text-muted-foreground">Structure</div>
                              </div>
                            </div>

                            {/* Strengths */}
                            {feedback.strengths?.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  Strengths
                                </h4>
                                <ul className="space-y-1">
                                  {feedback.strengths.map((s, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <span className="text-green-500">•</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Weaknesses */}
                            {feedback.weaknesses?.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  Areas for Improvement
                                </h4>
                                <ul className="space-y-1">
                                  {feedback.weaknesses.map((w, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <span className="text-yellow-500">•</span>
                                      {w}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Suggestions */}
                            {feedback.suggestions?.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4 text-blue-500" />
                                  Suggestions
                                </h4>
                                <ul className="space-y-1">
                                  {feedback.suggestions.map((s, i) => (
                                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <span className="text-blue-500">•</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}

                        {!answer && (
                          <p className="text-muted-foreground italic">No answer provided for this question</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Link to="/interview/new">
            <Button size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Try Another Interview
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="gap-2">
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Link to="/analytics">
            <Button variant="outline" size="lg" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
