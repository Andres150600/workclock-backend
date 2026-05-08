// Strips HTML tags from all string values in req.body recursively.
// Prevents stored XSS without requiring external packages.
function sanitizeVal(val) {
  return typeof val === 'string' ? val.replace(/<[^>]*>/g, '').trim() : val
}

function sanitizeDeep(val) {
  if (Array.isArray(val)) return val.map(sanitizeDeep)
  if (val && typeof val === 'object') {
    for (const k of Object.keys(val)) val[k] = sanitizeDeep(val[k])
    return val
  }
  return sanitizeVal(val)
}

export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') sanitizeDeep(req.body)
  next()
}
