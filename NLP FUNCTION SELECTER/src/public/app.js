document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("prompt-input");
  const submitBtn = document.getElementById("submit-prompt-btn");
  const exampleChips = document.querySelectorAll(".chip");
  
  const functionCallText = document.getElementById("function-call-text");
  const matchedFnName = document.getElementById("matched-fn-name");
  const matchedFnDesc = document.getElementById("matched-fn-desc");
  const confidenceBadge = document.getElementById("confidence-badge");
  const paramsContainer = document.getElementById("params-container");
  const executionOutput = document.getElementById("execution-output");
  const copyBtn = document.getElementById("copy-call-btn");

  const liveApiUrl = document.getElementById("live-api-url");
  const openApiBtn = document.getElementById("open-api-btn");
  const curlCode = document.getElementById("curl-code");

  const functionsList = document.getElementById("functions-list");
  const fnCount = document.getElementById("fn-count");
  const addFnTrigger = document.getElementById("add-fn-trigger");
  const addFnBtn2 = document.getElementById("add-fn-btn-2");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const cancelModalBtn = document.getElementById("cancel-modal-btn");
  const addFunctionForm = document.getElementById("add-function-form");
  const addParamRowBtn = document.getElementById("add-param-row-btn");
  const paramRowsContainer = document.getElementById("param-rows-container");

  // Check URL params on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const initialPrompt = urlParams.get("prompt") || urlParams.get("promt") || urlParams.get("q");
  if (initialPrompt) {
    promptInput.value = initialPrompt;
  }

  // Load functions and run initial prompt
  loadMasterData();
  runPrompt(promptInput.value);

  // Submit Prompt
  submitBtn.addEventListener("click", () => {
    runPrompt(promptInput.value);
  });

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      runPrompt(promptInput.value);
    }
  });

  // Example chips click
  exampleChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      promptInput.value = prompt;
      runPrompt(prompt);
    });
  });

  // Copy button
  copyBtn.addEventListener("click", () => {
    const text = functionCallText.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `<span>✓ Copied!</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
      }, 1500);
    });
  });

  /**
   * Run Prompt against local API
   */
  async function runPrompt(prompt) {
    if (!prompt || !prompt.trim()) return;

    updateApiDemoBox(prompt.trim());

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() })
      });

      const data = await res.json();

      if (data.success) {
        functionCallText.innerText = data.call || "No call generated";
        matchedFnName.innerText = data.matchedFunction || "Unknown";
        matchedFnDesc.innerText = data.description || "N/A";
        
        const confPercent = Math.round((data.confidence || 0) * 100);
        confidenceBadge.innerText = `Confidence: ${confPercent}%`;
        confidenceBadge.style.color = confPercent > 70 ? "#34d399" : "#fbbf24";

        // Render Parameters
        paramsContainer.innerHTML = "";
        const params = data.parameters || {};
        const paramKeys = Object.keys(params);

        if (paramKeys.length === 0) {
          paramsContainer.innerHTML = `<span class="text-sub">No parameters</span>`;
        } else {
          paramKeys.forEach(key => {
            const badge = document.createElement("div");
            badge.className = "param-badge";
            badge.innerHTML = `
              <span class="param-name-tag">${escapeHtml(key)}:</span>
              <span class="param-val-tag">${escapeHtml(String(params[key] || "null"))}</span>
            `;
            paramsContainer.appendChild(badge);
          });
        }

        // Render Execution Output
        executionOutput.innerText = JSON.stringify(data.executionOutput || {}, null, 2);
      } else {
        functionCallText.innerText = `Error: ${data.error || "Could not match function"}`;
        matchedFnName.innerText = "None";
        matchedFnDesc.innerText = "No function matched with high enough confidence.";
        confidenceBadge.innerText = `Confidence: 0%`;
        paramsContainer.innerHTML = `<span class="text-sub">None</span>`;
        executionOutput.innerText = "Function not executed.";
      }
    } catch (err) {
      functionCallText.innerText = "Network / Server Error: " + err.message;
    }
  }

  /**
   * Update API URL and cURL snippet box
   */
  function updateApiDemoBox(prompt) {
    const encoded = encodeURIComponent(prompt);
    const host = window.location.origin;
    const url = `${host}/?promt=${encoded}`;
    const textUrl = `${host}/?promt=${encoded}&format=text`;

    liveApiUrl.innerText = url;
    openApiBtn.href = url;

    curlCode.innerText = `curl "${textUrl}"\n# Returns: ${functionCallText.innerText || "payslip(hareesh, october)"}`;
  }

  /**
   * Load and render Master Data functions
   */
  async function loadMasterData() {
    try {
      const res = await fetch("/api/functions");
      const list = await res.json();

      fnCount.innerText = list.length;
      functionsList.innerHTML = "";

      list.forEach(fn => {
        const card = document.createElement("div");
        card.className = "fn-card";
        
        const paramsList = (fn.parameters || []).map(p => 
          `<span class="fn-param-pill">${escapeHtml(p.name)} (${escapeHtml(p.type || "string")})</span>`
        ).join(" ");

        card.innerHTML = `
          <div class="fn-card-top">
            <span class="fn-name">${escapeHtml(fn.name)}()</span>
            <button class="delete-fn-btn" title="Delete function" data-name="${escapeHtml(fn.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
          <div class="fn-desc">${escapeHtml(fn.description || "")}</div>
          <div class="fn-params-list">
            ${paramsList || '<span style="font-size:0.75rem; color:#6b7280;">No parameters</span>'}
          </div>
        `;

        card.querySelector(".delete-fn-btn").addEventListener("click", async (e) => {
          e.stopPropagation();
          if (confirm(`Delete function "${fn.name}" from Master Data?`)) {
            await deleteFunction(fn.name);
          }
        });

        card.addEventListener("click", () => {
          if (fn.examples && fn.examples.length > 0) {
            promptInput.value = fn.examples[0];
            runPrompt(fn.examples[0]);
          }
        });

        functionsList.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load master data", err);
    }
  }

  /**
   * Delete Function
   */
  async function deleteFunction(name) {
    try {
      await fetch(`/api/functions/${encodeURIComponent(name)}`, { method: "DELETE" });
      loadMasterData();
    } catch (err) {
      alert("Error deleting function: " + err.message);
    }
  }

  // Modal open/close
  function openModal() {
    modalBackdrop.classList.remove("hidden");
  }

  function closeModal() {
    modalBackdrop.classList.add("hidden");
    addFunctionForm.reset();
  }

  addFnTrigger.addEventListener("click", openModal);
  addFnBtn2.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);

  // Add parameter row in modal
  addParamRowBtn.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "param-row";
    row.innerHTML = `
      <input type="text" placeholder="Param name" class="param-name" required />
      <select class="param-type">
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="month">Month</option>
        <option value="date">Date</option>
        <option value="email">Email</option>
        <option value="year">Year</option>
      </select>
      <input type="text" placeholder="Prepositions (e.g. for, of)" class="param-prep" />
    `;
    paramRowsContainer.appendChild(row);
  });

  // Submit Add Function Form
  addFunctionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("new-fn-name").value.trim();
    const desc = document.getElementById("new-fn-desc").value.trim();
    const keywordsRaw = document.getElementById("new-fn-keywords").value.trim();
    const keywords = keywordsRaw ? keywordsRaw.split(",").map(k => k.trim()) : [];

    const paramRows = paramRowsContainer.querySelectorAll(".param-row");
    const parameters = [];

    paramRows.forEach(row => {
      const pName = row.querySelector(".param-name").value.trim();
      const pType = row.querySelector(".param-type").value;
      const pPrep = row.querySelector(".param-prep").value.trim();
      if (pName) {
        parameters.push({
          name: pName,
          type: pType,
          prepositions: pPrep ? pPrep.split(",").map(p => p.trim()) : []
        });
      }
    });

    const newFn = {
      name,
      description: desc,
      keywords,
      examples: [`${name} for example`],
      parameters
    };

    try {
      const res = await fetch("/api/functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFn)
      });

      if (res.ok) {
        closeModal();
        loadMasterData();
        promptInput.value = `test ${name}`;
        runPrompt(promptInput.value);
      } else {
        const data = await res.json();
        alert("Failed to save: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }
});
