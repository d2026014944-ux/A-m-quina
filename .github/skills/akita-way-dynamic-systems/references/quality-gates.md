# Quality Gates - Dynamic Systems Implementation

## Gate A - Foundation
- [ ] CLAUDE.MD fully updated before coding
- [ ] System assumptions are explicit (linearity, time invariance, ICs)
- [ ] Objective is explicit (analysis/synthesis/simulation)

## Gate B - Modeling Decision
- [ ] Domain choice justified (Laplace vs state-space)
- [ ] Derivation is traceable from physics to equations
- [ ] A/B/C/D or H(s) checked by human review

## Gate C - TDD First
- [ ] Tests written before implementation
- [ ] Dimension tests pass
- [ ] Poles/eigenvalue tests pass
- [ ] Step response or state transition sanity tests pass
- [ ] Intentional bad-model test fails as expected

## Gate D - Safety
- [ ] New AI-generated scripts run in sandbox/container only
- [ ] Runtime guardrails enabled (timeout, max iterations, bounded inputs)
- [ ] Autonomous tuning has restricted permissions

## Gate E - Architecture
- [ ] Plant and controller are separated modules
- [ ] I/O contract between modules is explicit
- [ ] Closed-loop integration tests exist
- [ ] Plant change breaks integration test if controller is outdated

## Gate F - Release Readiness
- [ ] All unit and integration tests pass
- [ ] Numerical stability validated under expected operating range
- [ ] Documentation updated when model/equations change
- [ ] No unresolved assumptions remain

## Stop-Ship Triggers
- Missing CLAUDE.MD assumptions
- Controller implementation created before tests
- Unsafe host execution of untrusted simulation scripts
- No integration tests for plant-controller interaction
