import React from 'react';

const INVENTORY_WEB_POSITIONS_KEY = 'msbm.inventoryWebNodePositions.v1';

export default class RendererErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, details) {
    console.error('Workspace renderer failed', error, details);
  }

  retry = () => window.location.reload();

  resetLayout = () => {
    try { localStorage.removeItem(INVENTORY_WEB_POSITIONS_KEY); } catch { /* Continue with reload if storage is restricted. */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="renderer-recovery-screen" role="alert">
      <section>
        <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" />
        <small>Workspace recovery</small>
        <h1>The inventory workspace could not finish loading</h1>
        <p>Your inventory data has not been deleted. Reload the renderer, or reset only the saved inventory-map bubble positions if a stored layout caused the problem.</p>
        <code>{this.state.error?.message || 'Unexpected renderer error'}</code>
        <div><button type="button" onClick={this.retry}>Reload workspace</button><button type="button" className="primary" onClick={this.resetLayout}>Reset map layout and reload</button></div>
      </section>
    </main>;
  }
}
