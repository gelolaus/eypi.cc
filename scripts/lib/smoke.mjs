export function checkResponse(url, res, expect) {
  if (res.status !== expect.status) {
    return `${url} expected status ${expect.status}, got ${res.status}`
  }
  const contentType = res.contentType ?? ''
  if (!contentType.startsWith(expect.contentTypePrefix)) {
    return `${url} expected content-type ${expect.contentTypePrefix}, got ${contentType || '(none)'}`
  }
  return null
}
