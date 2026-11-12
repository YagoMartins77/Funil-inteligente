import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrcamentadorPage } from '../pages/orcamentador/OrcamentadorPage';

const mockEtapas = [
  { id: 1, ordem: 1, slug: 'acolhimento', nome: 'Acolhimento', descricao: 'Etapa 1', ativa: true },
  { id: 2, ordem: 2, slug: 'diagnostico', nome: 'Diagnóstico Técnico', descricao: 'Etapa 2', ativa: true },
  { id: 3, ordem: 3, slug: 'cotacao', nome: 'Cotação e Estoque', descricao: 'Etapa 3', ativa: true },
  { id: 4, ordem: 4, slug: 'apresentacao', nome: 'Apresentação do Orçamento', descricao: 'Etapa 4', ativa: true },
  { id: 5, ordem: 5, slug: 'fechamento', nome: 'Fechamento', descricao: 'Etapa 5', ativa: true },
];

const mockDesfechos = [
  { id: 1, codigo: 'convertido', nome: 'Orçamento convertido', exigeMotivo: false },
  { id: 2, codigo: 'desistiu', nome: 'Cliente desistiu', exigeMotivo: true },
];

const mockMotivos = [
  { id: 1, codigo: 'preco_acima_esperado', nome: 'Preço acima do esperado', categoria: 'comercial' },
];

describe('Orçamentador Tablet FASTCAR (5 Etapas)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.endsWith('/etapas')) {
          return new Response(JSON.stringify(mockEtapas), { status: 200 });
        }
        if (path.endsWith('/desfechos')) {
          return new Response(JSON.stringify(mockDesfechos), { status: 200 });
        }
        if (path.endsWith('/desfechos/motivos')) {
          return new Response(JSON.stringify(mockMotivos), { status: 200 });
        }
        if (path.endsWith('/atendimentos') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({ id: 77, uuidExterno: 'u-77', status: 'em_andamento', etapaAtualOrdem: 1 }),
            { status: 201 },
          );
        }
        if (path.includes('/atendimentos/77') && (!init || !init.method || init.method === 'GET')) {
          return new Response(
            JSON.stringify({ id: 77, status: 'em_andamento', etapaAtualOrdem: 1 }),
            { status: 200 },
          );
        }
        if (path.includes('/pausas/iniciar') || path.includes('/espera-oficina/iniciar')) {
          return new Response(JSON.stringify({ id: 1, duracaoMs: 0 }), { status: 201 });
        }
        if (path.includes('/pausas/finalizar') || path.includes('/espera-oficina/finalizar')) {
          return new Response(JSON.stringify({ id: 1, duracaoMs: 5000 }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true, id: 77 }), { status: 200 });
      }),
    );
  });

  it('inicia atendimento, navega entre etapas, registra pausa, espera da oficina e desfecho', async () => {
    render(
      <MemoryRouter>
        <OrcamentadorPage />
      </MemoryRouter>,
    );

    const btnIniciar = await screen.findByText(/Iniciar Novo Atendimento/i);
    fireEvent.click(btnIniciar);

    expect(await screen.findByText(/ID #77/i)).toBeInTheDocument();
    expect(screen.getByText(/ETAPA 1 DE 5/i)).toBeInTheDocument();

    // Avança para etapa 2
    fireEvent.click(screen.getByText(/Avançar para Etapa 2/i));
    expect(await screen.findByText(/ETAPA 2 DE 5/i)).toBeInTheDocument();

    // Inicia e finaliza pausa operacional
    fireEvent.click(screen.getByText(/Pausa Operacional/i));
    fireEvent.click(await screen.findByText(/Busca física de peça no estoque/i));
    expect(await screen.findByText(/Pausa Operacional em Andamento/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Retomar Atendimento/i));

    // Inicia e finaliza espera da oficina
    fireEvent.click(await screen.findByText(/Espera da Oficina/i));
    fireEvent.click(await screen.findByText(/Compatibilidade elétrica/i));
    expect(await screen.findByText(/Oficina Respondeu/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Oficina Respondeu/i));

    // Encerra com desistência e motivo fechado
    fireEvent.click(await screen.findByText(/Encerrar \/ Desistência/i));
    fireEvent.click(await screen.findByText(/Cliente desistiu/i));
    fireEvent.click(await screen.findByText(/Preço acima do esperado/i));

    await waitFor(() => {
      expect(screen.getByText(/Atendimento #77 encerrado/i)).toBeInTheDocument();
    });
  });

  it('recupera sessão ativa do localStorage após atualização da página', async () => {
    localStorage.setItem(
      'fastcar_orcamentador_sessao_v1',
      JSON.stringify({
        atendimentoId: 77,
        uuidExterno: 'u-77',
        etapaOrdem: 3,
        etapaIniciadaEmMs: Date.now() - 5000,
        visitaId: 'u-77:e3',
        emPausa: false,
        emEsperaOficina: false,
        pausaId: null,
        pausaIniciadaEmMs: null,
        esperaId: null,
        esperaIniciadaEmMs: null,
        acumuladoPausaEtapaMs: 0,
        acumuladoEsperaEtapaMs: 0,
        acumuladoOciosoEtapaMs: 0,
      }),
    );

    render(
      <MemoryRouter>
        <OrcamentadorPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/ETAPA 3 DE 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Atendimento #77 recuperado automaticamente/i)).toBeInTheDocument();
  });
});
