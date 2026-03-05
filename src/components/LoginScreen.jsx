import { useState, useRef, useEffect } from 'react';

/**
 * LoginScreen — welcome + login with spinning dodecahedron.
 *
 * In demo mode, accepts any credentials and enters the app.
 */
export default function LoginScreen({ onLogin }) {
  const [homeserver, setHomeserver] = useState('https://matrix.khora.us');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  // Spinning dodecahedron animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 200;
    const h = canvas.height = 200;
    let frame = 0;
    let running = true;

    // Dodecahedron vertices (projected to 2D)
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
        // Rotate Y then X
        let x1 = x * cosA - z * sinA;
        let z1 = x * sinA + z * cosA;
        let y1 = y * cosB - z1 * sinB;
        let z2 = y * sinB + z1 * cosB;
        const scale = 38 / (3 + z2 * 0.3);
        return [w/2 + x1 * scale, h/2 + y1 * scale, z2];
      });

      // Draw edges
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

      // Draw vertices
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    // Demo mode — accept any credentials
    setTimeout(() => {
      onLogin({
        userId: username ? `@${username}:khora.us` : '@demo:khora.us',
        homeserver,
        role: 'provider',
      });
    }, 600);
  };

  const handleDemoLogin = () => {
    setLoading(true);
    setTimeout(() => {
      onLogin({
        userId: '@demo:khora.us',
        homeserver: 'https://matrix.khora.us',
        role: 'provider',
      });
    }, 400);
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
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label>Homeserver</label>
            <input
              type="text"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="https://matrix.example.com"
            />
          </div>
          <div className="field-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:server"
            />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: 8 }}
          >
            {loading ? 'Connecting...' : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '16px 0 8px', fontSize: 12, color: 'var(--tx-3)' }}>
          or
        </div>

        <button
          onClick={handleDemoLogin}
          className="btn-ghost"
          disabled={loading}
          style={{ width: '100%', padding: '12px' }}
        >
          Enter Demo Mode
        </button>

        <div className="login-footer">
          Data sovereign. Matrix-native. Your keys, your data.
        </div>
      </div>
    </div>
  );
}
