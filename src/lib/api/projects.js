import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

export async function getProjects(userId) {
  return offlineDb.get(
    'projects',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    }
  )
}

export async function addProject(userId, project) {
  return offlineDb.save(
    'projects',
    userId,
    project,
    async (item) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...item, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function updateProject(id, updates) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'projects',
    userId,
    { id, ...updates },
    async (item) => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data
      } catch (err) {
        console.error('[projects.js] updateProject failed', err)
        throw err
      }
    }
  )
}

export async function deleteProject(id) {
  const userId = await getAuthenticatedUserId()
  return offlineDb.delete(
    'projects',
    userId,
    id,
    async () => {
      try {
        const { error } = await supabase.from('projects').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('[projects.js] deleteProject failed', err)
        throw err
      }
    }
  )
}
