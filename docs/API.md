# API Documentation

## Overview

All backend API endpoints are documented using **OpenAPI 3.0** and served via **RapiDoc** at `/api/docs` when the backend is running.

- **OpenAPI Spec**: `/api/docs.json`
- **API Reference**: `http://localhost:3000/api/docs`
- **Library**: `swagger-jsdoc` + RapiDoc (static HTML/JS)
- **Standard**: All responses follow the wrapper:
  - Success: `{ "success": true, "data": <payload> }`
  - Error: `{ "success": false, "error": { "code": "<CODE>", "message": "<message>" } }`

## Endpoint Registry

All planned endpoints by module. Each endpoint must have JSDoc comments for OpenAPI annotation.

### Auth

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | ADMIN | Register new user |
| POST | `/api/auth/login` | PUBLIC | Login, return JWT |
| GET | `/api/auth/me` | AUTHENTICATED | Get current user profile |
| POST | `/api/auth/refresh` | AUTHENTICATED | Refresh JWT token |

### Context (Session)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/context` | AUTHENTICATED | Get current operator session context |
| POST | `/api/context` | AUTHENTICATED | Set/update session context (from scan) |
| POST | `/api/context/reset` | AUTHENTICATED | Reset session context |
| GET | `/api/context/suggestions` | AUTHENTICATED | Get auto-complete suggestions based on context |
| GET | `/api/context/suggestions/grades` | AUTHENTICATED | Get grade suggestions based on context commodity |

### Farmers

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/farmers` | AUTHENTICATED | List all farmers |
| POST | `/api/farmers` | AUTHENTICATED | Create farmer |
| GET | `/api/farmers/:id` | AUTHENTICATED | Get farmer detail |
| PUT | `/api/farmers/:id` | AUTHENTICATED | Update farmer |
| GET | `/api/farmers/:id/pallets` | AUTHENTICATED | Get farmer's pallets |
| GET | `/api/farmers/:id/summary` | AUTHENTICATED | Get farmer's grade summary per commodity |

### Pallets

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/pallets` | AUTHENTICATED | Create pallet |
| GET | `/api/pallets/:id` | AUTHENTICATED | Get pallet detail |
| GET | `/api/pallets/:id/weighings` | AUTHENTICATED | Get pallet weighing history |
| POST | `/api/pallets/:id/weigh` | AUTHENTICATED | Record initial weighing |
| POST | `/api/pallets/:id/pouches` | AUTHENTICATED | Create pouches from pallet |

### Weighing

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/weighing` | AUTHENTICATED | Record weighing |
| POST | `/api/weighing/quick` | AUTHENTICATED | Quick weighing with commodity auto-fill from context |
| GET | `/api/grades` | AUTHENTICATED | List all grades |

### Warehouse

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/warehouse` | AUTHENTICATED | Get warehouse status per commodity |
| POST | `/api/warehouse/in` | AUTHENTICATED | Record stock in |
| POST | `/api/warehouse/out` | AUTHENTICATED | Record stock out |
| GET | `/api/warehouse/summary` | AUTHENTICATED | Get stock summary by grade per commodity |
| GET | `/api/warehouse/capacity` | AUTHENTICATED | Get warehouse capacity per commodity |

### Labels

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/labels/pouch/:pouchId` | AUTHENTICATED | Generate pouch label (QR + EAN-13 + commodity) |
| GET | `/api/labels/packaging/:packagingId` | AUTHENTICATED | Generate packaging label (ITF-14 + commodity) |
| POST | `/api/labels/print` | AUTHENTICATED | Print label via printer service |
| GET | `/api/labels/preview/:type/:id` | AUTHENTICATED | Preview label before print |

### Packaging

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/packaging/types` | AUTHENTICATED | List packaging types |
| POST | `/api/packaging/types` | ADMIN | Create packaging type |
| GET | `/api/packaging/sizes` | AUTHENTICATED | List packaging sizes |
| POST | `/api/packaging/sizes` | ADMIN | Create packaging size |
| POST | `/api/packaging/units` | AUTHENTICATED | Create packaging unit |
| POST | `/api/packaging/units/:id/pack` | AUTHENTICATED | Add items to packaging |
| GET | `/api/packaging/units/:id` | AUTHENTICATED | Get packaging detail + items |
| GET | `/api/packaging/units` | AUTHENTICATED | List all packaging units |
| DELETE | `/api/packaging/units/:id/items/:itemId` | AUTHENTICATED | Remove item from packaging |

### Deliveries

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/deliveries` | AUTHENTICATED | Create delivery |
| POST | `/api/deliveries/:id/packaging` | AUTHENTICATED | Add packaging units to delivery |
| POST | `/api/deliveries/:id/depart` | AUTHENTICATED | Record truck departure |
| GET | `/api/deliveries/:id` | AUTHENTICATED | Get delivery detail |
| GET | `/api/deliveries` | AUTHENTICATED | List all deliveries |
| GET | `/api/deliveries/:id/verify` | AUTHENTICATED | Verify shipment |

## Implementation Notes

1. **JSDoc Annotations**: Every route handler must have JSDoc comments with `@swagger` tags for OpenAPI generation.
2. **Validation**: Use Zod schemas documented in Swagger for request body validation.
3. **RBAC**: Each endpoint must specify required role(s) in OpenAPI security requirement.
4. **Response Codes**: Document 200, 400, 401, 403, 404, 500 for each endpoint.
5. **Examples**: Include example request/response payloads in OpenAPI spec.

## Workflow

1. Define endpoint in `docs/API.md`
2. Implement route in backend with JSDoc + `swagger-jsdoc` annotations
3. Run backend and verify at `/api/docs`
4. Update this file if endpoints change

---

## Context API Contract

### GET /api/context

**Response 200**:
```json
{
  "success": true,
  "data": {
    "farmerId": "farmer-123",
    "farmerName": "Ahmad",
    "commodityId": "cmd-001",
    "commodityName": "Kentang",
    "palletId": "pallet-456",
    "palletCode": "PLT-001",
    "defaultGradeId": "grade-a",
    "location": "Lokasi Kebun A"
  }
}
```

**Response 404** (no context):
```json
{
  "success": true,
  "data": null
}
```

### POST /api/context

**Request Body**:
```json
{
  "farmerId": "farmer-123",
  "commodityId": "cmd-001",
  "palletId": "pallet-456"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "farmerId": "farmer-123",
    "farmerName": "Ahmad",
    "commodityId": "cmd-001",
    "commodityName": "Kentang",
    "palletId": "pallet-456",
    "palletCode": "PLT-001",
    "defaultGradeId": "grade-a",
    "location": "Lokasi Kebun A"
  }
}
```

### POST /api/context/reset

**Response 200**:
```json
{
  "success": true,
  "data": null
}
```

---

## Error Handling Standards

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed (Zod schema) |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient role/permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource or state conflict |
| `INTERNAL_ERROR` | 500 | Server error |

### Logging Levels

- **ERROR**: Server errors, failed operations, exceptions
- **WARN**: Validation failures, auth failures, deprecated usage
- **INFO**: Successful operations, state changes, MQTT messages
- **DEBUG**: Detailed flow, SQL queries (development only)

### Implementation

Use Winston logger with structured JSON format:
```typescript
logger.error('Failed to create pallet', {
  error: error.message,
  stack: error.stack,
  userId: user.id,
  payload: palletData
});
```
