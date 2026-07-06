import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export const JOB_STAGES = ['applied', 'oa', 'interview', 'offer', 'rejected']
export const JOB_STAGE_LABELS = {
  applied: 'Applied',
  oa: 'Online Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export async function getJobApplications(userId) {
  return offlineDb.get(
    'job_applications',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('user_id', userId)
        .order('application_date', { ascending: false })
      if (error) throw error
      return data
    }
  )
}

export async function addJobApplication(userId, job) {
  return offlineDb.save(
    'job_applications',
    userId,
    job,
    async (item) => {
      const { data, error } = await supabase
        .from('job_applications')
        .insert({ ...item, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function updateJobApplication(id, updates) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'job_applications',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteJobApplication(id) {
  let userId = null
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    console.warn('[jobs] no authenticated user for delete, removing locally only', err?.message)
  }

  try {
    return await offlineDb.delete(
      'job_applications',
      userId,
      id,
      async () => {
        const { error } = await supabase.from('job_applications').delete().eq('id', id)
        if (error) throw error
      }
    )
  } catch (err) {
    console.warn('[jobs] delete failed, but local cache was updated', err?.message)
    return null
  }
}
