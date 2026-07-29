import { ensureShell } from '../components/shell.js';

export async function asistenteOTView() {
  const shell = ensureShell('/asistente-ot');
  shell.setTitle('Asistente Nueva OT');
  shell.setActions('');
  shell.content().innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-soft);">Redirigiendo al asistente inteligente...</div>';
  setTimeout(() => { window.location.hash = '/documentos/nuevo/orden'; }, 300);
}