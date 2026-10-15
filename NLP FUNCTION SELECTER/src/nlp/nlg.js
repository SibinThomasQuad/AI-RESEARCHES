/**
 * Natural Language Generator (NLG) & JSON-to-Text Humanizer.
 * Operates 100% offline with zero external APIs.
 * Converts structured JSON payloads into fluent, human-readable sentences.
 */

function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
}

function formatList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  if (arr.length === 1) return String(arr[0]);
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
}

/**
 * Main JSON-to-Human-Text Formatter
 */
class JsonHumanizer {
  /**
   * Convert any JSON payload to human-readable text.
   * @param {Object} data - Input JSON payload
   * @param {string} [contextHint] - Optional hint (e.g. function name: 'payslip', 'getemployeeinfo')
   * @returns {string} Human-readable natural text
   */
  static humanize(data, contextHint = null) {
    if (data === null || data === undefined) {
      return "No data provided.";
    }

    if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    const hint = (contextHint || "").toLowerCase();

    // 1. Comprehensive Employee Profile or Directory Record
    // Detect if payload represents an employee profile
    const isEmployeeProfile = 
      hint.includes("employee") ||
      data.employeeId ||
      data.fullName ||
      (data.firstName && data.lastName) ||
      (data.employment && data.employment.jobTitle) ||
      (Array.isArray(data.skills) && data.email) ||
      (data.employee && (data.email || data.designation || data.department || data.manager || data.requestedField));

    if (isEmployeeProfile) {
      return this.formatEmployeeProfile(data);
    }

    // 2. Payslip / Salary
    // Only format as payslip if actual payslip fields are present
    const isPayslip =
      data.salaryBreakdown ||
      (data.netSalary && (data.employee || data.basicSalary)) ||
      (hint.includes("payslip") && !data.employeeId && !data.employment);

    if (isPayslip) {
      return this.formatPayslip(data);
    }

    // 3. Attendance / Punch
    if (hint.includes("attendance") || ("isPresent" in data) || data.punchIn) {
      return this.formatAttendance(data);
    }

    // 4. Leave Application / Balance
    if (hint.includes("leave") || data.referenceId?.startsWith("LV-") || data.sickLeaveRemaining !== undefined) {
      return this.formatLeave(data);
    }

    // 5. Expense Reimbursement
    if (hint.includes("expense") || hint.includes("reimburse") || data.claimId) {
      return this.formatExpense(data);
    }

    // 6. Meeting Room Booking
    if (hint.includes("room") || data.reservationId || (data.room && data.time)) {
      return this.formatRoomBooking(data);
    }

    // 7. Meeting Schedule
    if (hint.includes("meeting") || (data.participant && data.time)) {
      return this.formatScheduleMeeting(data);
    }

    // 8. IT Support Ticket
    if (hint.includes("it") || hint.includes("ticket") || data.ticketNumber) {
      return this.formatItTicket(data);
    }

    // 9. Tax Calculation
    if (hint.includes("tax") || data.taxableIncome || data.estimatedTax) {
      return this.formatTax(data);
    }

    // 10. Generic / Arbitrary JSON Fallback
    return this.formatGenericJson(data);
  }

