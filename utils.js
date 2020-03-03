const readline = require('readline')

function guid() {
    function _p8(s) {
        const p = (Math.random().toString(16) + '000000000').substr(2, 8)
        return s ? '-' + p.substr(0, 4) + '-' + p.substr(4, 4) : p 
    }
    return _p8() + _p8(true) + _p8(true) + _p8()
}

function requestId() {
	const now = Date.now().toString()
	return now.substring(now.length - 9, now.length)
}

async function getInput(question, hide = false) {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({
		    input: process.stdin,
		    output: process.stdout
		})

		if (hide) {
			rl.input.on('keypress', function (x, y) {
				const length = rl.line.length
				readline.moveCursor(rl.output, -length, 0)
				readline.clearLine(rl.output, 1)
				for (let i = 0; i < length; i++) {
				  rl.output.write('*')
				}
			})
		}

		rl.question(question, function(input) {
		    rl.close()
		    resolve(input)
		})
	})
}

function chunkString(size) {
    return (chunk) => {
        let result = [];
        let chars = String(chunk).split('')

        for(let i = 0; i < (String(chunk).length / size); i++) {
            result = result.concat(chars.slice(i * size, (i + 1) * size).join(''))
        }
        return result
    }
}

function formatInfo(info) {
	if (info.indexOf('01') === 0) {
		return chunkString(37)(info).map(s => s.substr(2))
	} else {
		return chunkString(35)(info)
	}
}

function printProtected(input) {
	if (input == null) {
		return input
	}
	let stringifyOutput = false
	let output = {...input}
	if (typeof input == 'string') {
		try {
			output = JSON.parse(input)
			stringifyOutput = true
		} catch (error) {}
	}
	try {
		if (input.password) {
			output.password = input.password.replace(/\w/g, '*')
		}
		if (input.client_secret) {
			output.client_secret = input.client_secret.replace(/\w/g, '*')
		}
		if (input.access_token) {
			output.access_token = input.access_token.replace(/\w/g, '*')
		}
		if (input.token) {
			output.token = input.token.replace(/\w/g, '*')
		}
		if (input.refresh_token) {
			output.refresh_token = input.refresh_token.replace(/\w/g, '*')
		}
		if (input.authorization) {
			output.authorization = input.authorization.replace(/\d/g, '*') // only numbers
		}
	} catch (error) {
		console.error(error)
	}
	if (stringifyOutput) {
		return JSON.stringify(output)
	}
	return output
}

module.exports = {
	guid,
	requestId,
	getInput,
	formatInfo,
	printProtected
}