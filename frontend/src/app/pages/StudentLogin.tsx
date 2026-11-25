import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Book, KeyRound, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { manualLogin, loginWithGoogle, createGoogleCredentials, registerStudent, resetStudentPassword } from '../data/api';
import { signInWithGoogle } from '../data/firebase';
import { AlertCircle } from 'lucide-react';


export default function StudentLogin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [registerEmail, setRegisterEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [newAdm, setNewAdm] = useState('');
  const [newDepartment, setNewDepartment] = useState('Computer Science');
  const [newPass, setNewPass] = useState('');
  const [newConfirm, setNewConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const userData = await manualLogin(email, password);
      
      window.localStorage.setItem('smart-library-student-auth', 'true');
      window.localStorage.setItem('smart-library-user', JSON.stringify(userData));
      window.localStorage.removeItem('smart-library-admin-auth');
      navigate('/student/dashboard', { state });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register' | 'reset') => {
    setMode(nextMode);
    setError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const userData = await registerStudent({
        name,
        admission_number: email,
        department,
        email: registerEmail,
        password,
      });
      window.localStorage.setItem('smart-library-student-auth', 'true');
      window.localStorage.setItem('smart-library-user', JSON.stringify(userData));
      navigate('/student/dashboard', { state });
    } catch (err: any) {
      setError(err.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (resetPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetStudentPassword({
        admission_number: email,
        email: resetEmail,
        new_password: resetPassword,
      });
      setPassword('');
      setResetPassword('');
      setResetConfirmPassword('');
      setError('Password updated. You can now sign in.');
      setMode('login');
    } catch (err: any) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const gUser = await signInWithGoogle();
      const idToken = await gUser.getIdToken();
      
      const res = await loginWithGoogle(idToken);
      
      if (res.new_user) {
        setPendingGoogleUser({ email: res.email, name: res.name });
        return; // Don't navigate yet, show credential creation form
      } else {
        window.localStorage.setItem('smart-library-user', JSON.stringify(res));
      }
      
      window.localStorage.setItem('smart-library-student-auth', 'true');
      navigate('/student/dashboard', { state });
    } catch (err: any) {
      setError(err.message || "Google Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPass !== newConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await createGoogleCredentials({
        email: pendingGoogleUser.email,
        name: pendingGoogleUser.name,
        admission_number: newAdm,
        department: newDepartment,
        password: newPass
      });
      window.localStorage.setItem('smart-library-user', JSON.stringify(res));
      window.localStorage.setItem('smart-library-student-auth', 'true');
      navigate('/student/dashboard', { state });
    } catch (err: any) {
      setError(err.message || "Failed to finalize account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <header><Link to="/"><Book size={18} />Smart Library</Link><nav><Link to="/admin/login">Staff sign in</Link><Link to="/" aria-label="Close and return home"><X size={20} /></Link></nav></header>
      <main>
        <div className="account-title"><h1>{pendingGoogleUser ? 'Complete your account' : mode === 'register' ? 'Sign up' : mode === 'reset' ? 'Password recovery' : 'Sign in'}</h1>
          {!pendingGoogleUser && mode !== 'reset' && <p>{mode === 'login' ? 'New to the library?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Sign up' : 'Sign in'}</button></p>}
        </div>
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className={pendingGoogleUser || mode === 'reset' ? 'account-single' : 'account-methods'}>
          {!pendingGoogleUser && mode === 'login' ? (
            <>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Admission Number</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="e.g. 2023PE1250"
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

                <div className="flex items-center justify-end text-sm">
                  <button type="button" onClick={() => setError('Please contact your library administrator to recover your account.')} className="font-medium text-sky-700 hover:underline dark:text-sky-300">
                    Forgot password?
                  </button>
                </div>

                <Button 
                    type="submit" 
                    disabled={loading}
                    className="h-12 w-full rounded-2xl reading-panel text-white shadow-lg shadow-blue-500/25 hover:from-sky-600 hover:to-blue-800 disabled:opacity-70"
                >
                  {loading ? 'Entering...' : 'Enter Dashboard'}
                  <ArrowRight className="size-4" />
                </Button>
              </form>

            </>
          ) : !pendingGoogleUser && mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input required aria-label="Full name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-2xl" />
              <Input required aria-label="Admission number" placeholder="Admission number" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input required type="email" aria-label="College email" placeholder="College email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input required aria-label="Department" placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className="h-12 rounded-2xl" />
              <Input required minLength={8} type="password" aria-label="Create password (minimum 8 characters)" placeholder="Create password (minimum 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Input required minLength={8} type="password" aria-label="Confirm password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl reading-panel text-white">
                {loading ? 'Creating account...' : 'Create account'} <ArrowRight className="size-4" />
              </Button>
            </form>
          ) : !pendingGoogleUser && mode === 'reset' ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-center">
                <KeyRound className="mx-auto mb-3 size-8 text-sky-700 dark:text-sky-300" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reset password</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Confirm your admission number and registered email.</p>
              </div>
              <Input required aria-label="Admission number" placeholder="Admission number" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input required type="email" aria-label="Registered email" placeholder="Registered email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="h-12 rounded-2xl" />
              <Input required minLength={8} type="password" aria-label="New password (minimum 8 characters)" placeholder="New password (minimum 8 characters)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Input required minLength={8} type="password" aria-label="Confirm new password" placeholder="Confirm new password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} className="h-12 rounded-2xl" />
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl reading-panel text-white">
                {loading ? 'Updating password...' : 'Update password'} <ArrowRight className="size-4" />
              </Button>
              <button type="button" onClick={() => switchMode('login')} className="w-full text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300">Back to sign in</button>
            </form>
          ) : (
            <form onSubmit={handleCreateCredentials} className="space-y-5">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-100 dark:border-blue-800/30 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Welcome <strong>{pendingGoogleUser.name}</strong>! Since this is your first time using Google Login, please link your Admission Number and create a backup password.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAdm">Admission Number</Label>
                <Input
                  id="newAdm"
                  type="text"
                  placeholder="e.g. 2023PE1250"
                  value={newAdm}
                  onChange={(e) => setNewAdm(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPass">Create Password</Label>
                <Input
                  id="newPass"
                  type="password"
                  placeholder="Enter a secure password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newDepartment">Department</Label>
                <Input
                  id="newDepartment"
                  placeholder="e.g. Computer Science"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newConfirm">Confirm Password</Label>
                <Input
                  id="newConfirm"
                  type="password"
                  placeholder="Re-enter password"
                  value={newConfirm}
                  onChange={(e) => setNewConfirm(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/80 px-4 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </div>

              <Button 
                  type="submit" 
                  disabled={loading}
                  className="h-12 w-full rounded-2xl reading-panel text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700 disabled:opacity-70 mt-4"
              >
                {loading ? 'Creating Account...' : 'Continue to Dashboard'}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          )}

          {!pendingGoogleUser && mode !== 'reset' && <aside><button className="account-google" type="button" disabled={loading} onClick={handleGoogleLogin}>Continue with Google</button></aside>}
          </div>
      </main>
    </div>
  );
}
