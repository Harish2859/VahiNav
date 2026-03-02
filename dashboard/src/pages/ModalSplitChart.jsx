import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { FaInfoCircle, FaArrowLeft } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import useDashboardStore from '../store/dashboardStore.js';
import { getModalSplit } from '../services/apiClient.js';
import { getTravelModeColor } from '../utils/mapUtils.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// National average comparison data (static)
const NATIONAL_AVG = {
  car: 45,
  bus: 30,
  walk: 15,
  bicycle: 6,
  auto: 4,
};

export default function ModalSplitChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const modalSplitData = useDashboardStore((s) => s.modalSplitData);
  const setModalSplitData = useDashboardStore((s) => s.setModalSplitData);
  const selectedMode = useDashboardStore((s) => s.selectedMode);
  const setSelectedMode = useDashboardStore((s) => s.setSelectedMode);

  useEffect(() => {
    if (modalSplitData) { setLoading(false); return; }
    getModalSplit()
      .then((data) => { setModalSplitData(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner message="Fetching modal split data..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 dark:text-red-400 mb-2">Failed to load modal split data</p>
        <p className="text-sm text-gray-500">{error}</p>
        <p className="text-xs text-gray-400 mt-4">
          Make sure the backend API is running at{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
          </code>
        </p>
      </div>
    );
  }

  const split = modalSplitData?.modal_split || modalSplitData || {};
  const modes = Object.keys(split);
  const values = modes.map((m) => split[m]);
  const total = values.reduce((a, b) => a + b, 0);

  const chartData = {
    labels: modes.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
    datasets: [
      {
        data: values,
        backgroundColor: modes.map((m) => getTravelModeColor(m)),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { padding: 16, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return ` ${val} trips (${pct}%)`;
          },
        },
      },
    },
    onClick: (_, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        const mode = modes[idx].toLowerCase();
        setSelectedMode(selectedMode === mode ? null : mode);
      }
    },
  };

  // Dominant mode for insight
  const dominantMode = modes.reduce((a, b) => (split[a] > split[b] ? a : b), modes[0] || '');
  const dominantPct = total > 0 ? ((split[dominantMode] / total) * 100).toFixed(0) : 0;

  const metrics = [
    { label: 'Total Trips', value: total.toLocaleString() },
    { label: 'Dominant Mode', value: dominantMode ? dominantMode.charAt(0).toUpperCase() + dominantMode.slice(1) : '—' },
    { label: 'Mode Share', value: `${dominantPct}%` },
    { label: 'Modes Tracked', value: modes.length },
  ];

  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Modal Split Analytics</h1>
        {selectedMode && (
          <button
            onClick={() => setSelectedMode(null)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <FaArrowLeft size={12} />
            Clear filter: {selectedMode}
          </button>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(({ label, value }) => (
          <div key={label} className="card text-center">
            <div className="text-2xl font-bold text-gov-secondary">{value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Travel Mode Distribution
          </h2>
          <div className="chart-container">
            <Pie data={chartData} options={chartOptions} />
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Click a slice to filter Map View by that mode
          </p>
        </div>

        {/* Comparison + Insights */}
        <div className="space-y-4">
          {/* Insights */}
          <div className="card border-l-4 border-gov-accent">
            <div className="flex items-start gap-2">
              <FaInfoCircle className="text-gov-accent mt-0.5 flex-shrink-0" size={16} />
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Key Insight</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {dominantPct >= 60 ? (
                    <>{dominantPct}% of commuters rely on <strong>{dominantMode}</strong>. Opportunity to improve public transit and reduce private vehicle dependency.</>
                  ) : (
                    <>Modal split shows relatively balanced distribution, with {dominantMode} at {dominantPct}%. This indicates good multi-modal adoption.</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison with national average */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Comparison with National Average
            </h3>
            <div className="space-y-3">
              {Object.entries(NATIONAL_AVG).map(([mode, nationalPct]) => {
                const localVal = split[mode] || 0;
                const localPct = total > 0 ? ((localVal / total) * 100).toFixed(1) : 0;
                const color = getTravelModeColor(mode);
                const diff = (parseFloat(localPct) - nationalPct).toFixed(1);

                return (
                  <div key={mode}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{mode}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Local: <strong>{localPct}%</strong> | National: {nationalPct}%
                        {' '}
                        <span className={parseFloat(diff) > 0 ? 'text-red-500' : 'text-green-500'}>
                          ({diff > 0 ? '+' : ''}{diff}%)
                        </span>
                      </span>
                    </div>
                    <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute h-full rounded-full"
                        style={{ width: `${Math.min(parseFloat(localPct), 100)}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
