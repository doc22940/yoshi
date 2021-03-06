# Contributing to Yoshi

Hey! Thanks for your interest in improving our Toolkit!

Please take a moment to review this document in order to make the contribution process easy and effective for everyone involved.

## Submitting an Issue

Please provide us with an issue in case you've found a bug, want a new feature, have an awesome idea, or there is something you want to discuss.

## Submitting a Pull Request

Good pull requests, such as patches, improvements, and new features, are a fantastic help. They should remain focused in scope and avoid containing unrelated commits.

Please **ask first** if somebody else is already working on this or the core developers think your feature is in-scope. Generally always have a related issue with discussions for whatever you are including.

## Local Setup

1.  Clone the repo `git clone git@github.com:wix/yoshi.git`.
2.  Run `yarn` in the yoshi monorepo root.
3.  Run `yarn watch` to continuously transpile files with TypeScript.

That's it, you're good to go.

## Adding a New Feature to the Yoshi Toolkit

1.  Make sure the feature is tested.
2.  Document it in [README.md](https://github.com/wix/yoshi/blob/master/README.md)

## Lint

`yarn lint` - Run [eslint](https://eslint.org/) on all packages with the following [rules](https://github.com/wix/yoshi/blob/master/.eslintrc).

## Test types

### Integration tests

Test each feature on a dedicated installed project.

How it works:

1. We copy [base fixture template](./test/fixtures/typescript/base-template/package.json) to `.tmp` folder (file which are needed in most tests, like `package.json`)
2. Copy test feature folder to the same destination, overriding existing files.
3. Run the test using puppeteer, against the installed project. This will test how the feature works for the user's production code.
4. Most tests run:
   - `prod` or `dev` in order to simulate local and production environments.
   - a `test` command, testing how user's own tests run, in the installed project. This one basically tests out `jest-yoshi-preset`

Command:

`npx jest` - Run all integration tests (not recommended locally). Please see below how to run those localy.

### Unit tests

Isolated unit tests for each Yoshi package

Command:

`yarn test:unit`

### Template tests

Create a `create-yoshi-app`'s template, and then run install, build and test.

Command:

`yarn test:{templateName}`

### Legacy integration tests

** Legacy **

Create a few complex projects that cover a lot of different edge-cases, build, run, and test that everything is working. (These tests are legacy. New features should be written in the previous integration tests)

Command:

`yarn test:legacy:{commandName|other}`

## Running Integration Tests Locally

We have several status checks for integration tests, in order to parallelize them in CI. Locally, we usually run the specific feature relevant for us. You can filter it using jest (awesome) filtering capabilities. For example:

```
npx jest css-inclution
```

or

```
npx jest typescript/features/loaders/css/css-inclusion/css-inclusion.test.js
```

You can also filter a specific test:

```
npx jest moment -t='exclude locales imported from moment'
```

#### Debugging a test locally:

Add a `DEBUG=true` before the command, for example:

```
DEBUG=true npx jest css-inclution
```

This will open the browser and produce verbose logs.

The tests will run under `.tmp` folder and can be debugged easily. For example:

```
> .tmp/javascript/features/css-inclution >> npm start
```

```
> .tmp/javascript/features/css-inclution >> npm test
```

```
> .tmp/javascript/features/css-inclution >> npm build
```

## Running Legacy Integration Tests Locally

** Legacy **

Yoshi's test suite, in its current state, takes a long time to complete and (unfortunately) contains flaky tests. Therefore, we advise limiting the scope of the test execution in your local environment to the tests that are most affected by your changes. Limit the scope using [mocha's `only` function](https://mochajs.org/#exclusive-tests).

After the limited scope of tests passes locally you can push your changes and have the `Pull Request CI Server` build and run all of the tests as the test suite is much less flaky on the [CI server](http://pullrequest-tc.dev.wixpress.com/viewType.html?buildTypeId=FedInfra_Yoshi).

#### Test Phases

In order to simplify Yoshi's tests we created a helper utility called [`test-phases`](https://github.com/wix/yoshi/blob/master/test/helpers/test-phases.js). This utility is in charge of setting up the environment for the test (`package.json`, `pom.xml`, source files, etc) in a temp directory, running Yoshi's commands (`start`, `build`, `lint`, etc) and asserting against the result (stdout, file content, exit code, etc).
You can see an example usage of `test-phases` [here](https://github.com/wix/yoshi/blob/master/packages/yoshi/test/lint.spec.js).

#### Debugging Tests

You might run into an issue where you have a test that seems to run and then hang (neither fail nor pass).
This usually means that there was an error but you can't see it.
The reason behind this is that Yoshi mutes the output of all the tests by default in order not to spam the build log in the CI. In order to see the output of the tests, and see the error they threw, you can do one of the two:

```js
it("should do something", () => {
  const res = test
    .verbose() // <------ add this
    .setup({
      //...
    })
    .execute(/* some task*/);

  expect(/* something */).to.equal(/* something */);
});
```

Alternatively, you can run all your tests (or just the focused ones) with the verbose flag in the following way:

```bash
VERBOSE_TESTS=true npm test
```

This is the same as adding the `.verbose()` method to each and every test.

## Running Template Tests Locally

The E2E suite will create a corresponding E2E test for each template from `projects/create-yoshi-app/templates` directory. It will generate the project in a temporary directory, it will then run `npm install` & `npm test` to verify that it's not failing.

- Verbose mode:

`-v`/`--verbose` output verbose logs, good for debugging

```bash
node ./scripts/runE2E.js --verbose
```

- Focus specific templates using command lines arguments:

Example: will match `client` & `fullstack-typescript` projects

```bash
node ./scripts/runE2E.js client fullstack-typescript
```

> Note: if no arguments supplied, the templates suite will run on all possible templates

## Create Yoshi App

To work on the initializer, first link `create-yoshi-app` so it will be available globally:

```shell
cd packages/create-yoshi-app
npm link
```

### Adding a Template

Create two directories:

- `packages/create-yoshi-app/templates/<template-name>`

- `packages/create-yoshi-app/templates/<template-name>-typescript`

Specify them in the following file:

- `packages/create-yoshi-app/src/projects.js`

It will be added to the templates you can choose when running `create-yoshi-app` and will be tested automatically in the `e2e` suite.

For details about the templating and more see [create-yoshi-app](./packages/create-yoshi-app/README.md)

### Modifying a Template

If you want to modify the content of one of the templates run the following command:

```shell
npm run create-yoshi-app:dev
```

It will create a project in a temp directory. You'll have a watcher that listens to changes from the template and updates the generated project accordingly.

## Release a New Version

> **Note:** Make sure you fetched up-to date tags from remote: `git fetch --tags` and that you pulled all of master's last changes.

Start by heading to the [CHANGELOG.md](https://github.com/wix/yoshi/blob/master/CHANGELOG.md) and insert the version's changes.
For changes to appear in the changelog, the PRs should be tagged [with tags](https://github.com/wix/yoshi/blob/89b2b566bbfe961a14123f8de92cd4af9a4a952a/lerna.json#L10-L15) like `PR: New Feature :rocket:`.

To autogenerate a changelog using last tagged PR's run:

```bash
npm run changelog
```

> **Note:** For first time you'll need to [export a GITHUB_AUTH token](https://github.com/lerna/lerna-changelog#github-token)

> **Note:** In this stage we choose the version bump (`patch`/`minor`), we follow semver.

- New releases can be issued from branch `master`.

- `alpha`/`beta`/`rc` versions should be issued from a branch named `version_${version_name}`.

Now commit the changes - `git commit -m "changelog for v1.2.3"`

```bash
npm run createVersion
```

This command will open an interactive UI for choosing the version, it will bump it in the relevant packages and add a git tag.

> It runs [lerna publish --skip-npm](https://github.com/lerna/lerna#--skip-npm) under the hood

> **Note:** Use the same version as in the changelog.

during the release creation process, it will also generate the website according to the new version.

> Verify to run `yarn` in the `website` directory, which is needed for creating the website locally.
> Now Push the commits and tag to GitHub

```bash
git push origin master/version_* --follow-tags
```

Push your changes including the tags, a [build](http://ci.dev.wix/viewType.html?buildTypeId=Wix_Angular_WixHaste_HastePresetYoshi) will run in the CI, and after a successful build `wix-ci-publisher` will publish the relevant packages to npm.
