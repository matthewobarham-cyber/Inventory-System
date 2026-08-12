import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';
import './web-styles.css';
import App from './App.jsx';
import RendererErrorBoundary from './RendererErrorBoundary.jsx';

document.documentElement.dataset.appPlatform = 'web';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RendererErrorBoundary><App /></RendererErrorBoundary>
  </React.StrictMode>
);
