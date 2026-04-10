import { Routes, Route } from 'react-router';
import { useRealtime } from '@/hooks/use-realtime';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import Departments from '@/pages/Departments';
import DepartmentDetail from '@/pages/DepartmentDetail';
import Agents from '@/pages/Agents';
import AgentDetail from '@/pages/AgentDetail';
import Tasks from '@/pages/Tasks';
import Pipelines from '@/pages/Pipelines';
import Meetings from '@/pages/Meetings';
import TerminalPage from '@/pages/TerminalPage';
import Settings from '@/pages/Settings';
import PixelOffice from '@/pages/PixelOffice';
import Skills from '@/pages/Skills';
import Projects from '@/pages/Projects';

export default function App() {
  useRealtime();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/departments/:id" element={<DepartmentDetail />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/office" element={<PixelOffice />} />
      </Routes>
    </Layout>
  );
}
