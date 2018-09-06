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

export default function({types: t }) {
  return {
    inherits: require("babel-plugin-syntax-jsx"),
    pre (state) {
      this.opts = {
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
      }
      this.translations = {}
    },
    visitor: {
      JSXOpeningElement (path, state) {
        if (referencesImport(path.get('name'), this.opts.moduleSourceName, this.opts.format.componentList)) {
          const attributes = path.get('attributes')
            .filter((attr) => attr.isJSXAttribute())
          const prop = attributes.find(attr => attr.get('name').node.name === 'key')
          this.translations[prop.get('value').node.value] = this.opts.defaultVal
        }
      },
      CallExpression (path, state) {
        if (referencesImport(path.get('callee'), this.opts.moduleSourceName, this.opts.format.funcList)){
          const args = path.get('arguments')
          if (!t.isStringLiteral(args[0])) return
          this.translations[args[0].node.value] = this.opts.defaultVal
        }
      }
    },
    post (state) {
      const cwd = process.cwd()
      const destPathList = this.opts.lngs.map(lng => {
        return path.join(cwd, path.relative(cwd, template(this.opts.dest, { interpolate: this.opts.interpolate })({ lng, ns: this.opts.ns })))
      })
      destPathList.forEach(dest => {
        const exist = existsSync(dest)
        let existedTranslations = {}
        if (exist) {
          existedTranslations = JSON.parse(readFileSync(dest))
        }
        let newTranslations = merge({}, )
        newTranslations = mapKeys(existedTranslations, (v, k) => {
          const nk = k.replace(new RegExp(this.opts.dirtyPrefix, 'gm'), '')
          if(!has(this.translations, nk)) {
            return this.opts.dirtyPrefix + nk
          } else {
            return nkk
          }
        })
        forEach(this.translations, (v, k) => {
          if (newTranslations[k] == undefined) {
            newTranslations[k] = v
          }
        })
        if (this.opts.sort === true) {
          newTranslations = chain(newTranslations).toPairs().sortBy(0).fromPairs().value()
        }
        const dirtyTranslations = pickBy(newTranslations, (v, k) => startsWith(k, this.opts.dirtyPrefix))
        newTranslations = merge({}, dirtyTranslations, omit(newTranslations, keys(dirtyTranslations)))
        mkdirp.sync(path.dirname(dest))
        writeFileSync(dest, JSON.stringify(newTranslations, null, 2))
      })
    }
  }
}

