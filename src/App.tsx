import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AlertsPage } from './pages/AlertsPage';
import { AssetPage } from './pages/AssetPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { ReportPage } from './pages/ReportPage';
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
          <Route path="asset" element={<AssetPage />} />
          <Route path="alert" element={<AlertsPage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
