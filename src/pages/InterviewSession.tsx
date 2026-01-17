import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { VoiceRecorder } from '@/components/interview/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Clock,
  Mic,
  Type,
  Send
} from 'lucide-react';

interface Question {
  id: string;
  question_number: number;
  question_text: string;
}

interface Answer {
  question_id: string;
  answer_text?: string;
  audio_url?: string;
  transcript?: string;
}

export default function InterviewSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [textAnswer, setTextAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerMode, setAnswerMode] = useState<'text' | 'voice'>('text');
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes per question

  useEffect(() => {
    if (id) {
      fetchQuestions();
    }
  }, [id]);

  useEffect(() => {
    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex]);

  // Reset timer when question changes
  useEffect(() => {
    setTimeLeft(180);
  }, [currentIndex]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('interview_id', id)
        .order('question_number', { ascending: true });

      if (error) throw error;

      setQuestions(data || []);
      
      // Load existing answers
      const questionIds = (data || []).map((q) => q.id);
      if (questionIds.length > 0) {
        const { data: answerData } = await supabase
          .from('interview_answers')
          .select('*')
          .in('question_id', questionIds);

        if (answerData) {
          const answerMap: Record<string, Answer> = {};
          answerData.forEach((a) => {
            answerMap[a.question_id] = a;
          });
          setAnswers(answerMap);
        }
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load interview questions');
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveTextAnswer = useCallback(async () => {
    if (!currentQuestion || !textAnswer.trim()) return;

    try {
      const existingAnswer = answers[currentQuestion.id];
      
      if (existingAnswer) {
        await supabase
          .from('interview_answers')
          .update({ answer_text: textAnswer })
          .eq('question_id', currentQuestion.id);
      } else {
        await supabase
          .from('interview_answers')
          .insert({
            question_id: currentQuestion.id,
            answer_text: textAnswer,
          });
      }

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { 
          ...prev[currentQuestion.id], 
          question_id: currentQuestion.id,
          answer_text: textAnswer 
        },
      }));
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  }, [currentQuestion, textAnswer, answers]);

  const handleVoiceRecordingComplete = async (audioUrl: string, transcript: string) => {
    if (!currentQuestion) return;

    try {
      const existingAnswer = answers[currentQuestion.id];
      
      if (existingAnswer) {
        await supabase
          .from('interview_answers')
          .update({ 
            audio_url: audioUrl, 
            transcript: transcript,
            answer_text: transcript 
          })
          .eq('question_id', currentQuestion.id);
      } else {
        await supabase
          .from('interview_answers')
          .insert({
            question_id: currentQuestion.id,
            audio_url: audioUrl,
            transcript: transcript,
            answer_text: transcript,
          });
      }

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { 
          question_id: currentQuestion.id,
          audio_url: audioUrl, 
          transcript: transcript,
          answer_text: transcript 
        },
      }));

      toast.success('Voice answer saved!');
    } catch (error) {
      console.error('Error saving voice answer:', error);
      toast.error('Failed to save voice answer');
    }
  };

  const goToNext = async () => {
    if (answerMode === 'text') {
      await saveTextAnswer();
    }
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setTextAnswer(answers[questions[currentIndex + 1]?.id]?.answer_text || '');
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setTextAnswer(answers[questions[currentIndex - 1]?.id]?.answer_text || '');
    }
  };

  const handleSubmitInterview = async () => {
    if (answerMode === 'text') {
      await saveTextAnswer();
    }

    setIsSubmitting(true);
    try {
      // Score answers using rule-based system (no AI)
      const { error: scoreError } = await supabase.functions.invoke('score-answer', {
        body: { interviewId: id },
      });

      if (scoreError) throw scoreError;

      toast.success('Interview completed! Calculating your scores...');
      navigate(`/interview/${id}/results`);
    } catch (error) {
      console.error('Error submitting interview:', error);
      toast.error('Failed to submit interview. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold">No questions found</h1>
          <p className="text-muted-foreground mt-2">Something went wrong. Please start a new interview.</p>
          <Button className="mt-4" onClick={() => navigate('/interview/new')}>
            Start New Interview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-4xl">
        {/* Progress Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${timeLeft <= 30 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className={`font-mono text-sm ${timeLeft <= 30 ? 'text-destructive' : ''}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline">Question {currentQuestion.question_number}</Badge>
            </div>
            <CardTitle className="text-xl leading-relaxed mt-4">
              {currentQuestion.question_text}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Answer Section */}
        <Card className="mb-6">
          <CardHeader>
            <Tabs value={answerMode} onValueChange={(v) => setAnswerMode(v as 'text' | 'voice')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="gap-2">
                  <Type className="h-4 w-4" />
                  Text Answer
                </TabsTrigger>
                <TabsTrigger value="voice" className="gap-2">
                  <Mic className="h-4 w-4" />
                  Voice Answer
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {answerMode === 'text' ? (
              <Textarea
                placeholder="Type your answer here..."
                className="min-h-[200px] resize-none"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
              />
            ) : (
              <VoiceRecorder 
                onRecordingComplete={handleVoiceRecordingComplete}
                existingTranscript={answers[currentQuestion.id]?.transcript}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentIndex === questions.length - 1 ? (
              <Button 
                onClick={handleSubmitInterview}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Interview
              </Button>
            ) : (
              <Button onClick={goToNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
