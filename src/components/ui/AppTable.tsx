import React from 'react';
import { cn } from '../../lib/utils';

export function AppTable({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm text-left border-collapse", className)} {...props} />
    </div>
  );
}

export function AppTableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-lithium-50 text-xs font-bold text-text-muted border-b border-lithium-200 sticky top-0 z-10", className)} {...props} />;
}

export function AppTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0 bg-white", className)} {...props} />;
}

export function AppTableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-lithium-100 transition-colors hover:bg-lithium-50/50 data-[state=selected]:bg-lithium-50",
        className
      )}
      {...props}
    />
  );
}

export function AppTableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left align-middle font-bold whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function AppTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("p-4 align-middle font-medium", className)}
      {...props}
    />
  );
}
