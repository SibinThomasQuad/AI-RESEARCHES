const path = require("path");
const fs = require("fs");
const { TfIdfClassifier } = require("./tfidf");
const { SlotExtractor } = require("./slotExtractor");

/**
 * Main AI / NLP Function Caller Engine.
 * Operates 100% locally with zero external APIs or cloud dependencies.
 */
class FunctionCallerEngine {
  constructor(masterDataPath = null) {
    this.masterDataPath = masterDataPath || path.join(__dirname, "../data/masterData.json");
    this.functions = [];
    this.functionMap = new Map();
    this.classifier = new TfIdfClassifier();
    this.implementations = new Map();

    this.loadMasterData();
    this.registerDefaultImplementations();
    this.watchMasterData();
  }

  /**
   * Watch master data file for external changes and auto-reload index
   */
  watchMasterData() {
    if (this.masterDataPath && fs.existsSync(this.masterDataPath)) {
      let timeout;
      try {
        fs.watch(this.masterDataPath, () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            console.log("⚡ masterData.json updated on disk, reloading NLP index...");
            this.loadMasterData();
          }, 150);
        });
      } catch (e) {
        // file watch optional
      }
    }
  }

  /**
   * Load master data functions from JSON file.
   */
  loadMasterData() {
    try {
      if (fs.existsSync(this.masterDataPath)) {
        const raw = fs.readFileSync(this.masterDataPath, "utf-8");
        this.functions = JSON.parse(raw);
        this._rebuildIndex();
      } else {
        this.functions = [];
      }
    } catch (err) {
      console.error("Error loading master data:", err.message);
      this.functions = [];
    }
  }

  /**
   * Save current master data back to JSON file.
   */
  saveMasterData() {
    try {
      fs.writeFileSync(this.masterDataPath, JSON.stringify(this.functions, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error("Error saving master data:", err.message);
      return false;
    }
  }

  /**
   * Register a new function definition into master data.
   */
  addFunction(fnDef, saveToFile = false) {
    // Validate
    if (!fnDef || !fnDef.name || !fnDef.description) {
      throw new Error("Function definition must include 'name' and 'description'.");
    }

    // Remove existing if any
    this.functions = this.functions.filter(f => f.name.toLowerCase() !== fnDef.name.toLowerCase());
    this.functions.push(fnDef);
    this._rebuildIndex();

    if (saveToFile) {
      this.saveMasterData();
    }
  }

  /**
   * Optional: Register a real JavaScript execution handler for a function name.
   */
  registerImplementation(name, handlerFn) {
    this.implementations.set(name.toLowerCase(), handlerFn);
  }

  /**
   * Re-index classifier with all functions in master data.
   */
  _rebuildIndex() {
    this.classifier = new TfIdfClassifier();
    this.functionMap.clear();

    for (const fn of this.functions) {
      this.functionMap.set(fn.name.toLowerCase(), fn);

      // Combine description, keywords, and examples for semantic indexing
      const corpusParts = [
        fn.name,
        fn.description || "",
        (fn.keywords || []).join(" "),
        (fn.examples || []).join(" ")
      ];

      const corpusText = corpusParts.join(" ");
      this.classifier.addDocument(fn.name, corpusText, fn.keywords || []);
    }

    this.classifier.train();
  }

  /**
   * Parse user prompt, predict the matching function, and extract arguments.
   * @param {string} prompt
   * @returns {Object} Parse result
   */
  parse(prompt) {
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        success: false,
        error: "Prompt cannot be empty",
        matchedFunction: null,
        call: null
      };
    }

    const cleanPrompt = prompt.trim();

    // 1. Classify intent
    const matches = this.classifier.classify(cleanPrompt);

    if (!matches || matches.length === 0 || matches[0].score < 0.1) {
      return {
        success: false,
        error: "No matching function found for the given prompt",
        confidence: matches[0] ? matches[0].score : 0,
        prompt: cleanPrompt,
        matchedFunction: null,
        call: null
      };
    }

    const topMatch = matches[0];
    const functionDef = this.functionMap.get(topMatch.id.toLowerCase());

    // 2. Extract slots / arguments
    const extraction = SlotExtractor.extract(functionDef, cleanPrompt);

    // 3. Format function call string: e.g. "payslip(hareesh, october)"
    // Cleanly omit trailing null/undefined arguments for natural syntax
    const trimmedArgs = [...extraction.args];
    while (trimmedArgs.length > 0 && (trimmedArgs[trimmedArgs.length - 1] === null || trimmedArgs[trimmedArgs.length - 1] === undefined)) {
      trimmedArgs.pop();
    }

    const argListFormatted = trimmedArgs.map(arg => {
      if (arg === null || arg === undefined) return "undefined";
      return String(arg);
    }).join(", ");

    const callString = `${functionDef.name}(${argListFormatted})`;

    const self = this;
    return {
      success: true,
      prompt: cleanPrompt,
      matchedFunction: functionDef.name,
      description: functionDef.description,
      confidence: topMatch.score,
      allMatches: matches.slice(0, 3),
      parameters: extraction.params,
      args: extraction.args,
      call: callString,
      async execute() {
        const handler = self.implementations ? self.implementations.get(functionDef.name.toLowerCase()) : null;
        if (handler) {
          return await handler(...extraction.args);
        }
        return `Simulated execution of: ${callString}`;
      }
    };
  }

  /**
   * Register default mock implementations so the functions can actually be executed!
   */
  registerDefaultImplementations() {
    this.registerImplementation("payslip", (employee, month) => {
      const basic = Math.floor(Math.random() * 30000) + 40000;
      const hra = Math.floor(basic * 0.4);
      const deductions = Math.floor(basic * 0.12);
      const net = basic + hra - deductions;
      return {
        status: "success",
        employee: employee || "Unknown",
        month: month || "Current",
        salaryBreakdown: {
          basicSalary: `$${basic}`,
          hra: `$${hra}`,
          pfDeduction: `$${deductions}`,
          netSalary: `$${net}`
        },
        generatedAt: new Date().toISOString()
      };
    });

    this.registerImplementation("get_attendance", (employee, date) => {
      return {
        status: "success",
        employee: employee || "Unknown",
        date: date || "today",
        isPresent: true,
        punchIn: "09:05 AM",
        punchOut: "06:15 PM",
        workingHours: "9h 10m"
      };
    });

    this.registerImplementation("apply_leave", (employee, days, leaveType) => {
      return {
        status: "submitted",
        employee: employee || "Unknown",
        days: days || 1,
        leaveType: leaveType || "casual",
        referenceId: "LV-" + Math.floor(100000 + Math.random() * 900000),
        message: `Leave application for ${days || 1} day(s) of ${leaveType || "casual"} leave submitted for approval.`
      };
    });

    this.registerImplementation("calculate_tax", (employee, year) => {
      return {
        status: "success",
        employee: employee || "Unknown",
        year: year || "2025-2026",
        taxableIncome: "$72,000",
        standardDeduction: "$7,500",
        estimatedTax: "$8,250"
      };
    });

    this.registerImplementation("send_email", (recipient) => {
      return {
        status: "sent",
        recipient: recipient || "unknown@domain.com",
        sentTime: new Date().toISOString(),
        message: `Email successfully queued for ${recipient}`
      };
    });

    this.registerImplementation("greet", () => {
      return {
        message: "Hello! I am your AI assistant. How can I help you today with your office or HR tasks?",
        status: "active"
      };
    });

    this.registerImplementation("get_help", () => {
      return {
        message: "Here are the tasks I can perform for you:",
        capabilities: [
          "Check Payslips (e.g. 'what is the payslip of hareesh in october')",
          "Check Attendance (e.g. 'is hareesh present today')",
          "Apply for Leave (e.g. 'apply 3 days sick leave for hareesh')",
          "Check Leave Balance (e.g. 'how many leaves left for hareesh')",
          "Calculate Tax / TDS (e.g. 'calculate tax for hareesh in 2025')",
          "Claim Expenses (e.g. 'claim 500 dollars travel reimbursement for hareesh')",
          "Book Meeting Rooms (e.g. 'book conference room A at 2pm')",
          "Schedule Meetings (e.g. 'schedule meeting with hareesh at 3pm')",
          "Employee Directory (e.g. 'who is hareesh\\'s manager')",
          "IT Support Tickets (e.g. 'create IT ticket for laptop wifi not working for hareesh')",
          "Company Policies (e.g. 'what is the work from home policy')",
          "Holiday Calendar (e.g. 'what are the upcoming holidays in october')"
        ]
      };
    });

    this.registerImplementation("get_leave_balance", (employee, leaveType) => {
      return {
        status: "success",
        employee: employee || "me",
        leaveType: leaveType || "all",
        sickLeaveRemaining: 8,
        casualLeaveRemaining: 6,
        vacationDaysRemaining: 14,
        totalLeavesRemaining: 28
      };
    });

    this.registerImplementation("reimburse_expense", (employee, amount, category) => {
      return {
        status: "submitted",
        claimId: "EXP-" + Math.floor(1000 + Math.random() * 9000),
        employee: employee || "me",
        amountClaimed: amount ? `$${amount}` : "$150",
        category: category || "general",
        approvalStatus: "Pending Manager Approval"
      };
    });

    this.registerImplementation("book_meeting_room", (room, time, date) => {
      return {
        status: "confirmed",
        reservationId: "RES-" + Math.floor(1000 + Math.random() * 9000),
        room: room || "Conference Room A",
        time: time || "2pm",
        date: date || "today",
        calendarInviteSent: true
      };
    });

    this.registerImplementation("schedule_meeting", (person, time) => {
      return {
        status: "meeting_scheduled",
        participant: person || "colleague",
        time: time || "3pm",
        meetingLink: "https://meet.google.com/xyz-abcd-efg",
        calendarInvite: "Sent"
      };
    });

    const employeeInfoHandler = (employee, field) => {
      const emp = employee || "Hareesh";
      const f = field || "completeprofile";
      return {
        status: "found",
        employee: emp,
        requestedField: f,
        department: "Engineering",
        designation: "Senior Software Engineer",
        manager: "Sarah Jenkins",
        email: `${emp.toLowerCase().replace(/[^a-z]/g, "")}@company.com`,
        phone: "+1 (555) 019-2834",
        officeLocation: "Bangalore Tech Park, Tower B",
        employmentStatus: "Full-Time Active"
      };
    };
    this.registerImplementation("getemployeeinfo", employeeInfoHandler);
    this.registerImplementation("get_employee_info", employeeInfoHandler);

    this.registerImplementation("it_support_ticket", (employee, issue) => {
      return {
        status: "created",
        ticketNumber: "INC-" + Math.floor(10000 + Math.random() * 90000),
        employee: employee || "me",
        issueCategory: issue || "Hardware/Software",
        priority: "Medium",
        assignedTeam: "Desktop Support",
        slaEstimatedResolution: "Within 4 business hours"
      };
    });

    this.registerImplementation("performance_review", (employee, year) => {
      return {
        status: "success",
        employee: employee || "me",
        year: year || "2025",
        performanceScore: "4.6 / 5.0",
        ratingTier: "Exceeds Expectations",
        appraisalSummary: "Outstanding technical contributions and team leadership."
      };
    });

    this.registerImplementation("get_holiday_list", (month, year) => {
      return {
        year: year || "2026",
        month: month || "all",
        upcomingHolidays: [
          { name: "Thanksgiving Day", date: "2026-11-26" },
          { name: "Christmas Eve & Day", date: "2026-12-24 to 2026-12-25" },
          { name: "New Year's Day", date: "2026-01-01" }
        ]
      };
    });

    this.registerImplementation("get_company_policy", (policyName) => {
      return {
        policy: policyName || "Work From Home Policy",
        summary: "Employees are eligible for hybrid work up to 3 days per week with manager coordination.",
        noticePeriod: "Standard notice period is 30 days for confirmed staff.",
        insuranceCoverage: "Health coverage includes dental, optical, and inpatient hospital care up to $50,000."
      };
    });

    this.registerImplementation("get_project_status", (projectName) => {
      return {
        project: projectName || "Project Titan",
        sprint: "Sprint 16",
        completionRate: "82%",
        deadline: "2026-11-30",
        milestonesAchieved: 14,
        status: "On Schedule"
      };
    });

    this.registerImplementation("get_weather", (city) => {
      return {
        city: city || "Unknown City",
        temperature: "24°C",
        condition: "Partly Cloudy",
        humidity: "65%"
      };
    });
  }
}

module.exports = { FunctionCallerEngine };
