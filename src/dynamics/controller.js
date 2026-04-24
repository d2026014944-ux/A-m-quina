function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function assertFinitePositive(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number.`);
  }
}

function assertChannelArray(name, values) {
  if (!Array.isArray(values) || values.length !== 2) {
    throw new Error(`${name} must be an array with two channels.`);
  }

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}[${index}] must be a finite number.`);
    }
  });
}

export function createBinauralPIController({
  dt = 0.02,
  kp = [0.85, 0.85],
  ki = [1.8, 1.8],
  outputBounds = [18, 880],
  integralBounds = [-600, 600],
} = {}) {
  assertFinitePositive("dt", dt);
  assertChannelArray("kp", kp);
  assertChannelArray("ki", ki);

  if (!Array.isArray(outputBounds) || outputBounds.length !== 2) {
    throw new Error("outputBounds must be [min, max].");
  }

  if (!Array.isArray(integralBounds) || integralBounds.length !== 2) {
    throw new Error("integralBounds must be [min, max].");
  }

  const [uMin, uMax] = outputBounds;
  const [iMin, iMax] = integralBounds;
  let integral = [0, 0];

  return {
    step(reference, measurement) {
      assertChannelArray("reference", reference);
      assertChannelArray("measurement", measurement);

      return [0, 1].map((channel) => {
        const error = reference[channel] - measurement[channel];
        integral[channel] = clamp(integral[channel] + error * dt, iMin, iMax);

        // Feed-forward + PI term gives fast reference tracking with zero steady-state error.
        const command =
          reference[channel] +
          kp[channel] * error +
          ki[channel] * integral[channel];

        return clamp(command, uMin, uMax);
      });
    },

    reset(initialIntegral = [0, 0]) {
      assertChannelArray("initialIntegral", initialIntegral);
      integral = [...initialIntegral];
    },

    getIntegralState() {
      return [...integral];
    },
  };
}
