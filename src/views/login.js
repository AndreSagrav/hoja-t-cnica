import { LOGO_DATA_URL } from '../assets/logo.js';
import { toast } from '../lib/utils.js';
import { signInDemo } from '../lib/auth.js';

export function loginView() {
  const root = document.getElementById('app');

  root.innerHTML = `
    <div class="login-shell" style="background:var(--navy-deep);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;height:100vh;">
      
      <!-- Orbes decorativos animados -->
      <div style="position:absolute;top:-15%;right:-10%;width:45vw;height:45vw;border-radius:50%;background:radial-gradient(circle,rgba(0,194,168,0.06) 0%,transparent 70%);pointer-events:none;animation:floatOrb1 8s ease-in-out infinite;"></div>
      <div style="position:absolute;bottom:-15%;left:-8%;width:35vw;height:35vw;border-radius:50%;background:radial-gradient(circle,rgba(26,79,160,0.08) 0%,transparent 70%);pointer-events:none;animation:floatOrb2 10s ease-in-out infinite;"></div>
      <div style="position:absolute;top:40%;left:50%;width:25vw;height:25vw;border-radius:50%;background:radial-gradient(circle,rgba(0,194,168,0.03) 0%,transparent 70%);pointer-events:none;animation:floatOrb3 12s ease-in-out infinite;"></div>

      <style>
        @keyframes floatOrb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} }
        @keyframes floatOrb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,-25px)} }
        @keyframes floatOrb3 { 0%,100%{transform:translate(-50%,0)} 50%{transform:translate(-50%,20px)} }
        @keyframes loginCardIn { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      </style>

      <div style="width:100%;max-width:420px;background:var(--surface);border-radius:var(--r-xl);padding:44px 36px;box-shadow:var(--shadow-xl);position:relative;z-index:1;margin:20px;animation:loginCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1);">
        
        <div style="display:flex;justify-content:center;margin-bottom:36px;">
          <div style="background:linear-gradient(135deg,#0b244e 0%,#0d3266 50%,#0f3d8a 100%);border-radius:16px;padding:18px 28px;box-shadow:0 8px 28px rgba(11,36,78,0.18);">
            <img src="${LOGO_DATA_URL}" alt="INNOVIO" style="max-width:170px;height:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.15));" />
          </div>
        </div>

        <h2 style="font-size:var(--fs-xl);font-weight:var(--fw-extrabold);color:var(--text);margin:0 0 8px;text-align:center;letter-spacing:-0.02em;">Bienvenido de vuelta</h2>
        <p style="color:var(--text-soft);font-size:var(--fs-sm);text-align:center;margin:0 0 32px;line-height:var(--lh-relaxed);">Ingresá tus credenciales para acceder al sistema</p>
        
        <div style="display:flex;flex-direction:column;gap:20px;margin-bottom:28px;">
          <div class="field">
            <label class="field-label" style="color:var(--text-mid);font-weight:600;">Correo electrónico</label>
            <div style="position:relative;">
              <svg width="16" height="16" fill="none" stroke="var(--text-soft)" viewBox="0 0 24 24" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:0.6;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <input id="email" class="input" type="email" value="innoviocr@outlook.com" placeholder="usuario@correo.com" style="height:46px;font-size:var(--fs-base);border-radius:var(--r-md);padding-left:42px;" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" style="color:var(--text-mid);font-weight:600;">Contraseña</label>
            <div style="position:relative;">
              <svg width="16" height="16" fill="none" stroke="var(--text-soft)" viewBox="0 0 24 24" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:0.6;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <input id="pass" class="input" type="password" value="••••••••••••" placeholder="••••••••" style="height:46px;font-size:var(--fs-base);border-radius:var(--r-md);padding-left:42px;" />
            </div>
          </div>
        </div>

        <button class="btn btn-accent" id="btn-login" style="width:100%;height:48px;font-size:var(--fs-base);font-weight:var(--fw-bold);border-radius:var(--r-md);box-shadow:0 4px 16px rgba(0,194,168,0.3);letter-spacing:0.01em;">
          Entrar al Sistema
        </button>

        <p style="text-align:center;margin-top:24px;font-size:var(--fs-xs);color:var(--text-soft);">
          Sistema de Gestión Industrial <span style="opacity:0.5;">•</span> v2.0
        </p>
      </div>
    </div>
  `;

  document.getElementById('btn-login').addEventListener('click', async () => {
    toast('¡Bienvenido de nuevo!', 'success');
    signInDemo();
    window.location.hash = '/dashboard';
  });
}