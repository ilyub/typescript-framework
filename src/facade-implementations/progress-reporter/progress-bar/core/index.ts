import type { Writable } from "@skylib/functions";

export const moduleConfig: Configuration = {
  activeClass: "progress-bar-active",
  enabled: false,
  finalEasing: false,
  finalEasingSpeed: 500,
  latency: 0,
  precision: 3,
  selector: "#progressBar",
  updateInterval: 100
};

export interface Configuration {
  readonly activeClass: string;
  readonly enabled: boolean;
  readonly finalEasing: boolean;
  readonly finalEasingSpeed: number;
  readonly latency: number;
  readonly precision: number;
  readonly selector: string;
  readonly updateInterval: number;
}

export interface PartialConfiguration extends Partial<Configuration> {}

export interface ProcessState {
  readonly expectedDuration: number;
  readonly lastUpdate: number;
  readonly progress: number;
  readonly state: State;
  readonly weight: number;
}

export type State = "auto" | "done" | "finalEasing" | "manual";

/**
 * Performs final easing.
 *
 * @param mutableState - Process state.
 */
export function finalEasing(mutableState: Writable<ProcessState>): void {
  if (moduleConfig.finalEasing) {
    const now = Date.now();

    const delta =
      (now - mutableState.lastUpdate) / moduleConfig.finalEasingSpeed;

    mutableState.lastUpdate = now;
    mutableState.progress += delta;

    if (mutableState.progress > 1) {
      mutableState.state = "done";
      mutableState.progress = 1;
    }
  } else {
    mutableState.state = "done";
    mutableState.progress = 1;
  }
}

/**
 * Grows progress.
 *
 * @param mutableState - Process state.
 */
export function growProgress(mutableState: Writable<ProcessState>): void {
  const now = Date.now();

  const delta = (now - mutableState.lastUpdate) / mutableState.expectedDuration;

  const exp = Math.exp(-delta);

  mutableState.lastUpdate = now;
  mutableState.progress += (1 - mutableState.progress) * (1 - exp);
}