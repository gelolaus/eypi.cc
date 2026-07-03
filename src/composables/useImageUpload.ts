const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

export function readImageAsDataUrl(
  file: File,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      reject(new Error('Image must be JPEG, PNG, or WebP.'))
      return
    }
    if (file.size > maxBytes) {
      reject(new Error(`Image must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read image.'))
    }
    reader.onerror = () => reject(new Error('Failed to read image.'))
    reader.readAsDataURL(file)
  })
}
