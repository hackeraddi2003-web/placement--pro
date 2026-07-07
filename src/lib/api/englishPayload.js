export function sanitizeEnglishLogForStorage(log = {}) {
    const { updated_at, ...rest } = log
    return rest
}
