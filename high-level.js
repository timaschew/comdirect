const fs = require('fs')

const CREDENTIALS_FILE_PATH = process.env.CREDENTIALS_FILE_PATH || '.credentials'

const {
	oAuthInit,
	getSessionStatus,
	validateSesssionTAN,
	activateSesssionTAN,
	oAuthSecondaryFlow,
	refreshTokenFlow,
	getAccountInfo
} = require('./low-level')

const utils = require('./utils')

let memory = {}
const persistence = process.env.PERSISTENCE
const DEBUG = process.env.DEBUG || false

function load() {
	if (persistence) {
		return JSON.parse(fs.readFileSync(CREDENTIALS_FILE_PATH, 'utf8'))
	}
	return memory
}

function save(object) {
	const credentials = load()
	const patched = Object.assign({}, credentials, object)
	if (persistence) {
		fs.writeFileSync(CREDENTIALS_FILE_PATH, JSON.stringify(patched, null, 2), 'utf8')
	} else {
		memory = patched
	}
}

async function loadUserData(reference, challengeUrl) {
	const data = await getValidCredentials(reference, challengeUrl)
	if (data.accountId == null) {
		const accountId = await getAccountInfo(data.access_token, data.requestId, data.requestId)
		save({accountId})
		return load()
	}
	return data
}

async function getValidCredentials(reference, challengeUrl) {
	const data = load()
	try {
		const accountId = await getAccountInfo(data.access_token, data.sessionId, data.requestId)
		if (accountId != null) {
			save({accountId})
			return load()
		}
	} catch (error) {
		// ignore
	}
	try {
		if (data.refresh_token != null) {
			const response = await refreshTokenFlow(data.refresh_token)
			save({access_token: response.access_token, refresh_token: response.refresh_token})
			return load()
		}
	} catch (error) {
		// ignore
	}
	return await runOAuthFlow(reference, challengeUrl)
}

async function runOAuthFlow(reference, challengeUrl) {
	// if both above are expired, do full flow:
	const username = await utils.getInput('Zugangsnummer/Username: ')
	const pin = await utils.getInput('PIN/Password: ', true)
	const oAuthResponse = await oAuthInit(username, pin)
	save({access_token: oAuthResponse.access_token, refresh_token: oAuthResponse.refresh_token})
	const sessionId =  utils.guid()
	const requestId = utils.requestId()
	const sessionStatus = await getSessionStatus(oAuthResponse.access_token, sessionId, requestId) 
	save({sessionUUID: sessionStatus[0].identifier, sessionId, requestId})
	const validationResponse = await validateSesssionTAN(sessionStatus[0].identifier, oAuthResponse.access_token, sessionId, requestId)
	if (validationResponse.headers['x-once-authentication-info'] != null) {
		const header = JSON.parse(validationResponse.headers['x-once-authentication-info'])
		if (DEBUG) console.log('x-once-authentication-info', header)
		if (header.id != null && header.typ == 'P_TAN' && header.challenge != null) {
			reference.challenge = header.challenge
			console.log(`Please solve the photoTAN with your browser: ${challengeUrl}`)
			const tan = await utils.getInput('TAN: ')
			const activatedSession = await activateSesssionTAN(tan, header.id, sessionStatus[0].identifier, oAuthResponse.access_token, sessionId, requestId)
			save({sessionUUID: activatedSession.identifier}) // TOOD: is this really needed? identifier is not changing usually
			if (activatedSession.sessionTanActive === true) {
				const finalRespone = await oAuthSecondaryFlow(oAuthResponse.access_token)
				save({access_token: finalRespone.access_token, refresh_token: finalRespone.refresh_token})
				return load()
			} else {
				throw new Error('photoTAN was not successful')
			}
		}
	}
	throw new Error('photoTAN not possible')
}

module.exports = {
	loadUserData,
	getValidCredentials,
	refreshTokenFlow,
	load,
	save
}

