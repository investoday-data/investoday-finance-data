const fs = require("node:fs");
const path = require("node:path");

const OPENAPI_FILE = path.join(__dirname, "..", "data", "openapi.json");
const TREE_FILE = path.join(__dirname, "..", "data", "tree.json");

let cachedMetadata = null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractResponseFields(operation) {
  try {
    const schema = operation.responses["200"].content["application/json"].schema;
    const properties = schema.properties || {};
    const dataProp = properties.data || {};

    let source = {};
    if (dataProp && Object.keys(dataProp).length > 0) {
      if (dataProp.type === "array") {
        source = dataProp.items?.properties || {};
      } else {
        source = dataProp.properties || {};
      }
    } else if (schema.type === "array") {
      source = schema.items?.properties || {};
    } else {
      source = Object.fromEntries(
        Object.entries(properties).filter(([key]) => !["code", "message"].includes(key))
      );
    }

    return Object.entries(source).map(([name, value]) => ({
      name,
      desc: value.description || "",
      example: value.example ?? "",
    }));
  } catch {
    return [];
  }
}

function parseOpenapiPaths(openapi) {
  const pathMap = {};

  for (const [apiPath, methods] of Object.entries(openapi.paths || {})) {
    for (const [method, operation] of Object.entries(methods || {})) {
      if (!operation || typeof operation !== "object") {
        continue;
      }

      const operationId = operation.operationId || "";
      if (!operationId) {
        continue;
      }

      const httpMethod = method.toUpperCase();
      const parameters = (operation.parameters || []).map((parameter) => ({
        name: parameter.name || "",
        in: parameter.in || "query",
        required: Boolean(parameter.required),
        desc: parameter.description || "",
        example: parameter.schema?.example ?? "",
        type: parameter.schema?.type || "string",
      }));

      if (httpMethod === "POST" && operation.requestBody) {
        const bodySchema =
          operation.requestBody.content?.["application/json"]?.schema || {};
        const props = bodySchema.properties || {};
        const requiredFields = new Set(bodySchema.required || []);

        for (const [name, value] of Object.entries(props)) {
          parameters.push({
            name,
            in: "body",
            required: requiredFields.has(name),
            desc: value.description || "",
            example: value.example ?? "",
            type: value.type || "string",
          });
        }
      }

      const detail = {
        path: apiPath.replace(/^\/+/, ""),
        method: httpMethod,
        summary: operation.summary || "",
        description: operation.description || "",
        parameters,
        responseFields: extractResponseFields(operation),
      };

      const existing = pathMap[operationId];
      if (!existing || existing.method !== "POST" || httpMethod === "POST") {
        pathMap[operationId] = detail;
      }
    }
  }

  return pathMap;
}

function flattenTree(nodes, parentPath = []) {
  const results = [];

  for (const node of nodes || []) {
    const currentPath = [...parentPath, node.groupName || ""];

    for (const child of node.children || []) {
      results.push(...flattenTree([child], currentPath));
    }

    for (const api of node.apis || []) {
      results.push({
        groupPath: currentPath.filter((part) => part && part !== "分组"),
        apiName: api.apiName || "",
        toolName: api.toolName || "",
        toolId: api.toolId || "",
        apiPath: api.apiPath || "",
        apiMethod: (api.apiMethod || "").toUpperCase(),
      });
    }
  }

  return results;
}

function createGroupNode() {
  return {
    children: {},
    entries: [],
  };
}

function buildGroupTree(records) {
  const tree = {};

  for (const record of records) {
    if (!record.groupPath.length) {
      continue;
    }

    let level = tree;
    let node = null;
    for (const part of record.groupPath) {
      if (!part) {
        continue;
      }
      if (!level[part]) {
        level[part] = createGroupNode();
      }
      node = level[part];
      level = node.children;
    }

    if (node) {
      node.entries.push(record);
    }
  }

  return tree;
}

function preferRecord(existing, candidate) {
  if (!existing) {
    return candidate;
  }
  if (existing.method !== "POST" && candidate.method === "POST") {
    return candidate;
  }
  if (existing.method === "POST" && candidate.method !== "POST") {
    return existing;
  }

  const existingScore =
    Number(Boolean(existing.description)) +
    Number(Boolean(existing.summary)) +
    Number((existing.parameters || []).length > 0) +
    Number((existing.responseFields || []).length > 0);
  const candidateScore =
    Number(Boolean(candidate.description)) +
    Number(Boolean(candidate.summary)) +
    Number((candidate.parameters || []).length > 0) +
    Number((candidate.responseFields || []).length > 0);

  return candidateScore > existingScore ? candidate : existing;
}

function buildReferencePath(groupPath) {
  if (!groupPath || !groupPath.length) {
    return "";
  }

  if (groupPath.length === 1) {
    return `references/${groupPath[0]}.md`;
  }

  return `references/${groupPath.join("/")}.md`;
}

function buildMetadata() {
  const openapi = readJson(OPENAPI_FILE);
  const treeData = readJson(TREE_FILE);
  const rawTree = Array.isArray(treeData) ? treeData : treeData.data || [];
  const pathMap = parseOpenapiPaths(openapi);
  const treeRecords = flattenTree(rawTree);

  const dedupe = new Map();
  for (const record of treeRecords) {
    const detail = pathMap[record.toolId] || pathMap[record.toolName] || {};
    const normalizedRecord = {
      ...record,
      method: (detail.method || record.apiMethod || "GET").toUpperCase(),
      path: detail.path || record.apiPath,
      reference: buildReferencePath(record.groupPath),
      summary: detail.summary || "",
      description: detail.description || "",
      parameters: detail.parameters || [],
      responseFields: detail.responseFields || [],
    };
    const dedupeKey = [
      normalizedRecord.path,
      normalizedRecord.groupPath.join("/"),
    ].join("|");
    dedupe.set(dedupeKey, preferRecord(dedupe.get(dedupeKey), normalizedRecord));
  }

  const records = [...dedupe.values()];

  return {
    groupTree: buildGroupTree(records),
    pathMap,
    records,
  };
}

