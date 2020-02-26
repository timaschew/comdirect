const fs = require('fs')
const path = require('path')
const http = require('http')

const {
	loadUserData,
	refreshTokenFlow
} = require('./high-level')

const utils = require('./utils')

const MINUTES_15 = 1000 * 60 * 15
const DEFAULT_PORT = 8089

module.exports = function(config = {autoRefresh: false, webhook: false, port: DEFAULT_PORT}) {
	return new Promise(async function(mainResolve, mainReject) {
		if (config.autoRefresh == null) config.autoRefresh = false
		if (config.webhook == null) config.webhook = false
		if (config.port == null) config.port = process.env.PORT || DEFAULT_PORT
		const reference = {}
		let refresh_token = null
		let tanHandlerResolve = null
		const baseUrl = `http://localhost:${config.port}`
		function htmlTemplate(title, body) {
			return `<!DOCTYPE html>
				<html>
				    <head>
				        <meta name="viewport" content="width=device-width, initial-scale=1">
				        <meta charset="UTF-8">
				        <title>comdirect ${title}</title>
				        <style>
					  		input, button {
					  			font-size: 1em;
					  		}
				  		</style>
				    </head>
				    <body>
				  		${body}
				    </body>
				    <script>
						function send() {
							const value = document.querySelector('input').value
							window.location.href = '/tan/' + value
						}
						function login() {
							const username = document.querySelector('input[type=number]').value
							const password = document.querySelector('input[type=password]').value
							fetch('${baseUrl}/login', {
							    method: 'POST',
							    headers: {'Content-Type':'application/json'},
							    body: JSON.stringify({username: username, password: password})
							}).then(() => {
								setTimeout(() => {
									window.location.href = '/challenge'
								}, 1000 * 2)
							}).catch(error => {
								console.error(error)
								alert(error.toString())
							})
						}
					</script>
				</html>`
		}

		http.createServer(async function(req, res) {
			if (req.url === '/challenge') {
				res.writeHead(200, {'Content-Type': 'text/html'})
				let form = ''
				if (config.webhook === true) {
					form = `<br><input type="number"> <button onClick="send()">Send</button>`
				}
				const html = htmlTemplate('TAN challenge', 
					`<img src="data:image/png;base64,${reference.challenge}">${form}`
				)
				res.end(html)
			} else if (req.url === '/') {
				res.writeHead(200, {'Content-Type': 'text/html'})
				res.write(htmlTemplate('Login', `
					<input placeholder="Username" type="number"><br>
					<input placeholder="Password" type="password"><br>
					<button onClick="login()">Login</button>`))
				res.end()
			} else if (req.url === '/login') {
				let body = ''
			    req.on('data', function(data) {
			        body += data
			    })
			    req.on('end', function() {
					const {username, password} = JSON.parse(body)
					loadUserData(reference, `${baseUrl}/challenge`, function() {
						return Promise.resolve(username)
					}, function() {
						res.writeHead(200, {'Content-Type': 'text/html'})
						res.end('') // this will redirec the user to the challenge URL
						return Promise.resolve(password)
					}, function() {
						return new Promise((resolve, reject) => {
							tanHandlerResolve = resolve
						})
					})
					.then(data => {
						console.log('authentication was successful')
						if (config.autoRefresh) {
							setInterval(triggerTokenRefresh, MINUTES_15)
						}
						mainResolve(data)
					})
					.catch(mainReject)
			    })
			} else if (req.url.indexOf('/tan') === 0) {
				const [x, y, tan] = req.url.split('/')
				res.writeHead(200, {'Content-Type': 'text/html'})
				res.end(htmlTemplate('TAN', 'Please check the server log.'))
				tanHandlerResolve(tan)
				
			} else {
				res.writeHead(404, {'Content-Type': 'text/html'})
				return res.end('Not found')
			}
		}).listen(config.port)
		console.log('listen on port', config.port)

		let result = null
		if (config.webhook === false) {
			result = await loadUserData(reference, `${baseUrl}/challenge`, function() {
				return utils.getInput('Zugangsnummer/Username: ')
			}, function() {
				return utils.getInput('PIN/Password: ', true)
			}, function() {
				return utils.getInput('TAN: ')
			})
			if (config.autoRefresh) {
				setInterval(triggerTokenRefresh, MINUTES_15)
			}
			return mainResolve(result)
		} else {
			result = await loadUserData()
			if (result == null) {
				console.log(`waiting for webhook, login via on: ${baseUrl}`)
			} else {
				if (config.autoRefresh) {
					setInterval(triggerTokenRefresh, MINUTES_15)
				}
				return mainResolve(result)
			}
		}
	})
}

function triggerTokenRefresh() {
	console.log('updating refresh token')
	refreshTokenFlow().then(console.log).catch(error => {
		console.error(error)
		console.log('Stopping server and application')
		process.exit(1)
	})
}

