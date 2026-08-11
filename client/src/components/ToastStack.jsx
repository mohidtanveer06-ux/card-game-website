import { useEffect } from 'react';

export default function ToastStack({ toasts, onDismiss }) {
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type || ''}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
