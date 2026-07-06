export function sanitizeMentorReviewForStorage(review = {}) {
    const { updated_at, ...rest } = review
    return rest
}
