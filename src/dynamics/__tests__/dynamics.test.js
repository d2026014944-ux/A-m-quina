import { describe, expect, it } from "vitest";
import { createBinauralPIController } from "../controller";
import {
  assertClosedLoopGate,
  runClosedLoopSimulation,
} from "../closedLoop";
import {
  buildBinauralStateSpacePlant,
  propagatePlantState,
} from "../plantModel";

describe("state-space modeling", () => {
  it("defines consistent matrix dimensions", () => {
    const plant = buildBinauralStateSpacePlant({ lambda: 8, dt: 0.02 });

    expect(plant.A).toHaveLength(2);
    expect(plant.A[0]).toHaveLength(2);
    expect(plant.B).toHaveLength(2);
    expect(plant.B[0]).toHaveLength(2);

    expect(plant.C).toHaveLength(2);
    expect(plant.C[0]).toHaveLength(2);
    expect(plant.D).toHaveLength(2);
    expect(plant.D[0]).toHaveLength(2);

    expect(plant.Ad).toHaveLength(2);
    expect(plant.Ad[0]).toHaveLength(2);
    expect(plant.Bd).toHaveLength(2);
    expect(plant.Bd[0]).toHaveLength(2);
  });

  it("keeps discrete poles aligned with expected dynamics", () => {
    const lambda = 8;
    const dt = 0.02;
    const plant = buildBinauralStateSpacePlant({ lambda, dt });
    const expectedPole = Math.exp(-lambda * dt);

    expect(plant.discretePoles).toHaveLength(2);

    for (const pole of plant.discretePoles) {
      expect(Math.abs(pole)).toBeLessThan(1);
      expect(pole).toBeCloseTo(expectedPole, 10);
    }
  });

  it("matches state update equation x(k+1)=Ad*x(k)+Bd*u(k)", () => {
    const lambda = 6;
    const dt = 0.01;
    const plant = buildBinauralStateSpacePlant({ lambda, dt });
    const x = [180, 210];
    const u = [220, 240];

    const next = propagatePlantState(plant, x, u);
    const alpha = Math.exp(-lambda * dt);
    const beta = 1 - alpha;

    expect(next[0]).toBeCloseTo(alpha * x[0] + beta * u[0], 10);
    expect(next[1]).toBeCloseTo(alpha * x[1] + beta * u[1], 10);
  });
});

describe("closed-loop integration gate", () => {
  it("passes nominal plant with tuned PI controller", () => {
    const plant = buildBinauralStateSpacePlant({ lambda: 8, dt: 0.02 });
    const controller = createBinauralPIController({
      dt: 0.02,
      kp: [0.85, 0.85],
      ki: [1.8, 1.8],
      outputBounds: [18, 880],
    });

    const report = runClosedLoopSimulation({
      plant,
      controller,
      initialState: [60, 72],
      reference: [220, 227.83],
      steps: 240,
      maxIterations: 500,
      timeoutMs: 300,
      errorThresholdHz: 1,
    });

    expect(report.stable).toBe(true);
    expect(report.finalAbsError[0]).toBeLessThan(1);
    expect(report.finalAbsError[1]).toBeLessThan(1);
    expect(() => assertClosedLoopGate(report)).not.toThrow();
  });

  it("fails integration gate when plant dynamics change without controller retuning", () => {
    const alteredPlant = buildBinauralStateSpacePlant({ lambda: 0.7, dt: 0.02 });
    const outdatedController = createBinauralPIController({
      dt: 0.02,
      kp: [0.85, 0.85],
      ki: [1.8, 1.8],
      outputBounds: [18, 880],
    });

    const report = runClosedLoopSimulation({
      plant: alteredPlant,
      controller: outdatedController,
      initialState: [60, 72],
      reference: [220, 227.83],
      steps: 40,
      maxIterations: 500,
      timeoutMs: 300,
      errorThresholdHz: 1,
    });

    expect(report.stable).toBe(true);
    expect(report.finalAbsError.some((value) => value > 1)).toBe(true);
    expect(() => assertClosedLoopGate(report)).toThrow(/Closed-loop gate failed/);
  });

  it("enforces runtime guardrails for bounded execution", () => {
    const plant = buildBinauralStateSpacePlant({ lambda: 8, dt: 0.02 });
    const controller = createBinauralPIController({
      dt: 0.02,
      kp: [0.85, 0.85],
      ki: [1.8, 1.8],
      outputBounds: [18, 880],
    });

    expect(() =>
      runClosedLoopSimulation({
        plant,
        controller,
        initialState: [60, 72],
        reference: [220, 227.83],
        steps: 25,
        maxIterations: 10,
        timeoutMs: 300,
        errorThresholdHz: 1,
      })
    ).toThrow(/maxIterations/);
  });
});
