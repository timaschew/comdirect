const fs = require('fs')
const path = require('path')
const http = require('http')
const got = require('got')

const {
	loadUserData,
	refreshTokenFlow
} = require('./high-level')

const DEFAULT_PORT = 8089
module.exports = async function(config = {autoRefresh: false, refreshOnStart: false, port: DEFAULT_PORT}) {
	const PORT = process.env.PORT || config.port || DEFAULT_PORT
	const reference = {}

	async function refresh(req, res) {
		try {
			await refreshTokenFlow()
			console.log('refresh token was updated')
			res.writeHead(200, {'Content-Type': 'text/html'})
			res.write('Ok')
			return res.end()
		} catch (error) {
			console.error(error)
			res.writeHead(400, {'Content-Type': 'text/html'})
			res.write(error.toString())
			return res.end()
		}
	}

	function challenge(req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'})
		res.write(`<img src="data:image/png;base64,${reference.challenge}">`)
		res.end()
	}

	http.createServer(function (req, res) {
		if (req.url === '/refresh') {
			return refresh(req, res)
		} else if (req.url === '/challenge') {
			return challenge(req, res)
		} else {
			res.writeHead(404, {'Content-Type': 'text/html'})
			res.write(`Not found`)
			return res.end()
		}
	}).listen(PORT)
	console.log('listen on port', PORT)

	const result = await loadUserData(reference, `http://localhost:${PORT}/challenge`)
	
	if (result.kdnr == null && config.refreshOnStart) {
		// do not for full flow
		got(`http://localhost:${PORT}/refresh`)
	}

	if (config.autoRefresh) {
		setInterval(() => {
			got(`http://localhost:${PORT}/refresh`)
		}, 1000 * 60 * 15)
	}
	return result

}


