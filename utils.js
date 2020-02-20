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


module.exports = {
	guid,
	requestId,
	getInput
}