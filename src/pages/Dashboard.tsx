import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Play, 
  TrendingUp, 
  Target, 
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Interview {
  id: string;
  role: string;
  difficulty: string;
  status: string;
  overall_score: number | null;
  confidence_score: number | null;
  started_at: string;
  completed_at: string | null;
}

interface Stats {
  totalInterviews: number;
  averageScore: number;
  averageConfidence: number;
  completedInterviews: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalInterviews: 0,
    averageScore: 0,
    averageConfidence: 0,
    completedInterviews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const { data: interviewData, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('user_id', user?.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const typedInterviews = (interviewData || []) as Interview[];
      setInterviews(typedInterviews);

      // Calculate stats
      const completed = typedInterviews.filter((i) => i.status === 'completed');
      const avgScore = completed.length > 0
        ? completed.reduce((sum, i) => sum + (i.overall_score || 0), 0) / completed.length
        : 0;
      const avgConfidence = completed.length > 0
        ? completed.reduce((sum, i) => sum + (i.confidence_score || 0), 0) / completed.length
        : 0;

      setStats({
        totalInterviews: typedInterviews.length,
        averageScore: avgScore,
        averageConfidence: avgConfidence,
        completedInterviews: completed.length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      sde: 'Software Engineer',
      data_engineer: 'Data Engineer',
      cloud_engineer: 'Cloud Engineer',
    };
    return labels[role] || role;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/10 text-green-500',
      medium: 'bg-yellow-500/10 text-yellow-500',
      hard: 'bg-red-500/10 text-red-500',
    };
    return colors[difficulty] || '';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-500',
      in_progress: 'bg-blue-500/10 text-blue-500',
      abandoned: 'bg-muted text-muted-foreground',
    };
    return colors[status] || '';
  };

  // Prepare chart data from completed interviews
  const chartData = interviews
    .filter((i) => i.status === 'completed' && i.confidence_score)
    .slice(0, 7)
    .reverse()
    .map((i) => ({
      date: format(new Date(i.started_at), 'MMM d'),
      confidence: i.confidence_score || 0,
      score: i.overall_score || 0,
    }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Ready to ace your next interview?
            </p>
          </div>
          <Link to="/interview/new">
            <Button size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Start New Interview
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Interviews
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalInterviews}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedInterviews}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average Score
                  </CardTitle>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg. Confidence
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageConfidence > 0 ? `${stats.averageConfidence.toFixed(0)}%` : '—'}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Confidence Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence Trend</CardTitle>
              <CardDescription>Your confidence score over recent interviews</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Complete some interviews to see your progress
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Interviews */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Interviews</CardTitle>
              <CardDescription>Your latest practice sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : interviews.length > 0 ? (
                <div className="space-y-3">
                  {interviews.slice(0, 5).map((interview) => (
                    <Link
                      key={interview.id}
                      to={interview.status === 'completed' 
                        ? `/interview/${interview.id}/results` 
                        : `/interview/${interview.id}`
                      }
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getRoleLabel(interview.role)}</span>
                          <Badge variant="outline" className={getDifficultyColor(interview.difficulty)}>
                            {interview.difficulty}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(interview.started_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getStatusColor(interview.status)}>
                          {interview.status.replace('_', ' ')}
                        </Badge>
                        {interview.overall_score && (
                          <span className="font-semibold">{interview.overall_score.toFixed(1)}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <p>No interviews yet</p>
                  <Link to="/interview/new">
                    <Button variant="link" className="mt-2">
                      Start your first interview
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
