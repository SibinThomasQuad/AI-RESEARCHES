#!/usr/bin/env node

/**
 * function_selector.js
 *
 * Lightweight Node.js program to select the correct function name and extract
 * parameters from natural-language prompts using a local Ollama model.
 *
 * Features:
 * - Shows connection and inference status in real-time
 * - Predefined function rules and parameter specifications
 * - Parameter extraction & validation based on function rules
 * - Structured JSON output: { "function": "<name>", "parameters": { ... } }
 * - Strict whitelist validation against hallucinated functions or keys
 * - Never executes functions
 * - Zero external npm dependencies (uses native Node 18+ fetch)
 */

// Configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3:1.7b';

/**
 * Predefined list of available functions, descriptions, and parameter rules.
 */
const AVAILABLE_FUNCTIONS = [
  {
    name: 'get_employees',
    description: 'Retrieve employee information, contact details (such as email, phone), staff profiles, or directory listings.',
    parameters: {
      name: {
        type: 'string',
        description: 'Name of the employee to look up (e.g., "hareesh", "Alice Johnson")',
        required: false
      },
      employee_id: {
        type: 'string',
        description: 'Unique employee ID or employee code (e.g., "EMP001")',
        required: false
      },
      field: {
        type: 'string',
        description: 'Specific information or field requested (e.g., "email", "phone", "salary", "profile")',
        required: false
      },
      department: {
        type: 'string',
        description: 'Department name (e.g., "Engineering", "Marketing", "Sales", "HR")',
        required: false
      },
      role: {
        type: 'string',
        description: 'Specific job title or role (e.g., "Manager", "Senior Engineer")',
        required: false
      }
    }
  },
  {
    name: 'get_attendance',
    description: 'Retrieve employee attendance records and clock-in/clock-out logs.',
    parameters: {
      name: {
        type: 'string',
        description: 'Name of the employee whose attendance is requested',
        required: false
      },
      employee_id: {
        type: 'string',
        description: 'Specific employee identifier or code (e.g., "EMP102")',
        required: false
      },
      date: {
        type: 'string',
        description: 'Target date or relative timeframe (e.g., "yesterday", "today", "2026-10-16")',
        required: false
      }
    }
  },
  {
    name: 'create_employee',
    description: 'Create a new employee record in the system.',
    parameters: {
      name: {
        type: 'string',
        description: 'Full name of the new employee',
        required: true
      },
      email: {
        type: 'string',
        description: 'Email address of the employee',
        required: false
      },
      department: {
        type: 'string',
        description: 'Department name (e.g., "Engineering", "Design")',
        required: false
      },
      role: {
        type: 'string',
        description: 'Assigned job title or position (e.g., "Developer")',
        required: false
      }
    }
  },
  {
    name: 'get_leave_balance',
    description: "Check an employee's remaining leave days and vacation balance.",
    parameters: {
      name: {
        type: 'string',
        description: 'Name of the employee to check leave balance for (e.g., "hareesh")',
        required: false
      },
      employee_id: {
        type: 'string',
        description: 'Employee ID or code (e.g., "EMP042")',
        required: false
      },
      leave_type: {
        type: 'string',
        description: 'Category of leave (e.g., "vacation", "sick", "annual", "casual")',
        required: false
      }
    }
  }
];

/**
 * Output formatted status message to stderr so stdout remains clean JSON.
 * @param {string} message
 * @param {boolean} [silent=false]
 */
function logStatus(message, silent = false) {
  if (!silent) {
    process.stderr.write(`[STATUS] ${message}\n`);
  }
}

/**
 * Build system prompt describing functions, parameter rules, and formatting instructions.
 * @param {Array<object>} functions
 * @returns {string}
 */
function buildSystemPrompt(functions) {
  const functionRules = functions
    .map((fn) => {
      const paramEntries = Object.entries(fn.parameters || {});
      const paramsList = paramEntries.length > 0
        ? paramEntries
            .map(([pName, pRule]) => `      - ${pName} (${pRule.type}, ${pRule.required ? 'REQUIRED' : 'optional'}): ${pRule.description}`)
            .join('\n')
        : '      None';

      return `- "${fn.name}":\n    Description: ${fn.description}\n    Parameters:\n${paramsList}`;
    })
    .join('\n\n');

  return `You are an intelligent function selector and parameter extractor.
Your task is to analyze the user's prompt, choose the single most relevant function from the rules below, and extract appropriate parameters based on the prompt.

Available Functions & Rules:
${functionRules}

Response Rules:
1. Return ONLY a single JSON object with exact keys: "function" and "parameters".
2. "function" MUST be one of the function names listed above, or "unknown" if no function applies.
3. "parameters" MUST be a JSON object containing the extracted arguments matching the function's parameter rules.
4. If a parameter was not mentioned in the prompt, omit it from the "parameters" object.
5. If no available function matches, set "function" to "unknown" and "parameters" to {}.
6. Do NOT invent, assume, or return parameters not defined in the function's rules.
7. Output pure JSON without markdown fences or additional conversational text.`;
}

/**
 * Safely parse JSON from model output.
 * @param {string} text
 * @returns {object|null}
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // 2. Strip markdown code fences (```json ... ```)
    const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
      return JSON.parse(stripped);
    } catch (_) {
      // 3. Match innermost object pattern
      const match = trimmed.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (_) {
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Validate and filter parameters against defined rules for the selected function.
 * @param {object} functionDef
 * @param {object} rawParameters
 * @returns {object} Validated parameters
 */
