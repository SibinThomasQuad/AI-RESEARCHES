const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Offline AI Function Caller API",
    version: "1.0.0",
    description: "A local, offline AI & Natural Language Processing (NLP) Function-Calling API in Node.js. It requires **zero external APIs** and dynamically maps user prompts to master data functions with slot/parameter extraction."
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local Development Server"
    }
  ],
  tags: [
    {
      name: "Function Calling",
      description: "Match natural language prompts to registered functions and extract arguments"
    },
    {
      name: "Response Humanizer",
      description: "Convert structured JSON payloads into fluent, human-readable text without external AI"
    },
    {
      name: "Master Data",
      description: "Manage registered functions, descriptions, and parameter definitions"
    }
  ],
  paths: {
    "/": {
      get: {
        tags: ["Function Calling"],
        summary: "Execute Prompt via Query Param (?promt=... or ?prompt=...)",
        description: "Parse a prompt passed as a query string and return the generated function call string (e.g. `payslip(hareesh, october)`). If accessed in a browser without parameters, Swagger UI is rendered.",
        parameters: [
          {
            name: "promt",
            in: "query",
            description: "The user prompt (e.g. 'what is the payslip of hareesh in october')",
            required: false,
            schema: {
              type: "string",
              example: "what is the payslip of hareesh in october"
            }
          },
          {
            name: "prompt",
            in: "query",
            description: "Alternative spelling for promt",
            required: false,
            schema: {
              type: "string",
              example: "what is the payslip of hareesh in october"
            }
          },
          {
            name: "format",
            in: "query",
            description: "Output format: 'text' (default) returns plain function string; 'json' returns full structured analysis.",
            required: false,
            schema: {
              type: "string",
              enum: ["text", "json"],
              default: "text"
            }
          }
        ],
        responses: {
          "200": {
            description: "Function successfully identified and arguments extracted",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                  example: "payslip(hareesh, october)"
                }
              },
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ParseResponse"
                }
              }
            }
          },
          "400": {
            description: "No matching function or invalid prompt",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string", example: "No matching function found for the given prompt" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/call": {
      get: {
        tags: ["Function Calling"],
        summary: "Parse Prompt via GET",
        description: "Returns the formatted function call string like `payslip(hareesh, october)`",
        parameters: [
          {
            name: "prompt",
            in: "query",
            description: "Natural language query",
            required: true,
            schema: {
              type: "string",
              example: "what is the payslip of hareesh in october"
            }
          },
          {
            name: "format",
            in: "query",
            description: "Response format",
            schema: {
              type: "string",
              enum: ["text", "json"],
              default: "text"
            }
          }
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                  example: "payslip(hareesh, october)"
                }
              },
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ParseResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/parse": {
      post: {
        tags: ["Function Calling"],
        summary: "Parse Prompt via JSON POST",
        description: "Analyze prompt text, calculate TF-IDF similarity, extract slots, and return function call metadata.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["prompt"],
                properties: {
                  prompt: {
                    type: "string",
                    example: "what is the payslip of hareesh in october"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Parsed function calling details",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ParseResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/execute": {
      post: {
        tags: ["Function Calling"],
        summary: "Parse & Execute Function",
        description: "Matches the prompt to a function, extracts arguments, and executes the local implementation handler.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["prompt"],
                properties: {
                  prompt: {
                    type: "string",
                    example: "what is the payslip of hareesh in october"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Function parsed and executed",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ParseResponse" },
                    {
                      type: "object",
                      properties: {
                        executionOutput: {
                          type: "object",
                          example: {
                            status: "success",
                            employee: "hareesh",
                            month: "october",
                            salaryBreakdown: {
                              basicSalary: "$50000",
                              hra: "$20000",
                              pfDeduction: "$6000",
                              netSalary: "$64000"
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/humanize": {
      post: {
        tags: ["Response Humanizer"],
        summary: "Convert Structured JSON to Human-Readable Text",
        description: "Takes any structured JSON payload (e.g., from an API call, database, or function execution) and converts it into fluent, natural language sentences without external AI/LLMs.",
        parameters: [
          {
            name: "format",
            in: "query",
            description: "Response format: 'json' (default) returns object with humanText field; 'text' returns plain text string.",
            schema: {
              type: "string",
              enum: ["json", "text"],
              default: "json"
            }
          },
          {
            name: "context",
            in: "query",
            description: "Optional context hint (e.g. 'getemployeeinfo', 'payslip', 'attendance')",
            required: false,
            schema: {
              type: "string"
            }
          }
        ],
        requestBody: {
          required: true,
          description: "Any structured JSON object (employee profile, payslip, attendance, or arbitrary JSON)",
          content: {
            "application/json": {
              schema: {
                type: "object"
              },
              examples: {
                "Employee Profile": {
                  summary: "Full Employee Profile",
                  value: {
                    "employeeId": "EMP1024",
                    "firstName": "John",
                    "lastName": "Doe",
                    "fullName": "John Doe",
                    "email": "john.doe@example.com",
                    "phone": "+1-555-0102",
                    "dateOfBirth": "1995-06-15",
                    "gender": "Male",
                    "address": {
                      "street": "123 Main Street",
                      "city": "New York",
                      "state": "New York",
                      "country": "USA",
                      "postalCode": "10001"
                    },
                    "employment": {
                      "jobTitle": "Software Engineer",
                      "department": "Engineering",
                      "employmentType": "Full-Time",
                      "joiningDate": "2022-03-14",
                      "managerId": "EMP1001",
                      "workLocation": "New York Office",
                      "status": "Active"
                    },
                    "salary": {
                      "currency": "USD",
                      "annualSalary": 85000,
                      "payFrequency": "Monthly"
                    },
                    "skills": ["JavaScript", "React", "Node.js", "SQL", "Git"],
                    "education": [
                      {
                        "degree": "Bachelor of Science",
                        "fieldOfStudy": "Computer Science",
                        "institution": "Example University",
                        "graduationYear": 2017
                      }
                    ],
                    "emergencyContact": {
                      "name": "Jane Doe",
                      "relationship": "Spouse",
                      "phone": "+1-555-0103"
                    }
                  }
                },
                "Payslip": {
                  summary: "Monthly Payslip Breakdown",
                  value: {
                    "status": "success",
                    "employee": "Hareesh",
                    "month": "october",
                    "salaryBreakdown": {
                      "basicSalary": "$49,162",
                      "hra": "$19,664",
                      "pfDeduction": "$5,899",
                      "netSalary": "$62,927"
                    }
                  }
                },
                "Attendance": {
                  summary: "Daily Attendance Record",
                  value: {
                    "employee": "Hareesh",
                    "date": "2026-10-15",
                    "isPresent": true,
                    "punchIn": "09:05 AM",
                    "punchOut": "06:15 PM",
                    "workingHours": "9h 10m"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Successfully converted to natural language text",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    humanText: {
                      type: "string",
                      example: "Here is the payslip for Hareesh for October. The basic salary is $49,162 with an HRA of $19,664 and PF deductions of $5,899 resulting in a net take-home salary of $62,927."
                    },
                    data: { type: "object" }
                  }
                }
              },
              "text/plain": {
                schema: {
                  type: "string",
                  example: "Here is the payslip for Hareesh for October. The basic salary is $49,162 with an HRA of $19,664 and PF deductions of $5,899 resulting in a net take-home salary of $62,927."
                }
              }
            }
          }
        }
      }
    },
    "/api/functions": {
      get: {
        tags: ["Master Data"],
        summary: "List Master Data Functions",
        description: "Retrieve all registered functions, their descriptions, keywords, and parameter schemas.",
        responses: {
          "200": {
            description: "List of master data functions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/FunctionDefinition"
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ["Master Data"],
        summary: "Register / Update Function in Master Data",
        description: "Add a new function definition or update an existing one in the master data.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/FunctionDefinition"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Function successfully registered",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Function registered successfully" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/functions/{name}": {
      delete: {
        tags: ["Master Data"],
        summary: "Delete Master Data Function",
        description: "Remove a function from the master data registry by name.",
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            description: "Name of the function to delete",
            schema: {
              type: "string",
              example: "payslip"
            }
          }
        ],
        responses: {
          "200": {
            description: "Function deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Function 'payslip' deleted successfully" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      ParseResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          prompt: { type: "string", example: "what is the payslip of hareesh in october" },
          matchedFunction: { type: "string", example: "payslip" },
          description: { type: "string", example: "Retrieve salary payslip or pay slip details for an employee" },
          confidence: { type: "number", example: 1.0 },
          parameters: {
            type: "object",
            example: {
              employee: "hareesh",
              month: "october"
            }
          },
          args: {
            type: "array",
            items: { type: "string" },
            example: ["hareesh", "october"]
          },
          call: { type: "string", example: "payslip(hareesh, october)" }
        }
      },
      FunctionDefinition: {
        type: "object",
        required: ["name", "description"],
        properties: {
          name: { type: "string", example: "payslip" },
          description: { type: "string", example: "Retrieve salary payslip details for an employee" },
          keywords: {
            type: "array",
            items: { type: "string" },
            example: ["payslip", "salary slip", "salary", "pay"]
          },
          examples: {
            type: "array",
            items: { type: "string" },
            example: ["what is the payslip of hareesh in october"]
          },
          parameters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", example: "employee" },
                type: { type: "string", example: "string" },
                description: { type: "string", example: "Employee name" },
                prepositions: {
                  type: "array",
                  items: { type: "string" },
                  example: ["of", "for"]
                }
              }
            }
          }
        }
      }
    }
  }
};

module.exports = swaggerSpec;
