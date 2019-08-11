const getPluralForm = _p();

export default function i18n(translation, params, pluralKey) {
    let text;
    if (Array.isArray(translation)) {
        if (!pluralKey) {
            const pluralKeys = Object.getOwnPropertyNames(params).filter(key => typeof params[key] === 'number');
            if (pluralKeys.length === 1) {
                pluralKey = pluralKeys[0];
            }
            if (!pluralKey) {
                throw new Error('Unable to find automatically the plural key in the params object, yu must specify manually the plural count property name as third argument to the i18n function');
            }
        }
        text = translation[getPluralForm(params[pluralKey])];
        if (!text) {
            text = translation[1];
        }
        if (!text) {
            text = translation[0];
        }
    } else {
        text = translation;
    }
    if (params) {
        return format(text, params);
    } else {
        return text;
    }

}

//Alternative format function that not uses intl-messageformat
/*
function format(text, params) {
    return text.replace(/{([^{}]*)}/g, (_str, key) => {
            return params[key]
        }
    );
}
*/

import IntlMessageFormat from 'intl-messageformat';
const cache = {};

// Some intl-messageformat customization
IntlMessageFormat.formats.date.short.year = 'numeric';
const formats = {
    number: {
        EUR: {
            style: 'currency',
            currency: 'EUR'
        },
        USD: {
            style: 'currency',
            currency: 'USD'
        }
    }
}

function format(text, params) {
    let cachedMessageFormat = cache[text]
    let messageFormat
    if (!cachedMessageFormat) {
        cache[text] = messageFormat = new IntlMessageFormat(text, LANGUAGE, formats)
    } else {
        messageFormat = cachedMessageFormat
    }
    return messageFormat.format(params);
}
