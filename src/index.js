const ConstDependency = require('webpack/lib/dependencies/ConstDependency');
const NullFactory = require('webpack/lib/NullFactory');
const ParserHelpers = require('webpack/lib/javascript/JavascriptParserHelpers');
const WebpackError = require('webpack/lib/WebpackError');
const gettextParser = require('gettext-parser');
const fs = require('fs');

class GettextWebpackPlugin {
    /**
     * Options:
     * - translation: string | (context: string | undefined, singular: string, plural: string | undefined) => string | null | undefined - 
     *   PO file with the translations or function thar returns the translation. Required.
     * - fallbackTranslation: string | (context: string | undefined, singular: string, plural: string | undefined) => string | null | undefined - 
     *   PO file with the traslations used as fallback when it is not in the translation or function thar returns the translation. Optional.
     * - includeFuzzy: boolean - Include the fuzzy translations. Default: false, that means, the translation marked as
     *   'Need works' will be ignored during the process.
     * - reportInvalidAs: 'error' | 'warning' | 'none' - Reports the invalid usage of the translations functions.
     *   Default: 'error'.
     * - pluralFactoryFunctionName: string - Name of the plural function factory name, this function will return the 
     *   plural function. The signature of this function will be: function(): (n: number) => number. Default: '_p'.
     * - pluralFunction: string - Overrides the plural function extracted from the po file returned by the 
     *   pluralFactoryFunction. If no plural function was found the default value is 
     *   'function(n) { return (n != 1) ? 1 : 0; }'.
     * - gettextFunctionName: string - Gettext function name. The signature of this function will be: 
     *   function(text: string): string. Optional.
     * - ngettextFunctionName: string - Ngettext function name. The signature of this function will be: 
     *   function(singular: string, plural: string): string[]. Optional.
     * - pgettextFunctionName: string - Pgettext function name. The signature of this function will be: 
     *   function(context: string, text: string): string. Optional.
     * - npgettextFunctionName: string - Npgettext function name. The signature of this function will be: 
     *   function(context: string, singular: string, plural: string): string[]. Optional.
     * - transformText: function(text: string): string - Funtion that allows to transform the transaled text; allowing
     *   by example implement a pseudolocalization by transforming the text. Optional.
     * - transformToJS: function(translation: string | string[]): string - Function that transforms the translation result in 
     *   JavaScript. By default JSON.stringify will be used. This function can change gettext results that can be 
     *   different to string or string[]. This function is usefull, by example, if you whant to compile the 
     *   translations into a function that handle the interpolations. Note: the result of this function must be
     *   the JavaScript to be included in the source file.
     * 
     * Note: if no (n/p/np/)gettextFunctionName are provided the default values are:
     * - gettextFunctionName: '__'
     * - ngettextFunctionName: '__'
     * - pgettextFunctionName: '_c'
     * - npgettextFunctionName: '_c'
     */
    constructor(options) {
        options = options || {};

        this.pluralFunctionName = options.pluralFactoryFunctionName;
        if (!this.pluralFunctionName) {
            this.pluralFunctionName = '_p';
        }

        const setPluralFunction = (fn) => {
            this.pluralFunction = fn;
        }

        let transformToJS = options.transformToJS;
        let transformText = options.transformText;
        if (!transformToJS) {
            if (transformText) {
                transformToJS = (translation) => {
                    if (Array.isArray(translation)) {
                        translation = translation.map((text) => {
                            return transformText(text);
                        });
                    } else {
                        translation = transformText(translation);
                    }
                    return JSON.stringify(translation);
                }
            } else {
                transformToJS = (translation) => {
                    return JSON.stringify(translation);
                }
            }
        } else if (transformText) {
            const initialTransformToJS = transformToJS;
            transformToJS = (translation) => {
                if (Array.isArray(translation)) {
                    translation = translation.map((text) => {
                        return transformText(text);
                    });
                } else {
                    translation = transformText(translation);
                }
                return initialTransformToJS(translation);
            }
        }

        if (options.fallbackTranslation) {
            const fistTranslate = buildTranslateFunction(options.translation, 'translation', options.includeFuzzy, setPluralFunction);
            const secondTranslate = buildTranslateFunction(options.fallbackTranslation, 'fallbackTranslation', options.includeFuzzy);
            this.translate = buidTranslationChain(transformToJS, fistTranslate, secondTranslate, noTranslation);
        } else {
            const fistTranslate = buildTranslateFunction(options.translation, 'translation', options.includeFuzzy, setPluralFunction);
            this.translate = buidTranslationChain(transformToJS, fistTranslate, noTranslation);
        }

        if (!this.pluralFunction) {
            this.pluralFunction = 'function(n) { return (n != 1) ? 1 : 0; }'
        }

        this.reportInvalidAs = options.reportInvalidAs;
        if (this.reportInvalidAs === undefined) {
            this.reportInvalidAs = 'error';
        }

        this.gettextFunctionName = options.gettextFunctionName;
        this.ngettextFunctionName = options.ngettextFunctionName;
        this.pgettextFunctionName = options.pgettextFunctionName;
        this.npgettextFunctionName = options.npgettextFunctionName;

        if (!this.gettextFunctionName && !this.ngettextFunctionName && !this.pgettextFunctionName && !this.npgettextFunctionName) {
            this.gettextFunctionNameOverloadedN = '__';
            this.pgettextFunctionNameOverloadedN = '_c'
        } else {
            if (this.gettextFunctionName && this.gettextFunctionName === this.ngettextFunctionName) {
                this.gettextFunctionNameOverloadedN = this.gettextFunctionName;
                this.gettextFunctionName = undefined;
                this.ngettextFunctionName = undefined;
            }

            if (this.pgettextFunctionName && this.pgettextFunctionName === this.npgettextFunctionName) {
                this.pgettextFunctionNameOverloadedN = this.pgettextFunctionName;
                this.pgettextFunctionName = undefined;
                this.npgettextFunctionName = undefined;
            }

            if (this.gettextFunctionName && this.gettextFunctionName === this.pgettextFunctionName) {
                this.gettextFunctionNameOverloadedP = this.gettextFunctionName;
                this.gettextFunctionName = undefined;
                this.pgettextFunctionName = undefined;
            }

            if (this.ngettextFunctionName && this.ngettextFunctionName === this.npgettextFunctionName) {
                this.ngettextFunctionNameOverloadedP = this.ngettextFunctionName;
                this.ngettextFunctionName = undefined;
                this.npgettextFunctionName = undefined;
            }

            if (this.gettextFunctionName && this.gettextFunctionName === this.npgettextFunctionName) {
                throw new Error('Invalid configuration, the name of the gettext function cannot be the same as npgettext')
            }

            if (this.ngettextFunctionName && this.ngettextFunctionName === this.pgettextFunctionName) {
                throw new Error('Invalid configuration, the name of the ngettext function cannot be the same as pgettext')
            }
        }

    }

