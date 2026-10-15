# Offline AI Function Caller API (with Swagger UI)

A 100% offline Natural Language Processing (NLP) Function-Calling API built with **Node.js** and **Swagger (OpenAPI 3.0)**, requiring **zero external APIs** (no OpenAI, no Gemini API keys needed).

Given a natural language query such as:
> `GET /?promt=what is the payslip of hareesh in october`

The API identifies the matching function from master data and extracts its parameters, returning:
> `payslip(hareesh, october)`

---

## 📖 Swagger Documentation

Start the server:
```bash
npm start
```

Access Swagger UI directly in your browser:
- **Swagger Interactive UI**: [http://localhost:3000/](http://localhost:3000/) or [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI 3.0 JSON Spec**: [http://localhost:3000/swagger.json](http://localhost:3000/swagger.json)

---

## ⚡ API Endpoints

### 1. `GET /` or `GET /api/call`
Execute prompt directly via URL query parameters (`?promt=...` or `?prompt=...`).

#### Plain Text Response (Default):
```bash
curl "http://localhost:3000/?promt=what%20is%20the%20payslip%20of%20hareesh%20in%20october"
```
**Output:**
```
payslip(hareesh, october)
```

#### Typo Tolerance Example:
```bash
curl "http://localhost:3000/?promt=what%20is%20the%20payslip%20of%20hareesh%20in%20ocober"
```
**Output:**
```
payslip(hareesh, october)
```

#### JSON Response (`&format=json`):
```bash
curl "http://localhost:3000/?promt=what%20is%20the%20payslip%20of%20hareesh%20in%20october&format=json"
```
**Output:**
```json
{
  "success": true,
  "prompt": "what is the payslip of hareesh in october",
  "matchedFunction": "payslip",
  "confidence": 1.0,
  "parameters": {
    "employee": "hareesh",
    "month": "october"
  },
  "args": ["hareesh", "october"],
  "call": "payslip(hareesh, october)"
}
```

---

### 2. `POST /api/parse`
Parse a natural language prompt via JSON body.

```bash
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{"prompt": "what is the payslip of hareesh in october"}'
```

---

### 3. `POST /api/execute`
Parse the prompt, extract arguments, execute the local implementation, and return both data and natural human text.

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt": "what is the email id of hareesh"}'
```

---

### 4. `POST /api/humanize` (JSON-to-Human-Text API)
Convert any structured JSON response payload into natural, fluent human-readable sentences without external AI.

#### Plain Text Output (`?format=text`):
```bash
curl -s -X POST "http://localhost:3000/api/humanize?format=text" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "employee": "Hareesh",
    "month": "october",
    "salaryBreakdown": {
      "basicSalary": "$49,162",
      "hra": "$19,664",
      "pfDeduction": "$5,899",
      "netSalary": "$62,927"
    }
  }'
```
**Output:**
```text
Here is the payslip for Hareesh for October. The basic salary is $49,162 with an HRA of $19,664 and PF deductions of $5,899 resulting in a net take-home salary of $62,927.
```

#### Employee Info Lookup Example:
```bash
curl -s -X POST "http://localhost:3000/api/humanize?format=text" \
  -H "Content-Type: application/json" \
  -d '{
    "employee": "Hareesh",
    "requestedField": "email",
    "email": "hareesh@company.com"
  }'
```
**Output:**
```text
The email address of Hareesh is hareesh@company.com.
```

#### Arbitrary / Custom JSON Example:
```bash
curl -s -X POST "http://localhost:3000/api/humanize?format=text" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-5432",
    "customer": "Sarah",
    "status": "Shipped",
    "items": ["Ergonomic Keyboard", "Desk Lamp"],
    "totalAmount": "$145.00"
  }'
```
**Output:**
```text
Order id is ORD-5432. Customer is Sarah. Status is Shipped. Items: Ergonomic Keyboard and Desk Lamp. Total amount is $145.00.
```

---

### 4. `GET /api/functions`
List all master data functions, their descriptions, keywords, and parameter schemas.

```bash
curl -s http://localhost:3000/api/functions
```

---

### 5. `POST /api/functions`
Register or update a function in the master data.

```bash
curl -X POST http://localhost:3000/api/functions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "generate_invoice",
    "description": "Generate invoice for customer order",
    "keywords": ["invoice", "bill"],
    "parameters": [
      { "name": "customer", "type": "string", "prepositions": ["for", "of"] },
      { "name": "order_id", "type": "number", "prepositions": ["order"] }
    ]
  }'
```

---

### 6. `DELETE /api/functions/{name}`
Delete a function from master data.

```bash
curl -X DELETE http://localhost:3000/api/functions/generate_invoice
```

---

## 💻 CLI Usage

You can also use the CLI or interactive REPL without starting the server:

```bash
node src/cli.js "what is the payslip of hareesh in october"
# Output: payslip(hareesh, october)
```

Interactive REPL:
```bash
node src/cli.js
```

---

## 🧪 Run Tests

```bash
npm test
```
