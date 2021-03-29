export type Fixture = {
    name: string,
    docstring: string | null,
    sourceFile: string,
    sourceLine: number,
};

export type Command = {
    cmd: string,
    args: string[],
};

export const parsePytestOutput = (input: string) => {
    /*
    Parse the output from `pytest --fixtures` for an array of fixtures and their docstrings.
    */
    const fixtures: Fixture[] = [];
    let docstring = "";
    let fixture: Fixture = {} as Fixture;

    for (let line of input.split("\n")) {
        const trimmedLine = line.replace(/^\s+|\s+$/g, "");
        if (trimmedLine === "") {
            // Process new line within docstring or between fixtures
            if (docstring.length > 0) {
                docstring += "\n";
            }
            continue;
        }
        if (line.startsWith("    ")) {
            // process docstring line
            const trimmedLine = line.substring(4);
            if (trimmedLine.indexOf("no docstring") <= 0) {
                if (docstring.length > 0) {
                    docstring += "\n";
                }
                docstring += trimmedLine;
            }
        } else if (/^\w+/.test(line)) {
            // Process line starts with character: should be fixture name
            /*
            tmpdir -- tests/lib/python2.7/site-packages/_pytest/tmpdir.py:172
            */
            const SRC_PATH_SEP = " -- ";
            const SRC_LINENO_SEP = ":";

            const name = line.slice(0, line.indexOf(" "));
            const path = line.slice(line.indexOf(SRC_PATH_SEP) + SRC_PATH_SEP.length, line.indexOf(SRC_LINENO_SEP));
            const lineno = Number(line.slice(line.indexOf(SRC_LINENO_SEP) + SRC_LINENO_SEP.length));

            if (fixture.name && fixture.sourceFile && fixture.sourceLine) {
                // if there's already a previously parsed fixture, push it
                fixture.docstring = docstring.trim() || null;
                fixtures.push(fixture);
                fixture = {} as Fixture;
                docstring = "";
            }
            fixture.name = name;
            fixture.sourceFile = path;
            fixture.sourceLine = lineno;
        } else if (line.startsWith("--") || line.startsWith("==")) {
            // Process sep line
            /*
            -------------- fixtures defined from aa.bb.cc --------------
            =============== no tests ran in 0.01 seconds `===============
            */
            if (fixture.name && fixture.sourceFile && fixture.sourceLine) {
                fixture.docstring = docstring.trim() || null;
                fixtures.push(fixture);
                fixture = {} as Fixture;
                docstring = "";
            }
        }
    }
    if (fixture.name && fixture.sourceFile && fixture.sourceLine) {
        fixture.docstring = docstring.trim() || null;
        fixtures.push(fixture);
    }
    console.log(fixtures);
    return fixtures;
};

export const parseCommand = (value: string | Array<string>) => {
    let command: Command = {} as Command;
    if (typeof value === "string") {
        command.args = value.toString().split(" ");
    } else {
        command.args = [...value];
    }
    command.cmd = command.args.shift() || "";
    return command;
};

export const shouldSuggest = (lineText: string, cursorPosition: number): boolean => {
    // TODO: support suggest to pytest fixture functions
    // TODO: support multiline test function definition
    if (/def test_/.test(lineText)) {
        let lineTillCurrentPosition = lineText.substr(0, cursorPosition);
        if (
            lineTillCurrentPosition.indexOf("(") > -1 &&
            lineTillCurrentPosition.indexOf(")") === -1
        ) {
            return true;
        }
    }
    return false;
};
