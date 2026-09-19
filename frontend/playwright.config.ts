import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
const root = resolve('..').replaceAll('\\', '/')
const python = resolve(process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python')
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome' } }],
  webServer: [
    { command: `"${python}" -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8001 --no-access-log`, url: 'http://127.0.0.1:8001/api/v1/health/live', reuseExistingServer: false, timeout: 30000, env: { DATABASE_URL: `sqlite:///${root}/runtime/e2e.db`, STORAGE_ROOT: `${root}/runtime/e2e-files`, AI_PROVIDER: 'local_medgemma', AI_BACKEND: 'transformers', OPENAI_API_KEY: '', QUEUE_MODE: 'inline', SEED_PROFILE: 'minimal', MODEL_PATH: '', DEMO_MODE: 'true', ALLOWED_ORIGINS: 'http://127.0.0.1:5174' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { VITE_BACKEND_TARGET: 'http://127.0.0.1:8001' } },
  ], reporter: 'list',
})
