package httpapi

import (
	"net/http"
)

const redocHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SmartGeulis Traceability System · OpenAPI Redoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="/favicon.png">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: #fafafa;
      }
      .custom-header {
        background: #0f172a;
        color: #ffffff;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #ea580c;
      }
      .brand-title {
        font-size: 18px;
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
    <redoc spec-url="/api/v1/openapi.json"
           theme='{
             "colors": {
               "primary": { "main": "#ea580c" },
               "success": { "main": "#16a34a" },
               "warning": { "main": "#f59e0b" },
               "error": { "main": "#dc2626" }
             },
             "typography": {
               "fontFamily": "\"Plus Jakarta Sans\", sans-serif",
               "headings": { "fontFamily": "\"Plus Jakarta Sans\", sans-serif", "fontWeight": "700" },
               "code": { "fontFamily": "\"JetBrains Mono\", monospace" }
             },
             "sidebar": {
               "backgroundColor": "#ffffff",
               "textColor": "#334155"
             }
           }'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>
`

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
	_, _ = w.Write([]byte(redocHTML))
}

