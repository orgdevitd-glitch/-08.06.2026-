import { Project, ProjectCalculatedMetrics, ProjectTask } from "../../src/types";

export function calculateProjectMetrics(project: Project, assessmentDate: Date): ProjectCalculatedMetrics {
  const completeness = calculateCompleteness(project);
  const timeliness = calculatePcTimeliness(project, assessmentDate);
  const planFact = calculatePlanFactByQuarter(project);
  
  // Calculate Progress and Weights based on planFact Q1-Q4
  const totalPlanWeight = planFact.reduce((acc, q) => acc + q.planWeight, 0);
  const totalFactWeight = planFact.reduce((acc, q) => acc + q.factWeight, 0);
  
  // The system was calculating it from tasks before, but the user explicitly wants to use Q1-Q4 plan/fact sums.
  let progressPercent: number | null = null;
  if (totalPlanWeight > 0) {
     progressPercent = (totalFactWeight / totalPlanWeight) * 100;
  }
  
  // Deviation
  // Strictly speaking, deviation is difference between what we planned to have done by now, and what we actually have done.
  // We'll calculate deviation as sum(factQuarter) - sum(planQuarter) for all evaluated quarters.
  // But user stated: "фактический вес минус плановый вес на текущий период". 
  // Let's use totalFactWeight - totalPlanWeight for simplicity, or just use the current totalFact - totalPlan.
  const deviationPercent = totalPlanWeight > 0 ? totalFactWeight - totalPlanWeight : null;

  const indicatorsStatus = calculateIndicatorsStatus(project);
  const overallStatus = getOverallStatus(project, timeliness.pcStatus, deviationPercent, indicatorsStatus, completeness.significantCompletenessPercent, planFact);

  return {
    ...completeness,
    ...timeliness,
    weightedTaskProgressPercent: progressPercent !== null ? progressPercent : 0, 
    planFactByQuarter: planFact,
    dataWarnings: detectDataWarnings(project),
    indicatorsStatus,
    overallStatus,
    totalPlanWeight,
    totalFactWeight,
    deviationPercent
  };
}

