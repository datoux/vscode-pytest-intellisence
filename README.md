# VS Code Pytest IntelliSense

The `vscode-pytest` extension brings additional pytest integration to VSCode. Using the output from `pytest --fixtures`, it teaches VS Code where the fixtures are defined, and what are the available fixtures.

This work is inspired and derived from [cameronmaske/pytest-vscode](https://github.com/cameronmaske/pytest-vscode)

## Configuration

This extension honors the `python.testing.pytestPath` and `python.pythonPath` from core Python extension.
If `python.testing.pytestPath` is set, it'll leverage that command to perform pytest fixture collection; otherwise use `python.pythonPath` + `-m pytest`.

## Release Notes

See [CHANGELOG](CHANGELOG.md)

### License

`vscode-pytest` is available under [MIT license](LICENSE).
