# CLAUDE.MD Template - Dynamic Systems

## 1) System Characterization
- System name:
- Physical domain:
- Is linear in state and input? (yes/no + reason)
- Is time invariant? (yes/no + reason)
- Inputs u(t):
- Outputs y(t):
- States x(t):
- Initial conditions:

## 2) Objective
- Primary objective: analysis | synthesis | real-time simulation
- Success criteria:
- Stability/performance targets:

## 3) Modeling Decision
- Selected domain: Laplace | State-space
- Decision rationale:
- If Laplace: H(s) form and assumptions
- If state-space: A, B, C, D matrices and derivation notes

## 4) Stack and Architecture
- Simulation stack:
- Deployment stack:
- Runtime constraints:
- Plant module boundary:
- Controller module boundary:
- Data contract (u(t), x(t), y(t)):

## 5) TDD Plan (Before Implementation)
- Unit tests for model consistency:
- Unit tests for dimensions:
- Unit tests for poles/eigenvalues:
- Response tests (step/impulse/frequency):
- Integration tests for closed-loop behavior:

## 6) Safety and Execution
- Sandbox/container image:
- Dependency pinning:
- Runtime guardrails (timeout/max iter/signal limits):
- Hardware-in-the-loop precautions:

## 7) Change Log
- Date:
- Change:
- Math impact:
- Tests updated:
