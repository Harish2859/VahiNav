import { useState } from 'react';
import { FaTimes, FaDownload, FaSpinner, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import useDashboardStore from '../store/dashboardStore.js';
import { exportData } from '../services/apiClient.js';

const FORMATS = [
  { value: 'csv', label: 'CSV', desc: 'All trips + breadcrumbs (Excel compatible)' },
  { value: 'geojson', label: 'GeoJSON', desc: 'Leaflet-compatible geographic format' },
  { value: 'shapefile', label: 'Shapefile', desc: 'For QGIS / ArcGIS import' },
];

export default function ExportModal() {
  const exportModalOpen = useDashboardStore((s) => s.exportModalOpen);
  const setExportModalOpen = useDashboardStore((s) => s.setExportModalOpen);
  const filters = useDashboardStore((s) => s.filters);

  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);

  if (!exportModalOpen) return null;

  const handleDownload = async () => {
    setStatus('loading');
    setProgress(0);
    setErrorMsg('');

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 200);

    try {
      const blob = await exportData(selectedFormat, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      clearInterval(progressInterval);
      setProgress(100);

      const ext = selectedFormat === 'shapefile' ? 'zip' : selectedFormat;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `natpac_trips_${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('success');
    } catch (err) {
      clearInterval(progressInterval);
      setStatus('error');
      setErrorMsg(err.message || 'Export failed. Please try again.');
    }
  };

  const handleClose = () => {
    setExportModalOpen(false);
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Export Trip Data</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Format selection */}
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </legend>
            <div className="space-y-2">
              {FORMATS.map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedFormat === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={value}
                    checked={selectedFormat === value}
                    onChange={() => setSelectedFormat(value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Date range */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {status === 'loading' && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Preparing export...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status messages */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <FaCheckCircle />
              Download started successfully!
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <FaExclamationCircle />
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={status === 'loading'}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {status === 'loading' ? (
              <FaSpinner className="animate-spin" size={14} />
            ) : (
              <FaDownload size={14} />
            )}
            {status === 'loading' ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