  /**
   * Format full employee profile or single attribute lookup
   */
  static formatEmployeeProfile(data) {
    const name = data.fullName || (data.firstName ? `${data.firstName} ${data.lastName || ""}`.trim() : (data.employee || "Employee"));
    const id = data.employeeId ? ` (${data.employeeId})` : "";
    const requested = (data.requestedField || "").toLowerCase();

    // Check if this was a specific single-field lookup
    if (requested === "email" && data.email) {
      return `The email address of ${name} is ${data.email}.`;
    }
    if (requested === "phone" && (data.phone || data.mobile)) {
      return `The phone number for ${name} is ${data.phone || data.mobile}.`;
    }
    if (requested === "manager" && (data.manager || data.employment?.managerId)) {
      return `${name}'s manager is ${data.manager || data.employment?.managerId}.`;
    }
    if ((requested === "designation" || requested === "role" || requested === "jobtitle") && (data.designation || data.employment?.jobTitle)) {
      const title = data.designation || data.employment?.jobTitle;
      const dept = data.department || data.employment?.department;
      return `${name} currently holds the position of ${title}${dept ? ` in the ${dept} department` : ""}.`;
    }

    const emp = data.employment || {};
    const sentences = [];

    // Header / Core role
    const jobTitle = emp.jobTitle || data.jobTitle || data.designation;
    const dept = emp.department || data.department;
    const loc = emp.workLocation || emp.location || data.workLocation || data.officeLocation;
    const empType = emp.employmentType || "";

    let intro = `${name}${id}`;
    if (jobTitle && dept) {
      intro += ` is a ${empType ? empType + " " : ""}${jobTitle} in the ${dept} department`;
    } else if (jobTitle) {
      intro += ` is a ${jobTitle}`;
    } else if (dept) {
      intro += ` works in the ${dept} department`;
    }

    if (loc) {
      intro += ` at ${loc}`;
    }

    if (emp.joiningDate) {
      intro += `, with the company since ${emp.joiningDate}`;
    }

    if (emp.status) {
      intro += ` (Status: ${emp.status})`;
    }

    sentences.push(intro + ".");

    // Contact details
    const contactParts = [];
    if (data.email) contactParts.push(`Email: ${data.email}`);
    if (data.phone) contactParts.push(`Phone: ${data.phone}`);
    if (contactParts.length > 0) {
      sentences.push(`Contact: ${contactParts.join(" | ")}.`);
    }

    // Address
    if (data.address && typeof data.address === "object") {
      const a = data.address;
      const addrStr = [a.street, a.city, a.state, a.country, a.postalCode].filter(Boolean).join(", ");
      if (addrStr) {
        sentences.push(`Address: ${addrStr}.`);
      }
    }

    // Skills
    if (Array.isArray(data.skills) && data.skills.length > 0) {
      sentences.push(`Skills: ${formatList(data.skills)}.`);
    }

    // Education
    if (Array.isArray(data.education) && data.education.length > 0) {
      const eduList = data.education.map(e => {
        if (typeof e === "string") return e;
        const deg = e.degree ? `${e.degree}` : "";
        const field = e.fieldOfStudy ? ` in ${e.fieldOfStudy}` : "";
        const inst = e.institution ? ` from ${e.institution}` : "";
        const yr = e.graduationYear ? ` (${e.graduationYear})` : "";
        return `${deg}${field}${inst}${yr}`.trim();
      }).filter(Boolean);
      if (eduList.length > 0) {
        sentences.push(`Education: ${formatList(eduList)}.`);
      }
    }

    // Compensation / Salary
    if (data.salary && typeof data.salary === "object") {
      const s = data.salary;
      const cur = s.currency || "USD";
      const amt = s.annualSalary ? `$${Number(s.annualSalary).toLocaleString()} ${cur}` : (s.amount || "");
      const freq = s.payFrequency ? ` paid ${s.payFrequency.toLowerCase()}` : "";
      if (amt) {
        sentences.push(`Compensation: ${amt}${freq}.`);
      }
    }

    // Emergency Contact
    if (data.emergencyContact && typeof data.emergencyContact === "object") {
      const ec = data.emergencyContact;
      const ecRel = ec.relationship ? ` (${ec.relationship})` : "";
      const ecPhone = ec.phone ? ` - ${ec.phone}` : "";
      if (ec.name) {
        sentences.push(`Emergency Contact: ${ec.name}${ecRel}${ecPhone}.`);
      }
    }

    return sentences.join(" ");
  }

  static formatPayslip(data) {
    const employee = capitalize(data.employee || "the employee");
    const month = capitalize(data.month || "the requested period");
    const sb = data.salaryBreakdown || data;

    let parts = [`Here is the payslip for ${employee} for ${month}.`];

    if (sb.basicSalary) parts.push(`The basic salary is ${sb.basicSalary}`);
    if (sb.hra) parts.push(`with an HRA of ${sb.hra}`);
    if (sb.pfDeduction) parts.push(`and PF deductions of ${sb.pfDeduction}`);
    if (sb.netSalary) parts.push(`resulting in a net take-home salary of ${sb.netSalary}.`);

    return parts.join(" ").replace(/ \./g, ".");
  }

  static formatAttendance(data) {
    const employee = capitalize(data.employee || "The employee");
    const date = data.date || "today";

    if (data.isPresent === false) {
      return `${employee} was marked absent on ${date}.`;
    }

    let text = `${employee} was present on ${date}.`;
    if (data.punchIn && data.punchOut) {
      text += ` Punch-in was recorded at ${data.punchIn} and punch-out at ${data.punchOut}`;
      if (data.workingHours) {
        text += ` (total working time: ${data.workingHours}).`;
      } else {
        text += ".";
      }
    } else if (data.punchIn) {
      text += ` Punched in at ${data.punchIn}.`;
    }

    return text;
  }

