import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface TopHeaderProps {
  dataState: 'no-upload' | 'uploaded' | 'partial' | 'error';
  isDemo?: boolean;
}

export function UploadStatusChip({ dataState }: { dataState: 'no-upload' | 'uploaded' | 'partial' | 'error' }) {
  const cfg = {
    'no-upload': { label: '데이터 미업로드', cls: 'status-chip' },
    'uploaded': { label: '실적 업로드됨', cls: 'status-chip ok' },
    'partial': { label: '일부 누락', cls: 'status-chip warn' },
    'error': { label: '처리 오류', cls: 'status-chip err' },
  }[dataState] || { label: '미업로드', cls: 'status-chip' };

  return (
    <div className={cfg.cls}>
      <span className="dot" />
      {cfg.label}
    </div>
  );
}

export default function TopHeader({ dataState, isDemo = true }: TopHeaderProps) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentDateString, setCurrentDateString] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentDateString(`${YYYY}. ${MM}. ${DD} ${hh}:${mm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    navigate('/');
  };

  const firstLetter = currentUser?.name ? currentUser.name.charAt(0) : '관';

  return (
    <header className="hdr">
      <span className="logo">HY<em>CM</em></span>
      <div className="vr" />
      <span className="portal-name">운영 포털</span>
      {isDemo && (
        <span className="demo-chip">
          <span className="demo-dot" />
          화면 확인용 샘플 데이터
        </span>
      )}
      <div className="flex-1" />
      <UploadStatusChip dataState={dataState} />
      <span className="hdr-date" id="hdrDate">
        {currentDateString}
      </span>
      <div className="avatar" title={currentUser?.name || '사용자'}>
        {firstLetter}
      </div>
      {currentUser && (
        <button
          onClick={handleLogout}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors ml-1"
          title="로그아웃"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </header>
  );
}
