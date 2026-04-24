---
name: akita-way-dynamic-systems
description: 'Disciplined workflow for dynamic system implementation with anti-vibe coding, TDD-first modeling, AI sandboxing, and plant-controller integration checks. Use when translating ODEs, transfer functions, or state-space equations into Python, MATLAB, or C/C++.'
argument-hint: 'System objective, model type, stack, and safety constraints'
user-invocable: true
---

# Akita Way Dynamic Systems

## What This Skill Produces
This skill produces a safe, testable, and mathematically traceable implementation plan for dynamic systems, including:
- domain mapping in CLAUDE.MD
- explicit model representation decision (Laplace vs state-space)
- TDD-first test suite before implementation
- sandboxed execution policy for AI-generated simulation/control code
- plant-controller separation with integration stability gates

## When To Use
Use this skill when you need to:
- implement dynamic models from physical equations
- build control software with fewer math-to-code mistakes
- avoid "vibe coding" in control/systems engineering
- deploy simulation and control code safely

## Required Inputs
Before running the workflow, collect:
- system equations or physical description
- objective: analysis, controller synthesis, or real-time simulation
- target stack (for example Python/SciPy, MATLAB, C/C++)
- constraints (sampling rate, hardware limits, safety constraints)

## Workflow

### Phase 1 - Foundation and Structure
1. Fill the CLAUDE.MD foundation using the [CLAUDE.MD template](./references/claude-md-template.md).
2. Answer the gating questions:
- Is the system linear in state and input?
- Is it time-invariant?
- What are u(t), y(t), and initial conditions?
- What is the final objective (analysis/synthesis/simulation)?
3. Define stack and architecture before asking the AI for implementation code.

Completion check:
- CLAUDE.MD is updated and reviewed before any implementation prompt.

### Phase 2 - Modeling and TDD-First Development
1. Translate the physical problem into a standard mathematical form.
2. Choose a modeling domain:
- Branch A (Laplace): Prefer for linear SISO transfer-function-centric tasks.
- Branch B (State-space): Prefer for universal handling, MIMO, and cleaner numerical integration.
3. Enforce TDD rule: tests must be written before solver/integrator/controller code.
4. Reject AI output that skips tests or jumps directly to final controller implementation.

Minimum tests before implementation:
- matrix dimension and shape consistency
- poles/eigenvalues consistency with expected dynamics
- transfer function step response sanity (if using Laplace)
- state update equation consistency (if using state-space)

If AI produces wrong A/B/C/D from the physics:
- stop generation
- manually correct model math in editor
- regenerate tests first, then implementation

Completion check:
- test suite exists and fails for intentional wrong model
- implementation starts only after tests are accepted

### Phase 3 - Safety and Isolation (AI Jail)
1. Never run new AI-generated control/simulation scripts directly on host machine.
2. Run in isolated container with pinned dependencies.
3. Restrict permissions for autonomous iterative tuning workflows.
4. Add runtime guards (timeouts, max iterations, bounded inputs).

Completion check:
- simulation and tuning run only in sandboxed environment
- no unbounded loops without guardrails

### Phase 4 - Plant vs Controller Separation
1. Split code architecture into independent modules/services:
- plant model
- controller logic
2. Define explicit I/O contract between modules (u(t), x(t), y(t)).
3. Create cross-module integration tests for closed-loop behavior.
4. Require integration failure when plant dynamics are changed without controller updates.

Completion check:
- closed-loop integration tests exist and are mandatory in CI/local gate

## Quality Gates
Use the [quality gate checklist](./references/quality-gates.md) before marking work complete.

Hard stop conditions:
- missing CLAUDE.MD model assumptions
- implementation before tests
- host execution of unsafe simulation/control scripts
- merged plant/controller code with no integration contract

## Prompt Patterns
Use prompts such as:
- "Apply akita-way-dynamic-systems to derive state-space model and write tests before integrator code."
- "Run akita-way-dynamic-systems for a linear SISO plant; decide Laplace vs state-space and justify."
- "Use akita-way-dynamic-systems to refactor plant/controller modules and add closed-loop integration tests."
