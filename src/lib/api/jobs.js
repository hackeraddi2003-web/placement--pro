import { supabase } from '../supabaseClient'

export const JOB_STAGES = ['applied', 'oa', 'interview', 'offer', 'rejected']
export const JOB_STAGE_LABELS = {
  applied: 'Applied',
  oa: 'Online Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export async function getJobApplications(userId) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('application_date', { ascending: false })
  if (error) throw error
  return data
}

export async function addJobApplication(userId, job) {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ ...job, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateJobApplication(id, updates) {
  const { data, error } = await supabase
    .from('job_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteJobApplication(id) {
  const { error } = await supabase.from('job_applications').delete().eq('id', id)
  if (error) throw error
}
