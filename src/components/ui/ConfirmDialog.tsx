import React from 'react';
import { AppModal } from './AppModal';
import { AppButton } from './AppButton';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'primary'
}: ConfirmDialogProps) {
  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <AppButton variant="secondary" onClick={onClose}>
            {cancelText}
          </AppButton>
          <AppButton variant={variant} onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </AppButton>
        </>
      }
    >
      <div className="text-lithium-600 text-sm leading-relaxed">
        {message}
      </div>
    </AppModal>
  );
}
