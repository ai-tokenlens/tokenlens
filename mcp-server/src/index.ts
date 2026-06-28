#!/usr/bin/env node
import { createServer } from "./server.js";
import { connectTransport } from "./transport/index.js";

const { server } = createServer();
await connectTransport(server);
