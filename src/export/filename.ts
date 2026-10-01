/** `presetai_<slug-of-reference>_<YYYYMMDD>.<ext>` — ASCII only, safe on every OS. */
export function presetFilename(referenceName: string | undefined, ext: string, date = new Date()): string {
  const base = (referenceName ?? 'look').replace(/\.[^.]+$/, '')
  const slug =
    base
      .normalize('NFKD')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'look'
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `presetai_${slug}_${ymd}.${ext}`
}
