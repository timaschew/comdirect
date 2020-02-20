const fs = require('fs')
const path = require('path')

const API_BASE = 'https://api.comdirect.de/'

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

const DEBUG = process.env.DEBUG || false

const got = require('got')
const agent = got.extend({
	prefixUrl: API_BASE,
	hooks: {
		afterResponse: [
			(response, rertry) => {
				if (DEBUG) {
					console.log(response.url, response.statusCode, response.body)
				}
				// No changes otherwise
				return response
			}
		]
	}
})

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

async function getSessionStatus(access_token, sessionId, requestId) {
	const options = {
		responseType: 'json',
	    'method': 'GET',
	    'url': 'api/session/clients/user/v1/sessions',
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': `Bearer ${access_token}`,
	        'x-http-request-info': JSON.stringify({
		    	clientRequestId: {
		    		sessionId: sessionId,
		    		requestId: requestId
		    	}
		    }),
	        'Content-Type': 'application/json'
	    }
	}
	const response = await agent(options)
	return response.body
}

async function validateSesssionTAN(sessionUUID, access_token, sessionId, requestId) {
	const options = {
	    responseType: 'json',
	    'method': 'POST',
	    'url': `api/session/clients/user/v1/sessions/${sessionUUID}/validate`,
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': `Bearer ${access_token}`,
	        'x-http-request-info': JSON.stringify({
		    	clientRequestId: {
		    		sessionId: sessionId,
		    		requestId: requestId
		    	}
		    }),
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

async function activateSesssionTAN(tan, challengeId, sessionUUID, access_token, sessionId, requestId) {
	const options = {
		responseType: 'json',
	    'method': 'PATCH',
	    'url': `api/session/clients/user/v1/sessions/${sessionUUID}`,
	    'headers': {
	        'Accept': 'application/json',
	        'Authorization': `Bearer ${access_token}`,
	        'x-http-request-info': JSON.stringify({
		    	clientRequestId: {
		    		sessionId: sessionId,
		    		requestId: requestId
		    	}
		    }),
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

async function oAuthSecondaryFlow(access_token) {
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
	        'token': access_token
	    }
	}
	const response = await agent(options)
	return response.body
}

async function refreshTokenFlow(refreshToken) {
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
	    'refresh_token': refreshToken
	  }
	}
	const response = await agent(options)
	return response.body
}

async function getAccountBalances(access_token, sessionId, requestId) {
	const options = {
	  responseType: 'json',
	  method: 'GET',
	  url: 'api/banking/clients/user/v1/accounts/balances',
	  headers: {
	    'Accept': 'application/json',
	    'Authorization': `Bearer ${access_token}`,
	    'x-http-request-info': JSON.stringify({
	    	clientRequestId: {
	    		sessionId: sessionId,
	    		requestId: requestId
	    	}
	    }),
	    'Content-Type': 'application/json'
	  }
	}
	const response = await agent(options)
	return response.body
}

async function getAccountInfo(access_token, sessionId, requestId) {
	const body = await getAccountBalances(access_token, sessionId, requestId)
	return body.values[0].accountId
}

async function getTransactions(access_token, accountId, sessionId, requestId) {
	const options = {
	  responseType: 'json',
	  method: 'GET',
	  url: `api/banking/v1/accounts/${accountId}/transactions`,
	  headers: {
	    'Accept': 'application/json',
	    'Authorization': `Bearer ${access_token}`,
		'x-http-request-info': JSON.stringify({
	    	clientRequestId: {
	    		sessionId: sessionId,
	    		requestId: requestId
	    	}
	    }),
	    'Content-Type': 'application/json'
	  }
	}
	const response = await agent(options)
  	return response.body
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
	getTransactions
}