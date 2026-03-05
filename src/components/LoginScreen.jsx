import { useState, useRef, useEffect } from 'react';

/**
 * LoginScreen — Matrix authentication with homeserver auto-detection.
 *
 * Default homeserver: matrix.org
 * Auto-detects server from @user:server format.
 * Links to Element for account creation.
 */
export default function LoginScreen({ onLogin }) {
  const [homeserver, setHomeserver] = useState('matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Auto-detect homeserver from username
  const effectiveHs = (() => {
    const userHost = username.includes(':') ? username.split(':').slice(1).join(':') : '';
    return userHost || homeserver;
  })();

  // Spinning dodecahedron animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 200;
    const h = canvas.height = 200;
    let frame = 0;
    let running = true;

    const phi = (1 + Math.sqrt(5)) / 2;
    const verts3d = [
      [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],
      [-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
      [0,phi,1/phi],[0,phi,-1/phi],[0,-phi,1/phi],[0,-phi,-1/phi],
      [1/phi,0,phi],[1/phi,0,-phi],[-1/phi,0,phi],[-1/phi,0,-phi],
      [phi,1/phi,0],[phi,-1/phi,0],[-phi,1/phi,0],[-phi,-1/phi,0],
    ];

    const edges = [
      [0,8],[0,12],[0,16],[8,4],[8,1],[12,2],[12,14],[16,17],[16,1],
      [4,14],[4,18],[1,9],[1,13],[2,17],[2,10],[14,6],[18,19],[18,5],
      [9,5],[9,8],[13,3],[13,15],[17,3],[10,6],[10,11],[6,19],
      [5,15],[19,7],[15,7],[3,11],[11,7],
    ];

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const t = frame * 0.008;
      const cosA = Math.cos(t), sinA = Math.sin(t);
      const cosB = Math.cos(t * 0.7), sinB = Math.sin(t * 0.7);

      const projected = verts3d.map(([x, y, z]) => {
        let x1 = x * cosA - z * sinA;
        let z1 = x * sinA + z * cosA;
        let y1 = y * cosB - z1 * sinB;
        let z2 = y * sinB + z1 * cosB;
        const scale = 38 / (3 + z2 * 0.3);
        return [w/2 + x1 * scale, h/2 + y1 * scale, z2];
      });

      const goldColor = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#c9a352';
      ctx.strokeStyle = goldColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(projected[a][0], projected[a][1]);
        ctx.lineTo(projected[b][0], projected[b][1]);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = goldColor;
      for (const [px, py] of projected) {
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      frame++;
      requestAnimationFrame(draw);
    }

    draw();
    return () => { running = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(effectiveHs, username, password);
    } catch (err) {
      const msg = err.data?.error || err.message || 'Login failed';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <canvas ref={canvasRef} style={{ marginBottom: 24 }} />
      <div className="login-brand">Khora</div>
      <div className="login-subtitle">
        Sovereign Case Management
      </div>

      <div className="login-card">
        <h2>Sign in</h2>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 16, lineHeight: 1.5 }}>
          Khora is built on the Matrix network — the same encrypted platform that
          powers Element. Sign in with your Matrix account.
        </p>

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6,
            background: 'var(--red-dim, #3a1c1c)', color: 'var(--red, #e55)', fontSize: 12,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:matrix.org"
              autoComplete="username"
            />
            {username.includes(':') && (
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>
                Server detected: {effectiveHs}
              </div>
            )}
          </div>
          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>

          {/* Advanced: custom homeserver */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: 'none', color: 'var(--tx-3)',
              fontSize: 11, cursor: 'pointer', padding: '4px 0', marginBottom: 4,
            }}
          >
            {showAdvanced ? '▾ Hide advanced' : '▸ Advanced: custom homeserver'}
          </button>

          {showAdvanced && (
            <div className="field-group">
              <label>Homeserver</label>
              <input
                type="text"
                value={homeserver}
                onChange={(e) => setHomeserver(e.target.value)}
                placeholder="matrix.org"
              />
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>
                Override auto-detection. Use any Matrix homeserver you trust.
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !username || !password}
            style={{ width: '100%', padding: '12px', marginTop: 8 }}
          >
            {loading ? 'Connecting...' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 12, color: 'var(--tx-3)' }}>
          Don't have an account?
        </div>

        <a
          href="https://app.element.io/#/register"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ width: '100%', padding: '12px', display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          Create account on Element
        </a>

        <div className="login-footer">
          Data sovereign. Matrix-native. Your keys, your data.
        </div>
      </div>
    </div>
  );
}
