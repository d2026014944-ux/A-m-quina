import { useState, useEffect, useRef, useCallback } from "react";

const N_DICE = 10;
const DICE_SUM_MEAN = 35;
const DICE_STD = Math.sqrt((10 * 35) / 12);

const TOTAL_TRIALS = 3000;
const SLOW_LIMIT = 12;
const MEDIUM_LIMIT = 180;
const MIN_LOG_TRIAL = 0.7;
const Y_MIN_CLAMP = -0.08;
const Y_MAX_CLAMP = 1.08;
const MAX_GRAPH_DOTS = 18;

const DOTS = {
  1: [[50, 50]],
  2: [
    [30, 30],
    [70, 70],
  ],
  3: [
    [30, 30],
    [50, 50],
    [70, 70],
  ],
  4: [
    [30, 30],
    [70, 30],
    [30, 70],
    [70, 70],
  ],
  5: [
    [30, 30],
    [70, 30],
    [50, 50],
    [30, 70],
    [70, 70],
  ],
  6: [
    [30, 25],
    [70, 25],
    [30, 50],
    [70, 50],
    [30, 75],
    [70, 75],
  ],
};

function Die({ value = 1, size = 56 }) {
  const pips = DOTS[value] || DOTS[1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`Die showing ${value}`}>
      <defs>
        <linearGradient id="dieGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a4f9d" />
          <stop offset="100%" stopColor="#2375df" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="16" fill="url(#dieGrad)" stroke="#8cbcff" strokeWidth="3" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="#fff" />
      ))}
    </svg>
  );
}

function Graph({ estimates, fastMode, trial }) {
  const canvasRef = useRef(null);
  const W = 580;
  const H = 310;
  const M = { t: 20, r: 28, b: 66, l: 66 };
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const LOG_MAX = Math.log10(TOTAL_TRIALS);

  const gx = (t) => M.l + (Math.log10(Math.max(t, MIN_LOG_TRIAL)) / LOG_MAX) * pw;
  const gy = (v) => M.t + ph - Math.min(Math.max((v - 1) / 4, Y_MIN_CLAMP), Y_MAX_CLAMP) * ph;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const piY = gy(Math.PI);
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = "#EE4444";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(M.l, piY);
    ctx.lineTo(M.l + pw, piY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (estimates.length > 0) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      estimates.forEach(({ trial: t, piEst }, i) => {
        const x = gx(t);
        const y = gy(piEst);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      const dotCount = Math.min(estimates.length, MAX_GRAPH_DOTS);
      for (let i = 0; i < dotCount; i++) {
        const { trial: t, piEst } = estimates[i];
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(gx(t), gy(piEst), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [estimates]);

  const xTicks = [1, 10, 100, 1000];
  const yTicks = [1, 2, 3, 4, 5];

  return (
    <div style={{ position: "relative", width: W, height: H, marginTop: 10 }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={M.l} y1={M.t + ph} x2={M.l + pw + 8} y2={M.t + ph} stroke="#e5e5e5" strokeWidth="2" />
        <line x1={M.l} y1={M.t + ph} x2={M.l} y2={M.t - 8} stroke="#e5e5e5" strokeWidth="2" />
        <polygon points={`${M.l + pw + 8},${M.t + ph} ${M.l + pw},${M.t + ph - 4} ${M.l + pw},${M.t + ph + 4}`} fill="#e5e5e5" />
        <polygon points={`${M.l},${M.t - 8} ${M.l - 4},${M.t} ${M.l + 4},${M.t}`} fill="#e5e5e5" />

        {xTicks.map((t) => (
          <g key={t}>
            <line x1={gx(t)} y1={M.t + ph} x2={gx(t)} y2={M.t + ph + 7} stroke="#e5e5e5" />
            <text x={gx(t)} y={M.t + ph + 25} fill="#ddd" fontSize="15" textAnchor="middle">
              10
              <tspan dy="-7" fontSize="11">
                {Math.log10(t)}
              </tspan>
            </text>
          </g>
        ))}

        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l - 7} y1={gy(t)} x2={M.l} y2={gy(t)} stroke="#e5e5e5" />
            <text x={M.l - 14} y={gy(t) + 5} fill="#ddd" fontSize="13" textAnchor="end">
              {t}
            </text>
          </g>
        ))}

        <text x={M.l + pw / 2} y={H - 12} fill="#ddd" textAnchor="middle" fontSize="15">
          Number of Trials (log scale)
        </text>
        <text x={22} y={M.t + ph / 2} fill="#ddd" textAnchor="middle" fontSize="15" transform={`rotate(-90 22 ${M.t + ph / 2})`}>
          π Estimate
        </text>
        <text x={M.l + pw - 4} y={gy(Math.PI) - 8} fill="#EE4444" textAnchor="end" fontSize="13">
          π ≈ 3.141
        </text>
        {fastMode && (
          <text x={W - 12} y={22} fill="#aaa" textAnchor="end" fontSize="13">
            Simulating 3,000+ trials… ({trial})
          </text>
        )}
      </svg>
    </div>
  );
}

function Frac({ num, den, color = "#F5C118" }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", color, lineHeight: 1, verticalAlign: "middle" }}>
      <span>{num}</span>
      <span style={{ width: "100%", borderTop: `1.4px solid ${color}`, margin: "3px 0 2px" }} />
      <span>{den}</span>
    </span>
  );
}

