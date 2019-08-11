const { GettextExtractor, JsExtractors } = require('gettext-extractor');
const fs = require('fs');

if (!fs.existsSync('i18n')) {
    fs.mkdirSync('i18n');
}

let extractor = new GettextExtractor();

extractor
    .createJsParser([
        JsExtractors.callExpression('__', {
            arguments: {
                text: 0,
                textPlural: 1,
            }
        }),
        JsExtractors.callExpression('__', {
            arguments: {
                text: 0
            }
        }),
        JsExtractors.callExpression('_c', {
            arguments: {
                text: 1,
                textPlural: 2,
                context: 0
            }
        }),
        JsExtractors.callExpression('_c', {
            arguments: {
                text: 1,
                context: 0
            }
        })
    ])
    .parseFilesGlob('./src/**/*.@(ts|js|tsx|jsx)')
    .parseFilesGlob('./src/**/*.@(html)', undefined, {
        transformSource: (source) => {
            return '`' + source + '`';
        }
    });

extractor.savePotFile('./i18n/messages.pot');

extractor.printStats();
