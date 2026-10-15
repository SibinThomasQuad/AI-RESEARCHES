const { FunctionCallerEngine } = require("../src/nlp/engine");

const engine = new FunctionCallerEngine();

const testCases = [
  { prompt: "hello chatbot", expectedFn: "greet" },
  { prompt: "what can you do", expectedFn: "get_help" },
  { prompt: "what is the payslip of hareesh in october", expectedFn: "payslip" },
  { prompt: "what is the payslip of hareesh in ocober", expectedFn: "payslip" },
  { prompt: "my payslip for september", expectedFn: "payslip" },
  { prompt: "is hareesh present today", expectedFn: "get_attendance" },
  { prompt: "check attendance of hareesh on 2026-10-15", expectedFn: "get_attendance" },
  { prompt: "apply 3 days sick leave for hareesh", expectedFn: "apply_leave" },
  { prompt: "how many leaves left for hareesh", expectedFn: "get_leave_balance" },
  { prompt: "calculate tax for hareesh in 2025", expectedFn: "calculate_tax" },
  { prompt: "claim 500 dollars travel reimbursement for hareesh", expectedFn: "reimburse_expense" },
  { prompt: "book conference room A at 2pm", expectedFn: "book_meeting_room" },
  { prompt: "schedule meeting with hareesh at 3pm", expectedFn: "schedule_meeting" },
  { prompt: "who is hareesh's manager", expectedFn: "getemployeeinfo" },
  { prompt: "what is the email id of hareesh", expectedFn: "getemployeeinfo" },
  { prompt: "create IT ticket for laptop wifi not working for hareesh", expectedFn: "it_support_ticket" },
  { prompt: "what was hareesh performance rating in 2025", expectedFn: "performance_review" },
  { prompt: "what are the upcoming holidays in october", expectedFn: "get_holiday_list" },
  { prompt: "what is the work from home policy", expectedFn: "get_company_policy" },
  { prompt: "what is the status of project titan", expectedFn: "get_project_status" },
  { prompt: "send email to hareesh@example.com", expectedFn: "send_email" },
  { prompt: "what is the weather in london", expectedFn: "get_weather" }
];

console.log("=== RUNNING EXPANDED CHATBOT NLP FUNCTION CALLER TESTS ===");
let passed = 0;

testCases.forEach((tc, idx) => {
  const result = engine.parse(tc.prompt);
  const isMatch = result.success && result.matchedFunction === tc.expectedFn;
  const status = isMatch ? "✓ PASS" : "✗ FAIL";

  console.log(`\n[Test ${idx + 1}] [${status}] Prompt: "${tc.prompt}"`);
  console.log(`  Expected: ${tc.expectedFn} | Got: ${result.matchedFunction} (Score: ${result.confidence})`);
  console.log(`  Generated Call: ${result.call}`);
  console.log(`  Parameters:     ${JSON.stringify(result.parameters)}`);

  if (isMatch) {
    passed++;
  }
});

console.log(`\n=== SUMMARY: ${passed}/${testCases.length} Passed ===\n`);

if (passed !== testCases.length) {
  process.exit(1);
}
