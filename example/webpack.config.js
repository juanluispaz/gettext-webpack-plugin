const GettextWebpackPlugin = require('gettext-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');
const process = require('process');
const path = require('path');
const webpack = require('webpack');
const pseudolocale = require('pseudolocale');

pseudolocale.option.startDelimiter = '{';
pseudolocale.option.endDelimiter = '}';
pseudolocale.option.prepend = ''
pseudolocale.option.append = ''
const pseudolocalize = pseudolocale.str

if (!fs.existsSync('i18n')) {
    console.error('No .po files found in the folder i18n');
    process.exit(-1);
}

const poFiles = [];
const filesInTranslationFolder = fs.readdirSync('i18n');
for (var i = 0, length = filesInTranslationFolder.length; i < length; i++) {
    const fileName = filesInTranslationFolder[i];
    if (fileName.endsWith('.po')) {
        poFiles.push(path.resolve('i18n', fileName));
    }
}

if (poFiles.length <= 0) {
    console.error('No .po files found in the folder i18n');
    process.exit(-1);
}

module.exports = poFiles.map(function(poFile) {
    const localeName = path.parse(poFile).name.replace('_', '-');
    let language = localeName;
    let isPseudo = language.startsWith('pseudo-');
    if (isPseudo) {
        language = language.substring('pseudo-'.length)
    }
    return {
        name: localeName,
        mode: 'production',
        entry: './src/index.js',
        module: {
            rules: [
                { test: /\.(png|svg|jpg|jpeg|gif)$/, type: 'asset' },
                { test: /\.(woff|woff2|eot|ttf|otf)$/, type: 'asset/resource' }
            ]
        },
        plugins: [
            new GettextWebpackPlugin({
                translation: poFile,
                transformText: isPseudo ? pseudolocalize : undefined
            }),
            new HtmlWebpackPlugin({
                filename: localeName + '.index.html',
                template: 'src/index.html',
                minify: {
                    collapseWhitespace: true,
                    keepClosingSlash: true,
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    useShortDoctype: true,
                    minifyCSS: true
                }
            }),
            new webpack.DefinePlugin({
                'LANGUAGE': JSON.stringify(language)
            })
        ],
        output: {
            filename: localeName + '.[name].[contenthash].js'
        }
    };
});