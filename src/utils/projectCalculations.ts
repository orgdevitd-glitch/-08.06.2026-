import { Project } from "../types";

/**
 * Safely sanitizes and parses numeric values from input strings.
 * Core fixes: Handles ranges (e.g., "10-20%"), random dashes, percentages, and empty or lone minus signs.
 * Guarantees a return value of 0 instead of NaN in case of configuration errors.
 */
export const sanitizeAndParseFloat = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null) return 0;
  const valStr = val.toString().trim().replace(/,/g, ".");
  if (valStr === "" || valStr.toLowerCase() === "nan") return 0;

  // Handle ranges like "10-20%" or "10 - 20"
  const rangeMatch = valStr.match(/^([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const first = parseFloat(rangeMatch[1]);
    const second = parseFloat(rangeMatch[2]);
    if (!isNaN(first) && !isNaN(second)) {
      return (first + second) / 2;
    }
  }

  // Handle potential leading/trailing garbage, but keep main digits, dot, and minus-sign prefix
  const cleaned = valStr.replace(/[^\d.-]/g, "");
  if (
    cleaned === "" ||
    cleaned === "." ||
    cleaned === "-" ||
    cleaned === ".-" ||
    cleaned === "-."
  ) {
    return 0;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Parses dates in Russian format (DD.MM.YYYY) into safe JS Date objects.
 */
export const parseRussianDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr || dateStr.toLowerCase().trim() === "nan") return null;
  const parts = dateStr.trim().split(".");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return null;
};

/**
 * Checks if a specific quarter index (1, 2, 3, 4) of year 2026 is overlapping with project lifecycle.
 */
export const isQuarterInProjectLifecycle = (p: Project, qIndex: number): boolean => {
  const qStart = new Date(2026, (qIndex - 1) * 3, 1);
  const qEnd = new Date(2026, qIndex * 3, 0, 23, 59, 59);

  const pStart = parseRussianDate(p.startDate) || new Date(2026, 0, 1);
  const pEnd = parseRussianDate(p.endDate) || new Date(2026, 11, 31);

  return pStart <= qEnd && pEnd >= qStart;
};

/**
 * Determines whether the quarter should be processed for milestone calculations.
 */
export const isQuarterActiveForMilestones = (
  namesStr: string,
  progStr: string,
  weightStr: string
): boolean => {
  const namesClean = (namesStr || "").trim().toLowerCase();
  if (!namesClean || namesClean === "nan") return false;

  const progClean = (progStr || "").trim().toLowerCase();
  const weightClean = (weightStr || "").trim().toLowerCase();

  const isProgEmpty = !progClean || progClean === "nan" || progClean === "";
  const isWeightEmpty = !weightClean || weightClean === "nan" || weightClean === "";

  if (isProgEmpty && isWeightEmpty) return false;

  const progParts = progClean.split(";").map((s) => s.trim());
  const weightParts = weightClean.split(";").map((s) => s.trim());

  const allProgEmptyOrNan =
    progParts.length === 0 ||
    progParts.every((p) => {
      if (p === "" || p === "nan") return true;
      const parsed = p.replace(/,/g, ".").replace(/[^\d.-]/g, "");
      return parsed === "" || parsed === "." || parsed === "-";
    });
  const allWeightEmptyOrNan =
    weightParts.length === 0 ||
    weightParts.every((w) => {
      if (w === "" || w === "nan") return true;
      const parsed = w.replace(/,/g, ".").replace(/[^\d.-]/g, "");
      return parsed === "" || parsed === "." || parsed === "-";
    });

  if (allProgEmptyOrNan && allWeightEmptyOrNan) {
    return false;
  }

  return true;
};

/**
 * Determines whether the quarter has configured KPIs and can be calculated.
 */
export const isQuarterActiveForKpi = (
  namesStr: string,
  plansStr: string,
  factsStr: string
): boolean => {
  const namesClean = (namesStr || "").trim().toLowerCase();
  if (!namesClean || namesClean === "nan") return false;

  const names = namesClean.split(";").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return false;

  const plans = (plansStr || "").split(";").map((s) => s.trim());
  const facts = (factsStr || "").split(";").map((s) => s.trim());

  let hasRealFact = false;
  let hasConfiguredIndicator = false;

  names.forEach((_, index) => {
    const planVal = sanitizeAndParseFloat(plans[index] || "");
    const factRaw = facts[index] ? facts[index].trim() : "";
    const factVal = sanitizeAndParseFloat(factRaw);

    if (planVal > 0) {
      hasConfiguredIndicator = true;
      if (factRaw !== "" && factRaw.toLowerCase() !== "nan" && factVal > 0) {
        hasRealFact = true;
      }
    }
  });

  if (hasConfiguredIndicator && !hasRealFact) {
    return false;
  }

  return true;
};

/**
 * Calculation of milestone completion rate in a single quarter.
 * Prevention of NaN & Infinity: returns 0 if lengths or weights are 0.
 * Sets remaining weights to 0 if names length exceeds weights length.
 */
export const calculateMilestoneQuarterProgress = (
  namesStr: string,
  progStr: string,
  weightStr: string
): number | null => {
  const names = namesStr.split(";").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0 || namesStr.toLowerCase() === "nan") {
    return null;
  }

  if (!isQuarterActiveForMilestones(namesStr, progStr, weightStr)) {
    return null;
  }

  const progresses = progStr.split(";").map((s) => s.trim());
  const weights = weightStr.split(";").map((s) => s.trim());

  if (names.length === 0) {
    return 0;
  }

  const parsedWeights = names.map((_, i) => {
    const wStr = weights[i] || "";
    return sanitizeAndParseFloat(wStr);
  });

  const totalWeightsSum = parsedWeights.reduce((sum, w) => sum + w, 0);

  let finalWeights: number[] = [];
  if (totalWeightsSum === 0) {
    finalWeights = names.map(() => (names.length > 0 ? 100 / names.length : 0));
  } else {
    finalWeights = parsedWeights;
  }

  let sumOfWeights = 0;
  let weightedSum = 0;

  names.forEach((_, index) => {
    const pStr = progresses[index] || "";
    const valP = sanitizeAndParseFloat(pStr);
    const valW = finalWeights[index] || 0;

    weightedSum += valP * valW;
    sumOfWeights += valW;
  });

  if (sumOfWeights > 0) {
    return weightedSum / sumOfWeights;
  }
  return 0;
};

