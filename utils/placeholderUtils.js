const randomstring = require('randomstring');

const replacePlaceholders = (template, email) => {
    try {
        const [emailUsername, domain] = email.split('@');
        const domainName = domain?.split('.')[0] || 'Unknown';
        const toBase64 = (str) => Buffer.from(str).toString('base64');
        const randomDate = new Date(Date.now() - Math.random() * 10000000000).toISOString();

        return template
            .replace(/GIRLUSER/g, emailUsername)
            .replace(/GIRLDOMC/g, domainName.charAt(0).toUpperCase() + domainName.slice(1))
            .replace(/GIRLdomain/g, domainName)
            .replace(/GIRLDOMAIN/g, domain)
            .replace(/TECHGIRLEMAIL/g, email)
            .replace(/TECHGIRLEMAIL64/g, toBase64(email))
            .replace(/TECHGIRLRND/g, randomstring.generate({ length: 5, charset: 'alphabetic' }))
            .replace(/TECHGIRLRNDLONG/g, randomstring.generate({ length: 50, charset: 'alphabetic' }))
            .replace(/TECHGIRLDATE/g, randomDate)
            .replace(/TECHGIRLIP/g, `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`)
            .replace(/TECHGIRLUA/g, ['Mozilla/5.0', 'Chrome/91.0.4472.124', 'Safari/605.1.15', 'Edge/91.0.864.59'][Math.floor(Math.random() * 4)]);
    } catch (err) {
        console.error(`Error personalizing the template for ${email}:`, err);
        return template; // Return the original template if an error occurs
    }
};

module.exports = { replacePlaceholders };