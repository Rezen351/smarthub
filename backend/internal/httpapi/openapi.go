package httpapi

import (
	"net/http"
)

const docsHTMLPrefix = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SmartGeulis Traceability System · OpenAPI Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: #fafafa;
        color: #1e293b;
      }
      .custom-header {
        background: #0f172a;
        color: #ffffff;
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #ea580c;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .brand-title {
        font-size: 17px;
        font-weight: 800;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-badge {
        background: #ea580c;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .header-links a {
        color: #cbd5e1;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        margin-left: 20px;
        transition: color 0.2s;
      }
      .header-links a:hover {
        color: #f97316;
      }
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui .wrapper { max-width: 1200px; padding: 0 20px; margin: 20px auto; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; color: #0f172a; }
      .swagger-ui .btn.authorize { background-color: #ea580c; border-color: #ea580c; color: #fff; }
      .swagger-ui .btn.authorize svg { fill: #fff; }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #2563eb; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #16a34a; }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #d97706; }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626; }
      
      /* Offline Fallback Styles */
      #fallback-ui { display: none; max-width: 1200px; margin: 24px auto; padding: 0 20px 48px; }
      .fb-tag-section { margin: 28px 0; }
      .fb-tag-section h2 { font-size: 20px; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; color: #0f172a; }
      .fb-endpoint { margin: 12px 0; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .fb-endpoint summary { cursor: pointer; display: flex; gap: 14px; align-items: center; padding: 12px 16px; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
      .fb-method { min-width: 68px; padding: 4px 8px; color: white; text-align: center; font-weight: 700; font-size: 11px; border-radius: 3px; }
      .fb-method.get { background: #2563eb; }
      .fb-method.post { background: #16a34a; }
      .fb-method.put, .fb-method.patch { background: #d97706; }
      .fb-method.delete { background: #dc2626; }
      .fb-body { padding: 16px; border-top: 1px solid #f1f5f9; background: #f8fafc; font-size: 13px; color: #334155; }
      .fb-body pre { overflow: auto; padding: 12px; background: #0f172a; color: #f8fafc; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
      @media (max-width: 640px) { .custom-header { flex-direction: column; align-items: flex-start; gap: 10px; } .header-links a { margin: 0 16px 0 0; } }
    </style>
  </head>
  <body>
    <header class="custom-header">
      <div class="brand-title">
        <span>SmartGeulis Traceability System</span>
        <span class="brand-badge">OpenAPI 3.0</span>
      </div>
      <div class="header-links">
        <a href="/api/v1/openapi.json" target="_blank" download>Download Spec (.json)</a>
        <a href="/dashboard">Return to Dashboard →</a>
      </div>
    </header>

    <div id="swagger-ui"></div>
    <div id="fallback-ui"></div>

    <script id="openapi-spec" type="application/json">`

const docsHTMLSuffix = `</script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
    <script>
      (function() {
        var specEl = document.getElementById("openapi-spec");
        var specObj = null;
        try {
          if (specEl && specEl.textContent) {
            specObj = JSON.parse(specEl.textContent);
          }
        } catch (e) {
          console.error("Failed to parse embedded openapi spec", e);
        }

        function renderFallback(spec) {
          var fb = document.getElementById("fallback-ui");
          var sw = document.getElementById("swagger-ui");
          if (!fb || !spec) return;
          if (sw) sw.style.display = "none";
          fb.style.display = "block";

          function esc(v) {
            return String(v || "").replace(/[&<>"']/g, function(c) {
              return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
            });
          }

          var html = '<div style="margin: 20px 0;"><h1>' + esc(spec.info && spec.info.title ? spec.info.title : "API Reference") + '</h1>';
          html += '<p style="color: #64748b; font-size: 14px;">' + esc(spec.info && spec.info.description ? spec.info.description : "") + '</p></div>';

          var grouped = {};
          var paths = spec.paths || {};
          Object.keys(paths).forEach(function(path) {
            var ops = paths[path];
            Object.keys(ops).forEach(function(method) {
              var m = method.toLowerCase();
              if (["get", "post", "put", "patch", "delete"].indexOf(m) < 0) return;
              var op = ops[method];
              var tag = (op.tags && op.tags[0]) ? op.tags[0] : "General";
              if (!grouped[tag]) grouped[tag] = [];
              grouped[tag].push({ path: path, method: m.toUpperCase(), op: op });
            });
          });

          Object.keys(grouped).forEach(function(tag) {
            html += '<section class="fb-tag-section"><h2>' + esc(tag) + '</h2>';
            grouped[tag].forEach(function(item) {
              var desc = item.op.summary || item.op.description || "";
              html += '<details class="fb-endpoint"><summary>';
              html += '<span class="fb-method ' + item.method.toLowerCase() + '">' + item.method + '</span>';
              html += '<strong>' + esc(item.path) + '</strong>';
              html += '<span style="color: #64748b; margin-left: auto;">' + esc(desc) + '</span>';
              html += '</summary><div class="fb-body">';
              if (item.op.description) {
                html += '<p><strong>Description:</strong> ' + esc(item.op.description) + '</p>';
              }
              if (item.op.parameters && item.op.parameters.length) {
                html += '<p><strong>Parameters:</strong></p><ul>';
                item.op.parameters.forEach(function(p) {
                  html += '<li><code>' + esc(p.name) + '</code> (' + esc(p.in) + ')' + (p.required ? ' <em>required</em>' : '') + ' - ' + esc(p.description || '') + '</li>';
                });
                html += '</ul>';
              }
              if (item.op.responses) {
                html += '<p><strong>Responses:</strong></p><pre>' + esc(JSON.stringify(item.op.responses, null, 2)) + '</pre>';
              }
              html += '</div></details>';
            });
            html += '</section>';
          });

          fb.innerHTML = html;
        }

        // Try Swagger UI initialization
        if (typeof SwaggerUIBundle !== "undefined") {
          try {
            window.ui = SwaggerUIBundle({
              spec: specObj || undefined,
              url: specObj ? undefined : "/api/v1/openapi.json",
              dom_id: "#swagger-ui",
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              layout: "BaseLayout",
              defaultModelsExpandDepth: 1,
              defaultModelExpandDepth: 1,
              docExpansion: "list",
              filter: true,
              showRequestHeaders: true
            });
          } catch (err) {
            console.warn("SwaggerUI initialization failed, falling back to native rendering", err);
            renderFallback(specObj);
          }
        } else {
          // Fallback if CDN script could not load
          renderFallback(specObj);
        }
      })();
    </script>
  </body>
</html>`

const openapiJSON = `{
  "openapi": "3.0.3",
  "info": {
    "title": "SmartGeulis Traceability System API",
    "description": "Production REST API for the SmartGeulis Potato Packhouse Traceability System. Covers Reception & Weighing (Station 01), Sorting & 3-Tier Grading (Station 02), 1 kg Pouch Retail Packaging (Station 03), Physical Pallets, Daily & Monthly Reporting with CSV downloads, and Hardware IoT Telemetry.",
    "version": "1.0.0",
    "contact": {
      "name": "SmartGeulis Engineering Team",
      "email": "support@smartgeulisunpad.com"
    }
  },
  "servers": [
    {
      "url": "/api/v1",
      "description": "SmartGeulis Production Gateway (v1)"
    },
    {
      "url": "http://localhost:3000/api/v1",
      "description": "Local Direct Backend Server"
    }
  ],
  "tags": [
    { "name": "System Health", "description": "Core connectivity and database telemetry" },
    { "name": "Authentication", "description": "User login, profile management, and credential updates" },
    { "name": "Station 01: Weighing & Reception", "description": "Farmer harvest intake sacks, tare deduction, and waring logging" },
    { "name": "Station 02: Sorting & Grading", "description": "3-tier potato classification (Grade A, B, C) and pallet allocation" },
    { "name": "Station 03: Retail Packaging", "description": "1 kg potato pouch packaging, GS1 barcode printing, and depletion" },
    { "name": "Pallet Registry", "description": "Reusable physical warehouse pallets (PLT-001 through PLT-010)" },
    { "name": "Reports & Analytics", "description": "Daily recap, monthly recap, farmer rankings, and CSV downloads" },
    { "name": "Hardware & Scales", "description": "Modbus TCP digital scale configuration and live readings" },
    { "name": "Printers", "description": "ESC/POS and TSPL network thermal printer configuration and test dispatch" }
  ],
  "paths": {
    "/health": {
      "get": {
        "tags": ["System Health"],
        "summary": "System Health Status",
        "description": "Returns operational status of the SmartGeulis API and PostgreSQL connection.",
        "responses": {
          "200": {
            "description": "Service is healthy",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": { "type": "string", "example": "ok" },
                    "system": { "type": "string", "example": "SmartGeulis Traceability API" },
                    "database": { "type": "string", "example": "connected" },
                    "timestamp": { "type": "string", "format": "date-time" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/auth/login": {
      "post": {
        "tags": ["Authentication"],
        "summary": "User Login",
        "description": "Authenticate an administrator, operator, or farmer account using email and password.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["email", "password"],
                "properties": {
                  "email": { "type": "string", "format": "email", "example": "admin@smartgeulisunpad.com" },
                  "password": { "type": "string", "format": "password", "example": "admin123" }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Login successful with JWT bearer token"
          },
          "401": {
            "description": "Invalid email or password"
          }
        }
      }
    },
    "/auth/me": {
      "get": {
        "tags": ["Authentication"],
        "summary": "Get Authenticated User",
        "security": [{ "BearerAuth": [] }],
        "responses": {
          "200": { "description": "Current user profile" },
          "401": { "description": "Unauthorized" }
        }
      }
    },
    "/reports/recap/daily": {
      "get": {
        "tags": ["Reports & Analytics"],
        "summary": "Daily Packhouse Recap",
        "description": "Get daily intake, sorting, and packaging totals with per-farmer breakdown. Pass ?format=csv to download as CSV.",
        "parameters": [
          {
            "name": "date",
            "in": "query",
            "required": false,
            "description": "Target date in YYYY-MM-DD format (defaults to current date)",
            "schema": { "type": "string", "example": "2026-11-11" }
          },
          {
            "name": "format",
            "in": "query",
            "required": false,
            "description": "Output format: 'json' (default) or 'csv' for direct download",
            "schema": { "type": "string", "enum": ["json", "csv"], "default": "json" }
          }
        ],
        "responses": {
          "200": {
            "description": "Daily recap report in JSON or CSV",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": { "type": "boolean", "example": true },
                    "data": {
                      "type": "object",
                      "properties": {
                        "date": { "type": "string", "example": "2026-11-11" },
                        "totalWarings": { "type": "integer", "example": 14 },
                        "uniqueFarmers": { "type": "integer", "example": 8 },
                        "grossIntakeKg": { "type": "number", "example": 720.5 },
                        "tareWeightKg": { "type": "number", "example": 16.8 },
                        "netIntakeKg": { "type": "number", "example": 703.7 },
                        "sortingBatches": { "type": "integer", "example": 10 },
                        "gradeAKg": { "type": "number", "example": 350.0 },
                        "gradeBKg": { "type": "number", "example": 240.5 },
                        "gradeCKg": { "type": "number", "example": 105.2 },
                        "shrinkageKg": { "type": "number", "example": 8.0 },
                        "packagedUnits": { "type": "integer", "example": 320 },
                        "packagedWeightKg": { "type": "number", "example": 320.0 }
                      }
                    }
                  }
                }
              },
              "text/csv": {
                "schema": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "/reports/recap/monthly": {
      "get": {
        "tags": ["Reports & Analytics"],
        "summary": "Monthly Packhouse Recap",
        "description": "Get monthly intake, grading, and packaging totals with daily breakdown and top 5 farmers. Pass ?format=csv to download as CSV.",
        "parameters": [
          {
            "name": "month",
            "in": "query",
            "required": false,
            "description": "Target month in YYYY-MM format (defaults to current month)",
            "schema": { "type": "string", "example": "2026-11" }
          },
          {
            "name": "format",
            "in": "query",
            "required": false,
            "description": "Output format: 'json' (default) or 'csv' for direct download",
            "schema": { "type": "string", "enum": ["json", "csv"], "default": "json" }
          }
        ],
        "responses": {
          "200": {
            "description": "Monthly recap report in JSON or CSV"
          }
        }
      }
    },
    "/reports/rankings/farmers": {
      "get": {
        "tags": ["Reports & Analytics"],
        "summary": "Farmer Rankings Leaderboard",
        "description": "Get top delivering farmers ordered by total gross kilograms delivered. Includes contribution percentage, waring count, and last delivery timestamp.",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "description": "Maximum number of farmers to return (1-100, default 10)",
            "schema": { "type": "integer", "default": 10 }
          },
          {
            "name": "period",
            "in": "query",
            "required": false,
            "description": "Time filter: 'all' (default), 'month', or 'today'",
            "schema": { "type": "string", "enum": ["all", "month", "today"], "default": "all" }
          },
          {
            "name": "format",
            "in": "query",
            "required": false,
            "description": "Output format: 'json' (default) or 'csv' for direct download",
            "schema": { "type": "string", "enum": ["json", "csv"], "default": "json" }
          }
        ],
        "responses": {
          "200": {
            "description": "Farmer rankings leaderboard"
          }
        }
      }
    },
    "/weighing": {
      "get": {
        "tags": ["Station 01: Weighing & Reception"],
        "summary": "List Reception Warings",
        "responses": {
          "200": { "description": "List of received sacks with tare and net weights" }
        }
      },
      "post": {
        "tags": ["Station 01: Weighing & Reception"],
        "summary": "Record Sacks Intake (Capture Weight)",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["farmerCode", "grossWeightKg"],
                "properties": {
                  "farmerCode": { "type": "string", "example": "FMR-001" },
                  "grossWeightKg": { "type": "number", "example": 52.4 },
                  "tareWeightKg": { "type": "number", "example": 1.2 }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Intake waring record created" }
        }
      }
    },
    "/sorting/process": {
      "post": {
        "tags": ["Station 02: Sorting & Grading"],
        "summary": "Commit 3-Tier Sorting Batch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["waringCode", "gradeA_Kg", "gradeB_Kg", "gradeC_Kg"],
                "properties": {
                  "waringCode": { "type": "string", "example": "WRG-20261111-0001" },
                  "gradeA_Kg": { "type": "number", "example": 25.0 },
                  "gradeB_Kg": { "type": "number", "example": 18.5 },
                  "gradeC_Kg": { "type": "number", "example": 7.0 },
                  "gradeA_PalletCode": { "type": "string", "example": "PLT-001" },
                  "gradeB_PalletCode": { "type": "string", "example": "PLT-002" },
                  "gradeC_PalletCode": { "type": "string", "example": "PLT-003" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Sorting batch committed and pallets updated" }
        }
      }
    },
    "/packaging/pack": {
      "post": {
        "tags": ["Station 03: Retail Packaging"],
        "summary": "Pack & Deplete 1 kg Retail Pouch",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["palletCode", "weightKg", "grade"],
                "properties": {
                  "palletCode": { "type": "string", "example": "PLT-001" },
                  "weightKg": { "type": "number", "example": 1.0 },
                  "grade": { "type": "string", "example": "A" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Pouch packaged, label generated, and pallet inventory depleted" }
        }
      }
    },
    "/pallets": {
      "get": {
        "tags": ["Pallet Registry"],
        "summary": "List Physical Pallets",
        "responses": {
          "200": { "description": "List of physical pallets with status and remaining kg" }
        }
      }
    },
    "/pallets/closeouts": {
      "get": {
        "tags": ["Pallet Registry"],
        "summary": "List Pallet Remainder Closeouts",
        "responses": {
          "200": { "description": "Recent audited pallet remainder settlements" }
        }
      }
    },
    "/pallets/{code}/release": {
      "post": {
        "tags": ["Pallet Registry"],
        "summary": "Close & Release Physical Pallet",
        "description": "Settles any sub-package remaining weight with an audited disposition and resets the pallet to AVAILABLE for Station 02 Sorting reuse (ADMIN or OPERATOR).",
        "security": [{ "BearerAuth": [] }],
        "parameters": [
          { "name": "code", "in": "path", "required": true, "schema": { "type": "string", "example": "PLT-001" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["disposition"],
                "properties": {
                  "disposition": {
                    "type": "string",
                    "enum": ["SHRINKAGE_LOSS", "CULL_REJECT", "LOOSE_RESERVE", "SAMPLE_USE"]
                  },
                  "notes": { "type": "string", "example": "Moved 0.45 kg edible remainder to loose crate" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Pallet settled and released to AVAILABLE" },
          "400": { "description": "Invalid disposition or pallet already available" },
          "401": { "description": "Authentication required" },
          "403": { "description": "Requires ADMIN or OPERATOR role" },
          "404": { "description": "Pallet not found" }
        }
      }
    },
    "/scales": {
      "get": {
        "tags": ["Hardware & Scales"],
        "summary": "List Station Scales",
        "responses": {
          "200": { "description": "Configured scale network and live weights" }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
`


func (s *server) openapiSpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(openapiJSON))
}

func (s *server) redocUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(docsHTMLPrefix + openapiJSON + docsHTMLSuffix))
}