    apply(compiler) {
        const plugin = { name: 'I18nGettextPlugin' };

        compiler.hooks.compilation.tap(plugin, (compilation, data) => {
            compilation.dependencyFactories.set(ConstDependency, new NullFactory());
            compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());

            const parserHook = data.normalModuleFactory.hooks.parser;
            const parserHandler = (parser) => {
                if (this.gettextFunctionName) {
                    parser.hooks.call.for(this.gettextFunctionName).tap(plugin, gettext(parser, this.translate, this.gettextFunctionName, this.reportInvalidAs));
                }
                if (this.ngettextFunctionName) {
                    parser.hooks.call.for(this.ngettextFunctionName).tap(plugin, ngettext(parser, this.translate, this.ngettextFunctionName, this.reportInvalidAs));
                }
                if (this.pgettextFunctionName) {
                    parser.hooks.call.for(this.pgettextFunctionName).tap(plugin, pgettext(parser, this.translate, this.pgettextFunctionName, this.reportInvalidAs));
                }
                if (this.npgettextFunctionName) {
                    parser.hooks.call.for(this.npgettextFunctionName).tap(plugin, npgettext(parser, this.translate, this.npgettextFunctionName, this.reportInvalidAs));
                }
                if (this.gettextFunctionNameOverloadedN) {
                    parser.hooks.call.for(this.gettextFunctionNameOverloadedN).tap(plugin, gettextOverloadedN(parser, this.translate, this.gettextFunctionNameOverloadedN, this.reportInvalidAs));
                }
                if (this.pgettextFunctionNameOverloadedN) {
                    parser.hooks.call.for(this.pgettextFunctionNameOverloadedN).tap(plugin, pgettextOverloadedN(parser, this.translate, this.pgettextFunctionNameOverloadedN, this.reportInvalidAs));
                }
                if (this.gettextFunctionNameOverloadedP) {
                    parser.hooks.call.for(this.gettextFunctionNameOverloadedP).tap(plugin, gettextOverloadedP(parser, this.translate, this.gettextFunctionNameOverloadedP, this.reportInvalidAs));
                }
                if (this.ngettextFunctionNameOverloadedP) {
                    parser.hooks.call.for(this.ngettextFunctionNameOverloadedP).tap(plugin, ngettextOverloadedP(parser, this.translate, this.ngettextFunctionNameOverloadedP, this.reportInvalidAs));
                }
                if (this.pluralFunctionName) {
                    parser.hooks.call.for(this.pluralFunctionName).tap(plugin, pluralFactory(parser, this.pluralFunction, this.pluralFunctionName, this.reportInvalidAs));
                }
            };

            parserHook.for('javascript/auto').tap(plugin, parserHandler);
            parserHook.for('javascript/dynamic').tap(plugin, parserHandler);
            parserHook.for('javascript/esm').tap(plugin, parserHandler);
        });
    }
}

class I18NGettextError extends WebpackError {
    constructor(module, message, loc) {
        super(message);
        this.name = 'I18NGettextError';
        this.module = module;
        this.loc = loc;
    }
}

function reportError(parser, reportInvalidAs, message, loc) {
    if (reportInvalidAs === 'error') {
        parser.state.module.addError(new I18NGettextError(parser.state.module, message, loc));
    } else if (reportInvalidAs === 'warning') {
        parser.state.module.addError(new I18NGettextError(parser.state.module, message, loc));
    }
}