/**
 * Overall milestones/tasks progress for project across all active quarters.
 */
export const calculateTasksProgressForProject = (p: Project): number => {
  if (!p._rawMilestonesNew) return 0;
  const quarters = ["q1", "q2", "q3", "q4"] as const;
  let sumOfQuarters = 0;
  let activeQuartersCount = 0;

  quarters.forEach((q) => {
    const namesStr = p._rawMilestonesNew?.[`${q}names`] || "";
    const progStr = p._rawMilestonesNew?.[`${q}progress`] || "";
    const weightStr = p._rawMilestonesNew?.[`${q}weights`] || "";

    const qProgress = calculateMilestoneQuarterProgress(namesStr, progStr, weightStr);
    if (qProgress !== null) {
      sumOfQuarters += qProgress;
      activeQuartersCount++;
    }
  });

  return activeQuartersCount > 0 ? sumOfQuarters / activeQuartersCount : 0;
};

/**
 * Overall KPIs progress for project across active quarters.
 */
export const calculateKpisProgressForProject = (p: Project): number | null => {
  if (!p._rawIndicatorsNew) return null;
  const quarters = ["q1", "q2", "q3", "q4"] as const;
  let totalQuarterProgressSum = 0;
  let quartersWithKpisCount = 0;

  quarters.forEach((q) => {
    const namesStr = p._rawIndicatorsNew?.[`${q}names`] || "";
    const plansStr = p._rawIndicatorsNew?.[`${q}plans`] || "";
    const factsStr = p._rawIndicatorsNew?.[`${q}facts`] || "";

    const names = namesStr.split(";").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0 || namesStr.toLowerCase() === "nan") {
      return;
    }

    if (!isQuarterActiveForKpi(namesStr, plansStr, factsStr)) {
      return;
    }

    const plans = plansStr.split(";").map((s) => s.trim());
    const facts = factsStr.split(";").map((s) => s.trim());

    let indProgressSum = 0;
    let indCount = 0;

    names.forEach((_, index) => {
      const planStr = plans[index] || "";
      const factStr = facts[index] || "";

      const planVal = sanitizeAndParseFloat(planStr);
      const factVal = sanitizeAndParseFloat(factStr);

      if (planVal > 0) {
        const rawProgress = (factVal / planVal) * 100;
        const cappedProgress = Math.min(100, Math.max(0, rawProgress));
        indProgressSum += cappedProgress;
        indCount++;
      }
    });

    if (indCount > 0) {
      const quarterKpiProgress = indProgressSum / indCount;
      totalQuarterProgressSum += quarterKpiProgress;
      quartersWithKpisCount++;
    }
  });

  return quartersWithKpisCount > 0 ? totalQuarterProgressSum / quartersWithKpisCount : null;
};

/**
 * Calculates milestones progress across the project's entire active lifecycle quarters.
 */
export const calculateYearMilestonesProgressForProject = (p: Project): number | null => {
  let sumOfQuarters = 0;
  let countOfQuarters = 0;

  for (let qIdx = 1; qIdx <= 4; qIdx++) {
    if (isQuarterInProjectLifecycle(p, qIdx)) {
      const q = `q${qIdx}`;
      const namesStr = p._rawMilestonesNew?.[`${q}names`] || "";
      const progStr = p._rawMilestonesNew?.[`${q}progress`] || "";
      const weightStr = p._rawMilestonesNew?.[`${q}weights`] || "";

      const qProgress = calculateMilestoneQuarterProgress(namesStr, progStr, weightStr);
      if (qProgress !== null) {
        countOfQuarters++;
        sumOfQuarters += qProgress;
      }
    }
  }

  return countOfQuarters > 0 ? sumOfQuarters / countOfQuarters : null;
};

