
# gettext-webpack-plugin

[![npm](https://img.shields.io/npm/v/gettext-webpack-plugin.svg)](http://npm.im/gettext-webpack-plugin)

This webpack plugin allows you to embed the translations in your webpack's bundle using gettext.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save gettext-webpack-plugin
```

For webpack 4 use the version 1.0.0 of this package.
For webpack 5 use the version 2.0.0 of this package.

## Differences with gettext

In some gettext implementations you can get the translation and format the text in one function. Example:

```js
const translation = ngettext('You are {age, number} year old.', 'You are {age, number} years old.', {age: 20});
```

With `gettext-webpack-plugin` you need to get the translation first and then format it:

```js
const translation = i18n(__('You are {age, number} year old.', 'You are {age, number} years old.'), {age: 20});
```

As well, notice when you handle the plural (ngettext function, in this example called `__` with two arguments), you don't specify the third argument with the plural count, it must be done by the format function.

## Example

In the example folder of the git repository you will find a webpack project that uses `gettext-webpack-plugin` to build a webapp, the result is a build output per language

### Commands:

- Use `npm run i18n:extract` to extract the texts from the source code. When you execute this command the file `i18n/messages.pot` will be updated with te text found in the source code.
- Use `npm run build` to build the project. When you execute this command you will find in the `dist/` folder one html file per .po file is defined in the `i18n/` folder.

**Note**: The folder `i18n/` contains the file `en.po` without translation to indicate that the English language must be included in the output; it have no translations, in consequence, the text defined in the source code will be used.

### Translations functions:

The default configuration is used, that define the following gettext functions:

- **`__(text)`**: translate the text received as argument. It corresponds to the `gettext` function.
- **`__(singularText, pluralText)`**: translate the texts received as argument. It corresponds to the `ngettext` function without the count (third by position) argument.
- **`_c(context, text)`**: translate the text received as second argument in the context received as first argument. It corresponds to the `pgettext` function.
- **`_c(context, singularText, pluralText)`**: translate the text received as second and third argument in the context received as first argument. It corresponds to the `pngettext` function without the count (fourth by position) argument.
- **`_p()`**: this function will return a function; this returned function returns the index of the plural form that must be used when the value is the one received as argument.

**Note**: The translation functions return a string with the translated text; except in the case of plurals, in this case the translations functions return an array of string.

### Format function

In the example is defined the `i18n` that format the translated text using [intl-messageformat](https://www.npmjs.com/package/intl-messageformat) provided by [format.js](https://formatjs.io/).

The format function receives as first argument a string (when there is no plural form) or an array of string (when there is plural form), and as second argument the parameters required by the translation. In the case of plural, the function returned by `_p()` will be used to choose the plural form.

## Basic usage

Add the `GettextWebpackPlugin` to the plugin section in your webpack config and you must specify the path to the .po file with the translations. This configuration translate the bundle to the language contained by the .po file.

```js
{
    // ...
    plugins: [
            new GettextWebpackPlugin({ translation: pathOfThePoFile }),
            // ...
    ],
    // ...
}
```

Usually you want to build your bundle in every language handled by your application; that way to do it is create one bundle per language. You can achieve it returning one configuration per language.

```js
const path = require('path');
const GettextWebpackPlugin = require('gettext-webpack-plugin');
const languages = ['en', 'es'];

module.exports = languages.map(language => {
    return {
        name: language,
        entry: './src/index.js',
        output: {
            filename: language + '.[name].js'
        },
        plugins: [
            new GettextWebpackPlugin({ translation: path.join(__dirname, 'i18n', language + '.po') })
        ]
    };
});
```

## Configuration

There are several configurations that you can specify to `gettext-webpack-plugin` in order to control how it works.

### Translation source

- **`translation`**: (string or function, **required**) In this property you can specify the path to the .po file with the translations or you can specify a function like `(context: string | undefined, singular: string, plural: string | undefined) => string | null | undefined` that will return the translation.
- **`fallbackTranslation`** (string or function, optional, default `undefined`): In this property you can specify the path to the .po file with the fallback translations that will be used when it is not found in the translation or you can specify a function like `(context: string | undefined, singular: string, plural: string | undefined) => string | null | undefined` that will return the translation.
- **`pluralFunction`**: (string, optional, you will want to specify when the translation option doesn't contains a path to a .po file) - Overrides the plural function extracted from the .po file returned by the `pluralFactoryFunction`. If no plural function was found the default value is `'function(n) { return (n != 1) ? 1 : 0; }'`.

**Note**: If the translation was found neither in the translation configuration nor in the fallback translation, the original text that appear in the source code will be used.

### Translation function's name

- **`gettextFunctionName`**: (string, optional, default `'__'`) Gettext function name. The signature of this function must be: `(text: string) => string`.
- **`ngettextFunctionName`**: (string, optional, default `'__'`) Ngettext function name. The signature of this function must be: `(singular: string, plural: string) => string[]`.
- **`pgettextFunctionName`**: (string, optional, default `'_c'`) Pgettext function name. The signature of this function must be: `(context: string, text: string) => string`.
- **`npgettextFunctionName`**: (string, optional, default `'_c'`) Npgettext function name. The signature of this function must be: `(context: string, singular: string, plural: string) => string[]`.
- **`pluralFactoryFunctionName`**: (string, optional, default `'_p'`) Name of the plural function factory name, this function will return the plural function. The signature of this function is: `() => (n: number => number)`.

**Note**: You can overload a function according to the number of parameters.

### Other configurations

- **`includeFuzzy`**: (boolean, optional, default `false`) Include the fuzzy translations. Default: false, that means, the translation marked as 'Need works' will be ignored during the process.
- **`reportInvalidAs`**: ( must be `'error'`, `'warning'` or `'none'`, optional, default `'error'`) Reports the invalid usage of the translations functions.
- **`transformToJS`**: (function, optional, default `JSON.stringify`) Function with the signature `(tranlation: string | string[]) => string` that transforms the translation result in JavaScript. By default `JSON.stringify` will be used. This function can change gettext results that can be different to string or string[]. This function is usefull, by example, if you want to compile the translations into a function that handle the interpolations. **Note**: the result of this function must be the JavaScript to be included in the source file as replacement of the gettext, ngettext, pgettext or npgettext function invocation.

## License

MIT

<!--
Edited with: https://stackedit.io/app
-->