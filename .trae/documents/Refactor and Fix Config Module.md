## Goals
- Fix configuration validation bugs and make getters safe/consistent.
- Align `env.validation.ts` with actual getters used in `config.service.ts`.
- Normalize logging redact handling and provide robust defaults.

## Issues Identified
- `JWT_SECRET` length mismatch: `env.validation.ts:24` uses `min(5)` but message says 32.
- `baseUrl` can be `undefined` but is cast to `string`: `config.service.ts:37–39`.
- Missing schema entries used by getters: `LOG_PRETTY`, `ENABLE_RATE_LIMITING`, `ENABLE_CORS`, `ENABLE_HELMET`.
- `LOG_REDACT` schema is commented out; current getter doesn’t split comma-separated values: `config.service.ts:128–144`, `env.validation.ts:45–51`.

## Changes to `env.validation.ts`
- Update `JWT_SECRET` to `z.string().min(32, 'JWT secret must be at least 32 characters long')`.
- Add `LOG_PRETTY: z.coerce.boolean().default(false)`.
- Add security flags with defaults: `ENABLE_RATE_LIMITING`, `ENABLE_CORS`, `ENABLE_HELMET` as `z.coerce.boolean().default(true)`.
- Add optional `BASE_URL: z.string().url().optional()`.
- Define `LOG_REDACT` with preprocessing to support comma-separated strings:
  - `LOG_REDACT: z.preprocess(val => typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : val, z.array(z.string())).optional()`.

## Changes to `config.service.ts`
- `baseUrl`: return `this.cfg.get<string>('BASE_URL', { infer: true }) || \
  \\`http://\\${this.host}:\\${this.port}\\`` and remove `as string` cast.
- `logRedact`: expect `string[]` from schema and normalize:
  - `const redact = this.cfg.get<string[]>('LOG_REDACT', { infer: true });`
  - If absent or empty, use the existing default list.
  - If a single comma-separated env was provided, schema preprocessing turns it into an array.
- Add `LOG_PRETTY` getter support (already present) backed by the new schema default.
- Keep StrictConfigService wrapper; no behavioral change elsewhere.

## Verification
- Start app without `BASE_URL` and confirm `baseUrl` resolves to `http://0.0.0.0:3000` (or configured host/port).
- Provide an env with short `JWT_SECRET` to verify the validation error matches the 32-char requirement.
- Set `LOG_REDACT="req.headers.authorization,req.headers.cookie"` and confirm the getter returns `['req.headers.authorization','req.headers.cookie']`.
- Toggle `ENABLE_*` flags and confirm getters reflect booleans with defaults when unset.

## Notes
- No runtime usage of `baseUrl` found beyond its getter; safe to refactor now.
- `pinpointApplicationId` remains unchanged; it throws only if called without configuration. No usages found currently.