import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Mic2, 
  Timer,
  MessageSquare
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { format } from 'date-fns';

interface AnalyticsData {
  confidenceTrend: { date: string; confidence: number; score: number }[];
  speedTrend: { date: string; wpm: number }[];
  fillerTrend: { date: string; count: number }[];
  averageConfidence: number;
  averageWpm: number;
  totalFillerWords: number;
  improvementRate: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      // Fetch completed interviews with answers
      const { data: interviews, error } = await supabase
        .from('interviews')
        .select(`
          *,
          interview_questions (
            interview_answers (*)
          )
        `)
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })
        .limit(20);

      if (error) throw error;

      // Process data for charts
      const confidenceTrend: { date: string; confidence: number; score: number }[] = [];
      const speedTrend: { date: string; wpm: number }[] = [];
      const fillerTrend: { date: string; count: number }[] = [];

      let totalConfidence = 0;
      let totalWpm = 0;
      let totalFillerWords = 0;
      let answerCount = 0;

      interviews?.forEach((interview) => {
        const date = format(new Date(interview.completed_at || interview.started_at), 'MMM d');
        
        confidenceTrend.push({
          date,
          confidence: interview.confidence_score || 0,
          score: (interview.overall_score || 0) * 10,
        });

        let interviewWpm = 0;
        let interviewFillers = 0;
        let questionCount = 0;

        interview.interview_questions?.forEach((q: any) => {
          q.interview_answers?.forEach((a: any) => {
            if (a.words_per_minute) {
              interviewWpm += a.words_per_minute;
              totalWpm += a.words_per_minute;
            }
            if (a.filler_word_count) {
              interviewFillers += a.filler_word_count;
              totalFillerWords += a.filler_word_count;
            }
            if (a.confidence_score) {
              totalConfidence += a.confidence_score;
              answerCount++;
            }
            questionCount++;
          });
        });

        if (questionCount > 0) {
          speedTrend.push({
            date,
            wpm: Math.round(interviewWpm / questionCount),
          });
          fillerTrend.push({
            date,
            count: interviewFillers,
          });
        }
      });

      // Calculate improvement rate (comparing first half to second half)
      const halfIndex = Math.floor(confidenceTrend.length / 2);
      const firstHalf = confidenceTrend.slice(0, halfIndex);
      const secondHalf = confidenceTrend.slice(halfIndex);
      
      const firstHalfAvg = firstHalf.length > 0 
        ? firstHalf.reduce((sum, d) => sum + d.confidence, 0) / firstHalf.length 
        : 0;
      const secondHalfAvg = secondHalf.length > 0 
        ? secondHalf.reduce((sum, d) => sum + d.confidence, 0) / secondHalf.length 
        : 0;
      const improvementRate = firstHalfAvg > 0 
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
        : 0;

      setData({
        confidenceTrend,
        speedTrend,
        fillerTrend,
        averageConfidence: answerCount > 0 ? totalConfidence / answerCount : 0,
        averageWpm: answerCount > 0 ? totalWpm / answerCount : 0,
        totalFillerWords,
        improvementRate,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Voice Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your speaking performance and improvement over time
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg. Confidence
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.averageConfidence.toFixed(0) || 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg. Speaking Speed
              </CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.averageWpm.toFixed(0) || 0} WPM
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Filler Words
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.totalFillerWords || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Improvement
              </CardTitle>
              <Mic2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(data?.improvementRate || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {(data?.improvementRate || 0) >= 0 ? '+' : ''}{data?.improvementRate.toFixed(1) || 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Confidence Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence & Score Trend</CardTitle>
              <CardDescription>Your performance over recent interviews</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.confidenceTrend && data.confidenceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.confidenceTrend}>
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
                    <Area
                      type="monotone"
                      dataKey="confidence"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      name="Confidence %"
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2) / 0.2)"
                      name="Score %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Complete some interviews to see your trends
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speaking Speed */}
          <Card>
            <CardHeader>
              <CardTitle>Speaking Speed</CardTitle>
              <CardDescription>Words per minute over time (optimal: 120-150 WPM)</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.speedTrend && data.speedTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.speedTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 200]} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="wpm"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-3))' }}
                      name="WPM"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No speaking data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filler Words */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Filler Words Usage</CardTitle>
              <CardDescription>Track your progress in reducing filler words (um, uh, like, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.fillerTrend && data.fillerTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.fillerTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--chart-4))"
                      radius={[4, 4, 0, 0]}
                      name="Filler Words"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No filler word data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
