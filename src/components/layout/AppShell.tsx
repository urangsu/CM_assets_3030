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
    try {
      const keys = Object.keys(localStorage);
      const hasAnyData = keys.some(key => {
        if (
          key.startsWith('cleanmetal_actual_data_') ||
          key.startsWith('hycm_raw_material_ledger_') ||
          key.startsWith('hycm_product_ledger_')
        ) {
          const val = localStorage.getItem(key);
          const rows = val ? JSON.parse(val) : [];
          return Array.isArray(rows) && rows.length > 0;
        }
        return false;
      });
      setDataState(hasAnyData ? 'uploaded' : 'no-upload');
    } catch {
      setDataState('no-upload');
    }
  };

  useEffect(() => {
    checkUploadStatus();
  }, [location.pathname]);

  return (
    <div className="app">
      <TopHeader dataState={dataState} isDemo={dataState === 'no-upload'} />
      <Sidebar />
      <main className="main">
        {children}
      </main>
    </div>
  );
}