/**
 * KPI Progress in a single quarter for annual calculations.
 * Safe skipping constraint: if `namesStr` is completely empty or "nan",
 * returns `null` instead of penalizing with `0`.
 */
export const calculateYearKpiQuarterProgress = (p: Project, qIdx: number): number | null => {
  if (!p._rawIndicatorsNew) return null;
  const q = `q${qIdx}`;
  const namesStr = p._rawIndicatorsNew[`${q}names`] || "";
  const plansStr = p._rawIndicatorsNew[`${q}plans`] || "";
  const factsStr = p._rawIndicatorsNew[`${q}facts`] || "";

  const names = namesStr.split(";").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0 || namesStr.toLowerCase() === "nan") {
    return null; // Skip this quarter completely
  }

  const plans = plansStr.split(";").map((s) => s.trim());
  const facts = factsStr.split(";").map((s) => s.trim());

  let indProgressSum = 0;
  let indCount = 0;

  names.forEach((_, index) => {
    const planStr = plans[index] || "";
    const factStr = facts[index] || "";

    const isPlanEmpty = !planStr.trim() || planStr.toLowerCase().trim() === "nan";
    const isFactEmpty = !factStr.trim() || factStr.toLowerCase().trim() === "nan";

    const planVal = sanitizeAndParseFloat(planStr);
    const factVal = sanitizeAndParseFloat(factStr);

    if (planVal > 0 && !isFactEmpty) {
      const rawProgress = (factVal / planVal) * 100;
      const cappedProgress = Math.min(100, Math.max(0, rawProgress));
      indProgressSum += cappedProgress;
    } else if (isPlanEmpty && !isFactEmpty && factVal > 0) {
      indProgressSum += 0;
    } else if (isPlanEmpty && isFactEmpty) {
      indProgressSum += 0;
    } else {
      indProgressSum += 0;
    }
    indCount++;
  });

  return indCount > 0 ? indProgressSum / indCount : 0;
};

/**
 * Aggregate annual indicators progress based only on active quarters that actually have KPIs.
 */
export const calculateYearKpisProgressForProject = (p: Project): number | null => {
  let sumOfQuarters = 0;
  let countOfQuarters = 0;

  for (let qIdx = 1; qIdx <= 4; qIdx++) {
    if (isQuarterInProjectLifecycle(p, qIdx)) {
      const qProgress = calculateYearKpiQuarterProgress(p, qIdx);
      if (qProgress !== null) {
        countOfQuarters++;
        sumOfQuarters += qProgress;
      }
    }
  }

  return countOfQuarters > 0 ? sumOfQuarters / countOfQuarters : null;
};

/**
 * Selected Quarter Milestones progress helper.
 */
export const calculateSelectedQuarterMilestonesProgressForProject = (
  p: Project,
  q: number
): number | null => {
  if (!p._rawMilestonesNew) return null;
  const namesStr = p._rawMilestonesNew[`q${q}names`] || "";
  const progStr = p._rawMilestonesNew[`q${q}progress`] || "";
  const weightStr = p._rawMilestonesNew[`q${q}weights`] || "";

  return calculateMilestoneQuarterProgress(namesStr, progStr, weightStr);
};

/**
 * Selected Quarter KPI progress helper.
 * Returns `null` if the quarter doesn't have active description names.
 */
export const calculateSelectedQuarterKpiProgressForProject = (
  p: Project,
  q: number
): number | null => {
  if (!p._rawIndicatorsNew) return null;
  const namesStr = p._rawIndicatorsNew[`q${q}names`] || "";
  const plansStr = p._rawIndicatorsNew[`q${q}plans`] || "";
  const factsStr = p._rawIndicatorsNew[`q${q}facts`] || "";

  const names = namesStr.split(";").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0 || namesStr.toLowerCase() === "nan") {
    return null;
  }

  const plans = plansStr.split(";").map((s) => s.trim());
  const facts = factsStr.split(";").map((s) => s.trim());

  let indProgressSum = 0;
  let indCount = 0;

  names.forEach((_, index) => {
    const planStr = plans[index] || "";
    const factStr = facts[index] || "";

    const planVal = sanitizeAndParseFloat(planStr);
    const factVal = sanitizeAndParseFloat(factStr);

    if (planVal > 0) {
      const rawProgress = (factVal / planVal) * 100;
      const cappedProgress = Math.min(100, Math.max(0, rawProgress));
      indProgressSum += cappedProgress;
      indCount++;
    } else {
      indCount++;
    }
  });

  return indCount > 0 ? indProgressSum / indCount : null;
};