function pluralFactory(parser, pluralFunction, name, reportInvalidAs) {
    return (expr) => {
        if (expr.arguments.length != 0) {
            reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 0 arguments', expr.loc);
            return false;
        }
        return ParserHelpers.toConstantDependency(parser, '(' + pluralFunction + ')')(expr);
    };
}

function gettext(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let singular;
        switch (expr.arguments.length) {
            case 1:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 non-empty string literal as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 non-empty string literal as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 non-empty string literal as argument', expr.loc);
                return false;
        }

        const result = translate(undefined, singular, undefined);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function ngettext(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let singular;
        let plural;
        switch (expr.arguments.length) {
            case 2:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[1]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(undefined, singular, plural);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function pgettext(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let context;
        let singular;
        switch (expr.arguments.length) {
            case 2:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(context, singular, undefined);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function npgettext(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let context;
        let singular;
        let plural;
        switch (expr.arguments.length) {
            case 3:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[2]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 3 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(context, singular, plural);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function gettextOverloadedN(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let singular;
        let plural;
        switch (expr.arguments.length) {
            case 2:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[1]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            case 1:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(undefined, singular, plural);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function pgettextOverloadedN(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let context;
        let singular;
        let plural;
        switch (expr.arguments.length) {
            case 3:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[2]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            case 2:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(context, singular, plural);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function gettextOverloadedP(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let context;
        let singular;
        switch (expr.arguments.length) {
            case 2:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            case 1:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 1 or 2 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(context, singular, undefined);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function ngettextOverloadedP(parser, translate, name, reportInvalidAs) {
    return (expr) => {
        let context;
        let singular;
        let plural;
        switch (expr.arguments.length) {
            case 3:
                context = parser.evaluateExpression(expr.arguments[0]);
                if (!context.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                context = context.string;
                if (!context) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = parser.evaluateExpression(expr.arguments[1]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[2]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            case 2:
                singular = parser.evaluateExpression(expr.arguments[0]);
                if (!singular.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                singular = singular.string;
                if (!singular) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = parser.evaluateExpression(expr.arguments[1]);
                if (!plural.isString()) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                plural = plural.string;
                if (!plural) {
                    reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                    return false;
                }
                break;
            default:
                reportError(parser, reportInvalidAs, 'The "' + name + '" function must receive 2 or 3 non-empty string literals as argument', expr.loc);
                return false;
        }

        const result = translate(context, singular, plural);
        return ParserHelpers.toConstantDependency(parser, result)(expr);
    };
}

function buidTranslationChain(transformToJS, f1, f2, f3) {
    if (f3) {
        return (context, singular, plural) => {
            let result = f1(context, singular, plural);
            if (result) {
                return transformToJS(result);
            }

            result = f2(context, singular, plural);
            if (result) {
                return transformToJS(result);
            }

            result = f3(context, singular, plural);
            return transformToJS(result);
        };
    } else {
        return (context, singular, plural) => {
            let result = f1(context, singular, plural);
            if (result) {
                return transformToJS(result);
            }

            result = f2(context, singular, plural);
            return transformToJS(result);
        };
    }
}

function noTranslation(_context, singular, plural) {
    if (!plural) {
        return singular;
    } else {
        return [singular, plural];
    }
}

function buildTranslateFunction(translation, name, includeFuzzy, setPluralFunction) {
    if (!translation) {
        return (_context, _singular, _plural) => undefined;
    } else if (typeof translation === 'function') {
        return translation
    } else if (typeof translation === 'string') {
        const input = fs.readFileSync(translation);
        const po = gettextParser.po.parse(input);
        if (setPluralFunction && po.headers && po.headers['plural-forms']) {
            const pluralForms = po.headers['plural-forms'];
            const pluralFunction = 'function(n) {var plural, nplurals; ' + pluralForms + ' return (plural === true ? 1 : (plural ? plural : 0)); }';
            setPluralFunction(pluralFunction);
        }
        const poTranslations = po.translations;
        return (context, singular, _plural) => {
            if (!context) {
                context = '';
            }
            const contextTranslations = poTranslations[context];
            if (!contextTranslations) {
                return undefined;
            }
            const keyTranslations = contextTranslations[singular];
            if (!keyTranslations) {
                return undefined;
            }
            const fuzzy = keyTranslations.comments && keyTranslations.comments.flag && keyTranslations.comments.flag.match(/fuzzy/) !== null;
            if (fuzzy && !includeFuzzy) {
                return undefined;
            }
            const translations = keyTranslations.msgstr;
            if (!translations) {
                return undefined;
            }
            for (let i = 0, length = translations.length; i < length; i++) {
                if (!translations[i]) {
                    return undefined;
                }
            }
            if (translations.length === 1) {
                return translations[0];
            } else {
                return translations;
            }
        }
    } else {
        throw new Error('Invalid option "' + name + '". Unable to handle the value as a source of translations');
    }
}

module.exports = GettextWebpackPlugin;