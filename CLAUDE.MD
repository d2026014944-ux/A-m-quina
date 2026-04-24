# CLAUDE.MD - Dynamic Systems Foundation

## 1) System Characterization
- System name: Binaural Frequency Tracking Layer (L8)
- Physical domain: Discrete-time control of audio oscillator frequency in browser
- Is linear in state and input? (yes/no + reason): yes, first-order linear plant per channel
- Is time invariant? (yes/no + reason): yes, plant parameters are constant in runtime
- Inputs u(t): controller command frequencies uL(t), uR(t) in Hz
- Outputs y(t): measured frequencies yL(t), yR(t) in Hz
- States x(t): plant states xL(t), xR(t) (oscillator frequency states)
- Initial conditions: x(0) = [fL0, fR0]

## 2) Objective
- Primary objective: real-time simulation
- Success criteria: track commanded binaural references with bounded control and stable closed loop
- Stability/performance targets: discrete poles inside unit circle, reference tracking error < 1 Hz in nominal plant

## 3) Modeling Decision
- Selected domain: State-space
- Decision rationale: two-channel MIMO handling and explicit numerical integration in JS loop
- If Laplace: N/A
- If state-space: A, B, C, D matrices and derivation notes
  - Continuous plant per channel: xdot = -lambda*x + lambda*u
  - Continuous matrices:
    - A = [[-lambda, 0], [0, -lambda]]
    - B = [[lambda, 0], [0, lambda]]
    - C = [[1, 0], [0, 1]]
    - D = [[0, 0], [0, 0]]
  - Exact discretization for dt:
    - Ad = exp(-lambda*dt) * I
    - Bd = (1 - exp(-lambda*dt)) * I

## 4) Stack and Architecture
- Simulation stack: JavaScript (ESM), React, Vite, Vitest
- Deployment stack: Browser runtime (Web Audio API)
- Runtime constraints: dt in [0.008, 0.05] s, bounded frequency command [18, 880] Hz
- Plant module boundary: src/dynamics/plantModel.js
- Controller module boundary: src/dynamics/controller.js
- Data contract (u(t), x(t), y(t)): u=[uL,uR], x=[xL,xR], y=[yL,yR], all in Hz

## 5) TDD Plan (Before Implementation)
- Unit tests for model consistency: matrix dimensions and discrete state update equation
- Unit tests for dimensions: A/B/C/D and Ad/Bd/Cd/Dd shape checks
- Unit tests for poles/eigenvalues: verify |pole| < 1 for nominal dt
- Response tests (step/impulse/frequency): closed-loop step tracking sanity for nominal plant
- Integration tests for closed-loop behavior: nominal tracking pass + altered plant fails with unchanged controller gains

## 6) Safety and Execution
- Sandbox/container image: devcontainer Ubuntu 24.04 (project workspace)
- Dependency pinning: package-lock.json + explicit package versions
- Runtime guardrails (timeout/max iter/signal limits): maxIterations and timeout in guarded simulator, bounded command frequencies
- Hardware-in-the-loop precautions: no direct hardware actuation; browser-only oscillator output

## 7) Change Log
- Date: 2026-04-20
- Change: Project revised to explicit state-space model workflow with TDD and module separation
- Math impact: Added first-order two-channel LTI plant and PI controller contract
- Tests updated: New dynamics unit/integration tests added before module integration
