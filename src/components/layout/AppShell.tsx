import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TopHeader from './TopHeader';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [dataState, setDataState] = useState<'no-upload' | 'uploaded' | 'partial' | 'error'>('no-upload');

  const checkUploadStatus = () => {
    const rawActuals = localStorage.getItem('cleanmetal_actual_data_2026');
    if (rawActuals) {
      try {
        const rows = JSON.parse(rawActuals);
        if (rows && rows.length > 0) {
          setDataState('uploaded');
          return;
        }
      } catch (e) {
        setDataState('no-upload');
      }
    }
    setDataState('no-upload');
  };

  useEffect(() => {
    checkUploadStatus();
  }, [location.pathname]);

  return (
    <div className="app">
      <TopHeader dataState={dataState} isDemo={true} />
      <Sidebar />
      <main className="main">
        {children}
      </main>
    </div>
  );
}
