export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

export function formatClockMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function labelDesfecho(codigo: string | null | undefined): string {
  switch (codigo) {
    case 'convertido':
      return 'Convertido';
    case 'desistiu':
      return 'Desistiu';
    case 'nao_fechou':
      return 'Não fechou';
    case 'interrompido':
      return 'Interrompido';
    default:
      return codigo ?? 'Em andamento';
  }
}
