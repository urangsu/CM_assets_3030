import React from 'react';
import { Navigate } from 'react-router-dom';

export default function UnbudgetedCheck() {
  return <Navigate to="/overrun-check?status=unbudgeted" replace />;
}
