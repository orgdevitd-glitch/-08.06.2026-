import OpenAI from "openai";
import { Project, ProjectCalculatedMetrics, ProjectAnalysisResult } from "../../src/types";
import { ProjectAnalysisResultSchema } from "../prompts/projectAnalysisPrompt";
import { cleanEnv, isValidAssistantId } from "./envHelper";

export async function analyzeProjectWithOpenAI(input: {
  project: Project;
  metrics: ProjectCalculatedMetrics;
  assessmentDate: string;
}): Promise<ProjectAnalysisResult> {
  const apiKey = cleanEnv(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    console.error("[ProjectAnalysis] OPENAI_API_KEY is missing or empty in environment variables.");
    throw new Error("Анализ временно недоступен. Обратитесь к администратору (не настроен OPENAI_API_KEY).");
  }

  const assistantId = cleanEnv(process.env.PROJECT_ANALYSIS_ASSISTANT_ID);

  console.log("[ProjectAnalysis-Diagnose] Checking analysis configuration:");
  console.log(`- hasOpenAIKey: ${!!apiKey}`);
  console.log(`- hasAssistantId: ${!!assistantId}`);
  console.log(`- assistantId: "${assistantId}"`);

  if (!assistantId) {
    console.error("[ProjectAnalysis] PROJECT_ANALYSIS_ASSISTANT_ID is missing or empty in environment variables.");
    throw new Error("Анализ временно недоступен. Обратитесь к администратору (не настроен PROJECT_ANALYSIS_ASSISTANT_ID).");
  }

  if (!isValidAssistantId(assistantId)) {
    console.error(`[ProjectAnalysis] PROJECT_ANALYSIS_ASSISTANT_ID is invalid (must start with "asst_"): "${assistantId}"`);
    throw new Error("Анализ временно недоступен. Обратитесь к администратору (некорректный PROJECT_ANALYSIS_ASSISTANT_ID).");
  }

  const openai = new OpenAI({ apiKey });

  const projectData = {
    assessmentDate: input.assessmentDate,
    project: input.project,
    metrics: input.metrics
  };

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: JSON.stringify({
      task: "Оцени проект по переданным данным и верни результат строго по заданной JSON-схеме.",
      projectData
    })
  });

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
    additional_instructions: `КРИТИЧЕСКИЕ ПРАВИЛА:
1. Для полей, которые являются датами (assessmentDate, nextPcDate), возвращай ТОЛЬКО дату в формате YYYY-MM-DD или null. Любые текстовые пояснения об отсутствии даты помещай в текстовые аналитические поля (например, в 'detailedAnalysis.pcTimeliness' или 'shortAnalysis.pcTimeliness').
2. Категорически запрещено использовать в полях дат текстовые формулировки или заглушки типа: 'Данные не переданы', 'Недостаточно данных для оценки', 'Не указан в переданных данных', 'Невозможно оценить по переданным данным'. Если дата отсутствует - верни null.
3. Не используй англицизмы, технические термины кода или технические имена полей JSON (такие как 'tasksAndMilestones', 'planFact', 'resourceValue', 'resourceLevel', 'pcStatus', 'indicatorsStatus' и т.д.) в генерируемых текстах. Пиши грамотно на русском языке (например, пиши 'объем ресурсов' или 'уровень обеспеченности ресурсами').
4. Для priorityActions.owner: Если во входных данных есть исполнитель (executor), используй его в качестве ответственного. Если исполнитель отсутствует, пиши исключительно: "Не указан в переданных данных". Ни в коем случае не придумывай и не используй обобщенные или абстрактные роли вроде "Руководитель проекта", "Проектный офис", "Команда проекта", "Куратор", если они явно отсутствуют во входных данных.
5. Для projectProposal (предложение по проекту): Не предлагай приостановку проекта, изменение графика, пересмотр бюджета, перенос сроков или другие кардинальные управленческие решения, если во входных данных нет к этому прямых предпосылок. Если основная проблема заключается в неполноте/пустоте полей карточки проекта, предложение должно быть сведено исключительно к актуализации данных, заполнению паспорта проекта, уточнению ресурсов, задач, сроков и дат проведения мониторинга.
6. Для aiProposal (ИИ-предложение): Не придумывай исторические базы данных, тяжелые предиктивные модели, сложный экономический эффект или фантастическую автоматизацию, если этого нет в исходных данных. Если нет достаточных оснований для отдельного содержательного ИИ-предложения, пиши строго: "По переданным данным нет достаточных оснований для отдельного предложения по применению ИИ". Если предложение возможно и целесообразно, оно должно быть максимально простым, приземленным и напрямую следовать из имеющихся дефектов данных, например: "Использовать ИИ для автоматической проверки полноты карточки проекта и выявления незаполненных обязательных полей".`,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "project_analysis_result",
        strict: true,
        schema: ProjectAnalysisResultSchema
      }
    }
  });

  while (["queued", "in_progress", "cancelling"].includes(run.status)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
  }

  if (run.status !== "completed") {
    throw new Error(`OpenAI assistant run failed with status: ${run.status}`);
  }

  const messages = await openai.beta.threads.messages.list(thread.id);

  const resultMessage = messages.data.find(
    (message) => message.role === "assistant" && message.run_id === run.id
  ) || messages.data.find(
    (message) => message.role === "assistant"
  );

  let rawText = "";
  if (resultMessage?.content) {
    for (const block of resultMessage.content) {
      if (block.type === "text") {
        rawText += block.text.value;
      }
    }
  }

  if (!rawText) {
    throw new Error("Assistant returned empty response");
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`Assistant returned invalid JSON: ${rawText.slice(0, 500)}`);
  }

  validateAgainstSchema(parsedResult);

  return {
    analysisId: run.id,
    projectId: input.project.projectId,
    createdAt: new Date().toISOString(),
    model: `Assistant (${assistantId})`,
    ...parsedResult
  };
}

