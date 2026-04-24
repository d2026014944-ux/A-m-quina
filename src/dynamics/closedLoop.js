import { propagatePlantState, readPlantOutput } from "./plantModel";

function assertFinitePositive(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number.`);
  }
}

function assertStateVector(name, values) {
  if (!Array.isArray(values) || values.length !== 2) {
    throw new Error(`${name} must be a 2-channel vector.`);
  }

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}[${index}] must be finite.`);
    }
  });
}

function ensureFiniteVector(name, values) {
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}[${index}] became non-finite during simulation.`);
    }
  });
}

export function runClosedLoopSimulation({
  plant,
  controller,
  initialState,
  reference,
  steps = 120,
  maxIterations = 1000,
  timeoutMs = 250,
  errorThresholdHz = 1,
} = {}) {
  if (!plant) throw new Error("plant is required.");
  if (!controller || typeof controller.step !== "function") {
    throw new Error("controller with step(reference, measurement) is required.");
  }

  assertStateVector("initialState", initialState);
  assertStateVector("reference", reference);
  assertFinitePositive("steps", steps);
  assertFinitePositive("maxIterations", maxIterations);
  assertFinitePositive("timeoutMs", timeoutMs);
  assertFinitePositive("errorThresholdHz", errorThresholdHz);

  const startTime = Date.now();
  let state = [...initialState];
  let iterations = 0;
  let stable = true;
  const history = [];

  for (let step = 0; step < steps; step += 1) {
    iterations += 1;

    if (iterations > maxIterations) {
      throw new Error("Simulation aborted: maxIterations exceeded.");
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error("Simulation aborted: timeout exceeded.");
    }

    const measurement = readPlantOutput(plant, state);
    const command = controller.step(reference, measurement);
    assertStateVector("command", command);

    state = propagatePlantState(plant, state, command);
    ensureFiniteVector("state", state);

    const absError = [
      Math.abs(reference[0] - state[0]),
      Math.abs(reference[1] - state[1]),
    ];

    if (!Number.isFinite(absError[0]) || !Number.isFinite(absError[1])) {
      stable = false;
    }

    history.push({
      step,
      state: [...state],
      command: [...command],
      absError,
    });
  }

  const finalAbsError = [
    Math.abs(reference[0] - state[0]),
    Math.abs(reference[1] - state[1]),
  ];

  const trackingPass =
    finalAbsError[0] <= errorThresholdHz &&
    finalAbsError[1] <= errorThresholdHz;

  return {
    stable,
    iterations,
    finalState: [...state],
    finalAbsError,
    trackingPass,
    errorThresholdHz,
    history,
  };
}

export function assertClosedLoopGate(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Closed-loop gate failed: simulation report is missing.");
  }

  if (!report.stable) {
    throw new Error("Closed-loop gate failed: unstable numerical response.");
  }

  if (!report.trackingPass) {
    throw new Error(
      `Closed-loop gate failed: tracking error exceeded ${report.errorThresholdHz} Hz.`,
    );
  }

  return true;
}
