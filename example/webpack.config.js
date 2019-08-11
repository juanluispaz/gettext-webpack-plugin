const GettextWebpackPlugin = require('gettext-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');
const process = require('process');
const path = require('path');
const webpack = require('webpack');

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

module.exports = poFiles.map(function (poFile) {
    const language = path.parse(poFile).name.replace('_', '-');
    return {
        name: language,
        mode: 'production',
        entry: './src/index.js',
        module: {
            rules: [
                { test: /\.(png|svg|jpg|jpeg|gif)$/, use: { loader: 'url-loader', options: { limit: 10000 } } },
                { test: /\.(woff|woff2|eot|ttf|otf)$/, use: 'file-loader' }
            ]
        },
        plugins: [
            new GettextWebpackPlugin({ translation: poFile }),
            new HtmlWebpackPlugin({
                filename: language + '.index.html',
                template: '!!html-loader?minimize&interpolate&conservativeCollapse=false!src/index.html'
            }),
            new webpack.DefinePlugin({
                'LANGUAGE': JSON.stringify(language)
            })
        ],
        output: {
            filename: language + '.[name].[contenthash].js'
        }
    };
});