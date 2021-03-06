import type { Configurable } from "./core";
import { Process } from "./Process";
import { moduleConfig } from "./core";
import { o } from "@skylib/functions";
import type { progressReporter } from "@skylib/facades";

export const progressBar: Configurable & progressReporter.Facade = {
  configure: config => {
    o.assign(moduleConfig, config);
  },
  getConfiguration: (): progressBar.Configuration => moduleConfig,
  getProgress: Process.getProgress,
  reset: Process.reset,
  spawn: (): Process => new Process()
};

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Ok
export namespace progressBar {
  export type Configuration = import("./core").Configuration;

  export type PartialConfiguration = import("./core").PartialConfiguration;
}
