import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Book, LockKeyhole, Shield, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { ThemeToggle } from '../components/theme/ThemeToggle';
import { adminLogin } from '../data/api';

const accessNotes = [
  'Monitor borrowing activity with cleaner oversight',
  'Manage books, students, and records from one hub',
  'Use a calmer control panel built for quick decisions',
];

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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(148,163,184,0.18),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_48%,_#f7f9fc_100%)] px-4 py-8 transition-colors dark:bg-[radial-gradient(circle_at_top_right,_rgba(71,85,105,0.25),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#111827_55%,_#020617_100%)] sm:px-6 lg:px-8">
      <div className="absolute left-0 top-16 h-56 w-56 rounded-full bg-slate-400/15 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-3 text-slate-700 dark:text-slate-200">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-lg shadow-slate-900/20 dark:from-slate-200 dark:to-slate-400 dark:text-slate-950">
            <Book className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold">Smart Library</p>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin Access</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/student/login">
            <Button variant="outline" className="rounded-full border-slate-300 bg-white/80 px-5 dark:border-slate-700 dark:bg-slate-900/70">
              Student Login
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/76 p-8 shadow-[0_25px_65px_-32px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/76 dark:shadow-black/35 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-[1.4rem] bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950">
              <Shield className="size-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Admin Portal</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Secure access for library management and oversight.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="text"
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
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">Sign in with the administrator account provided for this library.</p>

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-70 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white">
              {loading ? 'Signing in...' : 'Login to Dashboard'}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-7 rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
              <LockKeyhole className="size-4" />
              Admin-only area. Access and actions are monitored for library security.
            </p>
          </div>

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
              Back to Home
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-8 text-white shadow-[0_35px_90px_-38px_rgba(2,6,23,0.8)] sm:p-10">
          <div className="absolute right-6 top-6 flex size-24 items-center justify-center rounded-full bg-white/5 blur-xl" />
          <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
              <Sparkles className="size-3.5" />
              Command Center
            </p>

            <h2 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
              Manage the library with clarity and control.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              A better admin workspace should feel sharp, readable, and calm under pressure. This panel is built to support that.
            </p>

            <div className="mt-10 space-y-4">
              {accessNotes.map((note) => (
                <div key={note} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-sm leading-7 text-slate-200">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
