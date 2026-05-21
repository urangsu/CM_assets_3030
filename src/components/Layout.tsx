import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import Footer from './Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      navigate('/');
    }
  }, [navigate]);

  if (!currentUser) return null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
        {children}
      </div>
      <Footer isLoggedIn={true} />
    </AppShell>
  );
}