function calculateIndicatorsStatus(project: Project) {
  if (!project.indicators || project.indicators.length === 0) return "Нет показателей";
  
  const hasPlan = project.indicators.some(i => i.planValue !== undefined && i.planValue !== null && i.planValue !== "");
  const missingFact = project.indicators.some(i => (i.planValue && (!i.factValue || i.factValue === "")));
  
  // A simplistic lag detection: if fact < plan for numeric targets
  let lag = false;
  project.indicators.forEach(i => {
    if (i.planValue && i.factValue) {
      const pNum = parseFloat(i.planValue.toString().replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      const fNum = parseFloat(i.factValue.toString().replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      // Basic check, assumes higher is better. Realistically requires complex logic per indicator type,
      // but we will do a basic numeric comparison.
      if (!isNaN(pNum) && !isNaN(fNum) && fNum < pNum) {
        lag = true;
      }
    }
  });

  if (hasPlan && missingFact) return "Нет факта";
  if (lag) return "Отставание";
  return "В норме";
}

function getOverallStatus(
  project: Project, 
  pcStatus: string, 
  deviationPercent: number | null, 
  indicatorsStatus: string, 
  completenessPercent: number,
  planFact: any[]
): "Норма" | "Под наблюдением" | "Зона риска" | "Недостаточно данных" {
  
  const hasCrucialDataLags = completenessPercent < 50;
  
  if (project.status === "completed") return "Норма"; // Completed projects have less strict rules

  if (pcStatus === "Просрочен" || hasCrucialDataLags || (deviationPercent !== null && deviationPercent < 0) || indicatorsStatus === "Отставание") {
     return "Зона риска";
  }

  if (pcStatus === "Недостаточно данных" || completenessPercent < 80 || indicatorsStatus === "Нет факта") {
     return "Под наблюдением";
  }
  
  if (indicatorsStatus === "Нет показателей") {
     return "Недостаточно данных";
  }

  return "Норма";
}

function translateFieldName(field: string): string {
  const map: Record<string, string> = {
    projectName: "Название проекта",
    status: "Статус проекта",
    stage: "Стадия проекта",
    executor: "Исполнитель",
    deadlineAt: "Крайний срок",
    lastPcDate: "Дата последнего ПК",
    monitoringFrequencyWeeks: "Регулярность мониторинга",
    goals: "Цели проекта",
    resourceValue: "Объем ресурсов",
    resourceLevel: "Уровень обеспеченности ресурсами",
    rice: "Оценка RICE",
    roi: "Показатель ROI",
    tasks: "Задачи и вехи",
    indicators: "Проектные показатели",
    itResourceLevel: "Объем ИТ-ресурсов"
  };
  return map[field] || "Неописанное поле данных";
}

function calculateCompleteness(project: Project) {
  const significantFields = [
    "projectName", "status", "stage", "executor", "deadlineAt", "lastPcDate", 
    "monitoringFrequencyWeeks", "goals", "resourceValue", "resourceLevel", "rice", "roi", "tasks", "indicators"
  ];
  
  if (project.resourceLevel || project.resourceValue) {
    significantFields.push("itResourceLevel");
  }

  const allFields = Object.keys(project);
  let filledFields = 0;
  let filledSignificantFields = 0;
  const missingSignificantFields: string[] = [];

  significantFields.forEach(field => {
    let val = (project as any)[field];
    
    // Exception mapping
    if (field === "rice" || field === "roi") {
       if (project.rice || project.roi) {
         val = true; // count as filled if either is present
       }
    }
    
    if (val !== undefined && val !== null && val !== "" && (Array.isArray(val) ? val.length > 0 : true)) {
      filledSignificantFields++;
    } else {
      missingSignificantFields.push(translateFieldName(field));
    }
  });

  allFields.forEach(field => {
    const val = (project as any)[field];
    if (val !== undefined && val !== null && val !== "" && (Array.isArray(val) ? val.length > 0 : true)) {
      filledFields++;
    }
  });

  return {
    technicalCompletenessPercent: (filledFields / allFields.length) * 100,
    significantCompletenessPercent: (filledSignificantFields / significantFields.length) * 100,
    totalFields: allFields.length,
    filledFields,
    significantFields: significantFields.length,
    filledSignificantFields,
    missingSignificantFields
  };
}

function normalizeDateValue(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const ruDateMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ruDateMatch) {
    const [, day, month, year] = ruDateMatch;
    return `${year}-${month}-${day}`;
  }
  const ruDateTimeMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+/);
  if (ruDateTimeMatch) {
    const [, day, month, year] = ruDateTimeMatch;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

function parseDateSafe(value: string | null | undefined): Date | null {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;

  // Handle YYYY-MM-DD directly to avoid timezone/UTC offset shifting
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1; // 0-indexed month
    const day = parseInt(isoMatch[3], 10);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function calculatePcTimeliness(project: Project, assessmentDate: Date) {
  if (!project.lastPcDate || !project.monitoringFrequencyWeeks) {
    return {
      nextPcDate: project._rawMonitoring?.plannedNextPcPattern || null,
      pcStatus: "Недостаточно данных" as const
    };
  }

  // Provide explicit fallback mapping from extracted spreadsheet dates
  const nextPcDateVal = project._rawMonitoring?.plannedNextPcPattern;
  let pcStatus: "Своевременно" | "Просрочен" | "Недостаточно данных" = "Своевременно";
  
  if (nextPcDateVal) {
     const nextPc = parseDateSafe(nextPcDateVal);
     if (nextPc && assessmentDate > nextPc) {
       pcStatus = "Просрочен";
     }
  } else {
     const lastPc = parseDateSafe(project.lastPcDate);
     if (lastPc) {
       const nextPc = new Date(lastPc.getTime() + project.monitoringFrequencyWeeks * 7 * 24 * 60 * 60 * 1000);
       if (assessmentDate > nextPc) {
         pcStatus = "Просрочен";
       }
     }
  }
  
  return {
    nextPcDate: nextPcDateVal || null,
    pcStatus
  };
}

function calculatePlanFactByQuarter(project: Project) {
  if (project._rawQuarters) {
     const arr = [
       { q: "Q1", p: project._rawQuarters.q1plan, f: project._rawQuarters.q1fact },
       { q: "Q2", p: project._rawQuarters.q2plan, f: project._rawQuarters.q2fact },
       { q: "Q3", p: project._rawQuarters.q3plan, f: project._rawQuarters.q3fact },
       { q: "Q4", p: project._rawQuarters.q4plan, f: project._rawQuarters.q4fact },
     ];
     
     return arr.map(item => {
        const planWeight = item.p || 0;
        const factWeight = item.f || 0;
        const deviation = factWeight - planWeight;
        let status: "ok" | "risk" | "not_started" = "ok";
        if (planWeight > 0) {
            if (factWeight === 0) status = "not_started";
            else if (deviation < 0) status = "risk";
        }
        return {
           quarter: item.q,
           planWeight,
           factWeight,
           deviation,
           status
        };
     }) as Array<{
       quarter: string;
       planWeight: number;
       factWeight: number;
       deviation: number;
       status: "ok" | "risk" | "not_started";
     }>;
  }

  // Fallback if not mapped
  return [
    { quarter: "Q1", planWeight: 0, factWeight: 0, deviation: 0, status: "not_started" as "not_started" },
    { quarter: "Q2", planWeight: 0, factWeight: 0, deviation: 0, status: "not_started" as "not_started" },
    { quarter: "Q3", planWeight: 0, factWeight: 0, deviation: 0, status: "not_started" as "not_started" },
    { quarter: "Q4", planWeight: 0, factWeight: 0, deviation: 0, status: "not_started" as "not_started" }
  ];
}

function detectDataWarnings(project: Project): string[] {
  const warnings: string[] = [];

  if (!project.lastPcDate) warnings.push("Отсутствует дата последнего ПК");
  if (!project.monitoringFrequencyWeeks) warnings.push("Не указана частота мониторинга");

  if (project.indicators.length === 0) {
    warnings.push("В проекте не указаны показатели эффективности");
  }

  return warnings;
}

