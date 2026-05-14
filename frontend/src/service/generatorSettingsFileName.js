import packageInfo from '../../package.json'

function cleanPart(value, fallback = '') {
  const part = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}0-9]+/giu, '-')
    .replace(/^-+|-+$/g, '')

  return part || fallback
}

function dimensions(base) {
  if (!base?.active) return []
  const width = cleanPart(base.width, '0')
  const height = cleanPart(base.height, '0')
  const depth = cleanPart(base.depth, '0')
  const radius = cleanPart(base.cornerRadius, '0')
  return [`${width}x${height}x${depth}`, `r${radius}`]
}

function commonModelParts(options = {}) {
  const parts = []
  if (options.keychain?.active) parts.push('key')
  parts.push(...dimensions(options.base))
  if (options.text?.active) parts.push(`text${cleanPart(options.text.size, '0')}`)
  if (options.magnet?.active) {
    parts.push(`magnet${cleanPart(options.magnet.size, '0')}x${cleanPart(options.magnet.depth, '0')}`)
  }
  return parts
}

function generatorParts(generator, options = {}) {
  switch (generator) {
    case 'qr':
      return ['qr', ...commonModelParts(options)]
    case 'barcode':
      return ['barcode', ...commonModelParts(options)]
    case 'grz': {
      const plate = cleanPart(`${options.letter1 || ''}${options.digits || ''}${options.letter2 || ''}${options.letter3 || ''}`, 'plate')
      return ['grz', plate, cleanPart(options.region, 'region'), `${cleanPart(options.width, '65')}mm`]
    }
    case 'braille': {
      const text = cleanPart(options.text || 'braille', 'braille').slice(0, 24)
      return ['braille', `${cleanPart(options.dotMode, '6')}dot`, text]
    }
    case 'coaster':
      return ['coaster', cleanPart(options.base?.shape, 'circle')]
    case 'nametag': {
      const message = cleanPart(options.nametag?.message || 'nametag', 'nametag').slice(0, 24)
      return ['nametag', message]
    }
    default:
      return [cleanPart(generator, 'generator')]
  }
}

export function buildGeneratorSettingsFileName(generator, options = {}) {
  const timestamp = Date.now()
  const parts = ['vsqr', ...generatorParts(generator, options), timestamp]
  return `${parts.filter(Boolean).join('-')}.json`
}

export function buildGeneratorSettingsPayload(settings) {
  return {
    ...settings,
    version: packageInfo.version,
    appVersion: packageInfo.version,
  }
}
