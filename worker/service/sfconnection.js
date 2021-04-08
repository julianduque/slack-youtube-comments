const jsforce = require('jsforce');
const { getToken } = require('sf-jwt-token');

// establish connection to the salesforce environment
async function sfconnection() {
    const conn = new jsforce.Connection();
    try{
        const jwttokenresponse = await getToken({
            iss: process.env.CLIENT_ID,
            sub: process.env.USERNAME,
            aud: process.env.LOGIN_URL,
            privateKey: process.env.PRIVATE_KEY
        });
        conn.initialize({
            instanceUrl: jwttokenresponse.instance_url,
            accessToken: jwttokenresponse.access_token
        });
    } catch(exception) {
        console.log(exception);
    }
    return conn;
}

module.exports.sfconnection = sfconnection;