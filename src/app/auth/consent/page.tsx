import { Suspense } from 'react';
import ConsentView from '@/pages/ConsentPage';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function ConsentRoute() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ConsentView />
    </Suspense>
  );
}
