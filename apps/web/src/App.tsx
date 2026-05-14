import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Login } from "@/pages/Login";
import { Home } from "@/pages/Home";
import { Tasks } from "@/pages/Tasks";
import { Kpi } from "@/pages/Kpi";
import { Settings } from "@/pages/Settings";
import { InviteAccept } from "@/pages/InviteAccept";
import { CrossOrgAccept } from "@/pages/CrossOrgAccept";
import { useAuth } from "@/hooks/useAuth";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-text-secondary text-sm">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/kpi" element={<Kpi />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/invite/accept" element={<InviteAccept />} />
        <Route path="/cross-org/accept" element={<CrossOrgAccept />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
