import { supabase } from '../supabaseClient'

export async function getMentorReviews(userId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from('mentor_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getTodayMentorReview(userId, date) {
  const { data, error } = await supabase
    .from('mentor_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('review_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMentorReview(userId, review) {
  const { data, error } = await supabase
    .from('mentor_reviews')
    .upsert({ ...review, user_id: userId }, { onConflict: 'user_id,review_date' })
    .select()
    .single()
  if (error) throw error
  return data
}
