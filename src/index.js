const { chain, get, template, forEach, some, mapKeys, reduce, merge, has, startsWith, pickBy, omit, keys } = require('lodash')
const { readFileSync, existsSync, writeFileSync } = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

function referencesImport(path, mod, importedNames) {
  if (!(path.isIdentifier() || path.isJSXIdentifier())) {
    return false;
  }
  return importedNames.some((name) => path.referencesImport(mod, name));
}

function getOptions (state) {
  return getOptions.opts = (getOptions.opts || {
    moduleSourceName: get(state, 'opts.moduleSourceName', 'i18next' ),
    format: {
      funcList: get(state, 'opts.format.funcList', ['t']),
      componentList: get(state, 'opts.format.componentList', ['MD']),
    },
    dirtyPrefix: get(state, 'opts.dirtyPrefix', '~'),
    sort: get(state, 'opts.sort', true),
    lngs: get(state, 'opts.lngs', ['zh-CN', 'en-US']),
    ns: get(state, 'opts.ns', 'translation'),
    defaultVal: get(state, 'opts.defaultVal', ''),
    keySeparator: get(state, 'opts.keySeparator', '.'),
    interpolate:  get(state, 'opts.interpolate', /{{([\s\S]+?)}}/g),
    dest: get(state, 'opts.dest', './i18n/{{lng}}/{{ns}}.json')
  })
}

export default function({types: t }) {
  return {
    inherits: require("babel-plugin-syntax-jsx"),
    pre (state) {
      this.translations = {}
    },
    visitor: {
      JSXOpeningElement (path, state) {
        const opts = getOptions(state)
        if (referencesImport(path.get('name'), opts.moduleSourceName, opts.format.componentList)) {
          const attributes = path.get('attributes')
            .filter((attr) => attr.isJSXAttribute())
          const prop = attributes.find(attr => attr.get('name').node.name === 'key')
          this.translations[prop.get('value').node.value] = opts.defaultVal
        }
      },
      CallExpression (path, state) {
        const opts = getOptions(state)
        if (referencesImport(path.get('callee'), opts.moduleSourceName, opts.format.funcList)){
          const args = path.get('arguments')
          if (!t.isStringLiteral(args[0])) return
          console.log('pick key', args[0].node.value)
          this.translations[args[0].node.value] = opts.defaultVal
        }
      }
    },
    post (state) {
      const opts = getOptions(state)
      const cwd = process.cwd()
      const destPathList = opts.lngs.map(lng => {
        return path.join(cwd, path.relative(cwd, template(opts.dest, { interpolate: opts.interpolate })({ lng, ns: opts.ns })))
      })
      destPathList.forEach(dest => {
        const exist = existsSync(dest)
        let existedTranslations = {}
        if (exist) {
          existedTranslations = JSON.parse(readFileSync(dest))
        }
        let newTranslations = merge({}, )
        newTranslations = mapKeys(existedTranslations, (v, k) => {
          const nk = k.replace(new RegExp('^' + opts.dirtyPrefix), '')
          if(!has(this.translations, nk)) {
            return opts.dirtyPrefix + nk
          } else {
            return nk
          }
        })
        forEach(this.translations, (v, k) => {
          if (newTranslations[k] == undefined) {
            newTranslations[k] = v
          }
        })
        if (opts.sort === true) {
          newTranslations = chain(newTranslations).toPairs().sortBy(0).fromPairs().value()
        }
        const dirtyTranslations = pickBy(newTranslations, (v, k) => startsWith(k, opts.dirtyPrefix))
        newTranslations = merge({}, dirtyTranslations, omit(newTranslations, keys(dirtyTranslations)))
        mkdirp.sync(path.dirname(dest))
        writeFileSync(dest, JSON.stringify(newTranslations, null, 2))
      })
    }
  }
}

