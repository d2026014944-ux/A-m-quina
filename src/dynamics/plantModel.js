function assertFinitePositive(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number.`);
  }
}

function assertBinauralVector(name, values) {
  if (!Array.isArray(values) || values.length !== 2) {
    throw new Error(`${name} must be an array with two numeric channels.`);
  }

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}[${index}] must be a finite number.`);
    }
  });
}

export function buildBinauralStateSpacePlant({ lambda = 8, dt = 0.02 } = {}) {
  assertFinitePositive("lambda", lambda);
  assertFinitePositive("dt", dt);

  const alpha = Math.exp(-lambda * dt);
  const beta = 1 - alpha;

  const A = [
    [-lambda, 0],
    [0, -lambda],
  ];
  const B = [
    [lambda, 0],
    [0, lambda],
  ];
  const C = [
    [1, 0],
    [0, 1],
  ];
  const D = [
    [0, 0],
    [0, 0],
  ];

  const Ad = [
    [alpha, 0],
    [0, alpha],
  ];
  const Bd = [
    [beta, 0],
    [0, beta],
  ];
  const Cd = [
    [1, 0],
    [0, 1],
  ];
  const Dd = [
    [0, 0],
    [0, 0],
  ];

  return {
    dt,
    lambda,
    A,
    B,
    C,
    D,
    Ad,
    Bd,
    Cd,
    Dd,
    discretePoles: [alpha, alpha],
  };
}

export function propagatePlantState(plant, state, input) {
  if (!plant || !plant.Ad || !plant.Bd) {
    throw new Error("Invalid plant model. Expected Ad and Bd matrices.");
  }

  assertBinauralVector("state", state);
  assertBinauralVector("input", input);

  const nextLeft = plant.Ad[0][0] * state[0] + plant.Bd[0][0] * input[0];
  const nextRight = plant.Ad[1][1] * state[1] + plant.Bd[1][1] * input[1];

  return [nextLeft, nextRight];
}

export function readPlantOutput(plant, state) {
  if (!plant || !plant.Cd) {
    throw new Error("Invalid plant model. Expected Cd matrix.");
  }

  assertBinauralVector("state", state);
  return [
    plant.Cd[0][0] * state[0] + plant.Cd[0][1] * state[1],
    plant.Cd[1][0] * state[0] + plant.Cd[1][1] * state[1],
  ];
}
