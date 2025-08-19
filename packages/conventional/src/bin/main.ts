const [command = ""] = process.argv.splice(2, 1);
switch (command) {
	case "commit-msg": {
		await import("./commit-msg.js");
		break;
	}
	default: {
		console.error(`⛔ unknown command ${command}`);
	}
}
