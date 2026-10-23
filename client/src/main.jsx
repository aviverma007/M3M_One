import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { isAdmin } from './lib/constants';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import { Login, ForgotPassword, ResetPassword } from './pages/Auth';

const Projects = lazy(() => import('./pages/Projects'));
const ProjectForm = lazy(() => import('./pages/ProjectForm'));
const ProjectOverview = lazy(() => import('./pages/ProjectOverview'));
const KeyRatio = lazy(() => import('./pages/KeyRatio'));
const Chapter = lazy(() => import('./pages/Chapter'));
const Users = lazy(() => import('./pages/admin/Users'));
const ModuleAccess = lazy(() => import('./pages/admin/ModuleAccess'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog'));

function RequireAuth({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && !isAdmin(user)) return <Navigate to="/projects" replace />;
  return children;
}

function NotFound() {
  return <div className="py-20 text-center"><p className="text-sm font-semibold text-brand-600">404</p><p className="mt-2 text-xl font-semibold">Page not found</p></div>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="/projects" replace />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/new" element={<ProjectForm />} />
              <Route path="projects/:projectId" element={<ProjectOverview />} />
              <Route path="projects/:projectId/edit" element={<ProjectForm />} />
              <Route path="projects/:projectId/key-ratio" element={<KeyRatio />} />
              <Route path="projects/:projectId/modules/:moduleId/chapters/:chapterId" element={<Chapter />} />
              <Route path="admin/users" element={<RequireAuth admin><Users /></RequireAuth>} />
              <Route path="admin/access" element={<RequireAuth admin><ModuleAccess /></RequireAuth>} />
              <Route path="admin/audit" element={<RequireAuth admin><AuditLog /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
