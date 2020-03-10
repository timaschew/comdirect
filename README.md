# comdirect

Un-official node.js module for the [comdirect REST API](https://www.comdirect.de/cms/kontakt-zugaenge-api.html)

## NOTE:

This module works only with the **photoTAN** method!

Use it at your own risk!  
If you enter a wrong TAN 3 times your account will be blocked (to unlock you need to do a phone call).

You can reset the error counter by enter a valid TAN via the 
[official website](https://kunde.comdirect.de/lp/wt/login) by retreiving your [inbox (PostBox)](https://kunde.comdirect.de/itx/posteingangsuche).

Enable the and handle your [REST API credentials](https://kunde.comdirect.de/itx/oauth/privatkunden).

## Motivation

The REST API requires 5 HTTP requests (authentication) before you can fetch your bank account information.  
To fetch account transactions you need 7 HTTP requests in total.

The authentication works with an access token which is valid for 10 minutes and a refresh token which is valid for 20 minutes.
For each new HTTP request both tokens are changing its value and extending the expiration.
If the refresh token is expired you need to authenticate again which means to need to enter a new TAN again.

This module helps you to make it easys as possible by:

- automate much as possible of the authentication flow
  - if there is no valid refresh token you need to open a browser and do the TAN challenge (scan picture and and enter a TAN)
  - if access token is expired but refresh token is valid a new access token is created
- load the account id automatically in order to allow you to fetch account transactions
- auto refresh (update the refresh token automatically every 19 minutes, before it will expire)
- automatically save new access token, refresh token, request id and session id and automatically inject them
- mask sensitive output in the optional logs (client secret, pin/password, acces token, refresh token)
- reformat `remittanceInfo` in the transactions (remove `01`, `02`, etc. and split into an array of chunks)
- persist data (refresh token, account id, etc.) optionally to run your script again without doing the TAN challenge after it has terminated

**Reformated remittanceInfo:**

Original:

```
"remittanceInfo": "01Auszahlung                         \n02Commerzbank 00102434/Eisenbahnstraß\n032019-09-23T12:56:40 KFN 1  VJ 1315 ",
```

Reformated:

```
remittanceInfo: [
  'Auszahlung                         ',
  'Commerzbank 00102434/Eisenbahnstraß',
  '2020-03-02T11:26:15 KFN 1  VJ 1315 '
],
```

## Usage

### Install 
Either clone this repository and run `npm install` or install it with `npm install comdirect`.

## Environment variables

```sh
export CLIENT_ID=User_A1234B567D901012E0XXXXXXXXXXXXXX
export CLIENT_SECRET=ABDBASDBASB12361741623ABACBD
export PERSISTENCE=1 # optionally save refresh token, etc. to file, otherwise everything is only in the memory
export CREDENTIALS_FILE_PATH='.credentials' # defaults to '$PWD/.credentials', only usefull when PERSISTENCE=1
export DEBUG=1 # print all HTTP requests (url, status code, body)
```

### API

```js
{start, createServer} = require('comdirect')
highLevel = require('comdirect/high-level')
lowLevel = require('comdirect/low-level')
```

##### `comdirect.start(config = {autoRefresh: false, webhook: false, port: 8090})`
Function with an optional config object.  

`autoRefresh`: update the refresh token every 19 minutes  
`webhook`:  if true the authorization starts when you open the URL and do login via a browser.  
`port`: is required to open a URL for the TAN challenge in the browser and the webhook method.  

Returns a promise with the this object:
```json
{
  "access_token": "AAA",
  "refresh_token": "BBB",
  "sessionUUID": "CCC",
  "sessionId": "DDD",
  "requestId": "EEE",
  "accountId": ["FFF", "GGG"]
}
```

##### `comdirect.createServer(config = {autoRefresh: false, webhook: false}, callback)`

Like `comdirect.start` but without starting the server. Instead the function returns a HTTP server
on which you can attach your custom route handlers. You need to start the server manually via `server.listen`
and handle non matching URLs. The callback is called when the authentication is done.  
See the example below for more details. 

##### Other APIs

Coming soon. Please check the source code.


### Example (interactive CLI)

Example with interactive CLI. Follow instructions in the output.  
To scan the TAN challenge you need to use a browser.

```js
const comdirect = require('comdirect')
const {getTransactions} = require('comdirect/low-level')
const {refreshTokenFlowIfNeeded} = require('comdirect/high-level')

;(async function() {
	const result = await comdirect.start({autoRefresh: true, webhook: false})
	const {accountId} = result
	let transactions = await getTransactions(accountId)
	console.log(transactions.values[0]) // show latest transaction

	// wait 30 minutes
	await new Promise((resolve, reject) => setTimeout(resolve, 1000 * 60 * 30))
	// ensure a valid access token
	await refreshTokenFlowIfNeeded()
	transactions = await getTransactions(accountId)
	console.log(transactions.values[0]) // show latest transaction
})()
```

### Example (webhook)

Same as above, but just pass `webhook: true` instead.  

This is esefull when your deployment (and server start) is automated.  
The login and TAN challenge is done via any browser.


### Example (custom server)

You can attach other route handler to the server:

```js
const comdirect = require('comdirect')
const {getTransactions} = require('comdirect/low-level')
const {refreshTokenFlowIfNeeded} = require('comdirect/high-level')

let accountId = null

async function transactionHandler(req, res) {
  if (req.url === '/transactions') {
    try {
      await refreshTokenFlowIfNeeded()
      const transactions = await getTransactions(accountId)
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({payload: transactions}))
    } catch (error) {
      console.error(error)
      res.writeHead(400, {'Content-Type': 'application/json'})
      res.end('check server logs')
    }
  }
}

const PORT = process.env.port || 8088

;(async function() {
  const result = await new Promise((resolve, reject) => {
    const server = comdirect.createServer({autoRefresh: true, webhook: true}, (error, data) => {
      if (error) {
        return reject(error)
      }
      resolve(data)
    })
    server.on('request', transactionHandler)
    server.listen(PORT)
    console.log('listen on', PORT)
  })
  accountId = result.accountId
})()
```