function getMetadata() {
  if (!cachedMetadata) {
    cachedMetadata = buildMetadata();
  }

  return cachedMetadata;
}

function scoreRecord(record, query) {
  const normalizedQuery = query.toLowerCase();
  let score = 0;

  const exactFields = [record.path, record.toolId, record.toolName, record.apiName];
  if (exactFields.some((value) => String(value || "").toLowerCase() === normalizedQuery)) {
    score += 100;
  }

  const textFields = [
    record.apiName,
    record.path,
    record.toolId,
    record.toolName,
    record.summary,
    record.description,
    record.groupPath.join("/"),
  ];
  for (const value of textFields) {
    const normalizedValue = String(value || "").toLowerCase();
    if (!normalizedValue) {
      continue;
    }
    if (normalizedValue.includes(normalizedQuery)) {
      score += normalizedValue.startsWith(normalizedQuery) ? 25 : 15;
    }
  }

  for (const parameter of record.parameters || []) {
    const haystacks = [parameter.name, parameter.desc, parameter.type];
    for (const value of haystacks) {
      const normalizedValue = String(value || "").toLowerCase();
      if (normalizedValue.includes(normalizedQuery)) {
        score += parameter.name === query ? 12 : 8;
      }
    }
  }

  for (const field of record.responseFields || []) {
    const haystacks = [field.name, field.desc];
    for (const value of haystacks) {
      const normalizedValue = String(value || "").toLowerCase();
      if (normalizedValue.includes(normalizedQuery)) {
        score += field.name === query ? 10 : 6;
      }
    }
  }

  return score;
}

function matchesRecordQuery(record, query) {
  return scoreRecord(record, query) > 0;
}

function normalizeSearchInput(input) {
  const rawQueries = Array.isArray(input?.query)
    ? input.query
    : input?.query !== undefined && input?.query !== null && input?.query !== ""
      ? [input.query]
      : [];
  const rawToolIds = Array.isArray(input?.toolIds)
    ? input.toolIds
    : input?.toolIds !== undefined && input?.toolIds !== null && input?.toolIds !== ""
      ? [input.toolIds]
      : [];

  const queries = rawQueries
    .flatMap((value) => String(value || "").split("\n"))
    .map((value) => value.trim())
    .filter(Boolean);
  const toolIds = rawToolIds
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return { queries, toolIds };
}

function resolveApi(query) {
  const normalizedQuery = (query || "").trim();
  if (!normalizedQuery) {
    return { matches: [], error: "Please provide an endpoint path, tool_id, or API name." };
  }

  const { records } = getMetadata();
  const lowerQuery = normalizedQuery.toLowerCase();
  const exactMatches = records.filter((record) =>
    record.path === normalizedQuery ||
    record.toolId === normalizedQuery ||
    record.toolName === normalizedQuery ||
    record.apiName === normalizedQuery
  );

  if (exactMatches.length === 1) {
    return { matches: exactMatches };
  }

  const fuzzyMatches = records.filter((record) => {
    const haystacks = [
      record.path,
      record.toolId,
      record.toolName,
      record.apiName,
      record.groupPath.join("/"),
    ].map((value) => String(value || "").toLowerCase());

    return haystacks.some((value) => value.includes(lowerQuery));
  });

  if (exactMatches.length > 1) {
    return { matches: exactMatches };
  }

  return { matches: fuzzyMatches };
}

function searchApis(input, limit = 10) {
  const { queries, toolIds } = normalizeSearchInput(input);
  if (!queries.length && !toolIds.length) {
    return { matches: [], error: "Please provide query=... and/or tool_ids=... ." };
  }

  const { records } = getMetadata();
  let candidates = records;
  const toolIdOrder = new Map(toolIds.map((toolId, index) => [toolId, index]));

  if (toolIds.length) {
    const toolIdSet = new Set(toolIds);
    candidates = candidates.filter((record) => toolIdSet.has(record.toolId));
    if (!queries.length) {
      const matches = candidates
        .sort((left, right) =>
          (toolIdOrder.get(left.toolId) ?? Number.MAX_SAFE_INTEGER) -
            (toolIdOrder.get(right.toolId) ?? Number.MAX_SAFE_INTEGER) ||
          left.path.localeCompare(right.path)
        )
        .slice(0, limit);
      return { matches };
    }
  }

  const scored = candidates
    .map((record) => ({
      record,
      matchedAllQueries: queries.every((query) => matchesRecordQuery(record, query)),
      score: queries.reduce((sum, query) => sum + scoreRecord(record, query), 0),
    }))
    .filter((item) => item.matchedAllQueries && item.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      (toolIdOrder.get(left.record.toolId) ?? Number.MAX_SAFE_INTEGER) -
        (toolIdOrder.get(right.record.toolId) ?? Number.MAX_SAFE_INTEGER) ||
      left.record.path.localeCompare(right.record.path)
    )
    .slice(0, limit)
    .map((item) => item.record);

  return { matches: scored };
}

module.exports = {
  getMetadata,
  resolveApi,
  searchApis,
};
