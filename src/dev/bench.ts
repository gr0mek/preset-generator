// Dev-only benchmark page (dev/bench.html) — E1.4/E1.5. Runs the real worker path in the browser.
import { computeLutInWorker } from '../engine/client'
import type { EngineStage } from '../engine/types'
import { filmLook, mapImage, scene, synthImage } from '../../test/synth'

const RUNS = 5
const target = synthImage(512, 512, scene)
const reference = mapImage(target, filmLook)

async function run() {
  const totals: number[] = []
  const stages: Record<string, number[]> = {}
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    const res = await computeLutInWorker({ reference, target })
    totals.push(performance.now() - t0)
    for (const [k, v] of Object.entries(res.stats.timingsMs)) (stages[k] ??= []).push(v)
  }
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
  const report = {
    runs: RUNS,
    medianTotalMs: Math.round(median(totals)),
    stagesMedianMs: Object.fromEntries(
      Object.entries(stages).map(([k, v]) => [k as EngineStage, Math.round(median(v))]),
    ),
    hardwareConcurrency: navigator.hardwareConcurrency,
    userAgent: navigator.userAgent,
  }
  document.getElementById('out')!.textContent = JSON.stringify(report, null, 2)
  ;(window as unknown as { __bench: unknown }).__bench = report
}
run().catch((e) => {
  document.getElementById('out')!.textContent = 'ERROR ' + String(e)
  ;(window as unknown as { __bench: unknown }).__bench = { error: String(e) }
})