function validateParameters(functionDef, rawParameters) {
  if (!functionDef || !functionDef.parameters || typeof rawParameters !== 'object' || rawParameters === null) {
    return {};
  }

  const validated = {};
  const rules = functionDef.parameters;

  for (const [key, rule] of Object.entries(rules)) {
    const rawVal = rawParameters[key];

    if (rawVal !== undefined && rawVal !== null) {
      if (rule.type === 'string' && typeof rawVal === 'string') {
        const trimmed = rawVal.trim();
        if (trimmed.length > 0) {
          validated[key] = trimmed;
        }
      } else if (rule.type === 'number' && !isNaN(Number(rawVal))) {
        validated[key] = Number(rawVal);
      } else if (rule.type === 'boolean') {
        validated[key] = Boolean(rawVal);
      } else {
        validated[key] = rawVal;
      }
    }
  }

  return validated;
}

/**
 * Validate function name against whitelist.
 * @param {string|undefined} name
 * @param {Array<object>} functions
 * @returns {string}
 */
function validateFunctionName(name, functions) {
  if (typeof name !== 'string') return 'unknown';
  const cleanName = name.trim();
  const exists = functions.some((f) => f.name === cleanName);
  return exists ? cleanName : 'unknown';
}

/**
 * Selects the matching function and extracts parameters based on function rules.
 *
 * @param {string} userPrompt - Natural language prompt from the user.
 * @param {object} [options]
 * @param {Array} [options.functions] - Custom function list.
 * @param {string} [options.model] - Model name (defaults to qwen3:1.7b).
 * @param {string} [options.host] - Ollama host URL (defaults to http://127.0.0.1:11434).
 * @param {boolean} [options.silent] - Silence stderr status logs.
 * @returns {Promise<{ function: string, parameters: object }>}
 */
async function selectFunction(userPrompt, options = {}) {
  // Input validation
  if (typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    throw new Error('Input validation failed: User prompt must be a non-empty string.');
  }

  const functions = options.functions || AVAILABLE_FUNCTIONS;
  if (!Array.isArray(functions) || functions.length === 0) {
    throw new Error('Input validation failed: Available functions list cannot be empty.');
  }

  const model = options.model || DEFAULT_MODEL;
  const host = options.host || OLLAMA_HOST;
  const silent = options.silent === true;
  const cleanPrompt = userPrompt.trim();

  // Status: Connecting
  logStatus(`Connecting to local Ollama at ${host}...`, silent);

  const systemPrompt = buildSystemPrompt(functions);

  const payload = {
    model: model,
    stream: false,
    format: {
      type: 'object',
      properties: {
        function: { type: 'string' },
        parameters: { type: 'object' }
      },
      required: ['function', 'parameters']
    },
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: cleanPrompt
      }
    ],
    options: {
      temperature: 0
    }
  };

  const startTime = Date.now();
  let response;

  try {
    logStatus(`Connected. Sending prompt to model '${model}'...`, silent);
    logStatus(`Prompt: "${cleanPrompt}"`, silent);

    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    logStatus(`Connection failed to ${host}`, silent);
    throw new Error(
      `Failed to connect to Ollama at "${host}". Please verify Ollama is running.\nDetails: ${err.message}`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    logStatus(`Error response from Ollama (HTTP ${response.status})`, silent);
    throw new Error(`Ollama HTTP ${response.status}: ${errorBody}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  logStatus(`Response received in ${elapsed}s. Validating function rules and parameters...`, silent);

  const data = await response.json();
  const rawContent = data.message?.content || '';

  // Extract structured JSON
  const parsed = extractJson(rawContent);
  const selectedFunctionName = validateFunctionName(parsed?.function, functions);

  if (selectedFunctionName === 'unknown') {
    logStatus(`Result: No matching function found. Returning 'unknown'.`, silent);
    return {
      function: 'unknown',
      parameters: {}
    };
  }

  // Find target function definition to apply its parameter rules
  const targetDef = functions.find((f) => f.name === selectedFunctionName);
  const validatedParams = validateParameters(targetDef, parsed?.parameters);

  logStatus(`Result: Matched '${selectedFunctionName}' with ${Object.keys(validatedParams).length} parameter(s).`, silent);

  return {
    function: selectedFunctionName,
    parameters: validatedParams
  };
}

// -------------------------------------------------------------
// CLI & Test Execution
// -------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);

  // If a command-line argument is passed, process it directly and output JSON to stdout
  if (args.length > 0) {
    const prompt = args.join(' ');
    try {
      const result = await selectFunction(prompt);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  // If run without arguments, demonstrate multiple test scenarios
  console.log('================================================================');
  console.log(' Local Ollama Function & Parameter Selector (Model: ' + DEFAULT_MODEL + ')');
  console.log('================================================================\n');

  const testPrompts = [
    'Show me the attendance records for yesterday',
    'Add a new employee named Alice Johnson into Engineering as Senior Engineer',
    'How many remaining vacation days do I have this year for employee EMP042?',
    'List all staff members currently working in Marketing department',
    'Can you bake a chocolate cake?' // Unrelated prompt -> unknown
  ];

  for (const prompt of testPrompts) {
    console.log(`\n>>> Testing: "${prompt}"`);
    try {
      const result = await selectFunction(prompt);
      console.log('Output JSON:\n' + JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Error:`, err.message);
    }
    console.log('----------------------------------------------------------------');
  }

  console.log('\nTip: You can pass custom prompts directly:');
  console.log('  node function_selector.js "Show me the attendance records for yesterday"');
}

// Export for programmatic use if imported as a module
module.exports = {
  selectFunction,
  AVAILABLE_FUNCTIONS
};

// Execute if run directly from CLI
if (require.main === module) {
  main();
}
