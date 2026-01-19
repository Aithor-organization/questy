/**
 * Toast Component
 * 범용 토스트 알림 UI
 */

import { useToastStore, type Toast as ToastType } from '../stores/toastStore';

const iconMap: Record<ToastType['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const colorMap: Record<ToastType['type'], string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColorMap: Record<ToastType['type'], string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-3 rounded-xl border shadow-lg
            animate-toast-in ${colorMap[toast.type]}
          `}
        >
          <div
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              text-white text-sm flex-shrink-0 ${iconColorMap[toast.type]}
            `}
          >
            {iconMap[toast.type]}
          </div>

          <p className="flex-1 text-sm font-medium">{toast.message}</p>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      ))}

      <style>{`
        @keyframes toast-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
