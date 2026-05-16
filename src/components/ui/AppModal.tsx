import React from 'react';

interface AppModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  maxWidthClassName?: string;
}

export function AppModal({
  isOpen,
  title,
  description,
  children,
  footer,
  onClose,
  maxWidthClassName = 'max-w-lg',
}: AppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-md p-4">
      <div className={`bg-white rounded-2xl border border-lithium-200 shadow-popover w-full ${maxWidthClassName} max-h-[86vh] flex flex-col overflow-hidden`}>
        <div className="flex-none px-6 py-4 border-b border-lithium-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-eco-black">{title}</h3>
              {description && (
                <p className="mt-1 text-sm text-text-muted">{description}</p>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-text-subtle hover:text-eco-black ml-2"
              >
                닫기
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex-none px-6 py-4 border-t border-lithium-200 bg-white/95 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
