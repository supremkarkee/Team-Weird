"use strict";

/**
 * CMP-X306 Security Workbench Frontend Engine
 */

let authToken = localStorage.getItem("cmp_auth_token") || null;
let currentUser = null;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  checkSystemHealth();
  checkCurrentUser();
});

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add("active");
  }

  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(btn => {
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(tabId)) {
      btn.classList.add("active");
    }
  });
}

// System Health Verification
async function checkSystemHealth() {
  const statusEl = document.getElementById("system-status-indicator");
  const textEl = document.getElementById("system-status-text");

  try {
    const res = await fetch("/health");
    const data = await res.json();

    if (res.ok && data.status === "UP") {
      statusEl.className = "status-pill status-online";
      textEl.textContent = `Online (DB: ${data.services.database})`;
    } else {
      statusEl.className = "status-pill status-error";
      textEl.textContent = "Degraded (DB Offline)";
    }
  } catch (err) {
    statusEl.className = "status-pill status-error";
    textEl.textContent = "API Unreachable";
  }
}

// Check logged in user status
async function checkCurrentUser() {
  const roleBadge = document.getElementById("current-user-badge");
  const logoutBtn = document.getElementById("quick-logout-btn");

  try {
    const headers = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    const res = await fetch("/api/auth/me", { headers });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      roleBadge.textContent = `${currentUser.username} (${currentUser.role})`;
      roleBadge.className = currentUser.role === "ADMIN" ? "user-role-badge role-admin" : "user-role-badge role-user";
      logoutBtn.classList.remove("hidden");
    } else {
      currentUser = null;
      roleBadge.textContent = "GUEST";
      roleBadge.className = "user-role-badge";
      logoutBtn.classList.add("hidden");
    }
  } catch {
    currentUser = null;
    roleBadge.textContent = "GUEST";
    logoutBtn.classList.add("hidden");
  }
}

// Telemetry output logger
function logTelemetry(method, url, status, data, durationMs = 0) {
  const consoleEl = document.getElementById("console-output");
  const badgeEl = document.getElementById("response-status-badge");

  badgeEl.textContent = `${status} ${status >= 200 && status < 300 ? "OK" : "FAILED"}`;
  badgeEl.className = `badge badge-sm ${status >= 200 && status < 300 ? "badge-accent" : "badge-outline"}`;

  const output = {
    request: {
      method,
      url,
      timestamp: new Date().toISOString()
    },
    response: {
      httpStatus: status,
      duration: `${durationMs}ms`,
      body: data
    }
  };

  consoleEl.textContent = JSON.stringify(output, null, 2);
}

// Interactive Login
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  const startTime = performance.now();
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    logTelemetry("POST", "/api/auth/login", res.status, data, duration);

    if (res.ok && data.token) {
      authToken = data.token;
      localStorage.setItem("cmp_auth_token", authToken);
      await checkCurrentUser();
    }
  } catch (err) {
    logTelemetry("POST", "/api/auth/login", 0, { error: err.message });
  }
}

// Simulate Failed Login
async function simulateFailedLogin() {
  document.getElementById("login-password").value = "WrongPassword999!";
  document.getElementById("login-form").dispatchEvent(new Event("submit"));
}

// Interactive Register
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  const startTime = performance.now();
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, role: "USER" })
    });
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    logTelemetry("POST", "/api/auth/register", res.status, data, duration);

    if (res.ok && data.token) {
      authToken = data.token;
      localStorage.setItem("cmp_auth_token", authToken);
      await checkCurrentUser();
    }
  } catch (err) {
    logTelemetry("POST", "/api/auth/register", 0, { error: err.message });
  }
}

// Logout
async function handleLogout() {
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const startTime = performance.now();
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers
    });
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    authToken = null;
    localStorage.removeItem("cmp_auth_token");
    logTelemetry("POST", "/api/auth/logout", res.status, data, duration);
    await checkCurrentUser();
  } catch (err) {
    logTelemetry("POST", "/api/auth/logout", 0, { error: err.message });
  }
}