export default function App() {
  const [disp, setDisp] = useState({
    dice: [1, 2, 3, 4, 5, 6, 2, 4, 3, 5],
    sum: null,
    X: null,
    absX: null,
    trial: 0,
    piEst: null,
    estimates: [],
    mode: "idle",
    fastMode: false,
  });

  const sim = useRef({ running: false, trial: 0, sumAbsX: 0, estimates: [] });
  const tids = useRef([]);

  const killTimers = () => {
    tids.current.forEach(clearTimeout);
    tids.current = [];
  };
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    tids.current.push(id);
  };

  const doTrial = () => {
    const s = sim.current;
    const vals = Array.from({ length: N_DICE }, () => Math.floor(Math.random() * 6) + 1);
    const sum = vals.reduce((a, b) => a + b, 0);
    const X = (sum - DICE_SUM_MEAN) / DICE_STD;
    const absX = Math.abs(X);
    s.trial++;
    s.sumAbsX += absX;
    const piEst = 2 / Math.pow(s.sumAbsX / s.trial, 2);
    if (s.trial <= 120 || s.trial % 4 === 0 || s.trial === TOTAL_TRIALS) {
      s.estimates.push({ trial: s.trial, piEst });
    }
    return { vals, sum, X, absX, piEst };
  };

  const animate = useCallback(() => {
    const s = sim.current;

    const step = () => {
      if (!s.running || s.trial >= TOTAL_TRIALS) {
        setDisp((p) => ({ ...p, mode: "done", fastMode: false }));
        return;
      }

      if (s.trial < SLOW_LIMIT) {
        let cnt = 0;
        const flash = () => {
          if (!s.running) return;
          cnt++;
          setDisp((p) => ({
            ...p,
            dice: Array.from({ length: N_DICE }, () => Math.floor(Math.random() * 6) + 1),
          }));
          if (cnt < 9) {
            later(flash, 62);
          } else {
            const r = doTrial();
            setDisp((p) => ({
              ...p,
              dice: r.vals,
              sum: r.sum,
              X: r.X,
              absX: r.absX,
              trial: s.trial,
              piEst: r.piEst,
              estimates: [...s.estimates],
              mode: "running",
              fastMode: false,
            }));
            later(step, 820);
          }
        };
        flash();
      } else if (s.trial < MEDIUM_LIMIT) {
        const r = doTrial();
        setDisp((p) => ({
          ...p,
          dice: r.vals,
          sum: r.sum,
          X: r.X,
          absX: r.absX,
          trial: s.trial,
          piEst: r.piEst,
          estimates: [...s.estimates],
          mode: "running",
          fastMode: false,
        }));
        later(step, 48);
      } else {
        for (let i = 0; i < 20 && s.trial < TOTAL_TRIALS; i++) doTrial();
        const last = s.estimates[s.estimates.length - 1];
        setDisp((p) => ({
          ...p,
          trial: s.trial,
          piEst: last?.piEst ?? p.piEst,
          estimates: [...s.estimates],
          mode: s.trial >= TOTAL_TRIALS ? "done" : "running",
          fastMode: s.trial < TOTAL_TRIALS,
        }));
        if (s.trial < TOTAL_TRIALS) later(step, 16);
      }
    };

    step();
  }, []);

  const start = () => {
    killTimers();
    sim.current = { running: true, trial: 0, sumAbsX: 0, estimates: [] };
    setDisp({
      dice: Array.from({ length: N_DICE }, () => 1),
      sum: null,
      X: null,
      absX: null,
      trial: 0,
      piEst: null,
      estimates: [],
      mode: "running",
      fastMode: false,
    });
    animate();
  };

  useEffect(() => () => {
    sim.current.running = false;
    killTimers();
  }, []);

  const { dice, sum, X, absX, trial, piEst, estimates, mode, fastMode } = disp;
  const gold = "#F5C118";
  const green = "#72D672";

  const btnLabel = mode === "idle" ? "▶  Start Simulation" : mode === "done" ? "↺  Run Again" : "Simulating…";
  const btnActive = mode !== "running";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#eee",
        fontFamily: "Georgia, Times New Roman, serif",
        display: "flex",
        justifyContent: "center",
        padding: "28px 12px 40px",
      }}
    >
      <div style={{ width: 860, maxWidth: "100%" }}>
        <h1
          aria-label="Estimating pi using absolute value of X where X follows a standard normal distribution"
          style={{ color: gold, fontSize: 30, fontWeight: 600, margin: "0 0 10px" }}
        >
          Estimating π with |X| where X ~ N(0,1)
        </h1>
        <div style={{ color: gold, fontSize: 23, lineHeight: 1.5, marginBottom: 16 }}>
          <div>
            X ~ 𝒩(0,1) ⟹ E[|X|] ={" "}
            <span role="img" aria-label="square root" style={{ verticalAlign: "middle" }}>
              √
            </span>
            <Frac num="2" den="π" />
          </div>
          <div>
            π ≈ <Frac num="2" den="(Mean |X|)²" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, width: 320, marginBottom: 14 }}>
          {dice.map((v, i) => (
            <Die key={`${i}-${v}`} value={v} />
          ))}
        </div>

        <div style={{ color: gold, fontSize: 22, marginBottom: 12, minHeight: 30 }}>
          {sum == null ? (
            "Sum → X → |X|"
          ) : (
            <>
              Sum = {sum} → X = {X.toFixed(3)} → |X| = {absX.toFixed(3)}
            </>
          )}
        </div>

        <div style={{ color: green, fontSize: 27, marginBottom: 6 }}>
          Live Estimate: {piEst == null ? "—" : piEst.toFixed(4)}
          <span style={{ color: "#aaa", fontSize: 18 }}> (trial {trial})</span>
        </div>

        <Graph estimates={estimates} fastMode={fastMode} trial={trial} />

        <button
          type="button"
          onClick={btnActive ? start : undefined}
          disabled={!btnActive}
          style={{
            marginTop: 14,
            padding: "10px 16px",
            borderRadius: 8,
            border: `1px solid ${btnActive ? gold : "#777"}`,
            background: btnActive ? "#171717" : "#0f0f0f",
            color: btnActive ? gold : "#777",
            fontFamily: "inherit",
            fontSize: 16,
            cursor: btnActive ? "pointer" : "default",
          }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}
