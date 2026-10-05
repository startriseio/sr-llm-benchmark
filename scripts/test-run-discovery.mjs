import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listRuns } from '../src/lib.mjs'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sr-run-discovery-'))
const runsDir = path.join(root, 'runs')
const resultsRoot = path.join(root, 'results')
const registryFile = path.join(resultsRoot, 'runs.json')
const options = { runsDir, resultsRoot, registryFile }
const snapshot = async (id) => {
  await fs.mkdir(path.join(resultsRoot, id), { recursive: true })
  await fs.writeFile(path.join(resultsRoot, id, 'scores.json'), '{}')
}
try {
  assert.deepEqual(await listRuns(options), [])
  await snapshot('2026-07-01')
  await snapshot('2026-10-01')
  await fs.mkdir(path.join(resultsRoot, 'unfinished'))
  await fs.writeFile(registryFile, JSON.stringify({
    '2026-07-01': { note: 'published', id: 'wrong-id' },
    ghost: { note: 'registry only' },
  }))
  assert.deepEqual((await listRuns(options)).map(r => r.id), ['2026-10-01', '2026-07-01'])
  assert.equal((await listRuns(options))[1].note, 'published')
  await fs.mkdir(runsDir)
  await fs.writeFile(path.join(runsDir, '.gitkeep'), '')
  assert.equal((await listRuns(options)).length, 2)
  await fs.mkdir(path.join(runsDir, '2026-10-01'))
  await fs.mkdir(path.join(runsDir, '2026-10-02'))
  await fs.mkdir(path.join(runsDir, '.hidden'))
  assert.deepEqual((await listRuns(options)).map(r => r.id), ['2026-10-02', '2026-10-01', '2026-07-01'])
  console.log('✓ run discovery: published-only, gitkeep-only, local-only, mixed, deduplicated, metadata preserved')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
