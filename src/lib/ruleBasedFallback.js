/**
 * Rule-based fallback generators.
 * Used when the user has no AI provider configured (provider = 'none').
 * Keeps every AI-labeled feature in the app fully functional offline/free.
 */

const ENGLISH_TOPICS = [
  'Describe your hometown in 2 minutes',
  'Talk about a skill you taught yourself',
  'Explain why you chose MCA after BCA',
  'Describe a time you solved a difficult bug',
  'Talk about your favorite project and why you built it',
  'Explain the difference between a list and an array to a 10-year-old',
  'Describe your ideal first job',
  'Talk about a mistake you learned the most from',
]

const PROJECT_PROMPTS = [
  'Describe your AI Resume Analyzer project: what problem it solves and how.',
  'Walk through your EVA AI assistant — architecture and challenges.',
  'Explain the tech stack of your campus LMS and why you chose it.',
  'Describe a feature you are most proud of in any of your projects.',
]

const DSA_EXPLAIN_PROMPTS = [
  'Explain Two Pointers technique with an example, as if to an interviewer.',
  'Explain how a Sliding Window solution works on a string problem.',
  'Explain Binary Search and one tricky edge case.',
  'Explain the difference between BFS and DFS with a real use case.',
  'Explain how you would detect a cycle in a Linked List.',
]

const HR_PROMPTS = [
  'Tell me about yourself.',
  'What are your strengths?',
  'What are your weaknesses, and how are you working on them?',
  'Why should we hire you?',
  'Where do you see yourself in 5 years?',
]

function pickDaily(list, seedDate = new Date()) {
  const dayIndex = Math.floor(seedDate.getTime() / 86400000)
  return list[dayIndex % list.length]
}

export function getRuleBasedResponse(type, ctx = {}) {
  switch (type) {
    case 'english_task_speak_topic':
      return `Today's speaking task: "${pickDaily(ENGLISH_TOPICS)}" — speak out loud for 2 minutes, then write 3 sentences summarizing what you said.`

    case 'english_task_describe_project':
      return `Today's task: "${pickDaily(PROJECT_PROMPTS)}" — answer like you're in an interview, 1-2 minutes.`

    case 'english_task_explain_dsa':
      return `Today's task: "${pickDaily(DSA_EXPLAIN_PROMPTS)}" — explain out loud as if teaching a junior.`

    case 'english_task_hr_practice':
      return `Today's HR practice question: "${pickDaily(HR_PROMPTS)}" — answer in under 90 seconds, no filler words.`

    case 'mentor_feedback': {
      const { studyHours = 0, tasksCompleted = 0, totalTasks = 0, streak = 0 } = ctx
      const completionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0
      let feedback = `Day logged: ${studyHours}h study, ${tasksCompleted}/${totalTasks} tasks (${completionRate}%).`
      if (completionRate >= 80) {
        feedback += ' Strong day — this is the consistency that compounds.'
      } else if (completionRate >= 50) {
        feedback += ' Decent, but there is slack in the day. Find where it leaked.'
      } else {
        feedback += ' Low completion. Tomorrow, pick 3 non-negotiable tasks and protect them first.'
      }
      if (streak >= 7) feedback += ` Streak at ${streak} days — do not break it for anything trivial.`
      return feedback
    }

    case 'mentor_improvement_suggestions': {
      const { weakAreas = [] } = ctx
      if (weakAreas.length === 0) {
        return 'No flagged weak areas yet. Keep logging DSA topics and English sessions so patterns can surface.'
      }
      return `Focus areas based on your logs: ${weakAreas.join(', ')}. Pick one and give it 30 dedicated minutes tomorrow before anything else.`
    }

    case 'mentor_tomorrow_plan':
      return 'Suggested structure: 1 DSA topic (revision + 2 new problems), 1 English speaking task, 1 hour on active project, 15 min reviewing today\'s mistakes.'

    case 'readiness_insight': {
      const { score = 0 } = ctx
      if (score >= 80) return 'Readiness is strong. Shift focus to mock interviews and company-specific prep.'
      if (score >= 50) return 'Mid-range readiness. DSA consistency and English speaking practice will move this fastest.'
      return 'Early stage. Prioritize daily DSA + journal logging — readiness score responds directly to consistency.'
    }

    default:
      return 'No AI provider configured. Add a Gemini, OpenAI, or Claude key in Settings to unlock generated feedback — the app works fully without one too.'
  }
}
