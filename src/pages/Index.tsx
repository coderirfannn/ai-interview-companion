import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Mic, 
  BarChart3, 
  Target, 
  Sparkles, 
  CheckCircle2,
  ArrowRight,
  Code,
  Database,
  Cloud
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Questions',
    description: 'Get realistic interview questions tailored to your target role and experience level.',
  },
  {
    icon: Mic,
    title: 'Voice Recording',
    description: 'Practice answering out loud with voice recording and real-time transcription.',
  },
  {
    icon: BarChart3,
    title: 'Detailed Analytics',
    description: 'Track your speaking speed, filler words, and confidence over time.',
  },
  {
    icon: Target,
    title: 'Instant Feedback',
    description: 'Receive AI-generated feedback on technical accuracy, clarity, and structure.',
  },
];

const roles = [
  { icon: Code, label: 'Software Engineer', color: 'bg-blue-500/10 text-blue-500' },
  { icon: Database, label: 'Data Engineer', color: 'bg-green-500/10 text-green-500' },
  { icon: Cloud, label: 'Cloud Engineer', color: 'bg-purple-500/10 text-purple-500' },
];

const benefits = [
  'Practice anytime, anywhere',
  'No scheduling required',
  'Get feedback in seconds',
  'Track your improvement',
  'Build confidence',
  'Ace your interviews',
];

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Brain className="h-6 w-6 text-primary" />
            <span>Interview Coach</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/auth">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <Badge variant="outline" className="px-4 py-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              AI-Powered Interview Practice
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Master Your Technical
              <span className="text-primary"> Interviews</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Practice with AI-generated questions, get instant feedback on your answers, 
              and track your progress with detailed voice analytics.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={user ? '/dashboard' : '/auth'}>
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Start Practicing Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Role Badges */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <Badge key={role.label} variant="outline" className={`px-3 py-1.5 ${role.color}`}>
                    <Icon className="h-3.5 w-3.5 mr-2" />
                    {role.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our AI-powered platform helps you prepare for technical interviews 
              with realistic practice and actionable feedback.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-border/50">
                  <CardContent className="pt-6">
                    <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple 3-step process.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: 'Choose Your Role',
                description: 'Select your target position and difficulty level to get relevant questions.',
              },
              {
                step: '2',
                title: 'Answer Questions',
                description: 'Type or speak your answers to AI-generated technical interview questions.',
              },
              {
                step: '3',
                title: 'Get Feedback',
                description: 'Receive instant AI feedback with scores, strengths, and areas to improve.',
              },
            ].map((item, index) => (
              <div key={item.step} className="relative text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Why Practice With Us?
              </h2>
              <p className="text-muted-foreground mb-8">
                Traditional interview prep is time-consuming and expensive. 
                Our AI coach is available 24/7 and provides personalized feedback 
                that helps you improve faster.
              </p>
              <ul className="space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <Card className="border-border/50 shadow-xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">Interview Coach AI</div>
                        <div className="text-sm text-muted-foreground">Ready to help</div>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        "Great answer! You explained the concept clearly. Consider mentioning 
                        time complexity to strengthen your response."
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-green-500/10 text-green-500">Score: 8.5/10</Badge>
                      <Badge className="bg-blue-500/10 text-blue-500">Clarity: Excellent</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Ready to Ace Your Interview?
              </h2>
              <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
                Join thousands of candidates who have improved their interview skills 
                with our AI-powered practice platform.
              </p>
              <Link to={user ? '/dashboard' : '/auth'}>
                <Button size="lg" variant="secondary" className="gap-2">
                  Start Practicing Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/40">
        <div className="container flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold">Interview Coach</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Interview Coach. Built with AI to help you succeed.
          </p>
        </div>
      </footer>
    </div>
  );
}
