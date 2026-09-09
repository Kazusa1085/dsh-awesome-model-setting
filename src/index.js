/**
 * dsh-awesome-model-setting host half.
 *
 * Serves one read-only JSON route that answers "what does each model actually
 * accept right now?" — the *effective* capability after the settings document
 * and the adapter's own model catalog have been merged.
 *
 * Why this needs a host half: the browser wire (`llm.models`) carries only
 * id/name/description/reasoning, never input modalities, and the merge with the
 * provider catalog happens inside the adapter. `llm.listModels()` is the only
 * place that answer exists, and it is host-side.
 *
 * The route returns detached leaf data only (strings, numbers, arrays). No
 * service, session, or adapter object crosses it, and nothing is written.
 */
export const name = 'dsh-awesome-model-setting'

const ROUTE_PATH = '/plugins/dsh-awesome-model-setting/effective-models'
const DISCOVER_PATH = '/plugins/dsh-awesome-model-setting/discover-models'
const WEB_SERVER_KEYS = ['webServer', 'httpServer']

/** Coerce one optional value to a string with a fallback. */
function text(value, fallback) {
  return value === undefined || value === null ? fallback : String(value)
}

/**
 * Resolve the effective capability of every model of every registered route.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @returns {Promise<{ providers: Array<object> }>}
 */
async function collectEffectiveModels(ctx) {
  const llm = ctx.get('llm')
  if (llm === undefined) return { providers: [] }

  // The configurable-provider directory answers two questions the adapter
  // alone cannot: the display name to show, and whether the route is one the
  // adapter ships (false) or one configuration declared (true).
  const directory = {}
  try {
    for (const entry of llm.listConfigurableProviders()) {
      const id = String(entry.provider)
      directory[id] = {
        displayName: text(entry.displayName, id),
        declared: entry.declared === true,
        settingsNs: text(entry.settingsNs, ''),
      }
    }
  } catch (error) {
    // An unreadable directory only costs us display names and provenance.
  }

  const providers = []
  for (const provider of llm.listProviders()) {
    const id = String(provider.id)
    const meta = directory[id]
    const group = {
      provider: id,
      name: text(provider.name, id),
      displayName: meta === undefined ? id : meta.displayName,
      declared: meta === undefined ? false : meta.declared,
      models: [],
    }
    try {
      const list = await llm.listModels(id)
      for (const model of list) {
        const row = {
          id: String(model.id),
          name: text(model.name, String(model.id)),
          inputModalities: Array.isArray(model.inputModalities)
            ? model.inputModalities.map((item) => String(item))
            : [],
          contextWindow: null,
          maxTokens: null,
        }
        try {
          const info = await llm.resolveModelInfo(id, model.id)
          if (info !== null && info !== undefined) {
            if (info.context !== undefined && info.context !== null
              && typeof info.context.contextWindow === 'number') {
              row.contextWindow = info.context.contextWindow
            }
            if (typeof info.defaultMaxTokens === 'number') row.maxTokens = info.defaultMaxTokens
          }
        } catch (error) {
          // One model without exact metadata still lists; it just lacks capacity.
        }
        group.models.push(row)
      }
    } catch (error) {
      group.error = error instanceof Error ? error.message : String(error)
    }

    // The adapter exposes a default output cap only for models whose entry
    // declares one, so a catalog model listed as a bare `{ id }` comes back
    // without it. For a route the adapter ships a catalog for, that value is
    // available locally — fill the gap from the catalog. Hand-declared routes
    // are skipped deliberately: asking one would mean a network call.
    if (meta !== undefined && meta.declared === false && meta.settingsNs.length > 0
      && group.models.some((row) => row.maxTokens === null)) {
      try {
        const catalog = await llm.discoverModels(meta.settingsNs, {
          provider: id,
          signal: AbortSignal.timeout(5000),
        })
        const catalogById = new Map(catalog.map((model) => [String(model.id), model]))
        for (const row of group.models) {
          if (row.maxTokens !== null) continue
          const hit = catalogById.get(row.id)
          if (hit !== undefined && typeof hit.maxTokens === 'number') row.maxTokens = hit.maxTokens
        }
      } catch (error) {
        // No discovery registered for this namespace, or it failed: leave the gap.
      }
    }

    providers.push(group)
  }
  return { providers }
}

