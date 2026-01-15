import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Search,
  User,
  Mail,
  Calendar,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

interface UserData {
  id: string;
  full_name: string | null;
  created_at: string;
  email?: string;
  interviewCount: number;
  avgScore: number | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.full_name?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch all interviews for stats
      const { data: interviews, error: interviewError } = await supabase
        .from('interviews')
        .select('user_id, status, overall_score');

      if (interviewError) throw interviewError;

      // Aggregate interview stats per user
      const userStats: Record<string, { count: number; totalScore: number; completed: number }> = {};
      interviews?.forEach((i) => {
        if (!userStats[i.user_id]) {
          userStats[i.user_id] = { count: 0, totalScore: 0, completed: 0 };
        }
        userStats[i.user_id].count++;
        if (i.status === 'completed' && i.overall_score) {
          userStats[i.user_id].totalScore += i.overall_score;
          userStats[i.user_id].completed++;
        }
      });

      // Combine data
      const userData: UserData[] = (profiles || []).map((p) => {
        const stats = userStats[p.id] || { count: 0, totalScore: 0, completed: 0 };
        return {
          id: p.id,
          full_name: p.full_name,
          created_at: p.created_at,
          interviewCount: stats.count,
          avgScore: stats.completed > 0 ? stats.totalScore / stats.completed : null,
        };
      });

      setUsers(userData);
      setFilteredUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage platform users
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Name
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Joined
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Interviews
                        </div>
                      </TableHead>
                      <TableHead>Avg. Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.full_name?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <span className="font-medium">
                              {user.full_name || 'Unknown User'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.interviewCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.avgScore !== null ? (
                            <Badge 
                              variant="outline" 
                              className={
                                user.avgScore >= 8 
                                  ? 'bg-green-500/10 text-green-500' 
                                  : user.avgScore >= 6 
                                    ? 'bg-yellow-500/10 text-yellow-500' 
                                    : 'bg-red-500/10 text-red-500'
                              }
                            >
                              {user.avgScore.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No users match your search' : 'No users found'}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
