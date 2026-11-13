import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './context/SessionContext';
import { UiProvider } from './components/ui';
import App from './App';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 2 && !(err?.status >= 400 && err?.status < 500),
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <UiProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </UiProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
