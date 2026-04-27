import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_uzturhcjjjnstslmsuan", // Replace with your actual Trigger.dev project ID
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
  dirs: ["./trigger"],
});
