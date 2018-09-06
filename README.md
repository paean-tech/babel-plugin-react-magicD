# babel-plugin-magic-d

a magic konjac

## Example

**In**

```js
// input code
```

**Out**

```js
"use strict";

// output code
```

## Installation

```sh
$ npm install babel-plugin-magic-d
```

## Usage

### Via `.babelrc` (Recommended)

**.babelrc**

```json
{
  "plugins": ["magic-d"]
}
```

### Via CLI

```sh
$ babel --plugins magic-d script.js
```

### Via Node API

```javascript
require("babel-core").transform("code", {
  plugins: ["magic-d"]
});
```
