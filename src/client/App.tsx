import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tracking from './pages/Tracking';
import Vehicles from './pages/Vehicles';
import ApiEndpoints from './pages/ApiEndpoints';
import Settings from './pages/Settings';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/api" element={<ApiEndpoints />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;
