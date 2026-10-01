// Writes a synthetic demo pair (scene + known film look) to test/fixtures/demo/ for harness smoke tests.
import { mkdirSync, writeFileSync } from 'node:fs'
import jpeg from 'jpeg-js'
import { filmLook, mapImage, scene, synthImage } from '../test/synth'
mkdirSync('test/fixtures/demo', { recursive: true })
const tgt = synthImage(640, 400, scene)
const ref = mapImage(tgt, filmLook)
writeFileSync(
  'test/fixtures/demo/synthetic_target.jpg',
  jpeg.encode({ ...tgt, data: Buffer.from(tgt.data) }, 92).data,
)
writeFileSync(
  'test/fixtures/demo/synthetic_ref.jpg',
  jpeg.encode({ ...ref, data: Buffer.from(ref.data) }, 92).data,
)
