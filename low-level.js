const fs = require('fs')
const path = require('path')
const got = require('got')
const {formatInfo, printProtected} = require('./utils')

const API_BASE = 'https://api.comdirect.de'

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

let storageHandler = null
const agent = got.extend({
	prefixUrl: API_BASE,
	hooks: {
		beforeRequest: [
            options => {
       			const {access_token, sessionId, requestId} = storageHandler.load()
            	if (options.headers['x-http-request-info'] != null) {
	 				options.headers['x-http-request-info'] = JSON.stringify({
			    		clientRequestId: {
			    			sessionId: sessionId,
			    			requestId: requestId
			    		}

            		})
           		}
           		if (options.headers.authorization != null) {
           			options.headers.authorization = `Bearer ${access_token}`
           		}
           		if (options.form && options.form.token) {
           			options.form.token = access_token
           		}
           		if (process.env.DEBUG || false) {
					console.log('headers', printProtected(options.headers), 'body/form', printProtected(options.body) || printProtected(options.form))
				}
           	}
        ],
		afterResponse: [
			(response, rertry) => {
				if (process.env.DEBUG || false) {
					console.log(response.url, response.statusCode, printProtected(response.body))
				}
				if (response.body) {
					if (response.body.refresh_token) {
						storageHandler.save({refresh_token: response.body.refresh_token})
					}
					if (response.body.access_token) {
						storageHandler.save({access_token: response.body.access_token})
					}
				}
				return response
			}
		],
        beforeError: [
            error => {
                const {response} = error
 				if (response && response.body) {
 					error.body = response.body
                }
 				return error
            }
        ]
	}
})

function _setStorageHandler(_storageHandler) {
	storageHandler = _storageHandler
}

async function oAuthInit(username, password) {
	const options = {
		responseType: 'json',
	    'method': 'POST',
	    'url': 'oauth/token',
	    'headers': {
	        'Content-Type': 'application/x-www-form-urlencoded',
	        'Accept': 'application/json'
	    },
	    form: {
	        'client_id': CLIENT_ID,
	        'client_secret': CLIENT_SECRET,
	        'grant_type': 'password',
	        'username': username,
	        'password': password
	  }
	}
	const response = await agent(options)
	return response.body
}

async function getSessionStatus() {
	const options = {
		responseType: 'json',
	    'method': 'GET',
	    'url': 'api/session/clients/user/v1/sessions',
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': 'AUTO-INJECT',
	        'x-http-request-info': 'AUTO-INJECTED',
	        'Content-Type': 'application/json'
	    }
	}
	const response = await agent(options)
	return response.body
}

async function validateSesssionTAN(sessionUUID) {
	const options = {
	    responseType: 'json',
	    'method': 'POST',
	    'url': `api/session/clients/user/v1/sessions/${sessionUUID}/validate`,
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': 'AUTO-INJECT',
	        'x-http-request-info': 'AUTO-INJECTED',
	        'Content-Type': 'application/json'
	    },
	  	body: JSON.stringify({
	  		identifier: sessionUUID,
	  		sessionTanActive: true,
	  		activated2FA: true
	  	})
	}
	const response = await agent(options)
	return response
}

async function activateSesssionTAN(tan, challengeId, sessionUUID) {
	const options = {
		responseType: 'json',
	    'method': 'PATCH',
	    'url': `api/session/clients/user/v1/sessions/${sessionUUID}`,
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': 'AUTO-INJECT',
	        'x-http-request-info': 'AUTO-INJECTED',
	        'Content-Type': 'application/json',
	        'x-once-authentication-info': JSON.stringify({
	        	id: challengeId
	        }),
	        'x-once-authentication': tan
	    },
	    body: JSON.stringify({
	  		identifier: sessionUUID,
	  		sessionTanActive: true,
	  		activated2FA: true
	  	})
	}
	const response = await agent(options)
	return response.body
}

async function oAuthSecondaryFlow() {
	const options = {
		responseType: 'json',
	    'method': 'POST',
	    'url': '/oauth/token',
	    'headers': {
	        'Content-Type': 'application/x-www-form-urlencoded',
	        'Accept': 'application/json'
	    },
	    form: {
	        'client_id': CLIENT_ID,
	        'client_secret': CLIENT_SECRET,
	        'grant_type': 'cd_secondary',
	        'token': 'AUTO-INJECT'
	    }
	}
	const response = await agent(options)
	return response.body
}

async function refreshTokenFlow() {
	const {refresh_token} = storageHandler.load()
	const options = {
	  responseType: 'json',
	  method: 'POST',
	  url: 'oauth/token',
	  headers: {
	    'Content-Type': 'application/x-www-form-urlencoded',
	    'Accept': 'application/json'
	  },
	  form: {
	    'client_id': CLIENT_ID,
	    'client_secret': CLIENT_SECRET,
	    'grant_type': 'refresh_token',
	    'refresh_token': refresh_token
	  }
	}
	const response = await agent(options)
	return response.body
}

async function getAccountBalances() {
	const options = {
	  responseType: 'json',
	  method: 'GET',
	  url: 'api/banking/clients/user/v1/accounts/balances',
	  headers: {
	    'Accept': 'application/json',
	    'Authorization': 'AUTO-INJECT',
	    'x-http-request-info': 'AUTO-INJECTED',
	    'Content-Type': 'application/json'
	  }
	}
	const response = await agent(options)
	return response.body
}

async function getAccountInfo(access_token) {
	const body = await getAccountBalances(access_token)
	return body.values[0].accountId
}

async function getTransactions(accountId) {
	const options = {
	  responseType: 'json',
	  method: 'GET',
	  url: `api/banking/v1/accounts/${accountId}/transactions`,
	  headers: {
	    'Accept': 'application/json',
	    'Authorization': 'AUTO-INJECT',
		'x-http-request-info': 'AUTO-INJECTED',
	    'Content-Type': 'application/json'
	  }
	}
	const response = await agent(options)
  	const values = response.body.values.map(v => {
  		return {
  			...v,
  			remittanceInfo: formatInfo(v.remittanceInfo)
  		}
  	})
  	return {
  		...response.body,
  		values: values
  	}
}

module.exports = {
	oAuthInit,
	getSessionStatus,
	validateSesssionTAN,
	activateSesssionTAN,
	oAuthSecondaryFlow,
	refreshTokenFlow,
	getAccountBalances,
	getAccountInfo,
	getTransactions,
	_setStorageHandler
}