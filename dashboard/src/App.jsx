import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import MapView from './pages/MapView.jsx';
import ModalSplitChart from './pages/ModalSplitChart.jsx';
import TripChainReconstruction from './pages/TripChainReconstruction.jsx';
import Filters from './pages/Filters.jsx';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
          <Header darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard/map" replace />} />
              <Route path="/dashboard/map" element={<MapView />} />
              <Route path="/dashboard/analytics" element={<ModalSplitChart />} />
              <Route path="/dashboard/trip-chains" element={<TripChainReconstruction />} />
              <Route path="/dashboard/export" element={<Filters />} />
              <Route path="*" element={<Navigate to="/dashboard/map" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </div>
  );
}
