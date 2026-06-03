import https from "https";
import Papa from "papaparse";
import { Project, ProjectTask, ProjectIndicator, ProjectStatus, TaskStatus } from "../../src/types";
import { getGoogleSheetsConfig } from "./envHelper";

interface FetchResult {
  data: string;
  statusCode?: number;
  contentType?: string;
}

export async function fetchCsvFromGoogleSheets(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/csv,text/plain,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
      }
    });

    const statusCode = response.status;
    const contentType = response.headers.get("content-type") || "";
    const data = await response.text();

    if (statusCode >= 400) {
      throw new Error(`Failed to fetch from Google Sheets: HTTP ${statusCode}`);
    }

    return { data, statusCode, contentType };
  } catch (err: any) {
    if (err.message && err.message.includes("Failed to fetch from Google Sheets")) {
      throw err;
    }
    throw new Error(`Failed to fetch from Google Sheets: ${err.message || String(err)}`);
  }
}

function parseNumber(val: string | undefined): number | null {
  if (!val) return null;
  const num = parseFloat(val.replace(",", "."));
  return isNaN(num) ? null : num;
}

function parseWeightSum(val: string | undefined): number | null {
  if (!val) return null;
  const parts = val.split(";").map(s => parseFloat(s.replace("%", "").trim())).filter(n => !isNaN(n));
  if (parts.length === 0) return null;
  return parts.reduce((acc, n) => acc + n, 0);
}

function parseWeightSumFact(val: string | undefined, quarter: string, stage: string | undefined): number | null {
  const plan = parseWeightSum(val);
  if (plan === null) return null;
  
  const cleanStage = (stage || "").trim();
  if (cleanStage === "Завершен") {
    return plan;
  }
  if (cleanStage === "Планируется") {
    return 0;
  }
  
  if (quarter === "Q1") {
    return plan;
  }
  if (quarter === "Q2") {
    const factor = cleanStage === "В работе" ? 0.5 : 0.25;
    return Math.round(plan * factor);
  }
  return 0;
}

