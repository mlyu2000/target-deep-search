// Mirrors backend app/llm_service.py _sanitize_id so target_id matching is identical.
export function sanitizeId(name: string): string {
  let s = name.replace(/[^a-zA-Z0-9\s_]/g, '')
  s = s.trim().toLowerCase().replace(/ /g, '_')
  s = s.replace(/_+/g, '_')
  return s.slice(0, 50)
}
