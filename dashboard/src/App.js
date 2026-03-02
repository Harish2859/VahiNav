import React, { useState } from 'react';
import MapView from './pages/MapView';
import ModalSplitChart from './pages/ModalSplitChart';
import TripChainReconstruction from './pages/TripChainReconstruction';
import Filters from './pages/Filters';

function App() {
  const [filters, setFilters] = useState({});

  return (
    <div className="app-container">
      <div className="header">
        <h1>🧭 PathSathi - NATPAC Travel Analytics</h1>
        <p>Real-time visualization of passive mobility data for Kerala</p>
      </div>
      
      <div className="main-content">
        <div className="sidebar">
          <Filters filters={filters} setFilters={setFilters} />
        </div>
        
        <div className="main-panel">
          <div className="map-container">
            <MapView filters={filters} />
          </div>
          
          <div className="analytics-grid">
            <div style={{ gridColumn: '1 / -1' }}>
              <ModalSplitChart filters={filters} />
            </div>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            <TripChainReconstruction />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