/**
 * Ask the adapter which models one route can serve.
 *
 * For a route the adapter ships a catalog for, this answers from that catalog
 * locally — no network and no credential. Only a hand-declared route (one the
 * adapter knows nothing about) falls through to interrogating its endpoint.
 *
 * The reply deliberately carries no input modalities: the adapter does not
 * expose them here. A model's real modalities become visible once it is served,
 * which is what the client's "join" action is for.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} settingsNs - namespace whose registered discovery serves this route.
 * @param {string} provider - provider route key to interrogate.
 * @returns {Promise<{ models: Array<object>, error?: string }>}
 */
async function discoverProviderModels(ctx, settingsNs, provider) {
  const llm = ctx.get('llm')
  if (llm === undefined) return { models: [], error: 'llm service is not mounted' }
  if (provider.length === 0) return { models: [], error: 'missing provider' }

  // A catalog route answers locally; a hand-declared route has no catalog, so
  // the adapter needs that route's endpoint. It is read from the very settings
  // section the user configured, so a local server (LM Studio, Ollama, a
  // gateway) is interrogated at the URL already on file.
  const request = { provider, signal: AbortSignal.timeout(15000) }
  const settings = ctx.get('settings')
  if (settings !== undefined) {
    try {
      const section = settings.get(settingsNs)
      const providers = section === undefined || section === null ? undefined : section.providers
      const profile = providers === undefined || providers === null ? undefined : providers[provider]
      if (profile !== undefined && profile !== null) {
        if (typeof profile.baseURL === 'string' && profile.baseURL.length > 0) request.baseURL = profile.baseURL
        if (typeof profile.api === 'string' && profile.api.length > 0) request.api = profile.api
      }
    } catch (error) {
      // An unreadable section only costs us the endpoint hint; the adapter will
      // then report the missing baseURL itself.
    }
  }

  try {
    // Bound the wait instead of leaving the panel spinning on an unreachable host.
    const models = await llm.discoverModels(settingsNs, request)
    return {
      models: models.map((model) => ({
        id: String(model.id),
        name: text(model.name, ''),
        contextWindow: typeof model.contextWindow === 'number' ? model.contextWindow : null,
        maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : null,
      })),
    }
  } catch (error) {
    return { models: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Register the effective-models route once the web server is available.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {object} config
 */
export function apply(ctx, config = {}) {
  const routePath = config.routePath ?? ROUTE_PATH
  const discoverPath = config.discoverPath ?? DISCOVER_PATH

  const respond = async (res) => {
    let body
    try {
      body = JSON.stringify(await collectEffectiveModels(ctx))
    } catch (error) {
      body = JSON.stringify({ providers: [], error: error instanceof Error ? error.message : String(error) })
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
  }

  const respondDiscover = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const provider = url.searchParams.get('provider') ?? ''
    const settingsNs = url.searchParams.get('ns') ?? 'llm-pi-ai'
    let body
    try {
      body = JSON.stringify(await discoverProviderModels(ctx, settingsNs, provider))
    } catch (error) {
      body = JSON.stringify({ models: [], error: error instanceof Error ? error.message : String(error) })
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end(body)
  }

  let registered = false
  const registerRoute = () => {
    if (registered) return
    const webServer = ctx.get(WEB_SERVER_KEYS[0]) ?? ctx.get(WEB_SERVER_KEYS[1])
    if (webServer === undefined) return
    registered = true
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: routePath,
      handler: async (_req, res) => respond(res),
    }), 'dsh-awesome-model-setting: effective models route')
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: discoverPath,
      handler: async (req, res) => respondDiscover(req, res),
    }), 'dsh-awesome-model-setting: discover models route')
  }

  registerRoute()
  ctx.on('internal/service', (serviceName) => {
    if (WEB_SERVER_KEYS.includes(serviceName)) registerRoute()
  })
}
