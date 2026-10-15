const { tokenize, STOP_WORDS, stringSimilarity } = require("./tokenizer");

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const SHORT_MONTHS = {
  jan: "january", feb: "february", mar: "march", apr: "april",
  may: "may", jun: "june", jul: "july", aug: "august",
  sep: "september", oct: "october", nov: "november", dec: "december"
};

/**
 * Entity and Slot Extractor for mapping prompt tokens to function parameters.
 */
class SlotExtractor {
  /**
   * Extract parameters for a given function definition and user prompt.
   * @param {Object} functionDef - Function master data with parameters schema
   * @param {string} prompt - Raw user prompt
   * @returns {Object} Extracted parameters { [paramName]: value } and ordered array
   */
  static extract(functionDef, prompt) {
    const promptText = prompt.trim();
    const tokens = tokenize(promptText);
    const consumedTokens = new Set();
    const consumedSpans = [];

    // Mark intent keywords as consumed so they are not mistaken for arguments
    const funcName = functionDef.name.toLowerCase();
    consumedTokens.add(funcName);
    if (functionDef.keywords) {
      functionDef.keywords.forEach(k => {
        tokenize(k).forEach(t => consumedTokens.add(t));
      });
    }

    const result = {};
    const orderedArgs = [];
    const params = functionDef.parameters || [];

    // Phase 1: High-priority typed entities (email, date, time, amount, number, month, year, leave_type)
    for (const param of params) {
      if (param.type && ["email", "date", "time", "amount", "month", "number", "integer", "year", "leave_type"].includes(param.type.toLowerCase())) {
        const val = this.extractByType(param.type, tokens, promptText, consumedTokens);
        if (val !== null && val !== undefined) {
          result[param.name] = val;
          consumedTokens.add(String(val).toLowerCase());
        }
      }
    }

    // Phase 1b: Self-reference detection for employee/user parameters ("my payslip", "for me")
    for (const param of params) {
      if (!result[param.name] && ["employee", "user", "name"].includes(param.name.toLowerCase())) {
        if (/\b(my|me|myself)\b/i.test(promptText)) {
          result[param.name] = "me";
          consumedTokens.add("me");
          consumedTokens.add("my");
        }
      }
    }

    // Phase 1c: Enum and schema attribute matching (e.g. field = "email", "manager", "phone", "department")
    for (const param of params) {
      if (!result[param.name]) {
        const enums = param.enum || (param.items && param.items.enum);
        if (Array.isArray(enums) && enums.length > 0) {
          const matchedEnum = this.extractEnum(enums, promptText, consumedTokens);
          if (matchedEnum) {
            result[param.name] = matchedEnum;
            consumedTokens.add(matchedEnum.toLowerCase());
          }
        }
      }
    }

    // Phase 2: Custom regex patterns
    for (const param of params) {
      if (!result[param.name] && param.pattern) {
        const regex = new RegExp(param.pattern, "i");
        const match = promptText.match(regex);
        if (match && match[1]) {
          const val = match[1].trim();
          result[param.name] = val;
          consumedTokens.add(val.toLowerCase());
        }
      }
    }

    // Phase 3: Prepositional context (e.g. "of hareesh", "for rahul")
    for (const param of params) {
      if (!result[param.name] && param.prepositions && param.prepositions.length > 0) {
        for (const prep of param.prepositions) {
          const prepRegex = new RegExp(`\\b${prep}\\s+([a-zA-Z0-9_.-]+)\\b`, "gi");
          let match;
          while ((match = prepRegex.exec(promptText)) !== null) {
            if (match[1]) {
              const rawVal = match[1].trim();
              const lowerVal = rawVal.toLowerCase();

              // Ensure not a stop word, not already consumed, not function name
              if (!STOP_WORDS.has(lowerVal) && !consumedTokens.has(lowerVal)) {
                result[param.name] = rawVal;
                consumedTokens.add(lowerVal);
                break;
              }
            }
          }
          if (result[param.name]) break;
        }
      }
    }

    // Strict types that must never fall back to generic words
    const STRICT_TYPES = new Set(["year", "date", "month", "number", "integer", "amount", "time", "email", "leave_type"]);

    // Phase 4: Fallback for any remaining unassigned parameters
    for (const param of params) {
      if (!result[param.name]) {
        // If it's a specific type we haven't matched yet
        if (param.type) {
          const typedVal = this.extractByType(param.type, tokens, promptText, consumedTokens);
          if (typedVal !== null && typedVal !== undefined) {
            result[param.name] = typedVal;
            consumedTokens.add(String(typedVal).toLowerCase());
          }
        }

        // Only generic string parameters can fall back to unused words
        const isStrict = param.type && STRICT_TYPES.has(param.type.toLowerCase());
        if (!result[param.name] && !isStrict) {
          const fallbackVal = this.extractFallback(param, tokens, consumedTokens);
          if (fallbackVal) {
            result[param.name] = fallbackVal;
            consumedTokens.add(fallbackVal.toLowerCase());
          } else if (param.defaultValue !== undefined) {
            result[param.name] = param.defaultValue;
          } else {
            result[param.name] = null;
          }
        } else if (!result[param.name]) {
          result[param.name] = param.defaultValue !== undefined ? param.defaultValue : null;
        }
      }

      orderedArgs.push(result[param.name]);
    }

    return {
      params: result,
      args: orderedArgs
    };
  }

