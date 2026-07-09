import { supabase, getAuthenticatedUserId } from '../supabaseClient'
import { offlineDb } from '../offlineDb'

// ---- Daily Tasks ----
export async function getTasksByDate(userId, date) {
  return offlineDb.get(
    'daily_tasks',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('task_date', date)
        .order('priority', { ascending: true })
      if (error) throw error
      return data
    },
    (task) => task.task_date === date
  )
}

export async function getTasksInRange(userId, startDate, endDate) {
  return offlineDb.get(
    'daily_tasks',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('task_date', startDate)
        .lte('task_date', endDate)
      if (error) throw error
      return data
    },
    (task) => task.task_date >= startDate && task.task_date <= endDate
  )
}

export async function getPastUncompletedTasks(userId, todayDate) {
  return offlineDb.get(
    'daily_tasks',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .lt('task_date', todayDate)
      if (error) throw error
      return data || []
    },
    (task) => !task.is_completed && task.task_date < todayDate
  )
}

export async function addTask(userId, task) {
  return offlineDb.save(
    'daily_tasks',
    userId,
    task,
    async (item) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .insert({ ...item, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function toggleTask(id, isCompleted) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'daily_tasks',
    userId,
    { id, is_completed: isCompleted },
    async (item) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .update({ is_completed: isCompleted })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function updateTask(id, updates) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'daily_tasks',
    userId,
    { id, ...updates },
    async (item) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteTask(id) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.delete(
    'daily_tasks',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('daily_tasks').delete().eq('id', id)
      if (error) throw error
    }
  )
}

// ---- Daily Task Stats (completion %) ----
export async function upsertDailyTaskStats(userId, stats) {
  return offlineDb.upsert(
    'daily_task_stats',
    userId,
    stats,
    ['user_id', 'task_date'],
    async (item) => {
      // daily_task_stats has no created_at/id columns (its PK is the
      // user_id+task_date composite) — offlineDb.upsert adds both for local
      // cache bookkeeping, so strip them before sending to Supabase.
      const insertPayload = { ...item }
      delete insertPayload.created_at
      delete insertPayload.id
      const { data, error } = await supabase
        .from('daily_task_stats')
        .upsert(insertPayload, { onConflict: 'user_id,task_date' })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function getDailyTaskStatsByDate(userId, task_date) {
  const results = await offlineDb.get(
    'daily_task_stats',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('daily_task_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('task_date', task_date)
        .maybeSingle()
      if (error) throw error
      return data ? [data] : []
    },
    (stat) => stat.task_date === task_date
  )
  return results && results.length > 0 ? results[0] : null
}

// ---- Goals ----
export async function getGoals(userId) {
  return offlineDb.get(
    'goals',
    userId,
    async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('target_date', { ascending: true })
      if (error) throw error
      return data
    }
  )
}

export async function addGoal(userId, goal) {
  return offlineDb.save(
    'goals',
    userId,
    goal,
    async (item) => {
      const { data, error } = await supabase
        .from('goals')
        .insert({ ...item, user_id: userId })
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function toggleGoal(id, isCompleted) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.save(
    'goals',
    userId,
    { id, is_completed: isCompleted },
    async (item) => {
      const { data, error } = await supabase
        .from('goals')
        .update({ is_completed: isCompleted })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    }
  )
}

export async function deleteGoal(id) {
  const userId = await getAuthenticatedUserId()

  return offlineDb.delete(
    'goals',
    userId,
    id,
    async () => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    }
  )
}
