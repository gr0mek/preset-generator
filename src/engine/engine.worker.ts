import * as Comlink from 'comlink'
import { computeLut, type ComputeLutArgs } from './pipeline'
import type { EngineResult, ProgressFn } from './types'

const api = {
  compute(args: Omit<ComputeLutArgs, 'onProgress' | 'isCancelled'>, onProgress?: ProgressFn): EngineResult {
    const result = computeLut({ ...args, onProgress })
    return Comlink.transfer(result, [result.lut.data.buffer])
  },
}
export type EngineWorkerApi = typeof api
Comlink.expose(api)
