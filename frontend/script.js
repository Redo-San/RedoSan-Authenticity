const API_BASE = "http://localhost:3000";
let tauri = null;

document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    
    if (window.__TAURI__) {
        tauri = window.__TAURI__;
        await checkHealth();
    } else {
        console.log("Running in browser mode (fallback)");
        await checkHealthBrowser();
    }
});

function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            
            document.querySelectorAll(".tab-content").forEach(content => {
                content.classList.remove("active");
            });
            document.getElementById(tabName).classList.add("active");
            
            if (tabName === "setup") {
                checkStatus();
            }
        });
    });
}

async function checkHealth() {
    try {
        const { invoke } = window.__TAURI__;
        const result = await invoke("get_health");
        setStatus(result.message || "Connected to Tauri");
        document.querySelector(".version").textContent = `v${result.version || "1.0.0"}`;
    } catch (e) {
        setStatus("Tauri not available: " + e.message);
    }
}

async function checkHealthBrowser() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        setStatus(data.message || "Server connected");
        document.querySelector(".version").textContent = `v${data.version || "1.0.0"}`;
    } catch (e) {
        setStatus("Server not running - Run: python redosan_server.py");
    }
}

function setStatus(message, progress = null) {
    const statusBar = document.getElementById("status-bar");
    statusBar.textContent = message;
    
    const progressBar = document.getElementById("progress");
    const progressFill = document.querySelector(".progress-fill");
    
    if (progress !== null) {
        progressBar.classList.add("active");
        progressFill.style.width = progress + "%";
    } else {
        progressBar.classList.remove("active");
        progressFill.style.width = "0%";
    }
}

function getFilePath(inputId) {
    const input = document.getElementById(inputId);
    return input.value.trim();
}

function showResult(resultDiv, data) {
    resultDiv.style.display = "block";
    if (data.status === "ok" || data.status === "error") {
        if (data.data) {
            resultDiv.innerHTML = Object.entries(data.data)
                .map(([k, v]) => `<div class="result-item"><strong>${k}:</strong> ${v}</div>`).join("");
        } else if (data.message) {
            resultDiv.innerHTML = `<div class="result-item">${data.message}</div>`;
        }
    } else {
        resultDiv.innerHTML = `<div class="result-item error">${data.message || "Unknown error"}</div>`;
    }
}

async function runFingerprint() {
    const filepath = getFilePath("fp-file");
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("fp-result");
    setStatus("Generating fingerprint...", 10);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("compute_fingerprint", { filepath: filepath });
            setStatus("Done", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/fingerprint?file=${encodeURIComponent(filepath)}`);
            const data = await response.json();
            setStatus("Done", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<div class="result-item error">${e.message}</div>`;
    }
}

async function runTimestamp() {
    const filepath = getFilePath("ts-file");
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("ts-result");
    setStatus("Creating timestamp...", 20);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("run_python_script", { 
                scriptName: "modules/ots_stamp.py", 
                args: [filepath, "stamp"] 
            });
            setStatus(data.status === "ok" ? "Timestamp created" : "Timestamp failed", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/timestamp`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({file: filepath})
            });
            const data = await response.json();
            setStatus(data.status === "ok" ? "Timestamp created" : "Timestamp failed", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<div class="result-item error">${e.message}</div>`;
    }
}

async function runVerifyTimestamp() {
    const filepath = getFilePath("ts-file");
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("ts-result");
    setStatus("Verifying timestamp...", 30);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("run_python_script", { 
                scriptName: "modules/ots_stamp.py", 
                args: [filepath, "verify"] 
            });
            setStatus(data.status === "ok" ? "Verified" : "Verification failed", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/verify-ts`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({file: filepath})
            });
            const data = await response.json();
            setStatus(data.status === "ok" ? "Verified" : "Verification failed", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
    }
}

async function runC2PA() {
    const filepath = getFilePath("c2pa-file");
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("c2pa-result");
    setStatus("Analyzing C2PA...", 30);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("run_python_script", { 
                scriptName: "modules/c2pa_read.py", 
                args: [filepath] 
            });
            setStatus("C2PA analysis complete", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/c2pa-read`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({file: filepath})
            });
            const data = await response.json();
            setStatus("C2PA analysis complete", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<div class="result-item error">${e.message}</div>`;
    }
}

async function runWatermark() {
    const filepath = getFilePath("wm-file");
    const mode = document.getElementById("wm-mode")?.value || "check";
    
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("wm-result");
    setStatus(`${mode} watermark...`, 40);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("run_python_script", { 
                scriptName: "modules/wtype9.py", 
                args: [filepath, mode] 
            });
            setStatus("Watermark complete", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/watermark-check`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({file: filepath, params: { mode }})
            });
            const data = await response.json();
            setStatus("Watermark complete", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<div class="result-item error">${e.message}</div>`;
    }
}

async function runMetadata() {
    const filepath = getFilePath("meta-file");
    if (!filepath) {
        setStatus("Please select a file");
        return;
    }
    
    const resultDiv = document.getElementById("meta-result");
    setStatus("Extracting metadata...", 50);
    
    try {
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            const data = await invoke("run_python_script", { 
                scriptName: "modules/exiftool.py", 
                args: [filepath] 
            });
            setStatus("Metadata extracted", 100);
            showResult(resultDiv, data);
        } else {
            const response = await fetch(`${API_BASE}/api/metadata`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({file: filepath})
            });
            const data = await response.json();
            setStatus("Metadata extracted", 100);
            showResult(resultDiv, data);
        }
    } catch (e) {
        setStatus("Error: " + e.message);
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<div class="result-item error">${e.message}</div>`;
    }
}

async function checkStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = "<p>Checking...</p>";
    
    try {
        let data;
        if (window.__TAURI__) {
            const { invoke } = window.__TAURI__;
            data = await invoke("check_system_status");
        } else {
            const response = await fetch(`${API_BASE}/api/status`);
            data = await response.json();
        }
        
        statusDiv.innerHTML = `
            <p class="ok"><strong>System:</strong> OK</p>
            <p><strong>Version:</strong> ${data.version || "1.0.0"}</p>
            <hr>
            <p><strong>Dependencies:</strong></p>
            <p class="${data.modules?.java ? 'ok' : 'error'}">Java: ${data.modules?.java ? 'Available' : 'Not found'}</p>
            <p class="${data.modules?.python ? 'ok' : 'error'}">Python: ${data.modules?.python ? 'Available' : 'Not found'}</p>
            <p class="${data.modules?.openstego ? 'ok' : 'error'}">OpenStego: ${data.modules?.openstego ? 'Available' : 'Not found'}</p>
            <p class="${data.modules?.rust_backend ? 'ok' : 'error'}">Rust Backend: ${data.modules?.rust_backend ? 'Available' : 'Not found'}</p>
        `;
    } catch (e) {
        statusDiv.innerHTML = `<p class="error">Error checking status</p>
            <p>${e.message}</p>`;
    }
    
    setStatus("Ready");
}

function browseFile(inputId) {
    const input = document.getElementById(inputId);
    
    if (window.__TAURI__) {
        const { dialog } = window.__TAURI__;
        dialog.open().then(result => {
            if (result) {
                input.value = result;
            }
        }).catch(err => {
            console.error("Dialog error:", err);
            const filepath = prompt("Enter file path:");
            if (filepath) {
                input.value = filepath;
            }
        });
    } else {
        const filepath = prompt("Enter file path:");
        if (filepath) {
            input.value = filepath;
        }
    }
}

function setProgress(percent) {
    setStatus("Processing...", percent);
}