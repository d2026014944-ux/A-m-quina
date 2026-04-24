import { useEffect, useMemo, useRef, useState } from "react";
import { TextNeuralNetwork } from "./NeuralNetwork";
import { createBinauralPIController } from "./dynamics/controller";
import {
  assertClosedLoopGate,
  runClosedLoopSimulation,
} from "./dynamics/closedLoop";
import {
  buildBinauralStateSpacePlant,
  propagatePlantState,
} from "./dynamics/plantModel";

const SCHUMANN_BEAT_HZ = 7.83;
const GOLD = "#F5C118";
const GREEN = "#72D672";
const PANEL_BG = "#111";
const DYNAMICS_DT = 0.02;
const DYNAMICS_LAMBDA = 8;
const TRACKING_STEPS = 10;

const SYNAPTIC_NODES = [
  { id: "N1", label: "N1 - Entrada Sensorial" },
  { id: "N2", label: "N2 - Associacao Lateral" },
  { id: "N3", label: "N3 - Integrador de Contexto" },
  { id: "N4", label: "N4 - Saida Cognitiva" },
];

function SliderControl({ label, value, min, max, step, onChange, suffix }) {
  return (
    <label style={{ display: "block", color: "#ddd", fontSize: 14 }}>
      <div style={{ marginBottom: 6 }}>
        {label}: <strong style={{ color: GOLD }}>{value.toFixed(2)}</strong>
        {suffix}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function drawIdleSpectrum(ctx, width, height) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, width, height);

  const barCount = 24;
  const gap = 4;
  const barWidth = (width - gap * (barCount + 1)) / barCount;

  for (let i = 0; i < barCount; i += 1) {
    const phase = Math.sin((i / barCount) * Math.PI * 2);
    const barHeight = 16 + Math.abs(phase) * (height * 0.35);
    const x = gap + i * (barWidth + gap);
    const y = height - barHeight - 8;
    ctx.fillStyle = "#2f2f2f";
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

function NeuralNetworkSection() {
  const [network, setNetwork] = useState(null);
  const networkRef = useRef(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [hasTrained, setHasTrained] = useState(false);
  const [status, setStatus] = useState("Pronto para iniciar pipeline E1.");
  const [pipelineStats, setPipelineStats] = useState(null);
  const [bookPreview, setBookPreview] = useState([]);

  const [ioInput, setIoInput] = useState("status do pipe E1 para o nó selecionado");
  const [ioOutput, setIoOutput] = useState("");
  const [tcpChunk, setTcpChunk] = useState("chunk tcp externo: sinal textual em alta saturacao");

  const [nodeId, setNodeId] = useState(SYNAPTIC_NODES[0].id);
  const [rho, setRho] = useState(1000);
  const [weightIn, setWeightIn] = useState(0.5);
  const [weightOut, setWeightOut] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef(null);
  const audioRef = useRef({ graph: null });
  const dynamicsRef = useRef(null);
  const trackedFrequenciesRef = useRef([0, 0]);
  const [trackedFrequencies, setTrackedFrequencies] = useState([0, 0]);
  const [gateStatus, setGateStatus] = useState("Gate de malha fechada pendente.");

  const baseFrequency = useMemo(() => {
    const normalizedRho = Math.max(rho, 1);
    return 432 / Math.sqrt(normalizedRho / 1000);
  }, [rho]);

  const leftFrequency = useMemo(
    () => Math.max(18, baseFrequency - SCHUMANN_BEAT_HZ / 2),
    [baseFrequency]
  );

  const rightFrequency = useMemo(
    () => baseFrequency + SCHUMANN_BEAT_HZ / 2,
    [baseFrequency]
  );

  const ensureDynamics = () => {
    if (!dynamicsRef.current) {
      const plant = buildBinauralStateSpacePlant({
        lambda: DYNAMICS_LAMBDA,
        dt: DYNAMICS_DT,
      });
      const controller = createBinauralPIController({
        dt: DYNAMICS_DT,
        kp: [0.85, 0.85],
        ki: [1.8, 1.8],
        outputBounds: [18, 880],
      });

      const initialState = [leftFrequency, rightFrequency];
      dynamicsRef.current = { plant, controller, state: initialState };
      trackedFrequenciesRef.current = initialState;
      setTrackedFrequencies(initialState);
    }

    return dynamicsRef.current;
  };

  const stepFrequencyTracking = (reference) => {
    const dynamics = ensureDynamics();
    let state = [...dynamics.state];

    for (let i = 0; i < TRACKING_STEPS; i += 1) {
      const command = dynamics.controller.step(reference, state);
      state = propagatePlantState(dynamics.plant, state, command);
    }

    dynamics.state = state;
    trackedFrequenciesRef.current = state;
    setTrackedFrequencies(state);
    return state;
  };

  const evaluateClosedLoopGate = (reference) => {
    try {
      const plant = buildBinauralStateSpacePlant({
        lambda: DYNAMICS_LAMBDA,
        dt: DYNAMICS_DT,
      });
      const controller = createBinauralPIController({
        dt: DYNAMICS_DT,
        kp: [0.85, 0.85],
        ki: [1.8, 1.8],
        outputBounds: [18, 880],
      });

      const report = runClosedLoopSimulation({
        plant,
        controller,
        initialState: [
          Math.max(18, reference[0] - 36),
          Math.max(18, reference[1] - 36),
        ],
        reference,
        steps: 160,
        maxIterations: 500,
        timeoutMs: 250,
        errorThresholdHz: 1,
      });

      assertClosedLoopGate(report);
      setGateStatus(
        `Gate OK | erro final L=${report.finalAbsError[0].toFixed(2)}Hz R=${report.finalAbsError[1].toFixed(2)}Hz`
      );
    } catch (error) {
      setGateStatus(`Gate FAIL | ${error.message}`);
    }
  };

  const initializePipeline = async () => {
    setIsInitializing(true);
    setIoOutput("");
    try {
      const nextNetwork = new TextNeuralNetwork();
      const stats = await nextNetwork.initialize((message) => setStatus(message));

      if (networkRef.current) networkRef.current.dispose();
      networkRef.current = nextNetwork;
      setNetwork(nextNetwork);

      setPipelineStats(stats);
      setBookPreview(nextNetwork.getManifestBooks().slice(0, 6));
      setHasTrained(false);
      setStatus("Pipeline E1 pronto. LSTM aguardando treino com livros-probabilidade.");
    } catch (error) {
      setStatus(`Falha na inicializacao: ${error.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const trainNetwork = async () => {
    if (!networkRef.current) {
      setStatus("Inicialize o pipeline antes de treinar.");
      return;
    }

    setIsTraining(true);
    try {
      await networkRef.current.train((epoch, totalEpochs, logs) => {
        setStatus(
          `Treino LSTM: epoca ${epoch}/${totalEpochs} | loss ${logs.loss.toFixed(4)} | acc ${(logs.accuracy * 100).toFixed(2)}%`
        );
      });

      setHasTrained(true);
      setStatus("Treino concluido. Aplicacao I/O pronta para respostas.");
      setPipelineStats(networkRef.current.getPipelineStats());
    } catch (error) {
      setStatus(`Erro no treino: ${error.message}`);
    } finally {
      setIsTraining(false);
    }
  };

  const injectTcpStimulus = () => {
    if (!networkRef.current) {
      setStatus("Inicialize o pipeline para aceitar chunk TCP.");
      return;
    }

    const injected = networkRef.current.injectTcpChunk(tcpChunk);
    if (!injected) {
      setStatus("Chunk TCP vazio ou invalido.");
      return;
    }

    setPipelineStats(networkRef.current.getPipelineStats());
    setStatus(`Chunk TCP aceito: ${injected.sourceId} | checksum ${injected.checksum}`);
  };

  const generateIoResponse = () => {
    if (!networkRef.current) {
      setStatus("Inicialize o pipeline antes de gerar resposta I/O.");
      return;
    }

    try {
      const [trackedLeft, trackedRight] = trackedFrequenciesRef.current;
      const result = networkRef.current.generateIOResponse(ioInput, {
        nodeId,
        rho,
        weightIn,
        weightOut,
        leftHz: trackedLeft || leftFrequency,
        rightHz: trackedRight || rightFrequency,
      });

      const responseText = [
        `[I/O RESPONSE] node=${result.metadata.node}`,
        `checksum=${result.metadata.checksum}`,
        `rho=${result.metadata.rho} | wIn=${result.metadata.weightIn} | wOut=${result.metadata.weightOut}`,
        `L=${result.metadata.leftHz}Hz | R=${result.metadata.rightHz}Hz`,
        `tcpStimuli=${result.metadata.tcpStimuli}`,
        "",
        result.responseText,
      ].join("\n");

      setIoOutput(responseText);
      setStatus("Resposta I/O gerada com envelope de metadados.");
    } catch (error) {
      setStatus(`Falha ao gerar resposta: ${error.message}`);
    }
  };

  const ensureAudioGraph = async () => {
    if (!audioRef.current.graph) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio API indisponivel neste navegador.");

      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.87;

      const gain = context.createGain();
      gain.gain.value = 0.0001;

      const leftOsc = context.createOscillator();
      const rightOsc = context.createOscillator();
      leftOsc.type = "sine";
      rightOsc.type = "sine";

      const panLeft = context.createStereoPanner ? context.createStereoPanner() : null;
      const panRight = context.createStereoPanner ? context.createStereoPanner() : null;

      if (panLeft && panRight) {
        panLeft.pan.value = -0.85;
        panRight.pan.value = 0.85;
        leftOsc.connect(panLeft);
        rightOsc.connect(panRight);
        panLeft.connect(gain);
        panRight.connect(gain);
      } else {
        leftOsc.connect(gain);
        rightOsc.connect(gain);
      }

      gain.connect(analyser);
      analyser.connect(context.destination);

      leftOsc.start();
      rightOsc.start();

      audioRef.current.graph = {
        context,
        analyser,
        gain,
        leftOsc,
        rightOsc,
        frequencyData: new Uint8Array(analyser.frequencyBinCount),
      };
    }

    const graph = audioRef.current.graph;
    if (graph.context.state === "suspended") {
      await graph.context.resume();
    }

    return graph;
  };

  const applyFrequencies = () => {
    const graph = audioRef.current.graph;
    if (!graph) return;

    const [trackedLeft, trackedRight] = stepFrequencyTracking([
      leftFrequency,
      rightFrequency,
    ]);

    const now = graph.context.currentTime;
    graph.leftOsc.frequency.setTargetAtTime(trackedLeft, now, 0.02);
    graph.rightOsc.frequency.setTargetAtTime(trackedRight, now, 0.02);
  };

  const startBinaural = async () => {
    try {
      const graph = await ensureAudioGraph();
      applyFrequencies();
      graph.gain.gain.setTargetAtTime(0.08, graph.context.currentTime, 0.03);
      setIsPlaying(true);
      setStatus("Play binaural ativo com batimento de Schumann (7.83 Hz).");
    } catch (error) {
      setStatus(`Falha no AudioContext: ${error.message}`);
    }
  };

  const stopBinaural = async () => {
    const graph = audioRef.current.graph;
    if (!graph) return;

    graph.gain.gain.setTargetAtTime(0.0001, graph.context.currentTime, 0.03);
    await graph.context.suspend();
    setIsPlaying(false);
    setStatus("Binaural pausado.");
  };

  const toggleBinaural = async () => {
    if (isPlaying) await stopBinaural();
    else await startBinaural();
  };

  useEffect(() => {
    const reference = [leftFrequency, rightFrequency];
    stepFrequencyTracking(reference);
    evaluateClosedLoopGate(reference);
  }, [leftFrequency, rightFrequency]);

  useEffect(() => {
    if (isPlaying) applyFrequencies();
  }, [isPlaying, leftFrequency, rightFrequency]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let frameId = 0;
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      const graph = audioRef.current.graph;
      if (graph && isPlaying) {
        graph.analyser.getByteFrequencyData(graph.frequencyData);
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(0, 0, width, height);

        const barCount = 32;
        const gap = 3;
        const barWidth = (width - gap * (barCount + 1)) / barCount;
        const slice = Math.max(1, Math.floor(graph.frequencyData.length / barCount));

        for (let i = 0; i < barCount; i += 1) {
          const value = graph.frequencyData[i * slice] / 255;
          const barHeight = 12 + value * (height - 20);
          const x = gap + i * (barWidth + gap);
          const y = height - barHeight - 6;

          const hue = Math.round(45 + value * 60);
          ctx.fillStyle = `hsl(${hue}, 88%, 56%)`;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      } else {
        drawIdleSpectrum(ctx, width, height);
      }

      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);

  useEffect(
    () => () => {
      if (networkRef.current) {
        networkRef.current.dispose();
        networkRef.current = null;
      }

      const graph = audioRef.current.graph;
      if (graph) {
        try {
          graph.leftOsc.stop();
          graph.rightOsc.stop();
        } catch {
          // noop
        }
        graph.context.close();
        audioRef.current.graph = null;
      }

      dynamicsRef.current = null;
    },
    []
  );

  const actionDisabled = isInitializing || isTraining;

  return (
    <section
      aria-labelledby="io-app-title"
      style={{
        marginTop: 18,
        background: PANEL_BG,
        borderRadius: 16,
        border: "1px solid #2a2a2a",
        padding: "20px 18px",
      }}
    >
      <h2 id="io-app-title" style={{ color: GOLD, fontSize: 24, margin: "0 0 10px" }}>
        Aplicacao de Respostas I/O - E1 + L8
      </h2>
      <p style={{ color: "#d5d5d5", lineHeight: 1.55, margin: "0 0 14px" }}>
        Fluxo ativo: HTTP/TCP Source - RawTCPPipe - TextHTTPWorker - DataPipe - AdaptadorDinamico - MNHI Core.
        O treino LSTM usa livros-probabilidade-estatistica.md como base principal e agrega sinais externos em lotes.
      </p>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginBottom: 16,
        }}
      >
        <article style={{ background: "#171717", borderRadius: 12, padding: 12, border: "1px solid #2a2a2a" }}>
          <h3 style={{ margin: "0 0 8px", color: GREEN, fontSize: 17 }}>layer_e1_http_worker.py</h3>
          <p style={{ margin: "0 0 6px", color: "#ddd" }}>
            <strong>GutenbergSource:</strong> busca assincrona por HTTP e gera chunks para a camada E1.
          </p>
          <p style={{ margin: "0 0 6px", color: "#ddd" }}>
            <strong>RawTCPPipe:</strong> entrada TCP crua para ingestao textual de alta saturacao.
          </p>
          <p style={{ margin: "0 0 6px", color: "#ddd" }}>
            <strong>TextHTTPWorker:</strong> concorrencia maxima 4, checksum por estimulo e fila em lote.
          </p>
          <p style={{ margin: 0, color: "#ddd" }}>
            <strong>StimuliBatcher:</strong> consolida vocabulario unico por lote antes do STDP.
          </p>
        </article>

        <article style={{ background: "#171717", borderRadius: 12, padding: 12, border: "1px solid #2a2a2a" }}>
          <h3 style={{ margin: "0 0 8px", color: GREEN, fontSize: 17 }}>Telemetria E1</h3>
          <dl style={{ margin: 0, color: "#ddd", display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4 }}>
            <dt>Livros no markdown</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.listedBooks ?? "-"}</dd>
            <dt>Fontes HTTP conectadas</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.connectedSources ?? "-"}</dd>
            <dt>Estimulos verificados</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.verified ?? "-"}</dd>
            <dt>Lotes consolidados</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.batches ?? "-"}</dd>
            <dt>Vocabulario consolidado</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.consolidatedVocabulary ?? "-"}</dd>
            <dt>Estimulos TCP injetados</dt>
            <dd style={{ margin: 0 }}>{pipelineStats?.tcpStimuli ?? 0}</dd>
          </dl>
        </article>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <button
          type="button"
          disabled={actionDisabled}
          onClick={initializePipeline}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${GOLD}`,
            background: actionDisabled ? "#222" : "#1a1a1a",
            color: GOLD,
            cursor: actionDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {isInitializing ? "Inicializando E1..." : "Inicializar E1 + LSTM"}
        </button>

        <button
          type="button"
          disabled={!network || actionDisabled}
          onClick={trainNetwork}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${GREEN}`,
            background: !network || actionDisabled ? "#222" : "#111d11",
            color: GREEN,
            cursor: !network || actionDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {isTraining ? "Treinando LSTM..." : "Treinar com livros-probabilidade"}
        </button>

        <div style={{ alignSelf: "center", color: hasTrained ? GREEN : "#c5c5c5", fontSize: 14 }}>
          {hasTrained ? "Modelo treinado" : "Modelo aguardando treino"}
        </div>
      </div>

      <p aria-live="polite" style={{ color: "#b8d4ff", fontSize: 14, margin: "0 0 14px" }}>
        {status}
      </p>

      {bookPreview.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <strong style={{ color: GOLD, fontSize: 14 }}>Fontes do markdown conectadas:</strong>
          <div style={{ color: "#ddd", fontSize: 14, marginTop: 4 }}>
            {bookPreview.map((book) => book.title).join(" | ")}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          marginBottom: 16,
        }}
      >
        <article style={{ background: "#171717", borderRadius: 12, border: "1px solid #2a2a2a", padding: 12 }}>
          <h3 style={{ margin: "0 0 10px", color: GOLD, fontSize: 17 }}>Entrada I/O</h3>
          <label style={{ display: "block", marginBottom: 8, color: "#ddd", fontSize: 14 }}>
            Prompt de requisicao
            <textarea
              value={ioInput}
              onChange={(event) => setIoInput(event.target.value)}
              rows={4}
              style={{ width: "100%", marginTop: 6, background: "#0d0d0d", color: "#f1f1f1", border: "1px solid #333", borderRadius: 8, padding: 8 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8, color: "#ddd", fontSize: 14 }}>
            Injetar chunk no RawTCPPipe
            <input
              type="text"
              value={tcpChunk}
              onChange={(event) => setTcpChunk(event.target.value)}
              style={{ width: "100%", marginTop: 6, background: "#0d0d0d", color: "#f1f1f1", border: "1px solid #333", borderRadius: 8, padding: 8 }}
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={injectTcpStimulus}
              disabled={!network}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                border: "1px solid #5392f9",
                background: !network ? "#222" : "#11213d",
                color: "#8bb9ff",
                cursor: !network ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Enviar chunk TCP
            </button>
            <button
              type="button"
              onClick={generateIoResponse}
              disabled={!network}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                border: `1px solid ${GOLD}`,
                background: !network ? "#222" : "#2b2207",
                color: GOLD,
                cursor: !network ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Gerar resposta I/O
            </button>
          </div>
        </article>

        <article style={{ background: "#171717", borderRadius: 12, border: "1px solid #2a2a2a", padding: 12 }}>
          <h3 style={{ margin: "0 0 10px", color: GOLD, fontSize: 17 }}>Saida da aplicacao</h3>
          <pre
            aria-live="polite"
            style={{
              margin: 0,
              minHeight: 210,
              maxHeight: 310,
              overflow: "auto",
              background: "#0d0d0d",
              color: "#ebebeb",
              border: "1px solid #333",
              borderRadius: 8,
              padding: 10,
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
              fontSize: 13,
            }}
          >
            {ioOutput || "Aguardando geracao de resposta I/O."}
          </pre>
        </article>
      </div>

      <article style={{ background: "#171717", borderRadius: 12, border: "1px solid #2a2a2a", padding: 12 }}>
        <h3 style={{ margin: "0 0 10px", color: GOLD, fontSize: 17 }}>Interface L8 - Web Audio API</h3>
        <p style={{ margin: "0 0 12px", color: "#ddd", lineHeight: 1.5 }}>
          Frequencia recalculada em tempo real por f = 432 / sqrt(rho/1000). O modo binaural usa osciladores L/R com
          batimento fixo de 7.83 Hz (Schumann).
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: 12,
          }}
        >
          <label style={{ color: "#ddd", fontSize: 14 }}>
            No sinaptico
            <select
              value={nodeId}
              onChange={(event) => setNodeId(event.target.value)}
              style={{ width: "100%", marginTop: 6, background: "#0d0d0d", color: "#f1f1f1", border: "1px solid #333", borderRadius: 8, padding: 8 }}
            >
              {SYNAPTIC_NODES.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </label>

          <SliderControl
            label="Peso de entrada"
            value={weightIn}
            min={0}
            max={1}
            step={0.01}
            onChange={setWeightIn}
            suffix=""
          />

          <SliderControl
            label="Peso de saida"
            value={weightOut}
            min={0}
            max={1}
            step={0.01}
            onChange={setWeightOut}
            suffix=""
          />

          <SliderControl
            label="Rho"
            value={rho}
            min={150}
            max={2600}
            step={10}
            onChange={setRho}
            suffix=""
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: "#d7d7d7", fontSize: 14 }}>
            <strong style={{ color: GREEN }}>Ref L:</strong> {leftFrequency.toFixed(2)} Hz
          </div>
          <div style={{ color: "#d7d7d7", fontSize: 14 }}>
            <strong style={{ color: GREEN }}>Ref R:</strong> {rightFrequency.toFixed(2)} Hz
          </div>
          <div style={{ color: "#d7d7d7", fontSize: 14 }}>
            <strong style={{ color: GREEN }}>Track L:</strong> {(trackedFrequencies[0] ?? leftFrequency).toFixed(2)} Hz
          </div>
          <div style={{ color: "#d7d7d7", fontSize: 14 }}>
            <strong style={{ color: GREEN }}>Track R:</strong> {(trackedFrequencies[1] ?? rightFrequency).toFixed(2)} Hz
          </div>
          <div style={{ color: "#d7d7d7", fontSize: 14 }}>
            <strong style={{ color: GREEN }}>Beat:</strong> {SCHUMANN_BEAT_HZ.toFixed(2)} Hz
          </div>
          <button
            type="button"
            onClick={toggleBinaural}
            style={{
              marginLeft: "auto",
              padding: "8px 12px",
              borderRadius: 7,
              border: `1px solid ${isPlaying ? "#ff8b8b" : "#8ecf8e"}`,
              background: isPlaying ? "#2f1212" : "#0f2a10",
              color: isPlaying ? "#ff9f9f" : "#93dd93",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPlaying ? "Parar binaural" : "Play binaural"}
          </button>
        </div>

        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            color: gateStatus.startsWith("Gate OK") ? GREEN : "#ff9f9f",
          }}
        >
          {gateStatus}
        </p>

        <canvas
          ref={canvasRef}
          width={760}
          height={190}
          style={{ width: "100%", borderRadius: 10, border: "1px solid #2f2f2f", background: "#0b0b0b" }}
          aria-label="Visualizador de espectro ao vivo"
        />
      </article>
    </section>
  );
}

export default NeuralNetworkSection;