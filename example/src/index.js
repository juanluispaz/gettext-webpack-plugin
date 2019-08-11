import i18n from './shared/i18n';

const app = document.getElementById('app')

const question = document.createElement('span');
const input = document.createElement('input');
const answer = document.createElement('div');

question.innerText = __('Introduce your age:')

input.addEventListener('input', (event) => {
    const age = +event.target.value;
    if (isNaN(age)) {
        answer.innerText = __('Invalid age.');
    } else {
        answer.innerText = i18n(__('You are {age, number} year old.', 'You are {age, number} years old.'), {age});
    }
})

app.appendChild(question);
app.appendChild(input);
app.appendChild(answer);

document.body.classList.remove('loading'); // Hide loading