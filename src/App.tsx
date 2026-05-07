import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { SimulatorPage } from './pages/SimulatorPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/tenants/acme" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/tenants/:slug">
          <Route index element={<DashboardPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="asset" element={<PlaceholderPage title="Asset Tree" day="Day 5" />} />
          <Route path="alert" element={<PlaceholderPage title="Alerts" day="Day 5" />} />
          <Route path="report" element={<PlaceholderPage title="Reports" day="Day 5" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
