import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './context/SessionContext';
import { Loader } from './components/ui';
import AppShell from './components/layout/AppShell';
import LoginPage from './features/auth/LoginPage';
import GroupChoicePage from './features/onboarding/GroupChoicePage';
import InvitationsPage from './features/onboarding/InvitationsPage';
import GroupFormPage from './features/onboarding/GroupFormPage';
import DashboardPage from './features/admin/DashboardPage';
import SalesmenPage from './features/admin/SalesmenPage';
import FormsPage from './features/admin/FormsPage';
import FormBuilderPage from './features/admin/FormBuilderPage';
import FormDetailPage from './features/admin/FormDetailPage';
import LeadsPage from './features/admin/LeadsPage';
import LogsPage from './features/admin/LogsPage';
import SalesHomePage from './features/salesman/SalesHomePage';
import MyFormsPage from './features/salesman/MyFormsPage';
import MyLeadsPage from './features/salesman/MyLeadsPage';
import CaptureLeadPage from './features/salesman/CaptureLeadPage';
import QrPrintPage from './features/common/QrPrintPage';
import NotificationsPage from './features/common/NotificationsPage';
import ProfilePage from './features/common/ProfilePage';
import HelpPage from './features/common/HelpPage';

export default function App() {
  const s = useSession();

  if (s.status === 'loading') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader /></div>;

  if (s.status === 'loggedOut') {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (s.status === 'needsGroup') {
    return (
      <Routes>
        <Route path="/invitations" element={<InvitationsPage standalone />} />
        <Route path="/groups/new" element={<GroupFormPage standalone />} />
        <Route path="*" element={<GroupChoicePage />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      {s.isAdmin ? (
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/salesmen" element={<SalesmenPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/forms/new" element={<FormBuilderPage />} />
          <Route path="/forms/:formId" element={<FormDetailPage />} />
          <Route path="/forms/:formId/edit" element={<FormBuilderPage />} />
          <Route path="/forms/:formId/qr" element={<QrPrintPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<GroupFormPage edit />} />
          <Route path="/groups/new" element={<GroupFormPage />} />
          <Route path="/invitations" element={<InvitationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<SalesHomePage />} />
          <Route path="/my-forms" element={<MyFormsPage />} />
          <Route path="/my-leads" element={<MyLeadsPage />} />
          <Route path="/capture/:formId" element={<CaptureLeadPage />} />
          <Route path="/forms/:formId/qr" element={<QrPrintPage />} />
          <Route path="/groups/new" element={<GroupFormPage />} />
          <Route path="/invitations" element={<InvitationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AppShell>
  );
}
