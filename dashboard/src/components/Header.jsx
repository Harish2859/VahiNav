import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { FaMap, FaChartPie, FaRoute, FaDownload, FaMoon, FaSun, FaBars, FaTimes, FaQuestionCircle } from 'react-icons/fa';
import useDashboardStore from '../store/dashboardStore.js';

const NAV_ITEMS = [
  { path: '/dashboard/map', label: 'Map', icon: FaMap },
  { path: '/dashboard/analytics', label: 'Analytics', icon: FaChartPie },
  { path: '/dashboard/trip-chains', label: 'Trip Chains', icon: FaRoute },
  { path: '/dashboard/export', label: 'Export', icon: FaDownload },
];

export default function Header({ darkMode, onToggleDark }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const setExportModalOpen = useDashboardStore((s) => s.setExportModalOpen);

  return (
    <header className="bg-gov-primary text-white shadow-md z-50 relative">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-lg whitespace-nowrap">
          <span className="text-gov-accent text-2xl">🚗</span>
          <span className="hidden sm:inline">PathSathi</span>
          <span className="hidden md:inline text-blue-300 text-sm font-normal ml-1">
            — NATPAC Travel Analytics
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${location.pathname === path
                  ? 'bg-white/20 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-colors ml-1"
            title="Export Data"
          >
            <FaDownload size={14} />
          </button>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Harish2859/VahiNav"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-200 hover:text-white transition-colors hidden sm:block"
            title="Help / Documentation"
          >
            <FaQuestionCircle size={18} />
          </a>
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <FaSun size={16} /> : <FaMoon size={16} />}
          </button>
          <span className="hidden lg:block text-xs text-blue-300 border border-blue-700 rounded px-2 py-1">
            Admin
          </span>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-blue-200 hover:bg-white/10"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-gov-primary border-t border-blue-800 px-4 py-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium my-0.5 transition-colors
                ${location.pathname === path
                  ? 'bg-white/20 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
