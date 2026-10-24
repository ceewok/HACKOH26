// DynamoDB single-table data access. See docs/specs/bridge-builder.md §4 for keys.
//   Problem   PK=PROBLEM#<id>  SK=META
//   Solution  PK=PROBLEM#<id>  SK=SOL#<id>
//   Feedback  PK=SOL#<id>      SK=FB#<id>

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "./config.js";
import type {
  Feedback,
  Problem,
  ProblemSummary,
  Solution,
} from "./types.js";

const client = new DynamoDBClient({
  region: config.region,
  ...(config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}),
});

const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = config.tableName;

const problemPk = (id: string) => `PROBLEM#${id}`;
const solutionPk = (solutionId: string) => `SOL#${solutionId}`;

// --- Problems ---

export async function putProblem(problem: Problem): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: problemPk(problem.id), SK: "META", type: "problem", ...problem },
    }),
  );
}

export async function getProblem(id: string): Promise<Problem | null> {
  const res = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { PK: problemPk(id), SK: "META" } }),
  );
  return res.Item ? toProblem(res.Item) : null;
}

export async function listProblems(): Promise<ProblemSummary[]> {
  // Small dataset for a demo; a Scan filtered to problem metadata is fine here.
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "TypeIndex",
      KeyConditionExpression: "#t = :t",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":t": "problem" },
    }),
  );
  const items = (res.Items ?? []).map(toProblem);
  // Weekly challenge first, then stable by title.
  items.sort((a, b) => {
    if (a.isWeekly !== b.isWeekly) return a.isWeekly ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return items.map(({ id, title, hook, isWeekly }) => ({ id, title, hook, isWeekly }));
}

// --- Solutions ---

export async function putSolution(solution: Solution): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: problemPk(solution.problemId),
        SK: `SOL#${solution.id}`,
        type: "solution",
        ...solution,
      },
    }),
  );
}

export async function getSolutionById(id: string): Promise<Solution | null> {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "TypeIndex",
      KeyConditionExpression: "#t = :t",
      FilterExpression: "id = :id",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":t": "solution", ":id": id },
    }),
  );
  const item = (res.Items ?? [])[0];
  return item ? toSolution(item) : null;
}

export async function listSolutionsForProblem(problemId: string): Promise<Solution[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": problemPk(problemId), ":sk": "SOL#" },
    }),
  );
  return (res.Items ?? []).map(toSolution);
}

export async function setSolutionEndorsed(
  problemId: string,
  solutionId: string,
): Promise<void> {
  await doc.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: problemPk(problemId), SK: `SOL#${solutionId}` },
      UpdateExpression: "SET endorsedByPro = :t",
      ExpressionAttributeValues: { ":t": true },
    }),
  );
}

// --- Feedback ---

export async function putFeedback(feedback: Feedback): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: solutionPk(feedback.solutionId),
        SK: `FB#${feedback.id}`,
        type: "feedback",
        ...feedback,
      },
    }),
  );
}

export async function listFeedbackForSolution(solutionId: string): Promise<Feedback[]> {
  const res = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": solutionPk(solutionId), ":sk": "FB#" },
    }),
  );
  const items = (res.Items ?? []).map(toFeedback);
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return items;
}

// --- Mappers (strip DynamoDB key attrs) ---

function toProblem(item: Record<string, unknown>): Problem {
  return {
    id: String(item.id),
    title: String(item.title),
    hook: String(item.hook),
    description: String(item.description ?? ""),
    constraints: (item.constraints as string[]) ?? [],
    hintPills: (item.hintPills as string[]) ?? [],
    isWeekly: Boolean(item.isWeekly),
  };
}

function toSolution(item: Record<string, unknown>): Solution {
  return {
    id: String(item.id),
    problemId: String(item.problemId),
    author: item.author as Solution["author"],
    spec: item.spec as Solution["spec"],
    mermaid: String(item.mermaid ?? ""),
    parentSolutionId: item.parentSolutionId as string | undefined,
    tweakNote: item.tweakNote as string | undefined,
    endorsedByPro: Boolean(item.endorsedByPro),
    createdAt: String(item.createdAt),
  };
}

function toFeedback(item: Record<string, unknown>): Feedback {
  return {
    id: String(item.id),
    solutionId: String(item.solutionId),
    author: item.author as Feedback["author"],
    text: String(item.text),
    createdAt: String(item.createdAt),
  };
}
