import React from 'react';
import { Navigate } from 'react-router-dom';

export default function UnderrunCheck() {
  return <Navigate to="/overrun-check?status=underrun" replace />;
}