// Test Endpoint Probe (Unauthenticated vs Authenticated)
async function testEndpoint(url, method = "GET") {
  const headers = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const startTime = performance.now();
  try {
    const res = await fetch(url, { method, headers });
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();
    logTelemetry(method, url, res.status, data, duration);
  } catch (err) {
    logTelemetry(method, url, 0, { error: err.message });
  }
}

// Set XSS payload shortcut
function setPayload(text) {
  document.getElementById("xss-payload").value = text;
}

// Test Safe Echo Endpoint
async function testSafeEcho() {
  const payload = document.getElementById("xss-payload").value;
  const encodedParam = encodeURIComponent(payload);
  const url = `/api/echo/${encodedParam}`;

  const startTime = performance.now();
  try {
    const res = await fetch(url);
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();
    logTelemetry("GET", url, res.status, data, duration);
  } catch (err) {
    logTelemetry("GET", url, 0, { error: err.message });
  }
}

// Live HTTP Security Header Inspector
async function inspectHeaders() {
  const tbody = document.getElementById("headers-table-body");
  tbody.innerHTML = '<tr><td colspan="3" class="text-center">Querying server response headers...</td></tr>';

  try {
    const res = await fetch("/", { method: "HEAD" });
    const importantHeaders = [
      { name: "content-security-policy", impact: "Blocks unauthorized scripts, object injection, and inline XSS" },
      { name: "strict-transport-security", impact: "Forces browser to communicate only over encrypted HTTPS" },
      { name: "x-frame-options", impact: "Defeats Clickjacking by preventing iframe framing" },
      { name: "x-content-type-options", impact: "Prevents MIME-sniffing exploits (noSniff)" },
      { name: "referrer-policy", impact: "Eliminates sensitive URL parameters from referrer leakage" },
      { name: "x-powered-by", impact: "Suppressed by Helmet to prevent server fingerprinting" }
    ];

    tbody.innerHTML = "";
    importantHeaders.forEach(item => {
      const val = res.headers.get(item.name) || "(Not Present / Suppressed)";
      const isSecure = val !== "(Not Present / Suppressed)" || item.name === "x-powered-by";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: ${isSecure ? 'var(--accent-cyan)' : 'var(--accent-rose)'}; font-weight: 600;">${item.name}</td>
        <td><code>${escapeHtml(val)}</code></td>
        <td style="color: var(--text-secondary);">${item.impact}</td>
      `;
      tbody.appendChild(tr);
    });

    logTelemetry("HEAD", "/", res.status, {
      message: "Security headers retrieved successfully",
      headerCount: [...res.headers.entries()].length
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-rose">Error inspecting headers: ${err.message}</td></tr>`;
  }
}

// Load Audit Logs (Admin)
async function loadAuditLogs() {
  const display = document.getElementById("audit-logs-display");
  display.innerHTML = '<span class="text-muted">Fetching audit logs from database...</span>';

  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const startTime = performance.now();
  try {
    const res = await fetch("/api/admin/audit-logs", { headers });
    const duration = Math.round(performance.now() - startTime);
    const data = await res.json();

    logTelemetry("GET", "/api/admin/audit-logs", res.status, data, duration);

    if (res.ok && data.logs) {
      if (data.logs.length === 0) {
        display.innerHTML = '<span class="text-muted">No security events logged yet.</span>';
        return;
      }

      display.innerHTML = data.logs.map(log => {
        const detailsStr = typeof log.details === "object" ? JSON.stringify(log.details) : log.details;
        return `
          <div class="log-line">
            <span class="log-time">[${new Date(log.created_at).toLocaleTimeString()}]</span>
            <span class="log-level-${log.status}">[${log.status}]</span>
            <span style="color: var(--accent-purple); font-weight: 600;">${log.event_type}</span>
            <span style="color: var(--text-muted);">&bull; Actor: ${log.actor_id || "ANONYMOUS"} &bull; IP: ${log.ip_address}</span>
            <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 2px;">${escapeHtml(detailsStr)}</div>
          </div>
        `;
      }).join("");
    } else {
      display.innerHTML = `<span style="color: var(--accent-rose); font-weight: 600;">Access Denied (HTTP ${res.status}): ${data.error || "Requires ADMIN credentials."}</span>`;
    }
  } catch (err) {
    display.innerHTML = `<span style="color: var(--accent-rose);">Error: ${err.message}</span>`;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
