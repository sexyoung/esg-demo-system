import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tenants/acme" replace />} />
        <Route path="/map" element={<PlaceholderPage title="全域監控地圖" day="Day 5" />} />
        <Route path="/tenants/:slug">
          <Route index element={<DashboardPage />} />
          <Route path="simulator" element={<PlaceholderPage title="What-if Simulator" day="Day 4" />} />
          <Route path="asset" element={<PlaceholderPage title="Asset Tree" day="Day 2" />} />
          <Route path="alert" element={<PlaceholderPage title="Alerts" day="Day 3" />} />
          <Route path="report" element={<PlaceholderPage title="Reports" day="Day 5" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
