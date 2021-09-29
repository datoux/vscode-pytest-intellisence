"use strict";
import * as vscode from "vscode";
import cp = require("child_process");
import {readFileSync} from 'fs';
import { parsePytestOutput, shouldSuggest, parseCommand, Fixture, Command } from "./parse";

export const PYTHON: vscode.DocumentFilter = {
	language: "python",
	scheme: "file"
};

const generateRunOpts = (document: vscode.TextDocument) => {
	const pytestCommandCfg: string | undefined = vscode.workspace.getConfiguration("pytest").get("command");
  	const pythonPathCfg: string | undefined = vscode.workspace.getConfiguration("pytest").get("pythonPath") || "";
	if (!pytestCommandCfg) {
		vscode.window.showErrorMessage(
			"Please set `pytest.command` in your Workspace Settings, then reload to enable IntelliSense for pytest."
		);
		return parseCommand("pytest", "");
	}

  	return parseCommand(pytestCommandCfg, pythonPathCfg);
};

// const fixtureSuggestions = (filepath: string, cmd: string, args: string[]) => {
const fixtureSuggestions = (document: vscode.TextDocument, cmd: string, pythonPath: string, args: string[]) => {
	return new Promise<Fixture[]>((resolve, reject) => {
		const filepath = document.uri.fsPath;

		args = [...args, "--verbose", "--fixtures", "--collect-only", "--continue-on-collection-errors", filepath];
		let p = cp.spawn(cmd, args, {
			cwd: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath,
			env: { ...process.env, PYTHONPATH: pythonPath},
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
			console.log(stderr);
			resolve(parsePytestOutput(stdout));
		});
	});
};

class PytestFixtureCompletionItemProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): vscode.CompletionItem[] {
		let lineText = document.lineAt(position.line).text;
		const testPath = document.uri.fsPath;
		let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }
        let firstLine = editor.document.lineAt(0);
        let lastLine = editor.document.lineAt(editor.document.lineCount - 1);
        let textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
        let fullText = editor.document.getText(textRange);
		if (shouldSuggest(lineText, position.character, fullText)) {
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
		fixtureSuggestions(document, opts.cmd, opts.pythonPath, opts.args).then(fixtures => {
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
		cacheFixtures(vscode.window.activeTextEditor.document, generateRunOpts(vscode.window.activeTextEditor.document));
	}

	// cache fixtures when active window is changed
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				// generate new run opts everytime text editor is active
				cacheFixtures(editor.document, generateRunOpts(editor.document));
			}
		})
	);

	// cache fixtures when saving files
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(document => {
			if (document) {
				// generate new run opts everytime text editor is active
				cacheFixtures(document, generateRunOpts(document));
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