"""Cálculos do funil (funções puras, sem acesso a banco).

Regras da Proposta Individual de Solução (seções 2 e 8):
- tempo ativo = tempo na etapa sem segundo plano e sem ociosidade (calculado no tracker);
- estatística descritiva por etapa: média, mediana e desvio-padrão;
- anomalia: tempo ativo médio da JANELA RECENTE > mediana HISTÓRICA + 2 desvios-padrão.

Janela recente = as N sessões mais recentes (por início); histórico = todas as anteriores.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import StatisticsError, correlation, fmean, median, stdev

from .config import (ETAPAS, JANELA_PADRAO, K_DESVIOS, LIMITE_OVERHEAD_MS, MIN_BASELINE,
                     MIN_JANELA, TIMEOUT_EM_ANDAMENTO_S)

AVANCOS = ("avancou", "concluiu")
FINAIS = ("avancou", "concluiu", "abandonou")


@dataclass(frozen=True)
class Visita:
    sessao_id: str
    etapa: str
    ordem: int
    iniciada_em: datetime
    atualizada_em: datetime
    tempo_total_ms: int
    tempo_ativo_ms: int
    tempo_ocioso_ms: int
    tempo_oculto_ms: int
    resultado: str
    overhead_ms: float | None = None
    dispositivo: str = "desktop"
    cenario: str | None = None
    sintetica: bool = False


def agora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _r(valor, casas: int = 1):
    return None if valor is None else round(valor, casas)


def percentil(ordenados: list[float], p: float):
    """Percentil por interpolação linear (lista já ordenada)."""
    if not ordenados:
        return None
    pos = (len(ordenados) - 1) * p / 100
    i = int(pos)
    frac = pos - i
    if i + 1 < len(ordenados):
        return ordenados[i] + (ordenados[i + 1] - ordenados[i]) * frac
    return ordenados[i]


def estatisticas(valores: list[float]) -> dict:
    v = sorted(valores)
    n = len(v)
    if n == 0:
        return {"n": 0, "media": None, "mediana": None, "desvio": None, "p95": None,
                "minimo": None, "maximo": None}
    return {
        "n": n,
        "media": _r(fmean(v)),
        "mediana": _r(median(v)),
        "desvio": _r(stdev(v) if n > 1 else 0.0),
        "p95": _r(percentil(v, 95)),
        "minimo": v[0],
        "maximo": v[-1],
    }


def resultado_efetivo(v: Visita, agora: datetime, timeout_s: int = TIMEOUT_EM_ANDAMENTO_S) -> str:
    """Visita 'em_andamento' sem atualização por muito tempo é tratada como abandono."""
    if v.resultado == "em_andamento":
        return "abandonou" if (agora - v.atualizada_em).total_seconds() > timeout_s else "em_andamento"
    return v.resultado


def dividir_baseline_janela(visitas: list[Visita], janela: int) -> tuple[set[str], set[str]]:
    """Separa as sessões em (histórico, janela recente) pelo horário de início."""
    inicio: dict[str, datetime] = {}
    for v in visitas:
        if v.sessao_id not in inicio or v.iniciada_em < inicio[v.sessao_id]:
            inicio[v.sessao_id] = v.iniciada_em
    ordenadas = sorted(inicio, key=lambda s: (inicio[s], s))
    n_janela = max(0, min(janela, len(ordenadas)))
    corte = len(ordenadas) - n_janela
    return set(ordenadas[:corte]), set(ordenadas[corte:])


def avaliar_anomalia(base: list[float], atual: list[float], k: float = K_DESVIOS,
                     min_baseline: int = MIN_BASELINE, min_janela: int = MIN_JANELA) -> dict:
    """Anomalia se média(janela) > mediana(histórico) + k * desvio-padrão(histórico)."""
    saida = {
        "status": "dados_insuficientes",
        "n_historico": len(base),
        "n_janela": len(atual),
        "mediana_historica_ms": None,
        "desvio_historico_ms": None,
        "limiar_ms": None,
        "media_janela_ms": None,
        "desvios_acima_mediana": None,
    }
    if len(base) < max(min_baseline, 2) or len(atual) < min_janela:
        return saida
    med = median(base)
    dp = max(stdev(base), 1.0)  # piso de 1 ms evita limiar degenerado
    media = fmean(atual)
    limiar = med + k * dp
    saida.update(
        status="anomalia" if media > limiar else "normal",
        mediana_historica_ms=_r(med),
        desvio_historico_ms=_r(dp),
        limiar_ms=_r(limiar),
        media_janela_ms=_r(media),
        desvios_acima_mediana=_r((media - med) / dp, 2),
    )
    return saida


def relacao_tempo_abandono(pares: list[tuple[float, bool]]) -> dict:
    """Taxa de abandono por quartil de tempo ativo + correlação de Pearson (tempo × abandono)."""
    n = len(pares)
    saida = {"n": n, "pearson_r": None, "quartis": []}
    if n < 8:
        return saida
    xs = [p[0] for p in pares]
    ys = [1.0 if p[1] else 0.0 for p in pares]
    try:
        saida["pearson_r"] = _r(correlation(xs, ys), 3)
    except StatisticsError:  # entrada constante (ex.: ninguém abandona nesta etapa)
        saida["pearson_r"] = None
    ordenados = sorted(pares, key=lambda p: p[0])
    cortes = [round(i * n / 4) for i in range(5)]
    for q in range(4):
        fatia = ordenados[cortes[q]:cortes[q + 1]]
        if not fatia:
            continue
        abandonos = sum(1 for _, ab in fatia if ab)
        saida["quartis"].append({
            "faixa": f"Q{q + 1}",
            "de_ms": _r(fatia[0][0]),
            "ate_ms": _r(fatia[-1][0]),
            "n": len(fatia),
            "abandonos": abandonos,
            "taxa_abandono": _r(abandonos / len(fatia), 3),
        })
    return saida


def resumo_overhead(visitas: list[Visita], limite_ms: float = LIMITE_OVERHEAD_MS) -> dict:
    """Overhead medido pelo próprio tracker (apoio; a verificação oficial usa o DevTools Profiler)."""
    valores = sorted(v.overhead_ms for v in visitas if v.overhead_ms is not None)
    if not valores:
        return {"n": 0, "media_ms": None, "p95_ms": None, "maximo_ms": None,
                "limite_ms": limite_ms, "atende": None}
    p95 = percentil(valores, 95)
    return {
        "n": len(valores),
        "media_ms": _r(fmean(valores), 2),
        "p95_ms": _r(p95, 2),
        "maximo_ms": _r(valores[-1], 2),
        "limite_ms": limite_ms,
        "atende": p95 < limite_ms,
    }


def _status_sessoes(lista: list[tuple[Visita, str]], agora: datetime, timeout_s: int) -> dict[str, str]:
    por_sessao: dict[str, list[tuple[Visita, str]]] = defaultdict(list)
    for v, ef in lista:
        por_sessao[v.sessao_id].append((v, ef))
    status = {}
    for sid, itens in por_sessao.items():
        efs = [ef for _, ef in itens]
        if "concluiu" in efs:
            status[sid] = "concluida"
        elif "em_andamento" in efs:
            status[sid] = "em_andamento"
        elif "abandonou" in efs:
            status[sid] = "abandonada"
        else:  # só avanços, mas sem a visita seguinte registrada
            ultimo = max(v.atualizada_em for v, _ in itens)
            status[sid] = "abandonada" if (agora - ultimo).total_seconds() > timeout_s else "em_andamento"
    return status


def analisar_funil(visitas: list[Visita], *, agora: datetime | None = None,
                   janela: int = JANELA_PADRAO, k: float = K_DESVIOS,
                   min_baseline: int = MIN_BASELINE, min_janela: int = MIN_JANELA,
                   timeout_s: int = TIMEOUT_EM_ANDAMENTO_S) -> dict:
    agora = agora or agora_utc()
    lista = [(v, resultado_efetivo(v, agora, timeout_s)) for v in visitas]
    ids_base, ids_janela = dividir_baseline_janela(visitas, janela)

    status = _status_sessoes(lista, agora, timeout_s)
    contagem = defaultdict(int)
    for s in status.values():
        contagem[s] += 1
    total = len(status)
    encerradas = contagem["concluida"] + contagem["abandonada"]

    etapas_saida = []
    entradas_primeira = None
    for ordem, slug, nome in ETAPAS:
        da_etapa = [(v, ef) for v, ef in lista if v.etapa == slug]
        por_sessao: dict[str, list[str]] = defaultdict(list)
        for v, ef in da_etapa:
            por_sessao[v.sessao_id].append(ef)

        avancaram = abandonos = em_andamento = 0
        for efs in por_sessao.values():
            if any(e in AVANCOS for e in efs):
                avancaram += 1
            elif "abandonou" in efs:
                abandonos += 1
            else:
                em_andamento += 1
        entradas = len(por_sessao)
        if entradas_primeira is None:
            entradas_primeira = entradas
        decididas = avancaram + abandonos

        finalizadas = [v for v, ef in da_etapa if ef in FINAIS]
        base = [v.tempo_ativo_ms for v in finalizadas if v.sessao_id in ids_base]
        atual = [v.tempo_ativo_ms for v in finalizadas if v.sessao_id in ids_janela]
        pares = [(v.tempo_ativo_ms, ef == "abandonou") for v, ef in da_etapa if ef in FINAIS]

        etapas_saida.append({
            "ordem": ordem,
            "slug": slug,
            "nome": nome,
            "entradas": entradas,
            "avancaram": avancaram,
            "abandonos": abandonos,
            "em_andamento": em_andamento,
            "taxa_abandono": _r(abandonos / decididas, 4) if decididas else None,
            "conversao_acumulada": _r(entradas / entradas_primeira, 4) if entradas_primeira else None,
            "tempo_ativo": estatisticas([v.tempo_ativo_ms for v in finalizadas]),
            "tempo_ocioso_medio_ms": _r(fmean([v.tempo_ocioso_ms for v in finalizadas])) if finalizadas else None,
            "tempo_oculto_medio_ms": _r(fmean([v.tempo_oculto_ms for v in finalizadas])) if finalizadas else None,
            "anomalia": avaliar_anomalia(base, atual, k, min_baseline, min_janela),
            "relacao_tempo_abandono": relacao_tempo_abandono(pares),
        })

    comparaveis = [e for e in etapas_saida if e["anomalia"]["status"] != "dados_insuficientes"]
    maior = max(comparaveis, key=lambda e: e["anomalia"]["desvios_acima_mediana"], default=None)

    return {
        "atualizado_em": agora.isoformat() + "Z",
        "parametros": {"janela": janela, "k": k, "min_baseline": min_baseline, "min_janela": min_janela},
        "janela": {"sessoes_janela": len(ids_janela), "sessoes_historico": len(ids_base)},
        "totais": {
            "sessoes": total,
            "concluidas": contagem["concluida"],
            "abandonadas": contagem["abandonada"],
            "em_andamento": contagem["em_andamento"],
            "taxa_conclusao": _r(contagem["concluida"] / encerradas, 4) if encerradas else None,
            "taxa_abandono": _r(contagem["abandonada"] / encerradas, 4) if encerradas else None,
        },
        "etapas": etapas_saida,
        "alertas": [e["slug"] for e in etapas_saida if e["anomalia"]["status"] == "anomalia"],
        "etapa_maior_desvio": maior["slug"] if maior else None,
        "overhead": resumo_overhead(visitas),
    }
