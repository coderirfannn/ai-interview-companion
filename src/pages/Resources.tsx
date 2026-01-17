import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  BookOpen, 
  ExternalLink, 
  RefreshCw, 
  Code, 
  Database, 
  Cloud,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Resource {
  id: string;
  title: string;
  description: string;
  url: string | null;
  resource_type: string;
  role: string;
  difficulty: string;
}

const roleIcons: Record<string, typeof Code> = {
  sde: Code,
  data_engineer: Database,
  cloud_engineer: Cloud,
};

const roleLabels: Record<string, string> = {
  sde: 'Software Engineer',
  data_engineer: 'Data Engineer',
  cloud_engineer: 'Cloud Engineer',
};

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-500 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  hard: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function Resources() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('sde');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchResources();
    }
  }, [user, selectedRole, selectedDifficulty]);

  const fetchResources = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let url = `?role=${selectedRole}&limit=6`;
      if (selectedDifficulty) {
        url += `&difficulty=${selectedDifficulty}`;
      }

      const { data, error } = await supabase.functions.invoke('get-resources', {
        body: null,
        headers: {},
      });

      // Actually, we need to pass query params differently for edge functions
      // Let's use the body instead
      const { data: resourcesData, error: resourcesError } = await supabase.functions.invoke('get-resources', {
        method: 'GET',
      });

      // Edge functions with query params need different handling
      // For now, let's fetch directly from the table with RLS
      const role = selectedRole as 'sde' | 'data_engineer' | 'cloud_engineer';
      let query = supabase
        .from('learning_resources')
        .select('*')
        .eq('role', role)
        .limit(6);

      if (selectedDifficulty) {
        const diff = selectedDifficulty as 'easy' | 'medium' | 'hard';
        query = query.eq('difficulty', diff);
      }

      const { data: directData, error: directError } = await query;

      if (directError) throw directError;

      // Shuffle for randomness
      const shuffled = (directData || []).sort(() => Math.random() - 0.5);
      setResources(shuffled);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchResources(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Resources</h1>
            <p className="text-muted-foreground mt-1">
              Curated resources to help you prepare for interviews
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sde">Software Engineer</SelectItem>
                <SelectItem value="data_engineer">Data Engineer</SelectItem>
                <SelectItem value="cloud_engineer">Cloud Engineer</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={selectedDifficulty || 'all'} 
              onValueChange={(v) => setSelectedDifficulty(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No resources found</h3>
              <p className="text-muted-foreground mt-1">
                Try selecting a different role or difficulty level
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => {
              const RoleIcon = roleIcons[resource.role] || BookOpen;
              
              return (
                <Card key={resource.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-muted">
                          <RoleIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn("capitalize text-xs", difficultyColors[resource.difficulty])}
                        >
                          {resource.difficulty}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {resource.resource_type}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-3 line-clamp-2">
                      {resource.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <CardDescription className="flex-1 line-clamp-3">
                      {resource.description}
                    </CardDescription>
                    {resource.url && (
                      <a 
                        href={resource.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-4"
                      >
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <ExternalLink className="h-4 w-4" />
                          View Resource
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Stats Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Resource Library Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">Total Resources</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">3</div>
                <div className="text-sm text-muted-foreground">Role Categories</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">3</div>
                <div className="text-sm text-muted-foreground">Difficulty Levels</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
