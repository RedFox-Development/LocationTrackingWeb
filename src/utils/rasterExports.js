const base64ToBlob = (base64, mimeType = 'application/octet-stream') => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export const sanitizeFilenameStem = (value) => {
  return String(value || 'export')
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'export'
}

export const downloadProjectedRasterExport = ({
  pngBase64,
  pgwText,
  fileStem,
  pngMimeType = 'image/png',
  pgwMimeType = 'text/plain',
}) => {
  const safeStem = sanitizeFilenameStem(fileStem)
  const pngBlob = base64ToBlob(pngBase64, pngMimeType)
  const pgwBlob = new Blob([pgwText], { type: pgwMimeType })

  downloadBlob(pngBlob, `${safeStem}.png`)
  downloadBlob(pgwBlob, `${safeStem}.pgw`)
}

export { base64ToBlob, downloadBlob }
