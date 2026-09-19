export function localDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function displayTime(value?: string | null, language = 'ru'): string {
  if (!value) return '—'
  const date = new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
  if (Number.isNaN(date.getTime())) return '—'
  if (!language.startsWith('uz'))
    return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    }).format(date)
  // Some Chromium builds fall back to M01…M12 for Uzbek month names.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tashkent',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const months = [
    'yan',
    'fev',
    'mar',
    'apr',
    'may',
    'iyn',
    'iyl',
    'avg',
    'sen',
    'okt',
    'noy',
    'dek',
  ]
  return `${parts.day}-${months[Number(parts.month) - 1]} · ${parts.hour}:${parts.minute}`
}

export function displayDate(date: Date, language = 'ru'): string {
  if (Number.isNaN(date.getTime())) return '—'
  if (!language.startsWith('uz'))
    return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'ru-RU', {
      day: '2-digit',
      month: 'long',
      timeZone: 'Asia/Tashkent',
    }).format(date)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Tashkent',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const months = [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ]
  return `${parts.day}-${months[Number(parts.month) - 1]}`
}