  /**
   * Extract based on well-known semantic entity types.
   */
  static extractByType(type, tokens, rawPrompt, consumedTokens) {
    switch (type.toLowerCase()) {
      case "month": {
        // Look for exact month names
        for (const token of tokens) {
          const t = token.toLowerCase();
          if (MONTHS.includes(t)) {
            consumedTokens.add(t);
            return t;
          }
          if (SHORT_MONTHS[t]) {
            consumedTokens.add(t);
            return SHORT_MONTHS[t];
          }
        }

        // Fuzzy match for typos like "ocober" -> "october"
        for (const token of tokens) {
          if (consumedTokens.has(token) || token.length < 3) continue;
          for (const m of MONTHS) {
            if (stringSimilarity(token, m) >= 0.75) {
              consumedTokens.add(token);
              return m; // Normalize to matched month
            }
          }
        }
        return null;
      }

      case "date": {
        // Match YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
        const dateMatch = rawPrompt.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/);
        if (dateMatch) {
          return dateMatch[1];
        }
        // Match relative words
        const relMatch = rawPrompt.match(/\b(today|yesterday|tomorrow)\b/i);
        if (relMatch) {
          return relMatch[1].toLowerCase();
        }
        return null;
      }

      case "number":
      case "integer": {
        for (const token of tokens) {
          if (!consumedTokens.has(token) && /^\d+$/.test(token)) {
            return parseInt(token, 10);
          }
        }
        return null;
      }

      case "email": {
        const emailMatch = rawPrompt.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
        return emailMatch ? emailMatch[1] : null;
      }

      case "time": {
        const timeMatch = rawPrompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i);
        if (timeMatch) {
          return timeMatch[1].toLowerCase().replace(/\s+/g, "");
        }
        return null;
      }

      case "amount": {
        const amountMatch = rawPrompt.match(/(?:\$|€|£|₹|inr|usd)?\s*(\b\d+(?:\.\d{1,2})?\b)\s*(?:dollars|bucks|rupees|inr|usd)?/i);
        if (amountMatch) {
          return parseFloat(amountMatch[1]);
        }
        return null;
      }

      case "leave_type": {
        const leaveMatch = rawPrompt.match(/\b(sick|casual|vacation|annual|maternity|paternity|unpaid|half[- ]?day|earned|comp[- ]?off)\b/i);
        if (leaveMatch) {
          return leaveMatch[1].toLowerCase();
        }
        return null;
      }

      case "year": {
        const yearMatch = rawPrompt.match(/\b(20\d{2}|19\d{2})\b/);
        return yearMatch ? yearMatch[1] : null;
      }

      default:
        return null;
    }
  }

  /**
   * Fallback for unfilled parameters: Pick the most appropriate remaining token.
   */
  static extractFallback(param, tokens, consumedTokens) {
    const availableTokens = tokens.filter(
      t => !consumedTokens.has(t.toLowerCase()) && !STOP_WORDS.has(t.toLowerCase())
    );

    if (availableTokens.length > 0) {
      // Return first available content token
      return availableTokens[0];
    }
    return null;
  }

  /**
   * Extract matching enum or attribute value from prompt based on keywords & synonyms.
   */
  static extractEnum(enums, promptText, consumedTokens) {
    const textLower = promptText.toLowerCase();

    // Map common multi-word and colloquial phrases to schema enum values
    const SYNONYMS = {
      "email id": "email",
      "email address": "email",
      "mail id": "email",
      "mail address": "email",
      "phone number": "phone",
      "mobile number": "mobile",
      "contact number": "phone",
      "contact details": "phone",
      "contact info": "phone",
      "job title": "jobtitle",
      "job role": "role",
      "position": "designation",
      "work location": "worklocation",
      "office location": "officelocation",
      "reporting manager": "reportingmanager",
      "manager name": "manager",
      "direct reports": "directreports",
      "reporting hierarchy": "reportinghierarchy",
      "complete profile": "completeprofile",
      "employee id": "employeeid",
      "staff id": "employeeid",
      "emp id": "employeeid"
    };

    for (const phrase in SYNONYMS) {
      if (textLower.includes(phrase)) {
        const target = SYNONYMS[phrase];
        if (enums.includes(target) || enums.includes(target.toLowerCase())) {
          tokenize(phrase).forEach(t => consumedTokens.add(t));
          return target;
        }
      }
    }

    // Direct match against enum list
    for (const e of enums) {
      const eLower = e.toLowerCase();
      // Match exact word boundary: e.g. \bemail\b, \bmanager\b
      const regex = new RegExp(`\\b${eLower}\\b`, "i");
      if (regex.test(textLower)) {
        consumedTokens.add(eLower);
        return e;
      }
    }

    return null;
  }
}

module.exports = { SlotExtractor, MONTHS, SHORT_MONTHS };
