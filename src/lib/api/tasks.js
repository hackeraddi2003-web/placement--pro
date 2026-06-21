import { supabase } from '../supabaseClient'

// ---- Daily Tasks ----
export async function getTasksByDate(userId, date) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', date)
    .order('priority', { ascending: true })
  if (error) throw error
  return data
}

export async function getTasksInRange(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('task_date', startDate)
    .lte('task_date', endDate)
  if (error) throw error
  return data
}

export async function addTask(userId, task) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert({ ...task, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleTask(id, isCompleted) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .update({ is_completed: isCompleted })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id)
  if (error) throw error
}

// ---- Daily Task Stats (completion %) ----
export async function upsertDailyTaskStats(userId, { task_date, total_tasks, completed_tasks, completion_pct }) {
  const payload = {
    user_id: userId,
    task_date,
    total_tasks,
    completed_tasks,
    completion_pct,
  }

  const { error } = await supabase
    .from('daily_task_stats')
    .upsert(payload, { onConflict: 'user_id,task_date' })

  if (error) throw error
}

export async function getDailyTaskStatsByDate(userId, task_date) {
  const { data, error } = await supabase
    .from('daily_task_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', task_date)
    .maybeSingle()

  if (error) throw error
  return data
}

// ---- Goals ----
export async function getGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true })
  if (error) throw error
  return data
}

export async function addGoal(userId, goal) {
  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleGoal(id, isCompleted) {
  const { data, error } = await supabase
    .from('goals')
    .update({ is_completed: isCompleted })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}
