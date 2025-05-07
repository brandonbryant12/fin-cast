import './style.css';
import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { env } from '@/env';
import { createRouter } from '@/router';

const ROOT_ELEMENT_ID = 'app';

const rootElement = document.getElementById(ROOT_ELEMENT_ID);

if (!rootElement) {
  throw new Error(`Root element with ID '${ROOT_ELEMENT_ID}' not found.`);
}

const router = createRouter();

// Function to set document title
const SetDocumentTitle = () => {
  useEffect(() => {
    document.title = env.PUBLIC_APP_NAME;
  }, []);
  return null; // This component doesn't render anything itself
};


if (!rootElement.innerHTML) {
 const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        themes={['light', 'dark']}
        enableSystem
        disableTransitionOnChange
      >
       <SetDocumentTitle />
       <RouterProvider router={router} />
      </ThemeProvider>
     </React.StrictMode>,
  );
}