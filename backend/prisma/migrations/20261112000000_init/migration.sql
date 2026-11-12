-- CreateTable
CREATE TABLE "etapas" (
    "id" SERIAL NOT NULL,
    "ordem" INTEGER NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desfechos_catalogo" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(40) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "exige_motivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "desfechos_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motivos_desistencia" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(60) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "categoria" VARCHAR(60) NOT NULL,

    CONSTRAINT "motivos_desistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" SERIAL NOT NULL,
    "uuid_externo" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'em_andamento',
    "etapa_atual_ordem" INTEGER NOT NULL DEFAULT 1,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMPTZ(3),
    "tempo_total_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_ativo_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_pausa_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_espera_oficina_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_ocioso_ms" INTEGER NOT NULL DEFAULT 0,
    "desfecho_codigo" VARCHAR(40),
    "motivo_desistencia_codigo" VARCHAR(60),
    "dispositivo" VARCHAR(40) NOT NULL DEFAULT 'tablet',
    "cenario" VARCHAR(80),
    "sintetica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitas_etapa" (
    "id" SERIAL NOT NULL,
    "visita_id" VARCHAR(120) NOT NULL,
    "atendimento_id" INTEGER NOT NULL,
    "etapa_id" INTEGER NOT NULL,
    "etapa_slug" VARCHAR(80) NOT NULL,
    "ordem" INTEGER NOT NULL,
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMPTZ(3),
    "tempo_total_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_ativo_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_pausa_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_espera_oficina_ms" INTEGER NOT NULL DEFAULT 0,
    "tempo_ocioso_ms" INTEGER NOT NULL DEFAULT 0,
    "resultado" VARCHAR(32) NOT NULL DEFAULT 'em_andamento',
    "overhead_ms" DOUBLE PRECISION,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "visitas_etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_telemetria" (
    "id" SERIAL NOT NULL,
    "evento_id" VARCHAR(120) NOT NULL,
    "atendimento_id" INTEGER NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "etapa_ordem" INTEGER NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload_seguro" JSONB,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "eventos_telemetria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pausas_operacionais" (
    "id" SERIAL NOT NULL,
    "pausa_id" VARCHAR(120) NOT NULL,
    "atendimento_id" INTEGER NOT NULL,
    "etapa_ordem" INTEGER NOT NULL,
    "motivo_codigo" VARCHAR(60) NOT NULL,
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMPTZ(3),
    "duracao_ms" INTEGER NOT NULL DEFAULT 0,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pausas_operacionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esperas_oficina" (
    "id" SERIAL NOT NULL,
    "espera_id" VARCHAR(120) NOT NULL,
    "atendimento_id" INTEGER NOT NULL,
    "etapa_ordem" INTEGER NOT NULL,
    "motivo_codigo" VARCHAR(60) NOT NULL,
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMPTZ(3),
    "duracao_ms" INTEGER NOT NULL DEFAULT 0,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "esperas_oficina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucoes_simulacao" (
    "id" SERIAL NOT NULL,
    "semente" INTEGER NOT NULL,
    "total_sessoes" INTEGER NOT NULL,
    "regulares" INTEGER NOT NULL,
    "anomalas" INTEGER NOT NULL,
    "etapa_anomalia" INTEGER NOT NULL,
    "precisao" DOUBLE PRECISION NOT NULL,
    "revocacao" DOUBLE PRECISION NOT NULL,
    "falsos_positivos" INTEGER NOT NULL,
    "detalhes_json" JSONB NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execucoes_simulacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_estatisticas" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "janela_padrao" INTEGER NOT NULL DEFAULT 20,
    "k_desvios" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "min_baseline" INTEGER NOT NULL DEFAULT 10,
    "min_janela" INTEGER NOT NULL DEFAULT 3,
    "timeout_abandono_s" INTEGER NOT NULL DEFAULT 1800,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_estatisticas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etapas_ordem_key" ON "etapas"("ordem");
CREATE UNIQUE INDEX "etapas_slug_key" ON "etapas"("slug");
CREATE UNIQUE INDEX "desfechos_catalogo_codigo_key" ON "desfechos_catalogo"("codigo");
CREATE UNIQUE INDEX "motivos_desistencia_codigo_key" ON "motivos_desistencia"("codigo");
CREATE UNIQUE INDEX "atendimentos_uuid_externo_key" ON "atendimentos"("uuid_externo");
CREATE INDEX "atendimentos_sintetica_iniciado_em_idx" ON "atendimentos"("sintetica", "iniciado_em");
CREATE INDEX "atendimentos_status_idx" ON "atendimentos"("status");
CREATE INDEX "atendimentos_desfecho_codigo_idx" ON "atendimentos"("desfecho_codigo");
CREATE UNIQUE INDEX "visitas_etapa_visita_id_key" ON "visitas_etapa"("visita_id");
CREATE INDEX "visitas_etapa_atendimento_id_ordem_idx" ON "visitas_etapa"("atendimento_id", "ordem");
CREATE INDEX "visitas_etapa_sintetica_etapa_slug_iniciada_em_idx" ON "visitas_etapa"("sintetica", "etapa_slug", "iniciada_em");
CREATE UNIQUE INDEX "eventos_telemetria_evento_id_key" ON "eventos_telemetria"("evento_id");
CREATE INDEX "eventos_telemetria_atendimento_id_ocorrido_em_idx" ON "eventos_telemetria"("atendimento_id", "ocorrido_em");
CREATE INDEX "eventos_telemetria_sintetica_tipo_idx" ON "eventos_telemetria"("sintetica", "tipo");
CREATE UNIQUE INDEX "pausas_operacionais_pausa_id_key" ON "pausas_operacionais"("pausa_id");
CREATE INDEX "pausas_operacionais_atendimento_id_iniciada_em_idx" ON "pausas_operacionais"("atendimento_id", "iniciada_em");
CREATE INDEX "pausas_operacionais_sintetica_idx" ON "pausas_operacionais"("sintetica");
CREATE UNIQUE INDEX "esperas_oficina_espera_id_key" ON "esperas_oficina"("espera_id");
CREATE INDEX "esperas_oficina_atendimento_id_iniciada_em_idx" ON "esperas_oficina"("atendimento_id", "iniciada_em");
CREATE INDEX "esperas_oficina_sintetica_idx" ON "esperas_oficina"("sintetica");

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_desfecho_codigo_fkey" FOREIGN KEY ("desfecho_codigo") REFERENCES "desfechos_catalogo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_motivo_desistencia_codigo_fkey" FOREIGN KEY ("motivo_desistencia_codigo") REFERENCES "motivos_desistencia"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visitas_etapa" ADD CONSTRAINT "visitas_etapa_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visitas_etapa" ADD CONSTRAINT "visitas_etapa_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "etapas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos_telemetria" ADD CONSTRAINT "eventos_telemetria_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pausas_operacionais" ADD CONSTRAINT "pausas_operacionais_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "esperas_oficina" ADD CONSTRAINT "esperas_oficina_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
