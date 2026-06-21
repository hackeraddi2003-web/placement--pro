/**
 * Placement Readiness Score
 * A weighted composite of all tracked activity, 0-100.
 * Weights reflect typical placement-prep priority distribution.
 */
const WEIGHTS = {
  dsa: 0.30,
  projects: 0.15,
  subjects: 0.15,
  english: 0.15,
  interview: 0.15,
  consistency: 0.10,
}

export function calculateReadinessScore({
  dsaTopics = [],
  projects = [],
  subjects = [],
  englishLogs = [],
  interviewQuestions = [],
  streak = 0,
}) {
  // DSA: average progress across topics (expect 14 core topics)
  const dsaScore = dsaTopics.length
    ? dsaTopics.reduce((sum, t) => sum + (t.progress_pct || 0), 0) / dsaTopics.length
    : 0

  // Projects: completed projects out of a target of 4 solid ones
  const completedProjects = projects.filter((p) => p.status === 'completed').length
  const projectScore = Math.min((completedProjects / 4) * 100, 100)

  // Subjects: average progress across OOPs/DBMS/OS/CN
  const subjectScore = subjects.length
    ? subjects.reduce((sum, s) => sum + (s.progress_pct || 0), 0) / subjects.length
    : 0

  // English: based on recent confidence scores (last 10 logs), scaled 1-10 -> 0-100
  const recentEnglish = englishLogs.slice(-10)
  const englishScore = recentEnglish.length
    ? (recentEnglish.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / recentEnglish.length) * 10
    : 0

  // Interview: average confidence across logged questions, scaled 1-5 -> 0-100
  const interviewScore = interviewQuestions.length
    ? (interviewQuestions.reduce((sum, q) => sum + (q.confidence || 0), 0) / interviewQuestions.length) * 20
    : 0

  // Consistency: streak capped at 30 days = 100
  const consistencyScore = Math.min((streak / 30) * 100, 100)

  const weighted =
    dsaScore * WEIGHTS.dsa +
    projectScore * WEIGHTS.projects +
    subjectScore * WEIGHTS.subjects +
    englishScore * WEIGHTS.english +
    interviewScore * WEIGHTS.interview +
    consistencyScore * WEIGHTS.consistency

  return {
    overall: Math.round(weighted),
    breakdown: {
      dsa: Math.round(dsaScore),
      projects: Math.round(projectScore),
      subjects: Math.round(subjectScore),
      english: Math.round(englishScore),
      interview: Math.round(interviewScore),
      consistency: Math.round(consistencyScore),
    },
  }
}
