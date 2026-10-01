import * as Comlink from 'comlink'
import type { EngineWorkerApi } from './engine.worker'
import type { ComputeLutArgs } from './pipeline'
import { EngineError, type EngineResult, type ProgressFn } from './types'

export const ENGINE_TIMEOUT_MS = 15_000

/**
 * Runs computeLut in a dedicated worker. Each call uses a fresh worker so cancellation
 * (AbortSignal or timeout) is a hard terminate — no half-finished state survives.
 */
export async function computeLutInWorker(
  args: Omit<ComputeLutArgs, 'onProgress' | 'isCancelled'>,
  opts: { signal?: AbortSignal; onProgress?: ProgressFn; timeoutMs?: number } = {},
): Promise<EngineResult> {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
  const api = Comlink.wrap<EngineWorkerApi>(worker)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const abort = new Promise<never>((_, reject) => {
      if (opts.signal?.aborted) reject(new EngineError('ABORTED'))
      opts.signal?.addEventListener('abort', () => reject(new EngineError('ABORTED')), { once: true })
      timer = setTimeout(
        () => reject(new EngineError('ABORTED', 'timeout')),
        opts.timeoutMs ?? ENGINE_TIMEOUT_MS,
      )
    })
    const progress = opts.onProgress ? Comlink.proxy(opts.onProgress) : undefined
    return await Promise.race([api.compute(args, progress), abort])
  } finally {
    clearTimeout(timer)
    api[Comlink.releaseProxy]()
    worker.terminate()
  }
}
