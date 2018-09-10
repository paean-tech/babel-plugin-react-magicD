const { chain, get, set, template, forEach, some, mapKeys, reduce, merge, has, startsWith, pickBy, omit, keys, pick } = require('lodash')
const { readFileSync, existsSync, writeFileSync } = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const diff = require('diff')
const chalk = require('chalk')

function referencesImport(path, mod, importedNames) {
  if (!(path.isIdentifier() || path.isJSXIdentifier())) {
    return false;
  }
  return importedNames.some((name) => path.referencesImport(mod, name));
}

function getOptions (state) {
  return getOptions.opts = (getOptions.opts || {
    moduleSourceName: get(state, 'opts.moduleSourceName', 'i18next'),
    format: {
      funcList: get(state, 'opts.format.funcList', ['t']),
    },
    removeUnusedKey: get(state, 'opts.removeUnusedKey', false),
    dirtyPrefix: get(state, 'opts.dirtyPrefix', '~'),
    sort: get(state, 'opts.sort', true),
    lngs: get(state, 'opts.lngs', ['zh-CN', 'en-US']),
    ns: get(state, 'opts.ns', 'translation'),
    defaultVal: get(state, 'opts.defaultVal', ''),
    keySeparator: get(state, 'opts.keySeparator', '.'),
    interpolate:  get(state, 'opts.interpolate', /{{([\s\S]+?)}}/g),
    dest: get(state, 'opts.dest', './i18n/{{lng}}/{{ns}}.json'),
  })
}

function existTranslationsFile (path) {
  const exist = existsSync(path)
  let translations = {}
  if (exist) {
    try {
      translations = JSON.parse(readFileSync(path))
    } catch (e) {}
  }
  return translations
}

function save(existedTranslations, dest, translations, opts) {
  let newTranslations = mapKeys(existedTranslations, (v, k) => {
    if (opts.removeUnusedKey === false) {
      const nk = k.replace(new RegExp('^' + opts.dirtyPrefix), '')
      if (!has(translations, nk)) {
        return opts.dirtyPrefix + nk
      }
      return nk
    }
    return k
  })
  forEach(translations, (v, k) => {
    if (newTranslations[k] == undefined) {
      newTranslations[k] = v
    }
  })
  if (opts.removeUnusedKey === true) newTranslations = pick(newTranslations, keys(translations))
  if (opts.sort === true) {
    newTranslations = chain(newTranslations).toPairs().sortBy(0).fromPairs().value()
  }
  const dirtyTranslations = pickBy(newTranslations, (v, k) => startsWith(k, opts.dirtyPrefix))
  newTranslations = merge({}, dirtyTranslations, omit(newTranslations, keys(dirtyTranslations)))
  mkdirp.sync(path.dirname(dest))
  writeFileSync(dest, JSON.stringify(newTranslations, null, 2))
  return newTranslations
}

export default function({types: t }) {
  return {
    pre (state) {
      this.locales = this.locales || {}
    },
    visitor: {
      CallExpression (path, state) {
        const opts = getOptions(state)
        if (referencesImport(path.get('callee'), opts.moduleSourceName, opts.format.funcList)){
          const args = path.get('arguments')
          if (!t.isStringLiteral(args[0])) return
          opts.lngs.forEach(lng => set(this.locales, `['${lng}']['${args[0].node.value}']`, opts.defaultVal))
        }
      }
    },
    post (state) {
      const opts = getOptions()
      const cwd = process.cwd()
      opts.lngs.map(lng => {
        return [lng, path.join(cwd, path.relative(cwd, template(opts.dest, { interpolate: opts.interpolate })({ lng, ns: opts.ns })))]
      }).forEach(([lng, path]) => {
        const oldTrans = existTranslationsFile(path)
        console.log(lng, path, this.locales[lng])
        const newTranslations = save(oldTrans, path, this.locales[lng], opts)
        const diffLines = diff.diffJson(oldTrans, newTranslations)
        diffLines.forEach(line => {
          if (line.value != null && line.added != null || line.removed != null) {
            const color = line.added === true ? 'green' : 'red'
            const diffSymbol = line.added === true ? '+' : '-'
            console.log(chalk.keyword(color)(path + '\n' + diffSymbol + line.value))
            path = ''
         }
        })
        this.locales[lng] = newTranslations
      })
    }
  }
}

