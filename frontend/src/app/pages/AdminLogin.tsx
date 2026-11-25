import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Book, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { adminLogin } from '../data/api';


export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(email, password);
      window.localStorage.setItem('smart-library-admin-auth', 'true');
      window.localStorage.removeItem('smart-library-student-auth');
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <header><Link to="/"><Book size={18} />Smart Library</Link><nav><Link to="/student/login">Student sign in</Link><Link to="/" aria-label="Close and return home"><X size={20} /></Link></nav></header>
      <main><div className="account-title"><h1>Staff sign in</h1><p>Use your library administrator account.</p></div>
        <div className="account-single">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email" autoComplete="username"
                placeholder="Enter your admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password" autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </div>


            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-70 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
              {loading ? 'Signing in...' : 'Login to Dashboard'}
              <ArrowRight className="size-4" />
            </Button>
          </form>

        </div>
      </main>
    </div>
  );
}
