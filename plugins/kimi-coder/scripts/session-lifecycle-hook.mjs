#!/usr/bin/env node

import process from "node:process";

const event = process.argv[2];

if (event === "SessionStart") {
  // Nothing to initialize for now
  process.exit(0);
}

if (event === "SessionEnd") {
  // Nothing to clean up for now
  process.exit(0);
}

process.exit(0);
