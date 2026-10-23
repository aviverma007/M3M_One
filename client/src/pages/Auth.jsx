import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { post, errMsg } from '../lib/api';
import { Field } from '../components/ui';

function Shell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-950 p-12 text-brand-50 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 font-bold">M1</div>
          <span className="text-lg font-semibold">M3M One</span>
        </div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-snug">Every project's ratios, specs and sign-offs in one place.</p>
          <p className="mt-4 max-w-md text-brand-300">Benchmark checks across M3M Gurgaon, M3M Noida and Smartworld portfolios.</p>
        </div>
        <p className="text-xs text-brand-400">Smart World Developers · Internal use only</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-10" type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} required />
      <button type="button" className="absolute inset-y-0 right-0 px-3 text-ink-400 hover:text-ink-600" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!locked) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [locked]);
  if (user) return <Navigate to="/projects" replace />;
  const remaining = locked ? Math.max(0, Math.ceil((new Date(locked) - now) / 1000)) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/projects');
    } catch (err) {
      const d = err.response?.data;
      if (d?.errorCode === 'LOCKED') setLocked(d.data?.lockUntil);
      else toast.error(errMsg(err, 'Sign in failed'));
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Sign in" subtitle="Use your Smart World work account.">
      {locked && remaining > 0 && (
        <div className="mb-5 flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Too many failed attempts. Try again in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}.</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></Field>
        <Field label="Password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">Forgot password?</Link></div>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || remaining > 0}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await post('/auth/forgot-password', { email }); setSent(true); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset your password" subtitle="We'll send a reset link to your work email.">
      {sent ? (
        <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-200">If an account exists for <b>{email}</b>, a reset link is on its way. Ask IT if it doesn't arrive.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm font-medium text-brand-700 hover:underline">Back to sign in</Link>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const error = !token ? 'This reset link is missing its token.' : pw && pw.length < 8 ? 'Use at least 8 characters.' : pw2 && pw !== pw2 ? "Passwords don't match." : '';
  const submit = async (e) => {
    e.preventDefault(); if (error || !pw) return; setBusy(true);
    try { await post('/auth/reset-password', { token, password: pw }); toast.success('Password updated — sign in with your new password'); navigate('/login'); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={error}><PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !!error || !pw}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </Shell>
  );
}
