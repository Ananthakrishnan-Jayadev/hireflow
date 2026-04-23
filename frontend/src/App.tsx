import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/Login';
import { NotFoundPage } from './pages/NotFound';
import { LiveCopilotPage } from './pages/LiveCopilot';
import { DashboardPage } from './pages/Dashboard';
import { JobsPage } from './pages/Jobs';
import { JobCreatePage } from './pages/JobCreate';
import { JobDetailPage } from './pages/JobDetail';
import { CandidatesPage } from './pages/Candidates';
import { CandidateProfilePage } from './pages/CandidateProfile';
import { PipelinePage } from './pages/Pipeline';
import { AnalyticsPage } from './pages/Analytics';
import { InterviewsPage } from './pages/Interviews';
import { ScorecardPage } from './pages/Scorecard';
import { InterviewAssistantPage } from './pages/InterviewAssistant';
import { EmailsPage } from './pages/Emails';
import { AdminUsersPage } from './pages/AdminUsers';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner">
          <div className="spinner-circle" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',                       element: <DashboardPage /> },
      { path: 'jobs',                            element: <JobsPage /> },
      { path: 'jobs/new',                        element: <JobCreatePage /> },
      { path: 'jobs/:id',                        element: <JobDetailPage /> },
      { path: 'jobs/:id/edit',                   element: <JobCreatePage /> },
      { path: 'candidates',                      element: <CandidatesPage /> },
      { path: 'candidates/:id',                  element: <CandidateProfilePage /> },
      { path: 'pipeline',                        element: <PipelinePage /> },
      { path: 'interviews',                      element: <InterviewsPage /> },
      { path: 'interviews/:id/scorecard',        element: <ScorecardPage /> },
      { path: 'interview-assistant',             element: <InterviewAssistantPage /> },
      { path: 'emails',                          element: <EmailsPage /> },
      { path: 'analytics',                       element: <AnalyticsPage /> },
      { path: 'admin-users',                     element: <AdminUsersPage /> },
      { path: 'copilot',                         element: <LiveCopilotPage /> },
      { path: '*',                               element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