  static formatLeave(data) {
    if (data.totalLeavesRemaining !== undefined || data.sickLeaveRemaining !== undefined) {
      const emp = capitalize(data.employee || "You");
      return `${emp} currently has ${data.sickLeaveRemaining || 0} sick leave(s), ${data.casualLeaveRemaining || 0} casual leave(s), and ${data.vacationDaysRemaining || 0} vacation day(s) remaining (total: ${data.totalLeavesRemaining || 0} days).`;
    }

    if (data.status === "submitted" || data.referenceId) {
      return data.message || `Leave application for ${data.employee || "employee"} (${data.days || 1} day(s) of ${data.leaveType || "leave"}) has been submitted under reference ${data.referenceId}.`;
    }

    return data.message || "Leave details retrieved successfully.";
  }

  static formatExpense(data) {
    const emp = capitalize(data.employee || "Employee");
    const amount = data.amountClaimed || (data.amount ? `$${data.amount}` : "the amount");
    const cat = data.category ? ` for ${data.category}` : "";
    const id = data.claimId ? ` (Claim ID: ${data.claimId})` : "";
    return `Expense reimbursement claim of ${amount}${cat} has been submitted for ${emp}${id}. Current status: ${data.approvalStatus || "Pending"}.`;
  }

  static formatRoomBooking(data) {
    const room = data.room || "Meeting Room";
    const time = data.time ? ` at ${data.time}` : "";
    const date = data.date ? ` on ${data.date}` : "";
    const resId = data.reservationId ? ` (Booking Ref: ${data.reservationId})` : "";
    return `Reservation confirmed for ${room}${time}${date}${resId}. A calendar invite has been sent to participants.`;
  }

  static formatScheduleMeeting(data) {
    const person = data.participant || "participant";
    const time = data.time ? ` at ${data.time}` : "";
    const link = data.meetingLink ? ` Join link: ${data.meetingLink}.` : "";
    return `Meeting successfully scheduled with ${person}${time}.${link}`;
  }

  static formatItTicket(data) {
    const id = data.ticketNumber || "new ticket";
    const issue = data.issueCategory || data.issue || "technical issue";
    const team = data.assignedTeam ? ` Assigned to ${data.assignedTeam}.` : "";
    const sla = data.slaEstimatedResolution ? ` Resolution ETA: ${data.slaEstimatedResolution}.` : "";
    return `IT Support ticket ${id} has been created for ${issue}.${team}${sla}`;
  }

  static formatTax(data) {
    const emp = capitalize(data.employee || "Employee");
    const yr = data.year || "the tax year";
    const income = data.taxableIncome ? ` on a taxable income of ${data.taxableIncome}` : "";
    const tax = data.estimatedTax ? ` is estimated at ${data.estimatedTax}` : "";
    return `Tax calculation for ${emp} for ${yr}${income}${tax}.`;
  }

  /**
   * General fallback for arbitrary JSON data
   */
  static formatGenericJson(obj) {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "The list is empty.";
      return `Found ${obj.length} item(s): ` + obj.map((item, idx) => {
        if (typeof item === "object") return `Item ${idx + 1}: ${this.formatGenericJson(item)}`;
        return String(item);
      }).join("; ");
    }

    const sentences = [];

    // Check for standard status/message fields first
    if (obj.message && typeof obj.message === "string") {
      sentences.push(obj.message);
    }

    for (const key of Object.keys(obj)) {
      if (key === "message") continue;

      const val = obj[key];
      const label = formatLabel(key);

      if (val === null || val === undefined) continue;

      if (typeof val === "boolean") {
        sentences.push(`${capitalize(label)} is ${val ? "enabled" : "disabled"}.`);
      } else if (Array.isArray(val)) {
        if (val.length > 0) {
          const formattedItems = val.map(item => {
            if (typeof item === "object" && item !== null) {
              return Object.entries(item).map(([k, v]) => `${formatLabel(k)}: ${v}`).join(", ");
            }
            return String(item);
          });
          sentences.push(`${capitalize(label)}: ${formatList(formattedItems)}.`);
        }
      } else if (typeof val === "object") {
        sentences.push(`${capitalize(label)} contains: ${this.formatGenericJson(val)}`);
      } else {
        sentences.push(`${capitalize(label)} is ${val}.`);
      }
    }

    return sentences.join(" ");
  }
}

module.exports = { JsonHumanizer };
