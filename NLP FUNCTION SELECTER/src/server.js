const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const { FunctionCallerEngine } = require("./nlp/engine");

const app = express();
const PORT = process.env.PORT || 3000;
const engine = new FunctionCallerEngine();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI options & custom CSS for clean modern styling
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 25px 0; }
    .swagger-ui .info .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700; color: #1e293b; }
    .swagger-ui .scheme-container { background: #f8fafc; box-shadow: none; border-bottom: 1px solid #e2e8f0; }
    .swagger-ui .opblock.opblock-get { border-color: #38bdf8; background: rgba(56, 189, 248, 0.05); }
    .swagger-ui .opblock.opblock-post { border-color: #10b981; background: rgba(16, 185, 129, 0.05); }
    .swagger-ui .opblock.opblock-delete { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
  `,
  customSiteTitle: "Offline AI Function Caller - Swagger API Docs"
};

// Serve Swagger specification JSON
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Swagger UI served at /docs and /api-docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

/**
 * Root Route handler:
 * 1. If ?promt=... or ?prompt=... or ?q=... is provided, parse and return function call.
 * 2. If no prompt parameter is present, redirect/serve Swagger UI directly!
 */
app.get("/", (req, res, next) => {
  const prompt = req.query.prompt || req.query.promt || req.query.q || req.query.query;

  if (prompt) {
    const parseResult = engine.parse(prompt);
    const format = (req.query.format || "").toLowerCase();

    if (format === "json") {
      return res.json(parseResult);
    }

    // Default response: plain text function call string (e.g. "payslip(hareesh, october)")
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(parseResult.call || (parseResult.error || "No match"));
  }

  // If accessed directly without query params, show Swagger UI
  next();
}, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

/**
 * GET /api/call?prompt=... or ?promt=...
 */
app.get("/api/call", (req, res) => {
  const prompt = req.query.prompt || req.query.promt || req.query.q;
  if (!prompt) {
    return res.status(400).json({ error: "Missing required query parameter 'prompt' or 'promt'" });
  }

  const result = engine.parse(prompt);
  const format = (req.query.format || "").toLowerCase();

  if (format === "json") {
    return res.json(result);
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(result.call || (result.error || "No match"));
});

/**
 * POST /api/parse: Parse prompt via JSON body
 */
app.post("/api/parse", (req, res) => {
  const prompt = req.body.prompt || req.body.promt;
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in request body." });
  }

  const result = engine.parse(prompt);
  return res.json(result);
});

/**
 * POST /api/execute: Parse prompt and execute mock implementation
 */
app.post("/api/execute", async (req, res) => {
  const prompt = req.body.prompt || req.body.promt;
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in request body." });
  }

  const result = engine.parse(prompt);
  if (result.success && result.execute) {
    const executionOutput = await result.execute();
    return res.json({ ...result, executionOutput });
  }

  return res.status(400).json(result);
});

/**
 * GET /api/functions: List master data functions
 */
app.get("/api/functions", (req, res) => {
  res.json(engine.functions);
});

/**
 * POST /api/functions: Register or update function in master data
 */
app.post("/api/functions", (req, res) => {
  try {
    const fnDef = req.body;
    engine.addFunction(fnDef, true);
    res.status(201).json({
      message: "Function registered successfully",
      function: fnDef
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/functions/:name: Remove function from master data
 */
app.delete("/api/functions/:name", (req, res) => {
  const fnName = req.params.name;
  engine.functions = engine.functions.filter(f => f.name.toLowerCase() !== fnName.toLowerCase());
  engine._rebuildIndex();
  engine.saveMasterData();
  res.json({ message: `Function '${fnName}' deleted successfully` });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Offline AI Function Caller API is running!`);
    console.log(`👉 Swagger UI:    http://localhost:${PORT}/ (or /docs)`);
    console.log(`👉 Example Call:  http://localhost:${PORT}/?promt=what%20is%20the%20payslip%20of%20hareesh%20in%20october`);
    console.log(`👉 Raw Text:      http://localhost:${PORT}/api/call?prompt=what%20is%20the%20payslip%20of%20hareesh%20in%20october`);
    console.log(`👉 Swagger Spec:  http://localhost:${PORT}/swagger.json`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, engine };
