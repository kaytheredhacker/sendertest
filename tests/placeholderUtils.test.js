// filepath: /workspaces/sendertest/tests/placeholderUtils.test.js
const { replacePlaceholders } = require('../utils/placeholderUtils');

const template = `
    Hello GIRLUSER,
    Your email is TECHGIRLEMAIL.
    Your domain is GIRLDOMAIN.
    Random string: TECHGIRLRND.
`;

const email = 'john.doe@example.com';

console.log(replacePlaceholders(template, email));