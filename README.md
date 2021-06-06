# VS Code Pytest IntelliSense

The `vscode-pytest-intellisence` extension brings additional pytest integration to VSCode. Using the output from `pytest --fixtures`, it teaches VS Code where the fixtures are defined, and what are the available fixtures.

This work is inspired and derived from [reverbc/vscode-pytest](https://github.com/reverbc/vscode-pytest)

## Configuration

The addon requires you to set your pytest command
(behind the scenes, the addon runs `pytest /path/to/test_file --fixtures` to get a list of fixtures)

If you are using a virtual environment, when inside of it, you can find the fully fledged path to pytest by running `which pytest`.

```bash
$ which pytest
/Users/datoux/.virtualenvs/demo-mLN-1lcH/bin/pytest
```

Then set `pytest.command` appropriately in your workspace settings.

```json
{
  "pytest.command": "/Users/datoux/.virtualenvs/demo-mLN-1lcH/bin/pytest"
}
```

The additional parameter `pytest.pythonPath` adds additional python paths into PYTHONPATH for pytest 
to find all necessary python packages.

## Release Notes

See [CHANGELOG](CHANGELOG.md)

### License

`vscode-pytest-intellisence` is available under [MIT license](LICENSE).
