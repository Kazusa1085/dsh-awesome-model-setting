// dsh-awesome-model-setting client half (no-build bundle).
//
// Renders a "模型能力 / Model Capabilities" page inside the DSH settings panel.
//
// The page lists every model of every registered provider route and edits the
// four things that decide whether a model is usable as declared:
//   input modalities, context window, output cap, image request budgets.
//
// Two rules shape the whole UI:
//   1. It shows the EFFECTIVE value (settings document + provider catalog),
//      because a catalog route can be multimodal without anything in
//      settings.yaml. The host half answers that; the browser wire cannot.
//   2. It writes back only the user layer, and only the fields the user
//      actually touched — never a materialized copy of resolved defaults.
window.__ModuleLoader__.load({
  id: 'dsh-awesome-model-setting',
  factory: (require) => {
    const React = require('react')

    const ROUTE_PATH = '/plugins/dsh-awesome-model-setting/effective-models'
    const DISCOVER_ROUTE = '/plugins/dsh-awesome-model-setting/discover-models'
    const STYLE_ID = 'dsh-awesome-model-setting-style'
    const DS = 'llm-deepseek'
    const DS_PROVIDER = 'deepseek-official'
    const PI = 'llm-pi-ai'
    const FALLBACK_MODALITIES = ['text', 'image']
    const MODALITY_LABELS = { text: '文本', image: '图像', audio: '音频', video: '视频', pdf: 'PDF' }

    // Fields 「恢复路由默认值」 clears. `name` is deliberately absent: it is a
    // label (often the provider's own, e.g. a usage multiplier) rather than a
    // capability, and wiping it during a capability reset surprised users.
    const RESTORE_FIELDS = {
      deepseek: ['inputModalities', 'contextWindow', 'maxTokens', 'imagePixelBudget', 'imageMaxBytes', 'imageDetail'],
      'pi-ai': ['input', 'contextWindow', 'maxTokens'],
    }

    // Font Awesome Free v7.3.1 "image" icon (https://fontawesome.com/license/free).
    // Inlined as SVG because this frontend ships no icon font.
    const IMAGE_ICON_PATH = 'M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM224 176C250.5 176 272 197.5 272 224C272 250.5 250.5 272 224 272C197.5 272 176 250.5 176 224C176 197.5 197.5 176 224 176zM368 288C376.4 288 384.1 292.4 388.5 299.5L476.5 443.5C481 450.9 481.2 460.2 477 467.8C472.8 475.4 464.7 480 456 480L184 480C175.1 480 166.8 475 162.7 467.1C158.6 459.2 159.2 449.6 164.3 442.3L220.3 362.3C224.8 355.9 232.1 352.1 240 352.1C247.9 352.1 255.2 355.9 259.7 362.3L286.1 400.1L347.5 299.6C351.9 292.5 359.6 288.1 368 288.1z'

    const css = [
      '.mcap-root{max-width:820px;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary)}',
      '.mcap-title{margin:0;font-size:16px;font-weight:500;line-height:24px}',
      '.mcap-intro{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.mcap-search{box-sizing:border-box;flex:1 1 200px;min-width:160px;height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:13px}',
      '.mcap-search:focus{border-color:var(--dsw-alias-brand-primary);outline:none}',
      '.mcap-filter{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
      '.mcap-filter:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.mcap-filterActive{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3)}',
      '.mcap-group{display:flex;flex-direction:column;gap:6px}',
      '.mcap-groupHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.mcap-groupToggle{display:flex;align-items:center;gap:8px;background:0 0;border:none;padding:4px 0;font:inherit;cursor:pointer;color:var(--dsw-alias-label-secondary);text-align:left}',
      '.mcap-groupTitle{font-size:13px;font-weight:600}',
      '.mcap-count{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
      '.mcap-row{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden}',
      '.mcap-rowToggle{display:flex;align-items:center;gap:8px;width:100%;min-width:0;background:0 0;border:none;padding:10px 12px;font:inherit;cursor:pointer;color:var(--dsw-alias-label-primary);text-align:left;flex-wrap:nowrap}',
      '.mcap-rowToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.mcap-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .12s;font-size:11px}',
      '.mcap-chevronOpen{transform:rotate(90deg)}',
      '.mcap-name{font-size:14px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mcap-id{font-size:12px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mcap-icon{flex:none;color:var(--dsw-alias-brand-primary)}',
      '.mcap-tagRoute{border:1px solid var(--dsw-alias-border-l3);border-radius:4px;padding:0 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);flex:none}',
      '.mcap-summary{margin-left:auto;flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.mcap-dirty{font-size:11px;line-height:16px;border-radius:4px;padding:0 6px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label);flex:none;white-space:nowrap}',
      '.mcap-rowBody{border-top:1px solid var(--dsw-alias-border-l2);padding:12px;display:flex;flex-direction:column;gap:12px}',
      '.mcap-section{display:flex;flex-direction:column;gap:8px}',
      '.mcap-sectionTitle{display:flex;align-items:baseline;gap:12px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.mcap-sectionHint{font-size:11px;font-weight:400;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-fold{display:flex;align-items:center;gap:8px;background:0 0;border:none;padding:0;font:inherit;cursor:pointer;color:var(--dsw-alias-label-secondary);text-align:left}',
      '.mcap-foldBody{display:flex;flex-direction:column;gap:12px;padding-top:10px}',
      '.mcap-inline{display:flex;align-items:center;gap:18px;flex-wrap:wrap}',
      '.mcap-check{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.mcap-checkFixed{opacity:.75;cursor:default}',
      '.mcap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}',
      '.mcap-field{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.mcap-fieldLabel{display:flex;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-inherit{font-style:normal;opacity:.65}',
      '.mcap-input{box-sizing:border-box;width:100%;height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:13px}',
      '.mcap-input::placeholder{color:var(--dsw-alias-label-dimmed)}',
      '.mcap-input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}',
      '.mcap-input:disabled{opacity:.6;cursor:default}',
      '.mcap-confirm{border:1px solid var(--dsw-alias-state-warn-label);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-module-platform)}',
      '.mcap-confirmText{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-label)}',
      '.mcap-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mcap-save{height:32px;padding:0 16px;border:none;border-radius:16px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:13px;cursor:pointer}',
      '.mcap-save:disabled{opacity:.4;cursor:default}',
      '.mcap-ghost{background:0 0;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2)}',
      '.mcap-small{height:28px;padding:0 12px;font-size:12px}',
      '.mcap-status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-statusError{font-size:12px;color:var(--dsw-alias-state-error-primary)}',
      '.mcap-note{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-empty{border:1px dashed var(--dsw-alias-border-l3);border-radius:8px;padding:10px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.mcap-tiny{height:24px;padding:0 10px;font-size:11px}',
      '.mcap-discover{border:1px dashed var(--dsw-alias-border-l3);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}',
      '.mcap-discoverHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.mcap-discoverTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.mcap-discoverList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto}',
      '.mcap-discoverRow{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.mcap-discoverId{font-family:var(--ds-font-family-code);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mcap-discoverMeta{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
    ].join('\n')

    return {
      inject: ['slots', 'settingsScope', 'settingsSchema', 'connection'],
      apply(ctx) {
        const ensureStyle = () => {
          if (document.getElementById(STYLE_ID)) return () => {}
          const el = document.createElement('style')
          el.id = STYLE_ID
          el.setAttribute('data-plugin', 'dsh-awesome-model-setting')
          el.textContent = css
          document.head.appendChild(el)
          return () => { el.remove() }
        }
        ctx.effect(ensureStyle, 'dsh-awesome-model-setting: styles')

        const slots = ctx.get('slots')
        const scope = ctx.get('settingsScope')
        const schemaOps = ctx.get('settingsSchema')
        const connection = ctx.get('connection')
        if (slots === undefined || scope === undefined || schemaOps === undefined || connection === undefined) return

        const h = React.createElement
        const mirror = scope.describe()
        const api = connection.api

        const rowKey = (row) => row.ns + '|' + (row.route === null ? '' : row.route) + '|' + row.id
        const isPosInt = (value) => typeof value === 'number'
          ? Number.isInteger(value) && value > 0
          : (typeof value === 'string' && /^[0-9]+$/.test(value.trim()) && Number(value) > 0)
        const num = (value) => Number(String(value).trim())
        const formatCount = (value) => {
          if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
          if (value % 1000000 === 0) return String(value / 1000000) + 'M'
          if (value % 1000 === 0) return String(value / 1000) + 'K'
          return String(value)
        }
        const sameText = (left, right) => String(left === undefined || left === null ? '' : left) === String(right === undefined || right === null ? '' : right)
        const sameSet = (left, right) => {
          if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
          const a = left.map(String).slice().sort()
          const b = right.map(String).slice().sort()
          for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
          return true
        }
        const modalityLabel = (id) => MODALITY_LABELS[id] === undefined ? id : MODALITY_LABELS[id]
        const labelsOf = (list) => list.map(modalityLabel).join('、')
        const prettify = (value) => String(value).split('-')
          .map((part) => part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
          .join('-')

        /** Read the host half's effective-capability snapshot. */
        const fetchEffective = () => fetch(ROUTE_PATH, { cache: 'no-store' })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status)))

        /** Ask the adapter which models one pi-ai route can serve. */
        const fetchDiscover = (route) => fetch(
          DISCOVER_ROUTE + '?ns=' + encodeURIComponent(PI) + '&provider=' + encodeURIComponent(route),
          { cache: 'no-store' }
        ).then((response) => response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status)))

        /** Strip the schema-default artifacts an older version of this page may have written. */
        function pruneArtifacts(entry) {
          const next = {}
          for (const key of Object.keys(entry)) next[key] = entry[key]
          if (Array.isArray(next.input) && next.input.length === 0) delete next.input
          const compat = next.compat
          if (compat !== undefined && compat !== null && typeof compat === 'object') {
            const keys = Object.keys(compat)
            if (keys.length === 1 && keys[0] === 'chatTemplateKwargs') {
              const kwargs = compat.chatTemplateKwargs
              if (kwargs !== undefined && kwargs !== null && typeof kwargs === 'object' && Object.keys(kwargs).length === 0) delete next.compat
            }
          }
          return next
        }

        function ImageIcon() {
          return h('svg', {
            className: 'mcap-icon',
            width: 14,
            height: 14,
            viewBox: '0 0 640 640',
            fill: 'currentColor',
            role: 'img',
            'aria-label': '支持图像输入',
            focusable: 'false',
          }, h('path', { d: IMAGE_ICON_PATH }))
        }

        function namespaceRow(snap, ns) {
          const view = snap.view
          if (view === undefined) return undefined
          return view.namespaces.find((row) => row.ns === ns)
        }

        /** Walk one serialized schema node (`{uid, refs}`) by object keys and `inner` hops. */
        function schemaNode(wire, steps) {
          try {
            const refs = wire.schema.refs
            if (refs === undefined || refs === null) return undefined
            const at = (id) => refs[String(id)]
            let node = at(wire.schema.uid)
            for (const step of steps) {
              if (node === undefined || node === null) return undefined
              if (step === 'inner') {
                if (node.type !== 'array' && node.type !== 'dict') return undefined
                node = at(node.inner)
              } else {
                if (node.type !== 'object' || node.dict === undefined) return undefined
                node = at(node.dict[step])
              }
            }
            return node
          } catch (error) {
            return undefined
          }
        }

        /** The modality vocabulary, read from the schema so future modalities appear automatically. */
        function modalityOptions(wire, ns) {
          const node = schemaNode(wire, ns === DS
            ? ['models', 'inner', 'inputModalities', 'inner']
            : ['providers', 'inner', 'models', 'inner', 'input', 'inner'])
          if (node === undefined || node.type !== 'union' || !Array.isArray(node.list)) return FALLBACK_MODALITIES
          const values = []
          const refs = wire.schema.refs
          for (const id of node.list) {
            const member = refs[String(id)]
            if (member !== undefined && member.type === 'const' && typeof member.value === 'string') values.push(member.value)
          }
          return values.length > 0 ? values : FALLBACK_MODALITIES
        }

        /** The adapter's shipped default model entries, used to tell "written" from "changed". */
        function deepseekSchemaFacts(wire) {
          const facts = { shipped: {}, fieldModalities: ['text'] }
          const models = schemaNode(wire, ['models'])
          if (models !== undefined && models.meta !== undefined && Array.isArray(models.meta.default)) {
            for (const entry of models.meta.default) {
              if (entry !== null && entry !== undefined && entry.id !== undefined) facts.shipped[String(entry.id)] = entry
            }
          }
          const modalities = schemaNode(wire, ['models', 'inner', 'inputModalities'])
          if (modalities !== undefined && modalities.meta !== undefined
            && Array.isArray(modalities.meta.default) && modalities.meta.default.length > 0) {
            facts.fieldModalities = modalities.meta.default.map((item) => String(item))
          }
          return facts
        }

        function effectiveIndex(effective) {
          const index = {}
          if (effective === null || effective === undefined || !Array.isArray(effective.providers)) return index
          for (const group of effective.providers) {
            if (group === null || group === undefined) continue
            const provider = String(group.provider)
            const byId = {}
            const models = Array.isArray(group.models) ? group.models : []
            for (const model of models) {
              if (model === null || model === undefined) continue
              byId[String(model.id)] = {
                input: Array.isArray(model.inputModalities) ? model.inputModalities.map((item) => String(item)) : [],
                name: model.name === undefined || model.name === null ? '' : String(model.name),
                contextWindow: typeof model.contextWindow === 'number' ? model.contextWindow : undefined,
                maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : undefined,
              }
            }
            index[provider] = {
              models: byId,
              displayName: group.displayName === undefined ? provider : String(group.displayName),
              declared: group.declared === true,
            }
          }
          return index
        }

        function buildRows(snap, effective) {
          const index = effectiveIndex(effective)
          const rows = []

          const ds = namespaceRow(snap, DS)
          if (ds !== undefined) {
            const facts = deepseekSchemaFacts(ds)
            const models = Array.isArray(ds.value && ds.value.models) ? ds.value.models : []
            // The deepseek adapter ships a default model list; the user's own
            // list is what a parameter reset can act on.
            const narrowed = ds.user !== undefined && ds.user !== null && Array.isArray(ds.user.models)
            for (const model of models) {
              const id = String(model.id)
              const configured = Array.isArray(model.inputModalities) ? model.inputModalities.slice() : []
              const bucket = index[DS_PROVIDER]
              const host = bucket === undefined ? undefined : bucket.models[id]
              const eff = host === undefined ? undefined : host.input
              const hostName = host === undefined ? '' : host.name
              const shipped = facts.shipped[id]
              // 「恢复路由默认值」 appears only when the declared modalities really
              // differ from what the adapter ships — writing a field is not a change.
              let showRestore = false
              if (configured.length > 0) {
                if (shipped === undefined) showRestore = true
                else {
                  const shippedModalities = Array.isArray(shipped.inputModalities) && shipped.inputModalities.length > 0
                    ? shipped.inputModalities.map(String)
                    : facts.fieldModalities
                  showRestore = !sameSet(configured, shippedModalities)
                }
              }
              rows.push({
                ns: DS,
                provider: DS_PROVIDER,
                route: null,
                group: 'DeepSeek 官方适配器',
                id: id,
                name: model.name === undefined ? (hostName.length > 0 ? hostName : id) : String(model.name),
                input: eff === undefined || eff.length === 0 ? (configured.length > 0 ? configured : ['text']) : eff.slice(),
                hasOwnInput: configured.length > 0,
                routeDeclared: bucket === undefined ? true : bucket.declared,
                showRestore: showRestore,
                narrowed: narrowed,
                contextWindow: model.contextWindow,
                maxTokens: model.maxTokens,
                effectiveWindow: host === undefined ? undefined : host.contextWindow,
                effectiveTokens: host === undefined ? undefined : host.maxTokens,
                imagePixelBudget: model.imagePixelBudget,
                imageMaxBytes: model.imageMaxBytes,
                inheritedWindow: model.contextWindow === undefined,
                inheritedTokens: model.maxTokens === undefined,
              })
            }
          }

          const pi = namespaceRow(snap, PI)
          if (pi !== undefined) {
            const providers = pi.value && typeof pi.value.providers === 'object' && pi.value.providers !== null ? pi.value.providers : {}
            const userProviders = pi.user !== undefined && pi.user !== null
              && pi.user.providers !== undefined && pi.user.providers !== null ? pi.user.providers : {}
            for (const route of Object.keys(providers)) {
              const profile = providers[route] === null || providers[route] === undefined ? {} : providers[route]
              const userProfile = userProviders[route] === undefined || userProviders[route] === null ? {} : userProviders[route]
              // A route is "narrowed" when the user document lists its models;
              // otherwise the adapter already serves the whole catalog and there
              // is nothing to join.
              const narrowed = Array.isArray(userProfile.models)
              const models = Array.isArray(profile.models) ? profile.models : []
              const bucket = index[route]
              const alias = bucket !== undefined && bucket.displayName !== route ? bucket.displayName : prettify(route)
              const routeDeclared = bucket === undefined ? true : bucket.declared
              if (models.length === 0) {
                rows.push({ ns: PI, route: route, group: alias, id: null, empty: true, narrowed: narrowed })
                continue
              }
              for (const model of models) {
                const id = String(model.id)
                const configured = Array.isArray(model.input) ? model.input.slice() : []
                const host = bucket === undefined ? undefined : bucket.models[id]
                const eff = host === undefined ? undefined : host.input
                const hostName = host === undefined ? '' : host.name
                rows.push({
                  ns: PI,
                  provider: route,
                  route: route,
                  group: alias,
                  id: id,
                  name: model.name === undefined ? (hostName.length > 0 ? hostName : id) : String(model.name),
                  input: eff === undefined || eff.length === 0
                    ? (configured.length > 0 ? configured : (Array.isArray(profile.defaultInput) ? profile.defaultInput.slice() : ['text']))
                    : eff.slice(),
                  hasOwnInput: configured.length > 0,
                  routeDeclared: routeDeclared,
                  showRestore: configured.length > 0,
                  narrowed: narrowed,
                  contextWindow: model.contextWindow,
                  maxTokens: model.maxTokens,
                  effectiveWindow: host === undefined ? profile.defaultContextWindow : host.contextWindow,
                  effectiveTokens: host === undefined ? profile.defaultMaxTokens : host.maxTokens,
                  inheritedWindow: model.contextWindow === undefined,
                  inheritedTokens: model.maxTokens === undefined,
                })
              }
            }
          }
          return rows
        }

        function applyEdits(raw, value, family, original) {
          const next = pruneArtifacts(raw)
          if (value.restore === true) {
            for (const field of RESTORE_FIELDS[family]) delete next[field]
            return next
          }
          // `name` is never written: this page has no name editor, and the name
          // shown may be the provider catalog's own (e.g. a usage multiplier).
          // Materializing it here would freeze a catalog value into the user
          // document, so whatever the raw entry carried is preserved verbatim.
          //
          // The same reasoning applies to modalities: the value on screen may be
          // the catalog's, so write it only when the user actually changed it.
          const modalityChanged = original === undefined || !sameSet(value.input, original.input)
          const budgetChanged = original === undefined
            || !sameText(value.imagePixelBudget, original.imagePixelBudget)
            || !sameText(value.imageMaxBytes, original.imageMaxBytes)
          if (family === 'deepseek') {
            if (modalityChanged) {
              const input = value.input.length > 0 ? value.input.slice() : ['text']
              if (input.length === 1 && input[0] === 'text') delete next.inputModalities
              else next.inputModalities = input
              if (input.indexOf('image') >= 0) {
                if (isPosInt(value.imagePixelBudget)) next.imagePixelBudget = num(value.imagePixelBudget)
                else delete next.imagePixelBudget
                if (isPosInt(value.imageMaxBytes)) next.imageMaxBytes = num(value.imageMaxBytes)
                else delete next.imageMaxBytes
              } else {
                delete next.imagePixelBudget
                delete next.imageMaxBytes
                delete next.imageDetail
              }
            } else if (budgetChanged) {
              // Budgets are editable on their own; writing them must not drag the
              // modality field along.
              if (isPosInt(value.imagePixelBudget)) next.imagePixelBudget = num(value.imagePixelBudget)
              else delete next.imagePixelBudget
              if (isPosInt(value.imageMaxBytes)) next.imageMaxBytes = num(value.imageMaxBytes)
              else delete next.imageMaxBytes
            }
          } else if (modalityChanged) {
            next.input = value.input.length > 0 ? value.input.slice() : ['text']
          }
          if (isPosInt(value.contextWindow)) next.contextWindow = num(value.contextWindow)
          else delete next.contextWindow
          if (isPosInt(value.maxTokens)) next.maxTokens = num(value.maxTokens)
          else delete next.maxTokens
          return next
        }

        function NumberField(props) {
          const empty = props.value === undefined || props.value === null || String(props.value).length === 0
          const hint = props.inherited === true
            ? (props.inheritedText !== undefined && props.inheritedText.length > 0 ? '继承 ' + props.inheritedText : '继承')
            : ''
          return h('label', { className: 'mcap-field' },
            h('span', { className: 'mcap-fieldLabel' },
              props.label,
              hint.length > 0 ? h('em', { className: 'mcap-inherit' }, hint) : null
            ),
            h('input', {
              className: 'mcap-input',
              type: 'text',
              inputMode: 'numeric',
              disabled: props.disabled === true,
              value: empty ? '' : String(props.value),
              placeholder: '使用路由默认值',
              onChange: (event) => props.onChange(event.target.value),
            })
          )
        }

        function ModelRow(props) {
          const row = props.row
          const value = props.value
          if (row.empty === true) {
            return h('li', { className: 'mcap-empty' }, '该路由未声明模型列表（继承 pi-ai 内置目录），本页暂不支持编辑其能力。')
          }
          const key = rowKey(row)
          const open = props.open === true
          const isImage = value.input.indexOf('image') >= 0
          const deepseek = row.ns === DS
          const parts = []
          if (formatCount(row.effectiveWindow).length > 0) parts.push('上下文 ' + formatCount(row.effectiveWindow))
          if (formatCount(row.effectiveTokens).length > 0) parts.push('输出 ' + formatCount(row.effectiveTokens))
          const summary = parts.join(' · ')
          const extraChecks = props.modalities.filter((id) => id !== 'text')
          const inputSource = row.hasOwnInput === true
            ? '配置文件声明'
            : (row.routeDeclared === true ? '路由默认值' : '供应商目录声明')
          const fromRoute = row.hasOwnInput !== true && row.routeDeclared !== true && value.input.some((id) => id !== 'text')
          const restoring = value.restore === true
          return h('li', { className: 'mcap-row' },
            h('button', {
              className: 'mcap-rowToggle',
              type: 'button',
              'aria-expanded': open,
              onClick: () => props.onToggleOpen(key),
            },
              h('span', { className: 'mcap-chevron' + (open ? ' mcap-chevronOpen' : '') }, '▶'),
              h('span', { className: 'mcap-name', title: value.name }, value.name),
              h('code', { className: 'mcap-id', title: row.id }, row.id),
              isImage && !restoring ? h(ImageIcon, { key: 'icon' }) : null,
              fromRoute && !restoring ? h('span', { className: 'mcap-tagRoute', key: 'route' }, '路由声明') : null,
              props.dirty === true ? h('span', { className: 'mcap-dirty' }, '未保存') : null,
              summary.length > 0 ? h('span', { className: 'mcap-summary' }, summary) : null
            ),
            open ? h('div', { className: 'mcap-rowBody' },
              h('div', { className: 'mcap-section' },
                h('div', { className: 'mcap-sectionTitle' },
                  '输入模态',
                  h('span', { className: 'mcap-sectionHint' }, restoring ? '保存后恢复为默认' : inputSource)
                ),
                restoring ? h('p', { className: 'mcap-note' }, '保存后此模型将恢复为默认值（模态与容量全部清除，名称保留）。') : null,
                h('div', { className: 'mcap-inline' },
                  h('label', {
                    className: 'mcap-check mcap-checkFixed',
                    title: '模型支持文本输入，且你不能关掉这个功能',
                  },
                    h('input', {
                      type: 'checkbox',
                      checked: true,
                      disabled: true,
                      readOnly: true,
                      'aria-label': '文本输入（模型基础能力，不可关闭）',
                    }),
                    '文本'
                  ),
                  extraChecks.map((id) => h('label', { className: 'mcap-check', key: id },
                    h('input', {
                      type: 'checkbox',
                      checked: value.input.indexOf(id) >= 0,
                      disabled: restoring,
                      onChange: () => props.onToggleInput(row, id),
                    }),
                    modalityLabel(id)
                  )),
                  restoring ? h('button', {
                    className: 'mcap-filter',
                    type: 'button',
                    onClick: () => props.onCancelRestore(row),
                  }, '取消恢复') : (row.showRestore === true ? h('button', {
                    className: 'mcap-filter',
                    type: 'button',
                    onClick: () => props.onRestore(row),
                  }, '恢复路由默认值') : null)
                ),
                props.pending !== null && props.pending !== undefined && props.pending.key === key ? h('div', { className: 'mcap-confirm' },
                  h('p', { className: 'mcap-confirmText' }, '供应商声明此模型支持 ' + labelsOf(props.pending.from) + '，您正在试图改为 ' + labelsOf(props.pending.to) + '，确定吗？'),
                  h('div', { className: 'mcap-actions' },
                    h('button', { className: 'mcap-save mcap-small', type: 'button', onClick: () => props.onConfirmPending() }, '确定'),
                    h('button', { className: 'mcap-save mcap-ghost mcap-small', type: 'button', onClick: () => props.onCancelPending() }, '取消')
                  )
                ) : null
              ),
              h('div', { className: 'mcap-section' },
                h('button', {
                  className: 'mcap-fold',
                  type: 'button',
                  'aria-expanded': props.advancedOpen === true,
                  onClick: () => props.onToggleAdvanced(key),
                },
                  h('span', { className: 'mcap-chevron' + (props.advancedOpen === true ? ' mcap-chevronOpen' : '') }, '▶'),
                  h('span', { className: 'mcap-sectionTitle' }, '容量与预算'),
                  props.advancedDirty === true ? h('span', { className: 'mcap-dirty' }, '已修改') : null
                ),
                props.advancedOpen === true ? h('div', { className: 'mcap-foldBody' },
                  h('div', { className: 'mcap-section' },
                    h('div', { className: 'mcap-sectionTitle' }, '容量'),
                    h('div', { className: 'mcap-grid' },
                      h(NumberField, {
                        label: '上下文窗口',
                        value: value.contextWindow,
                        inherited: row.inheritedWindow,
                        inheritedText: formatCount(row.effectiveWindow),
                        disabled: restoring,
                        onChange: (next) => props.onPatch(row, { contextWindow: next }),
                      }),
                      h(NumberField, {
                        label: '最大输出 token',
                        value: value.maxTokens,
                        inherited: row.inheritedTokens,
                        inheritedText: formatCount(row.effectiveTokens),
                        disabled: restoring,
                        onChange: (next) => props.onPatch(row, { maxTokens: next }),
                      })
                    )
                  ),
                  deepseek && isImage && !restoring ? h('div', { className: 'mcap-section' },
                    h('div', { className: 'mcap-sectionTitle' }, '图像请求预算'),
                    h('div', { className: 'mcap-grid' },
                      h(NumberField, {
                        label: '图像像素预算',
                        value: value.imagePixelBudget,
                        onChange: (next) => props.onPatch(row, { imagePixelBudget: next }),
                      }),
                      h(NumberField, {
                        label: '单图字节上限',
                        value: value.imageMaxBytes,
                        onChange: (next) => props.onPatch(row, { imageMaxBytes: next }),
                      })
                    )
                  ) : null
                ) : null
              )
            ) : null
          )
        }

        const FILTERS = [
          { id: 'all', label: '全部' },
          { id: 'image', label: '仅多模态' },
          { id: 'dirty', label: '仅未保存' },
        ]

        function ModelCapabilitiesPage() {
          const [snap, setSnap] = React.useState(() => mirror.getSnapshot())
          const [effective, setEffective] = React.useState(null)
          const [drafts, setDrafts] = React.useState({})
          const [expanded, setExpanded] = React.useState({})
          const [advanced, setAdvanced] = React.useState({})
          const [collapsedGroups, setCollapsedGroups] = React.useState({})
          const [pending, setPending] = React.useState(null)
          const [query, setQuery] = React.useState('')
          const [filter, setFilter] = React.useState('all')
          const [status, setStatus] = React.useState(null)
          const [busy, setBusy] = React.useState(false)
          const [discoveries, setDiscoveries] = React.useState({})
          const [discoverOpen, setDiscoverOpen] = React.useState({})
          const [confirmReset, setConfirmReset] = React.useState(null)
          const [discoverBusy, setDiscoverBusy] = React.useState(false)

          React.useEffect(() => {
            const dispose = mirror.subscribe(() => setSnap(mirror.getSnapshot()))
            mirror.ensure()
            return dispose
          }, [])

          React.useEffect(() => {
            let stale = false
            const refresh = () => {
              fetchEffective().then(
                (result) => { if (!stale) setEffective(result) },
                () => { if (!stale) setEffective({ providers: [] }) }
              )
            }
            refresh()
            const off = ctx.on('connection/reset', refresh)
            return () => { stale = true; off() }
          }, [])

          const allRows = buildRows(snap, effective)
          const dsWire = namespaceRow(snap, DS)
          const piWire = namespaceRow(snap, PI)
          const valueOf = (row) => {
            const draft = drafts[rowKey(row)]
            return draft === undefined ? row : draft
          }
          const isDirty = (row) => row.id !== null && drafts[rowKey(row)] !== undefined

          const needle = query.trim().toLowerCase()
          const visibleRows = allRows.filter((row) => {
            if (row.id === null) return needle.length === 0 && filter === 'all'
            if (filter === 'image' && valueOf(row).input.indexOf('image') < 0) return false
            if (filter === 'dirty' && !isDirty(row)) return false
            if (needle.length === 0) return true
            const haystack = (row.id + ' ' + row.name + ' ' + row.group).toLowerCase()
            return haystack.indexOf(needle) >= 0
          })

          const groups = []
          for (const row of visibleRows) {
            const last = groups.length === 0 ? undefined : groups[groups.length - 1]
            if (last === undefined || last.title !== row.group) {
              groups.push({
                title: row.group,
                ns: row.ns,
                route: row.route === undefined ? null : row.route,
                narrowed: row.narrowed === true,
                routeDeclared: row.routeDeclared === true,
                rows: [row],
              })
            } else {
              last.rows.push(row)
              if (row.narrowed === true) last.narrowed = true
            }
          }

          const dirtyRows = allRows.filter(isDirty)
          const dirtyCount = dirtyRows.length
          const totalModels = allRows.filter((row) => row.id !== null).length
          const visibleModelCount = visibleRows.filter((row) => row.id !== null).length
          const visibleModelRows = visibleRows.filter((row) => row.id !== null)
          const allExpanded = visibleModelRows.length > 0 && visibleModelRows.every((row) => expanded[rowKey(row)] === true)

          const onPatch = (row, patch) => {
            const next = {}
            const current = valueOf(row)
            for (const key of Object.keys(current)) next[key] = current[key]
            for (const key of Object.keys(patch)) next[key] = patch[key]
            setDrafts((previous) => {
              const merged = {}
              for (const key of Object.keys(previous)) merged[key] = previous[key]
              merged[rowKey(row)] = next
              return merged
            })
          }
          const onToggleInput = (row, modality) => {
            const current = valueOf(row)
            const has = current.input.indexOf(modality) >= 0
            let nextInput = has ? current.input.filter((item) => item !== modality) : current.input.concat([modality])
            if (nextInput.indexOf('text') < 0) nextInput = ['text'].concat(nextInput)
            // Changing a capability the provider declared deserves a confirmation.
            const routeCapability = row.hasOwnInput !== true && row.routeDeclared !== true
              && current.input.some((id) => id !== 'text')
            if (routeCapability) {
              setPending({ key: rowKey(row), row: row, from: current.input.slice(), to: nextInput })
              return
            }
            onPatch(row, { input: nextInput, restore: false })
          }
          const onConfirmPending = () => {
            if (pending === null) return
            onPatch(pending.row, { input: pending.to.slice(), restore: false })
            setPending(null)
          }
          const onCancelPending = () => setPending(null)
          const onRestore = (row) => onPatch(row, { restore: true })
          const onCancelRestore = (row) => onPatch(row, { restore: false })
          const onToggleOpen = (key) => {
            setExpanded((previous) => {
              const next = {}
              for (const item of Object.keys(previous)) next[item] = previous[item]
              next[key] = previous[key] !== true
              return next
            })
          }
          const onToggleAdvanced = (key) => {
            setAdvanced((previous) => {
              const next = {}
              for (const item of Object.keys(previous)) next[item] = previous[item]
              next[key] = previous[key] !== true
              return next
            })
          }
          const onToggleGroup = (title) => {
            setCollapsedGroups((previous) => {
              const next = {}
              for (const item of Object.keys(previous)) next[item] = previous[item]
              next[title] = previous[title] !== true
              return next
            })
          }
          const setAllRows = (open) => {
            const next = {}
            for (const row of visibleRows) if (row.id !== null) next[rowKey(row)] = open
            setExpanded(next)
          }
          const advancedDirty = (row) => {
            const draft = drafts[rowKey(row)]
            if (draft === undefined) return false
            return !sameText(draft.contextWindow, row.contextWindow)
              || !sameText(draft.maxTokens, row.maxTokens)
              || !sameText(draft.imagePixelBudget, row.imagePixelBudget)
              || !sameText(draft.imageMaxBytes, row.imageMaxBytes)
          }

          /** Open (or close) one route's provider-discovery panel, loading on first open. */
          const toggleDiscovery = (route) => {
            if (discoverOpen[route] === true) {
              setDiscoverOpen((previous) => Object.assign({}, previous, { [route]: false }))
              return
            }
            setDiscoverOpen((previous) => Object.assign({}, previous, { [route]: true }))
            setDiscoveries((previous) => Object.assign({}, previous, { [route]: { status: 'loading', models: [], error: null } }))
            fetchDiscover(route).then(
              (result) => setDiscoveries((previous) => Object.assign({}, previous, {
                [route]: {
                  status: 'ready',
                  models: Array.isArray(result.models) ? result.models : [],
                  error: result.error === undefined || result.error === null ? null : String(result.error),
                },
              })),
              (error) => setDiscoveries((previous) => Object.assign({}, previous, {
                [route]: { status: 'ready', models: [], error: String(error !== null && error !== undefined && error.message !== undefined ? error.message : error) },
              }))
            )
          }

          /** Add discovered model ids to a narrowed route as minimal `{ id }` entries. */
          const joinDiscovered = async (route, ids) => {
            const wire = namespaceRow(snap, PI)
            if (wire === undefined) return
            const userProviders = wire.user !== undefined && wire.user !== null
              && wire.user.providers !== undefined && wire.user.providers !== null ? wire.user.providers : {}
            const userProfile = userProviders[route] === undefined || userProviders[route] === null ? {} : userProviders[route]
            if (!Array.isArray(userProfile.models)) {
              setStatus('该路由正在服务内置目录的全部模型，无需加入。')
              return
            }
            const next = userProfile.models.map((model) => pruneArtifacts(model))
            const existing = new Set(next.map((model) => String(model.id)))
            let added = 0
            for (const id of ids) {
              if (existing.has(id)) continue
              existing.add(id)
              next.push({ id: id })
              added += 1
            }
            if (added === 0) {
              setStatus('没有需要加入的模型。')
              return
            }
            setDiscoverBusy(true)
            setStatus(null)
            try {
              const response = await api.settings.mutate({
                ns: PI,
                ops: [{ op: 'set', path: ['providers', route, 'models'], value: next }],
                expectedRevision: wire.revision,
              })
              if (response.result.ok) setStatus('已加入 ' + String(added) + ' 个模型')
              else if (response.result.error.code === 'settings-conflict') setStatus('设置已被外部修改，请刷新后重试')
              else setStatus('加入失败：' + response.result.error.message)
              await mirror.load()
              fetchEffective().then((result) => setEffective(result), () => undefined)
            } catch (error) {
              setStatus(String(error !== null && error !== undefined && error.message !== undefined ? error.message : error))
            } finally {
              setDiscoverBusy(false)
            }
          }

          /**
           * Reset every model in one group back to its default parameters.
           *
           * This deliberately never touches the model list: which models exist is
           * the shipped Models page's job. Only the fields this page owns
           * (modalities, capacity, image budgets) are dropped from each entry, so
           * the adapter's own defaults take over again. Names are preserved.
           */
          const resetGroupParameters = async (group) => {
            const wire = namespaceRow(snap, group.ns)
            if (wire === undefined) return
            const fields = group.ns === DS ? RESTORE_FIELDS.deepseek : RESTORE_FIELDS['pi-ai']
            const strip = (model) => {
              const next = pruneArtifacts(model)
              for (const field of fields) delete next[field]
              return next
            }
            const ops = []
            if (group.ns === DS) {
              const userModels = wire.user !== undefined && wire.user !== null && Array.isArray(wire.user.models)
                ? wire.user.models : []
              if (userModels.length === 0) {
                setStatus('没有可重置的条目。')
                return
              }
              ops.push({ op: 'set', path: ['models'], value: userModels.map(strip) })
            } else {
              const userProviders = wire.user !== undefined && wire.user !== null
                && wire.user.providers !== undefined && wire.user.providers !== null ? wire.user.providers : {}
              const userProfile = userProviders[group.route] === undefined || userProviders[group.route] === null
                ? {} : userProviders[group.route]
              const userModels = Array.isArray(userProfile.models) ? userProfile.models : []
              if (userModels.length === 0) {
                setStatus('该路由的模型列表不由本页管理，没有可重置的条目。')
                return
              }
              ops.push({ op: 'set', path: ['providers', group.route, 'models'], value: userModels.map(strip) })
            }
            setDiscoverBusy(true)
            setStatus(null)
            try {
              const response = await api.settings.mutate({
                ns: group.ns,
                ops: ops,
                expectedRevision: wire.revision,
              })
              if (response.result.ok) setStatus('已把 ' + group.title + ' 的模型参数重置为默认值')
              else if (response.result.error.code === 'settings-conflict') setStatus('设置已被外部修改，请刷新后重试')
              else setStatus('重置失败：' + response.result.error.message)
              setConfirmReset(null)
              await mirror.load()
              fetchEffective().then((result) => setEffective(result), () => undefined)
            } catch (error) {
              setStatus(String(error !== null && error !== undefined && error.message !== undefined ? error.message : error))
            } finally {
              setDiscoverBusy(false)
            }
          }

          const save = async () => {
            if (dirtyCount === 0 || snap.view === undefined) return
            setBusy(true)
            setStatus(null)
            const messages = []
            try {
              const byNamespace = new Map()
              for (const row of dirtyRows) {
                const list = byNamespace.get(row.ns)
                if (list === undefined) byNamespace.set(row.ns, [row])
                else list.push(row)
              }
              for (const entry of byNamespace.entries()) {
                const ns = entry[0]
                const list = entry[1]
                const wire = namespaceRow(snap, ns)
                if (wire === undefined) continue
                const ops = []
                let candidate
                if (ns === DS) {
                  const userModels = wire.user !== undefined && wire.user !== null && Array.isArray(wire.user.models) ? wire.user.models : undefined
                  const effectiveModels = Array.isArray(wire.value.models) ? wire.value.models : []
                  const source = userModels === undefined ? effectiveModels : userModels
                  const models = source.map((model) => {
                    const row = list.find((item) => item.id === String(model.id))
                    if (row === undefined) return userModels === undefined ? model : pruneArtifacts(model)
                    return applyEdits(model, valueOf(row), 'deepseek', row)
                  })
                  ops.push({ op: 'set', path: ['models'], value: models })
                  candidate = Object.assign({}, wire.value, { models: models })
                } else {
                  const providers = Object.assign({}, wire.value.providers === undefined ? {} : wire.value.providers)
                  const userProviders = wire.user !== undefined && wire.user !== null
                    && wire.user.providers !== undefined && wire.user.providers !== null ? wire.user.providers : {}
                  const routes = []
                  for (const row of list) if (routes.indexOf(row.route) < 0) routes.push(row.route)
                  for (const route of routes) {
                    const userProfile = userProviders[route] === undefined || userProviders[route] === null ? {} : userProviders[route]
                    const effectiveProfile = providers[route] === undefined ? {} : providers[route]
                    const source = Array.isArray(userProfile.models)
                      ? userProfile.models
                      : (Array.isArray(effectiveProfile.models) ? effectiveProfile.models : [])
                    const models = source.map((model) => {
                      const row = list.find((item) => item.route === route && item.id === String(model.id))
                      return row === undefined ? pruneArtifacts(model) : applyEdits(model, valueOf(row), 'pi-ai', row)
                    })
                    ops.push({ op: 'set', path: ['providers', route, 'models'], value: models })
                    providers[route] = Object.assign({}, effectiveProfile, { models: models })
                  }
                  candidate = Object.assign({}, wire.value, { providers: providers })
                }
                const failure = schemaOps.validate(schemaOps.rehydrate(wire.schema), candidate)
                if (failure !== undefined) {
                  messages.push(ns + ' 校验失败：' + failure)
                  continue
                }
                const response = await api.settings.mutate({ ns: ns, ops: ops, expectedRevision: wire.revision })
                if (response.result.ok) messages.push(ns + ' 已保存')
                else if (response.result.error.code === 'settings-conflict') messages.push(ns + ' 设置已被外部修改，请刷新后重试')
                else messages.push(ns + ' 保存失败：' + response.result.error.message)
              }
              setDrafts({})
              setPending(null)
              await mirror.load()
              fetchEffective().then((result) => setEffective(result), () => undefined)
            } catch (error) {
              messages.push(String(error !== null && error !== undefined && error.message !== undefined ? error.message : error))
            } finally {
              setStatus(messages.join('；'))
              setBusy(false)
            }
          }

          /**
           * The per-route discovery panel: what the adapter says this route can
           * serve, with one action per model that is not in the document yet.
           */
          const renderDiscovery = (group) => {
            const route = group.route
            if (route === null || discoverOpen[route] !== true) return null
            const state = discoveries[route]
            const loading = state === undefined || state.status === 'loading'
            const configuredIds = new Set(group.rows.filter((row) => row.id !== null).map((row) => row.id))
            const candidates = state === undefined ? [] : state.models.filter((model) => !configuredIds.has(model.id))
            const joinable = group.narrowed === true ? candidates : []
            return h('div', { className: 'mcap-discover' },
              h('div', { className: 'mcap-discoverHead' },
                h('span', { className: 'mcap-discoverTitle' }, '从供应商加载'),
                loading ? h('span', { className: 'mcap-note' }, '正在读取…') : null,
                !loading && state.error === null ? h('span', { className: 'mcap-count' },
                  '共 ' + String(state.models.length) + ' 个 · 未声明 ' + String(candidates.length) + ' 个') : null,
                joinable.length > 0 ? h('button', {
                  className: 'mcap-filter mcap-tiny',
                  type: 'button',
                  disabled: discoverBusy,
                  onClick: () => { void joinDiscovered(route, joinable.map((model) => model.id)) },
                }, '全部加入') : null
              ),
              !loading && state.error !== null ? h('p', { className: 'mcap-statusError' }, state.error) : null,
              !loading && state.error === null && state.models.length === 0
                ? h('p', { className: 'mcap-note' }, '供应商没有报告任何模型。') : null,
              !loading && state.error === null && state.models.length > 0 ? h('ul', { className: 'mcap-discoverList' },
                state.models.map((model) => {
                  const declared = configuredIds.has(model.id)
                  const parts = []
                  if (formatCount(model.contextWindow).length > 0) parts.push('上下文 ' + formatCount(model.contextWindow))
                  if (formatCount(model.maxTokens).length > 0) parts.push('输出 ' + formatCount(model.maxTokens))
                  return h('li', { className: 'mcap-discoverRow', key: model.id },
                    h('span', { className: 'mcap-discoverId', title: model.id }, model.id),
                    model.name !== undefined && model.name.length > 0 && model.name !== model.id
                      ? h('span', { className: 'mcap-count' }, model.name) : null,
                    h('span', { className: 'mcap-discoverMeta' }, parts.join(' · ')),
                    declared
                      ? h('span', { className: 'mcap-count' }, '已声明')
                      : (group.narrowed === true
                        ? h('button', {
                          className: 'mcap-filter mcap-tiny',
                          type: 'button',
                          disabled: discoverBusy,
                          onClick: () => { void joinDiscovered(route, [model.id]) },
                        }, '加入')
                        : h('span', { className: 'mcap-count' }, '目录提供'))
                  )
                })
              ) : null
            )
          }

          const statusIsError = status !== null && (status.indexOf('失败') >= 0 || status.indexOf('校验') >= 0 || status.indexOf('修改') >= 0)

          return h('div', { className: 'mcap-root' },
            h('h2', { className: 'mcap-title' }, '模型能力'),
            h('p', { className: 'mcap-intro' }, '勾选框反映模型当前生效的能力（供应商目录 + 你的声明）。保存后立即生效，无需重启。'),
            snap.status === 'loading' ? h('p', { className: 'mcap-note' }, '正在读取设置…') : null,
            snap.status === 'unavailable' ? h('p', { className: 'mcap-statusError' }, '设置服务不可用（远程浏览器不提供设置写入）。') : null,
            snap.status === 'error' ? h('p', { className: 'mcap-statusError' }, '读取设置失败：' + String(snap.error)) : null,
            h('div', { className: 'mcap-toolbar' },
              h('input', {
                className: 'mcap-search',
                type: 'search',
                placeholder: '搜索模型 id 或名称…',
                value: query,
                onChange: (event) => setQuery(event.target.value),
              }),
              FILTERS.map((item) => h('button', {
                key: item.id,
                type: 'button',
                className: 'mcap-filter' + (filter === item.id ? ' mcap-filterActive' : ''),
                onClick: () => setFilter(item.id),
              }, item.label)),
              h('button', {
                className: 'mcap-filter',
                type: 'button',
                disabled: visibleModelRows.length === 0,
                onClick: () => setAllRows(!allExpanded),
              }, allExpanded ? '全部收起' : '全部展开')
            ),
            h('p', { className: 'mcap-note' }, '共 ' + String(totalModels) + ' 个模型' + (visibleModelCount === totalModels ? '' : '，当前显示 ' + String(visibleModelCount) + ' 个')),
            groups.length === 0 && snap.status === 'ready' ? h('p', { className: 'mcap-note' }, '没有匹配的模型。') : null,
            groups.map((group) => {
              const collapsed = collapsedGroups[group.title] === true
              const mods = group.ns === DS
                ? (dsWire === undefined ? FALLBACK_MODALITIES : modalityOptions(dsWire, DS))
                : (piWire === undefined ? FALLBACK_MODALITIES : modalityOptions(piWire, PI))
              return h('div', { className: 'mcap-group', key: group.title },
                h('div', { className: 'mcap-groupHead' },
                  h('button', {
                    className: 'mcap-groupToggle',
                    type: 'button',
                    onClick: () => onToggleGroup(group.title),
                  },
                    h('span', { className: 'mcap-chevron' + (collapsed ? '' : ' mcap-chevronOpen') }, '▶'),
                    h('span', { className: 'mcap-groupTitle' }, group.title),
                    h('span', { className: 'mcap-count' }, String(group.rows.length) + ' 个')
                  ),
                  group.route !== null ? h('button', {
                    className: 'mcap-filter mcap-tiny',
                    type: 'button',
                    disabled: discoverBusy,
                    onClick: () => toggleDiscovery(group.route),
                  }, discoverOpen[group.route] === true ? '收起发现' : '从供应商加载') : null,
                  group.routeDeclared === false && group.narrowed === true ? h('button', {
                    className: 'mcap-filter mcap-tiny',
                    type: 'button',
                    disabled: discoverBusy,
                    onClick: () => setConfirmReset(confirmReset === group.title ? null : group.title),
                  }, '重置为默认参数') : null
                ),
                group.routeDeclared === false && confirmReset === group.title ? h('div', { className: 'mcap-confirm' },
                  h('p', { className: 'mcap-confirmText' }, '将把 ' + group.title + ' 下 ' + String(group.rows.length) + ' 个模型的输入模态、容量与图像预算恢复为默认值。模型列表与名称不受影响。确定吗？'),
                  h('div', { className: 'mcap-actions' },
                    h('button', { className: 'mcap-save mcap-small', type: 'button', disabled: discoverBusy, onClick: () => { void resetGroupParameters(group) } }, '确定'),
                    h('button', { className: 'mcap-save mcap-ghost mcap-small', type: 'button', onClick: () => setConfirmReset(null) }, '取消')
                  )
                ) : null,
                renderDiscovery(group),
                collapsed ? null : h('ul', { className: 'mcap-list' },
                  group.rows.map((row) => h(ModelRow, {
                    key: row.id === null ? 'empty' : rowKey(row),
                    row: row,
                    value: valueOf(row),
                    open: row.id !== null && expanded[rowKey(row)] === true,
                    advancedOpen: advanced[rowKey(row)] === true,
                    advancedDirty: advancedDirty(row),
                    dirty: isDirty(row),
                    modalities: mods,
                    pending: pending,
                    onPatch: onPatch,
                    onToggleInput: onToggleInput,
                    onToggleOpen: onToggleOpen,
                    onToggleAdvanced: onToggleAdvanced,
                    onRestore: onRestore,
                    onCancelRestore: onCancelRestore,
                    onConfirmPending: onConfirmPending,
                    onCancelPending: onCancelPending,
                  }))
                )
              )
            }),
            h('div', { className: 'mcap-actions' },
              h('button', {
                className: 'mcap-save',
                type: 'button',
                disabled: busy || dirtyCount === 0,
                onClick: () => { void save() },
              }, busy ? '保存中…' : dirtyCount === 0 ? '保存' : '保存 ' + String(dirtyCount) + ' 项'),
              h('button', {
                className: 'mcap-save mcap-ghost',
                type: 'button',
                disabled: busy,
                onClick: () => { setDrafts({}); setPending(null); setStatus(null); void mirror.load() },
              }, '放弃修改'),
              status === null ? null : h('span', { className: statusIsError ? 'mcap-statusError' : 'mcap-status' }, status)
            )
          )
        }

        slots.inject('settings.section', () => slots.register({
          name: 'settings.section',
          id: 'model-capabilities',
          order: 11,
          label: () => '模型能力',
        }, ModelCapabilitiesPage))
      },
    }
  },
})
