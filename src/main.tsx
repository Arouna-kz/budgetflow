// main.tsx
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { GlobalNotificationProvider } from './contexts/GlobalNotificationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalNotificationProvider>
      <App />
    </GlobalNotificationProvider>
  </StrictMode>
);



// import { StrictMode } from 'react';
// import { createRoot } from 'react-dom/client';
// import App from './App.tsx';
// import './index.css';
// import { NotificationProvider } from './contexts/NotificationContext';
// import { GlobalNotificationContext } from './contexts/GlobalNotificationContext';

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <GlobalNotificationContext>
//       <App />
//     </GlobalNotificationContext>
//   </StrictMode>
// );


// import { StrictMode } from 'react';
// import { createRoot } from 'react-dom/client';
// import App from './App.tsx';
// import './index.css';
// import { NotificationProvider } from './contexts/NotificationContext';

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>
// );