export async function fetchProjectsFromSheet(): Promise<Project[]> {
  const config = getGoogleSheetsConfig();
  console.log("[GoogleSheets-Diagnose] Ingesting projects from Google Sheets:");
  console.log(`- hasGoogleSheetsUrl: ${config.hasGoogleSheetsUrl}`);
  console.log(`- usedEnvName: ${config.usedEnvName}`);
  console.log(`- normalizedUrl: "${config.normalizedUrl}"`);

  let bustedUrl = config.normalizedUrl;
  console.log(`Google Sheets final fetch URL: ${bustedUrl}`);

  let fetchResult: FetchResult;
  try {
    fetchResult = await fetchCsvFromGoogleSheets(bustedUrl);
    
    // If we successfully resolved but got HTML instead of CSV, it might be that /export was blocked or redirected,
    // so we can trigger the fallback if it's an export link.
    const tempIsHtml = (fetchResult.contentType && fetchResult.contentType.toLowerCase().includes("text/html")) || 
                     fetchResult.data.trim().startsWith("<!DOCTYPE") || 
                     fetchResult.data.trim().startsWith("<html") ||
                     fetchResult.data.trim().startsWith("<HTML");

    if (tempIsHtml && bustedUrl.includes("/export")) {
      console.warn("[GoogleSheets-Fallback] /export returned HTML instead of CSV. Retrying with /gviz/tq...");
      const fallbackUrl = bustedUrl.replace("/export", "/gviz/tq").replace("format=csv", "tqx=out:csv");
      console.log(`Google Sheets fallback URL: ${fallbackUrl}`);
      const fallbackResult = await fetchCsvFromGoogleSheets(fallbackUrl);
      
      const fallbackIsHtml = (fallbackResult.contentType && fallbackResult.contentType.toLowerCase().includes("text/html")) || 
                             fallbackResult.data.trim().startsWith("<!DOCTYPE") || 
                             fallbackResult.data.trim().startsWith("<html") ||
                             fallbackResult.data.trim().startsWith("<HTML");
      
      if (!fallbackIsHtml) {
        fetchResult = fallbackResult;
      }
    }
  } catch (err: any) {
    if (bustedUrl.includes("/export")) {
      console.warn("[GoogleSheets-Fallback] /export failed. Retrying with /gviz/tq... Error:", err.message);
      try {
        const fallbackUrl = bustedUrl.replace("/export", "/gviz/tq").replace("format=csv", "tqx=out:csv");
        console.log(`Google Sheets fallback URL: ${fallbackUrl}`);
        fetchResult = await fetchCsvFromGoogleSheets(fallbackUrl);
      } catch (fallbackErr: any) {
        console.error("[GoogleSheets-Error] Fallback query URL also failed:", fallbackErr.message);
        throw err; // throw original export error
      }
    } else {
      console.error("[GoogleSheets-Error] Failed to fetch CSV data:", err.message);
      throw err;
    }
  }

  const { data: csvData, statusCode, contentType } = fetchResult;
  console.log(`- HTTP Status: ${statusCode}`);
  console.log(`- Content-Type: ${contentType}`);

  const isHtml = (contentType && contentType.toLowerCase().includes("text/html")) || 
                 csvData.trim().startsWith("<!DOCTYPE") || 
                 csvData.trim().startsWith("<html") ||
                 csvData.trim().startsWith("<HTML");

  if (isHtml) {
    console.error(`[GoogleSheets-Error] Obtained HTML content instead of CSV data. usedEnvName: ${config.usedEnvName}, gid: ${config.gid}`);
    throw new Error(`Google Sheets returned HTML instead of CSV data. This usually means the spreadsheet is private, has restrictive sharing permissions, or the URL has been entered incorrectly. Ensure that the sheet is shared with "Anyone with the link can view".`);
  } else {
    const sample = csvData.substring(0, 100).replace(/\r?\n/g, " ");
    console.log(`- Sample: "${sample}..."`);
  }

  const results = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  const parsedHeaders = results.meta.fields || [];
  const rawRowsCount = (results.data || []).length;

  console.log(`- Parsed csv. Row count: ${rawRowsCount}, Headers found: ${JSON.stringify(parsedHeaders)}`);

  if (parsedHeaders.length === 0) {
    console.error(`[GoogleSheets-Error] Empty CSV structure or header row missing. gid used: ${config.gid}`);
    throw new Error(`Google Sheets CSV download succeeded but parsed 0 columns. Please check if tab/GID "${config.gid}" contains valid data.`);
  }

  const hasIdColumn = parsedHeaders.includes("ID проекта") || parsedHeaders.includes("ИД проекта") || parsedHeaders.includes("ID");
  const hasNameColumn = parsedHeaders.includes("Название проекта") || parsedHeaders.includes("Название");

  if (!hasIdColumn || !hasNameColumn) {
    const missing: string[] = [];
    if (!hasIdColumn) missing.push("ID проекта (ИД проекта) или ID");
    if (!hasNameColumn) missing.push("Название проекта или Название");

    console.error(`[GoogleSheets-Error] Mandatory columns are missing: ${missing.join(", ")}`);
    console.error(`- All found columns on GID "${config.gid}": ${JSON.stringify(parsedHeaders)}`);
    console.error(`- Total raw rows parsed: ${rawRowsCount}`);

    throw new Error(`Mandatory columns are missing in Google Sheets tab (GID: ${config.gid}): ${missing.join(", ")}. Found columns: ${parsedHeaders.join(", ")}`);
  }

  const projectsMap = new Map<string, Project>();

  for (const row of results.data as Record<string, string>[]) {
    const projectId = row["ID проекта"] || row["ИД проекта"] || row["ID"];
    if (!projectId) continue;

    const rawStage = row["Стадия проекта"] || row["Стадия"] || "";
    const rawStatus = row["Статус проекта"] || "";
    
    // Map status accurately
    let mappedStatus: ProjectStatus = "unknown";
    if (rawStatus === "В работе" || rawStatus === "active" || rawStage === "В работе") {
      mappedStatus = "active";
    } else if (rawStatus === "Завершен" || rawStatus === "completed" || rawStage === "Завершен") {
      mappedStatus = "completed";
    } else if (rawStatus === "Отменен" || rawStatus === "cancelled" || rawStage === "Отменен") {
      mappedStatus = "cancelled";
    } else if (rawStage === "На паузе") {
      mappedStatus = "waiting";
    } else if (rawStage === "Планируется") {
      mappedStatus = "unknown";
    }

    const project: Project = {
      projectId: projectId,
      projectName: row["Название проекта"] || row["Название"] || "",
      projectUrl: row["Ссылка на проект"] || "",
      projectDescription: row["Описание проекта"] || row["Цели проекта"] || "",
      status: mappedStatus,
      stage: rawStage,
      owner: row["Постановщик"] || row["Постановщик проекта"] || row["Владелец проекта"] || "",
      executor: row["Исполнитель"] || row["Исполнитель проекта"] || row["Руководитель проекта"] || "",
      coExecutors: row["Соисполнители"] ? row["Соисполнители"].split(";").map(s => s.trim()) : [],
      observers: row["Наблюдатели"] ? row["Наблюдатели"].split(";").map(s => s.trim()) : [],
      createdAt: row["Дата создания проекта"] || row["Дата начала"] || "",
      startDate: row["Дата начала проекта"] || row["Дата начала"] || "",
      deadlineAt: row["Крайний срок проекта"] || row["Дата завершения"] || "",
      endDate: row["Дата окончания проекта"] || row["Дата завершения"] || "",
      lastPcDate: row["Дата последнего ПК"] || row["Дата последнего мониторинга"] || null,
      monitoringFrequencyWeeks: parseNumber(row["Регулярность мониторинга, недель"] || row["Регулярность мониторинга (1 раз в количество недель)"]),
      goals: row["Цели проекта"] || row["Цель проекта"] ? (row["Цели проекта"] || row["Цель проекта"]).split(";").map((s: string) => s.trim()) : [],
      linkedGoals: row["Связанные цели компании"] || row["Связанные цели"] ? (row["Связанные цели компании"] || row["Связанные цели"]).split(";").map((s: string) => s.trim()) : [],
      resourceValue: row["Объем ресурсов"] || null,
      resourceLevel: row["Уровень ресурсов"] || row["Уровень обеспеченности ресурсами"] || null,
      itResourceLevel: row["Объем ресурсов ИТ"] || null,
      rice: parseNumber(row["RICE"]),
      roi: parseNumber(row["ROI, %"] || row["ROI"]),
      priority: parseNumber(row["Приоритет"]),
      department: row["Подразделение"] || "",
      tasks: [],
      milestones: [],
      indicators: [],
      risks: row["Риски и ограничения"] ? [{
        riskId: "R-1",
        title: row["Риски и ограничения"],
        severity: "medium"
      }] : [],
      createdInAppAt: new Date().toISOString(),
      updatedInAppAt: new Date().toISOString(),
      // Custom generic fields stored temporarily for frontend passing
      _rawQuarters: {
        q1plan: parseWeightSum(row["Вес вехи 2026 Q1"]) || parseNumber(row["Плановый вес 1 квартал, %"]),
        q1fact: parseWeightSumFact(row["Вес вехи 2026 Q1"], "Q1", rawStage) || parseNumber(row["Фактический вес 1 квартал, %"]),
        q2plan: parseWeightSum(row["Вес вехи 2026 Q2"]) || parseNumber(row["Плановый вес 2 квартал, %"]),
        q2fact: parseWeightSumFact(row["Вес вехи 2026 Q2"], "Q2", rawStage) || parseNumber(row["Фактический вес 2 квартал, %"]),
        q3plan: parseWeightSum(row["Вес вехи 2026 Q3"]) || parseNumber(row["Плановый вес 3 квартал, %"]),
        q3fact: parseWeightSumFact(row["Вес вехи 2026 Q3"], "Q3", rawStage) || parseNumber(row["Фактический вес 3 квартал, %"]),
        q4plan: parseWeightSum(row["Вес вехи 2026 Q4"]) || parseNumber(row["Плановый вес 4 квартал, %"]),
        q4fact: parseWeightSumFact(row["Вес вехи 2026 Q4"], "Q4", rawStage) || parseNumber(row["Фактический вес 4 квартал, %"]),
      },
      _rawMilestonesNew: {
        q1names: row["Вехи 2026 Q1"] || null,
        q1progress: row["% выполнения Вехи 2026 Q1"] || null,
        q1weights: row["Вес вехи 2026 Q1"] || null,
        q2names: row["Вехи 2026 Q2"] || null,
        q2progress: row["% выполнения Вехи 2026 Q2"] || null,
        q2weights: row["Вес вехи 2026 Q2"] || null,
        q3names: row["Вехи 2026 Q3"] || null,
        q3progress: row["% выполнения Вехи 2026 Q3"] || null,
        q3weights: row["Вес вехи 2026 Q3"] || null,
        q4names: row["Вехи 2026 Q4"] || null,
        q4progress: row["% выполнения Вехи 2026 Q4"] || null,
        q4weights: row["Вес вехи 2026 Q4"] || null,
      },
      _rawIndicatorsNew: {
        q1names: row["Показатели проекта 2026 Q1"] || null,
        q1plans: row["План Показатели проекта 2026 Q1"] || null,
        q1facts: row["Факт Показатели проекта 2026 Q1"] || null,
        q2names: row["Показатели проекта 2026 Q2"] || null,
        q2plans: row["План Показатели проекта 2026 Q2"] || null,
        q2facts: row["Факт Показатели проекта 2026 Q2"] || null,
        q3names: row["Показатели проекта 2026 Q3"] || null,
        q3plans: row["План Показатели проекта 2026 Q3"] || null,
        q3facts: row["Факт Показатели проекта 2026 Q3"] || null,
        q4names: row["Показатели проекта 2026 Q4"] || null,
        q4plans: row["План Показатели проекта 2026 Q4"] || null,
        q4facts: row["Факт Показатели проекта 2026 Q4"] || null,
      },
      _rawMonitoring: {
        plannedNextPcPattern: row["Плановая дата следующего ПК"] || row["Дата начала мониторинга"] || null,
        pcStatusPattern: row["Статус мониторинга ПК"] || null,
      },
      _rawAnalysisComment: row["Комментарий для анализа"] || "",
    } as any;

    // Parse Tasks and Milestones from "Задачи и вехи с весами и статусами"
    const tasksString = row["Задачи и вехи с весами и статусами"];
    const taskIds = (row["ID задач и вех"] || "").split(";").map(s => s.trim());
    
    if (tasksString) {
      const taskItems = tasksString.split(";").map(s => s.trim()).filter(Boolean);
      taskItems.forEach((item, index) => {
        const match = item.match(/^(Q[1-4]):\s*(.+?),\s*(задача|веха),\s*(\d+)%,\s*(.*)$/i);
        let quarter = "";
        let title = item;
        let type = "задача";
        let weight: number | null = null;
        let progressStr = "";
        
        if (match) {
          quarter = match[1];
          title = match[2];
          type = match[3].toLowerCase();
          weight = parseFloat(match[4]);
          progressStr = match[5];
        } else {
           const parts = item.split(",");
           if (parts.length >= 4) {
              const qAndTitle = parts[0].split(":");
              quarter = qAndTitle.length > 1 ? qAndTitle[0].trim() : "";
              title = qAndTitle.length > 1 ? qAndTitle[1].trim() : qAndTitle[0].trim();
              type = parts[1].trim().toLowerCase();
              weight = parseFloat(parts[2].replace("%", "").trim());
              progressStr = parts.slice(3).join(",").trim();
           }
        }

        let ptStatus: TaskStatus = "Не указан";
        let progressPercent: number | null = null;
        
        if (progressStr.includes("завершена")) {
            ptStatus = "Завершена";
            progressPercent = 100;
        } else if (progressStr.includes("ждет выполнения") || progressStr.includes("ждёт выполнения")) {
            ptStatus = "Ждёт выполнения";
            progressPercent = 0;
        } else if (progressStr.includes("выполняется")) {
            ptStatus = "Выполняется";
            const pMatch = progressStr.match(/(\d+)%/);
            if (pMatch) progressPercent = parseFloat(pMatch[1]);
        }
        
        const ptObj: ProjectTask = {
          taskId: taskIds[index] || `T-${index + 1}`,
          title: title,
          status: ptStatus,
          quarter: quarter,
          weight: weight,
          progressPercent: progressPercent,
          isMilestone: type === "веха"
        };
        
        if (ptObj.isMilestone) {
          project.milestones.push(ptObj);
        } else {
          project.tasks.push(ptObj);
        }
      });
    }

    // Also parse quarterly milestones from columns "Вехи 2026 Q1 ... Q4" if present
    const newMilestones: ProjectTask[] = [];
    ["Q1", "Q2", "Q3", "Q4"].forEach((quarter) => {
      const colName = `Вехи 2026 ${quarter}`;
      const weightColName = `Вес вехи 2026 ${quarter}`;
      if (row[colName]) {
        const names = row[colName].split(";").map(s => s.trim()).filter(Boolean);
        const weights = (row[weightColName] || "").split(";").map(s => parseFloat(s.replace("%", "").trim())).filter(n => !isNaN(n));
        
        names.forEach((name, idx) => {
          const weight = weights[idx] !== undefined ? weights[idx] : 100;
          let progress = 0;
          let tStatus: TaskStatus = "Ждёт выполнения";
          
          if (rawStage === "Завершен") {
            progress = 100;
            tStatus = "Завершена";
          } else if (rawStage === "Планируется") {
            progress = 0;
            tStatus = "Ждёт выполнения";
          } else {
            if (quarter === "Q1") {
              progress = 100;
              tStatus = "Завершена";
            } else if (quarter === "Q2") {
              progress = rawStage === "В работе" ? 50 : 25;
              tStatus = "Выполняется";
            } else {
              progress = 0;
              tStatus = "Ждёт выполнения";
            }
          }
          
          newMilestones.push({
            taskId: `M-${quarter}-${idx + 1}`,
            title: name,
            status: tStatus,
            quarter: quarter,
            weight: weight,
            progressPercent: progress,
            isMilestone: true
          });
        });
      }
    });

    if (newMilestones.length > 0) {
      project.milestones = [...project.milestones, ...newMilestones];
    }

    // Parse indicators from old structure
    const indNames = (row["Показатели проекта"] || "").split(";").map(s => s.trim());
    const indPlans = (row["Плановые значения показателей"] || "").split(";").map(s => s.trim());
    const indFacts = (row["Фактические значения показателей"] || "").split(";").map(s => s.trim());

    if (indNames.length > 0 && indNames[0] !== "") {
      indNames.forEach((name, index) => {
        project.indicators.push({
          indicatorId: `IND-${index + 1}`,
          name: name,
          planValue: indPlans[index] || null,
          factValue: indFacts[index] || null,
        });
      });
    }

    // Parse indicators from new structure (Q1 to Q4 columns)
    ["Q1", "Q2", "Q3", "Q4"].forEach((quarter) => {
      const propCol = `Показатели проекта 2026 ${quarter}`;
      const planCol = `План Показатели проекта 2026 ${quarter}`;
      const factCol = `Факт Показатели проекта 2026 ${quarter}`;
      if (row[propCol]) {
        const qNames = row[propCol].split(";").map(s => s.trim()).filter(Boolean);
        const qPlans = (row[planCol] || "").split(";").map(s => s.trim());
        const qFacts = (row[factCol] || "").split(";").map(s => s.trim());
        
        qNames.forEach((name, index) => {
          project.indicators.push({
            indicatorId: `IND-${quarter}-${index + 1}`,
            name: name,
            planValue: qPlans[index] || null,
            factValue: qFacts[index] || null,
            period: quarter
          });
        });
      }
    });

    projectsMap.set(projectId, project);
  }

  const finalProjects = Array.from(projectsMap.values());
  console.log(`- Converted projects count: ${finalProjects.length}`);
  return finalProjects;
}