export function validateAgainstSchema(data: any): void {
  if (!data || typeof data !== "object") {
    throw new Error("Validation Error: Root element is not an object");
  }

  // Check excess properties on root if additionalProperties is false
  const allowedRootKeys = ["shortAnalysis", "keyProblems", "managementConclusion", "priorityActions", "detailedAnalysis"];
  for (const key of Object.keys(data)) {
    if (!allowedRootKeys.includes(key)) {
      throw new Error(`Validation Error: Root contains extra property '${key}'`);
    }
  }

  // Check required root properties
  for (const key of allowedRootKeys) {
    if (!(key in data)) {
      throw new Error(`Validation Error: Root is missing required property '${key}'`);
    }
  }

  // Validate shortAnalysis
  const short = data.shortAnalysis;
  if (!short || typeof short !== "object") {
    throw new Error("Validation Error: 'shortAnalysis' is not a valid object");
  }
  const allowedShortKeys = [
    "dataCompleteness", "missingSignificantData", "pcTimeliness", "nextPcDate", 
    "assessmentDate", "weightedTaskProgress", "periodPlan", "periodFact", 
    "deviation", "indicators", "overallStatus"
  ];
  for (const key of Object.keys(short)) {
    if (!allowedShortKeys.includes(key)) {
      throw new Error(`Validation Error: 'shortAnalysis' contains extra property '${key}'`);
    }
  }
  for (const key of allowedShortKeys) {
    if (!(key in short)) {
      throw new Error(`Validation Error: 'shortAnalysis' is missing required property '${key}'`);
    }
  }
  if (typeof short.dataCompleteness !== "string") throw new Error("Validation Error: 'shortAnalysis.dataCompleteness' must be a string");
  if (!Array.isArray(short.missingSignificantData)) throw new Error("Validation Error: 'shortAnalysis.missingSignificantData' must be an array");
  if (typeof short.pcTimeliness !== "string") throw new Error("Validation Error: 'shortAnalysis.pcTimeliness' must be a string");
  if (short.nextPcDate !== null && typeof short.nextPcDate !== "string") throw new Error("Validation Error: 'shortAnalysis.nextPcDate' must be string or null");
  if (short.assessmentDate !== null && typeof short.assessmentDate !== "string") throw new Error("Validation Error: 'shortAnalysis.assessmentDate' must be string or null");
  if (typeof short.weightedTaskProgress !== "string") throw new Error("Validation Error: 'shortAnalysis.weightedTaskProgress' must be a string");
  if (typeof short.periodPlan !== "string") throw new Error("Validation Error: 'shortAnalysis.periodPlan' must be a string");
  if (typeof short.periodFact !== "string") throw new Error("Validation Error: 'shortAnalysis.periodFact' must be a string");
  if (typeof short.deviation !== "string") throw new Error("Validation Error: 'shortAnalysis.deviation' must be a string");
  if (typeof short.indicators !== "string") throw new Error("Validation Error: 'shortAnalysis.indicators' must be a string");
  if (typeof short.overallStatus !== "string") throw new Error("Validation Error: 'shortAnalysis.overallStatus' must be a string");

  // Validate keyProblems
  if (!Array.isArray(data.keyProblems)) {
    throw new Error("Validation Error: 'keyProblems' must be an array");
  }
  for (let i = 0; i < data.keyProblems.length; i++) {
    const item = data.keyProblems[i];
    if (!item || typeof item !== "object") {
      throw new Error(`Validation Error: 'keyProblems[${i}]' is not an object`);
    }
    const allowedKeys = ["problem", "managementAssessment", "severity"];
    for (const key of Object.keys(item)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Validation Error: 'keyProblems[${i}]' contains extra property '${key}'`);
      }
    }
    for (const key of allowedKeys) {
      if (!(key in item)) {
        throw new Error(`Validation Error: 'keyProblems[${i}]' is missing required property '${key}'`);
      }
    }
    if (typeof item.problem !== "string") throw new Error(`Validation Error: 'keyProblems[${i}].problem' must be a string`);
    if (typeof item.managementAssessment !== "string") throw new Error(`Validation Error: 'keyProblems[${i}].managementAssessment' must be a string`);
    const validSeverities = ["низкая", "средняя", "высокая", "критическая"];
    if (!validSeverities.includes(item.severity)) {
      throw new Error(`Validation Error: 'keyProblems[${i}].severity' must be one of: ${validSeverities.join(", ")}. Received: '${item.severity}'`);
    }
  }

  // Validate managementConclusion
  if (typeof data.managementConclusion !== "string") {
    throw new Error("Validation Error: 'managementConclusion' must be a string");
  }

  // Validate priorityActions
  if (!Array.isArray(data.priorityActions)) {
    throw new Error("Validation Error: 'priorityActions' must be an array");
  }
  for (let i = 0; i < data.priorityActions.length; i++) {
    const item = data.priorityActions[i];
    if (!item || typeof item !== "object") {
      throw new Error(`Validation Error: 'priorityActions[${i}]' is not an object`);
    }
    const allowedKeys = ["priority", "action", "owner"];
    for (const key of Object.keys(item)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Validation Error: 'priorityActions[${i}]' contains extra property '${key}'`);
      }
    }
    for (const key of allowedKeys) {
      if (!(key in item)) {
        throw new Error(`Validation Error: 'priorityActions[${i}]' is missing required property '${key}'`);
      }
    }
    if (typeof item.priority !== "number") throw new Error(`Validation Error: 'priorityActions[${i}].priority' must be a number`);
    if (typeof item.action !== "string") throw new Error(`Validation Error: 'priorityActions[${i}].action' must be a string`);
    if (typeof item.owner !== "string") throw new Error(`Validation Error: 'priorityActions[${i}].owner' must be a string`);
  }

  // Validate detailedAnalysis
  const detailed = data.detailedAnalysis;
  if (!detailed || typeof detailed !== "object") {
    throw new Error("Validation Error: 'detailedAnalysis' is not a valid object");
  }
  const allowedDetailedKeys = [
    "dataCompleteness", "pcTimeliness", "tasksAndMilestones", "planFact", 
    "indicators", "lagOrAdvance", "projectProposal", "aiProposal"
  ];
  for (const key of Object.keys(detailed)) {
    if (!allowedDetailedKeys.includes(key)) {
      throw new Error(`Validation Error: 'detailedAnalysis' contains extra property '${key}'`);
    }
  }
  for (const key of allowedDetailedKeys) {
    if (!(key in detailed)) {
      throw new Error(`Validation Error: 'detailedAnalysis' is missing required property '${key}'`);
    }
  }
  for (const key of allowedDetailedKeys) {
    if (typeof detailed[key] !== "string") {
      throw new Error(`Validation Error: 'detailedAnalysis.${key}' must be a string`);
    }
  }
}
