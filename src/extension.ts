"use strict";
import * as vscode from "vscode";
import cp = require("child_process");
import {readFileSync} from 'fs';
import { parsePytestOutput, shouldSuggest, parseCommand, Fixture, Command } from "./parse";

export const PYTHON: vscode.DocumentFilter = {
	language: "python",
	scheme: "file"
};

const generateRunOpts = () => {
	let pytestPath: string = vscode.workspace.getConfiguration("python.testing").get("pytestPath") || "pytest";
	const pythonPath: string = vscode.workspace.getConfiguration("python").get("pythonPath") || "python";

	// if python.testing.pytestPath is the default value (`pytest`), use python.pythonPath + `-m pytest`
	if (pytestPath === "pytest") {
		pytestPath = pythonPath + " -m pytest";
	}

	return parseCommand(pytestPath);
};

// const fixtureSuggestions = (filepath: string, cmd: string, args: string[]) => {
const fixtureSuggestions = (document: vscode.TextDocument, cmd: string, args: string[]) => {
	return new Promise<Fixture[]>((resolve, reject) => {
		const filepath = document.uri.fsPath;

		args = [...args, "--verbose", "--fixtures", "--collect-only", filepath];
		let p = cp.spawn(cmd, args, {
			cwd: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath,
			shell: true,
		});

		console.log(`${vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath}$ ${cmd} ${args.join(" ")}`);
		let stdout = "";
		let stderr = "";

		p.stdout.on("data", data => {
			stdout += data;
		});
		p.stderr.on("data", data => {
			stderr += data;
		});
		p.on("error", err => {
			// TODO: Error handling
			console.log(err);
			console.log(stderr);
			reject();
		});
		p.on("close", code => {
			resolve(parsePytestOutput(stdout));
		});
	});
};

class PytestFixtureCompletionItemProvider implements vscode.CompletionItemProvider {
	opts: Command;

	constructor() {
		this.opts = generateRunOpts();
	}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): vscode.CompletionItem[] {
		let lineText = document.lineAt(position.line).text;
		const testPath = document.uri.fsPath;
		if (shouldSuggest(lineText, position.character)) {
			if (FIXTURE_CACHE[testPath]) {
				const completions = FIXTURE_CACHE[testPath].map((fixture: Fixture) => {
					let item = new vscode.CompletionItem(
						fixture.name,
						vscode.CompletionItemKind.Variable
					);
					if (fixture.docstring) {
						item.documentation = new vscode.MarkdownString(fixture.docstring);
					}
					return item;
				});
				return completions;
			}
		}
		return [];
	}
}

const FIXTURE_CACHE: { [filePath: string]: Fixture[] } = {};

const cacheFixtures = (document: vscode.TextDocument, opts: Command) => {
	if (document.languageId === PYTHON.language) {
		fixtureSuggestions(document, opts.cmd, opts.args).then(fixtures => {
			console.log(`Found ${fixtures.length} fixtures for ${vscode.workspace.asRelativePath(document.fileName)}`);
			FIXTURE_CACHE[document.uri.fsPath] = fixtures;
		});
	}
};

class PytestFixtureDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Thenable<vscode.Definition> {
		return new Promise((resolve, reject) =>{
			const filePath = document.uri.fsPath;
			const range = document.getWordRangeAtPosition(position);
			const selectedWord = document.getText(range);
			let definitions:vscode.Definition = [];

			for (var fixture of FIXTURE_CACHE[filePath]) {
				if (fixture.name === selectedWord) {
					const fixtureModuleUri = vscode.Uri.joinPath(
						vscode.workspace.getWorkspaceFolder(document.uri)?.uri || vscode.Uri.file(""),
						fixture.sourceFile,
					);
					const fixtureModule = readFileSync(fixtureModuleUri.fsPath, {encoding: "utf8"});
					const fixturePos = fixtureModule.split("\n")[fixture.sourceLine - 1].indexOf(fixture.name);

					console.log(`Pushing definition ${fixture.name} at ${fixture.sourceFile}:${fixture.sourceLine}:${fixturePos}`);
					definitions.push({
						uri: fixtureModuleUri,
						range: new vscode.Range(
							fixture.sourceLine - 1,
							fixturePos,
							fixture.sourceLine - 1,
							fixturePos + fixture.name.length,
						),
					});
				}
			}
			resolve(definitions);
		});
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// cache fixtures when there's an active text editor when the plugin is activated
	if (vscode.window.activeTextEditor) {
		cacheFixtures(vscode.window.activeTextEditor.document, generateRunOpts());
	}

	// cache fixtures when active window is changed
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				// generate new run opts everytime text editor is active
				cacheFixtures(editor.document, generateRunOpts());
			}
		})
	);

	// cache fixtures when saving files
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			if (document) {
				// generate new run opts everytime text editor is active
				cacheFixtures(document, generateRunOpts());
			}
		})
	);

	// subscribing CompletionItemProvider to add discovered Pytest Fixtures into autocompletion suggestion
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			PYTHON,
			new PytestFixtureCompletionItemProvider()
		)
	);

	// subscribing DefinitionProvider to add discovered Pytest Fixtures into Go To Definition suggestion
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider(
        	PYTHON,
			new PytestFixtureDefinitionProvider()
		)
	);
}

// this method is called when your extension is deactivated
export function deactivate() { }
