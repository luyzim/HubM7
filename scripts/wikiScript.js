
import "dotenv/config";

const WIKI_BASE_URL = process.env.WIKI_BASE_URL; // ex: http://172.16.0.195
const WIKI_USERNAME = process.env.WIKI_USERNAME;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;

if (!WIKI_BASE_URL || !WIKI_USERNAME || !WIKI_PASSWORD) {
  throw new Error("Env vars obrigatórias: WIKI_BASE_URL, WIKI_USERNAME, WIKI_PASSWORD");
}

let jwtCache = null;

// --- GraphQL ops (Wiki.js /graphql) ---
const LOGIN_MUTATION = `
mutation ($u: String!, $p: String!) {
  authentication {
    login(username: $u, password: $p, strategy: "local") { jwt }
  }
}
`;

const PAGE_BY_PATH = `
query ($path: String!, $locale: String!) {
  pages {
    singleByPath(path: $path, locale: $locale) {
      id
      title
      content
      editor
      description
      isPublished
      isPrivate
      path
      tags { tag title }
    }
  }
}
`;

const CREATE_PAGE = `
mutation (
  $title: String!,
  $content: String!,
  $description: String!,
  $editor: String!,
  $isPublished: Boolean!,
  $isPrivate: Boolean!,
  $locale: String!,
  $path: String!,
  $tags: [String]!
) {
  pages {
    create(
      title: $title, content: $content, description: $description,
      editor: $editor, isPublished: $isPublished, isPrivate: $isPrivate,
      locale: $locale, path: $path, tags: $tags
    ) {
      responseResult { succeeded errorCode slug message }
      page { id path title }
    }
  }
}
`;

const UPDATE_PAGE = `
mutation (
  $id: Int!,
  $title: String!,
  $content: String!,
  $description: String!,
  $editor: String!,
  $isPublished: Boolean!,
  $isPrivate: Boolean!,
  $locale: String!,
  $tags: [String]!
) {
  pages {
    update(
      id: $id, title: $title, content: $content, description: $description,
      editor: $editor, isPublished: $isPublished, isPrivate: $isPrivate,
      locale: $locale, tags: $tags
    ) {
      responseResult { succeeded errorCode slug message }
      page { id path title }
    }
  }
}
`;

function isForbidden(err) {
  return (err?.message || "").toLowerCase().includes("forbidden");
}

async function rawGql(query, variables = {}, token = null) {
  //console.log("rawGql: Enviando query GraphQL:", query);
  //console.log("rawGql: Variáveis da query GraphQL:", variables);
  const res = await fetch(`${WIKI_BASE_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  //console.log("rawGql: Resposta JSON bruta da API Wiki:", JSON.stringify(json, null, 2));

      // GraphQL pode retornar 200 e vir com errors
    if (json.errors?.length) {
      const msg = json.errors.map(e => e.message).join(" | ");
      const err = new Error(msg);
      err.details = json.errors;
      // Extract specific error code if available from extensions
      const firstError = json.errors[0];
      if (firstError.extensions && firstError.extensions.exception && firstError.extensions.exception.code) {
        err.wikiCode = firstError.extensions.exception.code; // Use a distinct property like wikiCode
      } else if (firstError.extensions && firstError.extensions.code) {
        err.wikiCode = firstError.extensions.code;
      }
      console.error("rawGql: Erros GraphQL detectados:", json.errors);
      throw err;
    }  return json.data;
}

async function ensureJwt() {
  if (jwtCache) return jwtCache;
  const data = await rawGql(LOGIN_MUTATION, { u: WIKI_USERNAME, p: WIKI_PASSWORD });
  const jwt = data?.authentication?.login?.jwt;
  if (!jwt) throw new Error("Login não retornou JWT");
  jwtCache = jwt;
  return jwt;
}

async function gql(query, variables = {}) {
  if (!jwtCache) await ensureJwt();
  try {
    return await rawGql(query, variables, jwtCache);
  } catch (e) {
    // JWT expirou / invalidou: reloga e tenta 1x
    if (isForbidden(e)) {
      jwtCache = null;
      await ensureJwt();
      return await rawGql(query, variables, jwtCache);
    }
    throw e;
  }
}

// --- Helpers de conteúdo (append idempotente) ---
function appendToManagedBlock(existing, marker, newChunk) {
  const begin = `<!-- ${marker}:BEGIN -->`;
  const end = `<!-- ${marker}:END -->`;

  const cur = existing || "";
  const chunk = `${newChunk}\n`; // garante quebra

  // Se já existe, injeta antes do END (acumula)
  const endIdx = cur.indexOf(end);
  if (endIdx !== -1) {
    return cur.slice(0, endIdx) + chunk + cur.slice(endIdx);
  }

  // Se não existe, cria bloco novo no fim
  const sep = cur.trim() ? "\n\n" : "";
  return `${cur.trim()}${sep}${begin}\n${chunk}${end}\n`;
}

// --- API do serviço ---
export async function getPageByPath(path, locale) {
  const data = await gql("CCS-Sicoob-" + PAGE_BY_PATH, { path, locale });
  return data?.pages?.singleByPath ?? null;
}

export async function createPage({
  path,
  title,
  content,
  locale,
  description = "",
  editor = "markdown",
  isPublished = true,
  isPrivate = false,
  tags = [],
}) {
  const data = await gql(CREATE_PAGE, {
    title,
    content,
    description,
    editor,
    isPublished,
    isPrivate,
    locale,
    path,
    tags,
  });

  const rr = data.pages.create.responseResult;
  if (!rr.succeeded) {
    const err = new Error(`Create failed: ${rr.slug} (${rr.errorCode}) ${rr.message}`);
    err.meta = rr;
    throw err;
  }
  return data.pages.create.page;
}

export async function updatePage({
  id,
  title,
  content,
  locale,
  description = "",
  editor = "markdown",
  isPublished = true,
  isPrivate = false,
  tags = [],
}) {
  const data = await gql(UPDATE_PAGE, {
    id,
    title,
    content,
    description,
    editor,
    isPublished,
    isPrivate,
    locale,
    tags,
  });

  const rr = data.pages.update.responseResult;
  if (!rr.succeeded) {
    const err = new Error(`Update failed: ${rr.slug} (${rr.errorCode}) ${rr.message}`);
    err.meta = rr;
    throw err;
  }
  return data.pages.update.page;
}

export async function appendBlockToPageByPath({
  path,
  locale,
  marker,
  text,
}) {
  const page = await getPageByPath(path, locale);
  if (!page) {
    const err = new Error("Página não encontrada");
    err.code = "NOT_FOUND";
    throw err;
  }

  const merged = appendToManagedBlock(page.content || "", marker, text || "");

  // tags no schema vêm como objetos; mutation espera [String]
  const tagStrings = (page.tags || []).map(t => t.tag).filter(Boolean);

  return await updatePage({
    id: page.id,
    title: page.title,
    content: merged,
    description: page.description || "",
    editor: page.editor || "markdown",
    isPublished: page.isPublished ?? true,
    isPrivate: page.isPrivate ?? false,
    locale,
    tags: tagStrings,
  });
}
