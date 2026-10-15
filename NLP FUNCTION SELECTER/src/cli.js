#!/usr/bin/env node

const readline = require("readline");
const { FunctionCallerEngine } = require("./nlp/engine");

const engine = new FunctionCallerEngine();

const args = process.argv.slice(2);

// Single command invocation: node src/cli.js "what is the payslip of hareesh in october"
if (args.length > 0) {
  const prompt = args.join(" ");
  const result = engine.parse(prompt);

  if (process.env.VERBOSE || args.includes("--verbose") || args.includes("-v")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.success) {
      console.log(result.call);
    } else {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  }
  process.exit(0);
}

// Interactive REPL mode
console.log("\n=======================================================");
console.log("🤖 Offline AI Function Caller CLI (Zero External APIs)");
console.log("Type any prompt to extract the matching function call.");
console.log("Example: 'what is the payslip of hareesh in october'");
console.log("Type 'list' to see registered master data functions.");
console.log("Type 'exit' or press Ctrl+C to quit.");
console.log("=======================================================\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "ai-prompt > "
});

rl.prompt();

rl.on("line", (line) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  if (input === "exit" || input === "quit") {
    rl.close();
    return;
  }

  if (input === "list" || input === "functions") {
    console.log("\nRegistered Functions in Master Data:");
    engine.functions.forEach((f, idx) => {
      console.log(`  ${idx + 1}. \x1b[36m${f.name}\x1b[0m(${f.parameters.map(p => p.name).join(", ")})`);
      console.log(`     Description: ${f.description}`);
    });
    console.log("");
    rl.prompt();
    return;
  }

  const result = engine.parse(input);

  if (result.success) {
    console.log(`\n👉 \x1b[32m${result.call}\x1b[0m`);
    console.log(`   \x1b[90mMatched Function: ${result.matchedFunction} | Confidence: ${(result.confidence * 100).toFixed(0)}%\x1b[0m`);
    console.log(`   \x1b[90mParameters: ${JSON.stringify(result.parameters)}\x1b[0m\n`);
  } else {
    console.log(`\n❌ \x1b[31m${result.error}\x1b[0m\n`);
  }

  rl.prompt();
}).on("close", () => {
  console.log("\nGoodbye!");
  process.exit(0);
});
