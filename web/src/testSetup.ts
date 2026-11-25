// the tests never reach a network: a page that loads a data file without its own stub gets a plain 404
// answer instead of a refused connection, so a test run stays quiet
globalThis.fetch = async () => new Response("", { status: 404 });
