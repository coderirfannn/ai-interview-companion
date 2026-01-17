import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Code, Database, Cloud, Zap, Gauge, Flame, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'sde' | 'data_engineer' | 'cloud_engineer';
type Difficulty = 'easy' | 'medium' | 'hard';

const roles = [
  {
    id: 'sde' as Role,
    label: 'Software Engineer',
    description: 'Data structures, algorithms, system design',
    icon: Code,
  },
  {
    id: 'data_engineer' as Role,
    label: 'Data Engineer',
    description: 'ETL, data pipelines, warehousing',
    icon: Database,
  },
  {
    id: 'cloud_engineer' as Role,
    label: 'Cloud Engineer',
    description: 'AWS, Azure, GCP, infrastructure',
    icon: Cloud,
  },
];

const difficulties = [
  {
    id: 'easy' as Difficulty,
    label: 'Easy',
    description: 'Fundamental concepts, entry-level questions',
    icon: Zap,
    color: 'text-green-500',
  },
  {
    id: 'medium' as Difficulty,
    label: 'Medium',
    description: 'Intermediate concepts, some complexity',
    icon: Gauge,
    color: 'text-yellow-500',
  },
  {
    id: 'hard' as Difficulty,
    label: 'Hard',
    description: 'Advanced topics, complex scenarios',
    icon: Flame,
    color: 'text-red-500',
  },
];

export default function InterviewSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartInterview = async () => {
    if (!selectedRole || !selectedDifficulty || !user) return;

    setIsLoading(true);
    try {
      // Create interview record
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .insert({
          user_id: user.id,
          role: selectedRole,
          difficulty: selectedDifficulty,
          status: 'in_progress',
        })
        .select()
        .single();

      if (interviewError) throw interviewError;

      // Generate questions using AI edge function
      const { data: questionsData, error: questionsError } = await supabase.functions.invoke(
        'generate-questions',
        {
          body: { 
            role: selectedRole, 
            difficulty: selectedDifficulty,
            interviewId: interview.id 
          },
        }
      );

       if (questionsError) {
         // Try to extract the JSON error returned by the function
         const ctx: any = (questionsError as any).context;
         let msg = questionsError.message;
         if (ctx?.body) {
           try {
             const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
             if (parsed?.error) msg = parsed.error;
           } catch {
             // ignore parse failures
           }
         }
         throw new Error(msg);
       }

       toast.success('Interview started!');
       navigate(`/interview/${interview.id}`);
     } catch (error) {
       console.error('Error starting interview:', error);
       toast.error(error instanceof Error ? error.message : 'Failed to start interview. Please try again.');
     } finally {
       setIsLoading(false);
     }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Start New Interview</h1>
          <p className="text-muted-foreground">
            Select your target role and difficulty level
          </p>
        </div>

        {/* Role Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Select Role</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <Card
                  key={role.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    selectedRole === role.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border/50 hover:border-border'
                  )}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <CardHeader className="text-center pb-2">
                    <div className={cn(
                      'mx-auto p-3 rounded-xl w-fit mb-2',
                      selectedRole === role.id ? 'bg-primary/10' : 'bg-muted'
                    )}>
                      <Icon className={cn(
                        'h-6 w-6',
                        selectedRole === role.id ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>
                    <CardTitle className="text-base">{role.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>{role.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Select Difficulty</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {difficulties.map((diff) => {
              const Icon = diff.icon;
              return (
                <Card
                  key={diff.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    selectedDifficulty === diff.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border/50 hover:border-border'
                  )}
                  onClick={() => setSelectedDifficulty(diff.id)}
                >
                  <CardHeader className="text-center pb-2">
                    <div className={cn(
                      'mx-auto p-3 rounded-xl w-fit mb-2',
                      selectedDifficulty === diff.id ? 'bg-primary/10' : 'bg-muted'
                    )}>
                      <Icon className={cn(
                        'h-6 w-6',
                        selectedDifficulty === diff.id ? 'text-primary' : diff.color
                      )} />
                    </div>
                    <CardTitle className="text-base">{diff.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>{diff.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            className="gap-2 px-8"
            disabled={!selectedRole || !selectedDifficulty || isLoading}
            onClick={handleStartInterview}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                Begin Interview
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
