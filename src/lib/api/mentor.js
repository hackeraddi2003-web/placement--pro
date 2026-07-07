import { supabase } from '../supabaseClient'
import { offlineDb } from '../offlineDb'
import { sanitizeMentorReviewForStorage } from './mentorPayload'

export async function getMentorReviews(userId, { limit = 30 } = {}) {
  return offlineDb.get(
    'mentor_reviews',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('mentor_reviews')
        .select('*')
        .eq('user_id', userId)
        .order('review_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    }
  )
}

export async function getTodayMentorReview(userId, date) {
  const results = await offlineDb.get(
    'mentor_reviews',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('mentor_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('review_date', date)
        .maybeSingle()
      if (error) throw error
      return data ? [data] : []
    },
    (r) => r.review_date === date
  )
  return results && results.length > 0 ? results[0] : null
}

export async function upsertMentorReview(userId, review) {
  return offlineDb.upsert(
    'mentor_reviews',
    userId,
    review,
    ['user_id', 'review_date'],
    async (item) => {
      const { data, error } = await supabase
        .from('mentor_reviews')
        .upsert({ ...sanitizeMentorReviewForStorage(item), user_id: userId }, { onConflict: 'user_id,review_date' })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteMentorReview(userId, id) {
  return offlineDb.delete(
    'mentor_reviews',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('mentor_reviews').delete().eq('id', id)
      if (error) throw error
    }
  )
}

